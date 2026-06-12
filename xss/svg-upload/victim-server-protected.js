/*
 * How to Run (protected / fixed version):
 *
 * Terminal 1: cd demo-attacked/xss/svg-upload && npm run victim-protected
 * Terminal 2: cd demo-attacked/xss/svg-upload && npm run attacker
 *
 * Compare with the vulnerable server (npm run victim on port 3007):
 *   http://localhost:3009        ← Protected ConnectHub
 *
 * Fixes applied:
 *   - HttpOnly session cookie (JS cannot read member_session)
 *   - Extension + mimetype whitelist (first line of defense — easily spoofed)
 *   - Magic-byte + content sniffing (rejects SVG/XML renamed as .jpg)
 *   - Sharp re-encoding (destroys polyglot payloads)
 *   - Uploaded files served with Content-Disposition: attachment + CSP
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = 3009;
const UPLOADS_DIR = path.join(__dirname, 'uploads-protected');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const profiles = [
  {
    id: '1',
    username: 'Priya Sharma',
    bio: 'Product Designer at Fintech startup. Dog lover.',
    avatarUrl: null,
    uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    username: 'Marcus Webb',
    bio: 'Backend engineer. Coffee → code.',
    avatarUrl: null,
    uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    username: 'Yuki Tanaka',
    bio: 'UX researcher. Ask me about usability testing.',
    avatarUrl: null,
    uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ✅ FIX: HttpOnly=true — JavaScript cannot access member_session
app.use((req, res, next) => {
  if (!req.headers.cookie || !req.headers.cookie.includes('member_session=')) {
    res.cookie('member_session', 'MemberSarah_t0k3n_DEF012', { path: '/', httpOnly: true });
  }
  next();
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  },
});

// ✅ FIX (layer 1): Extension + mimetype whitelist — blocks honest SVG uploads only.
//    Attackers can rename payload.svg → payload.jpg and spoof Content-Type: image/jpeg.
function rasterOnlyFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, GIF, and WebP images are allowed. SVG is not permitted.'));
  }

  cb(null, true);
}

// ✅ FIX (layer 2): Verify actual file bytes — extension/mimetype alone is not enough.
function matchesMagicBytes(buffer) {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF: GIF8
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;

  return false;
}

function containsExecutableMarkup(buffer) {
  const head = buffer.slice(0, 4096).toString('utf8').toLowerCase();
  return (
    head.includes('<?xml') ||
    head.includes('<svg') ||
    head.includes('<script') ||
    head.includes('javascript:')
  );
}

function validateUploadedFile(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (!matchesMagicBytes(buffer)) {
    return 'File content does not match a real JPG, PNG, GIF, or WebP image (magic bytes check failed).';
  }

  if (containsExecutableMarkup(buffer)) {
    return 'File contains SVG/XML or script markup — rejected even if renamed with a .jpg extension.';
  }

  return null;
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: rasterOnlyFilter,
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'victim.html'));
});

app.get('/profile/:filename', (req, res) => {
  res.sendFile(path.join(__dirname, 'victim.html'));
});

app.get('/api/profiles', (req, res) => {
  const sorted = [...profiles].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );
  res.json(sorted);
});

app.get('/api/profiles/:id', (req, res) => {
  const profile = profiles.find((p) => p.id === req.params.id);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found.' });
  }
  res.json(profile);
});

app.post('/api/upload', function (req, res) {
  upload.single('avatar')(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filePath = path.join(UPLOADS_DIR, req.file.filename);
    const validationError = validateUploadedFile(filePath);

    if (validationError) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: validationError });
    }

    // ✅ FIX (Layer 3 — definitive polyglot killer):
    //    Re-encode through Sharp. Sharp decodes only the pixel data from the input
    //    and writes a brand-new file. All original bytes (EXIF, comments, embedded
    //    scripts, polyglot payloads) are destroyed — the output contains only clean
    //    pixel data in the target format.
    //
    //    A file that passes magic byte checks but contains a script buried in EXIF
    //    or after the image data (polyglot attack) will be neutralised here because
    //    Sharp never copies the original byte stream — it re-renders from pixels.
    //
    //    This is the approach used by GitHub, Twitter, and every major platform
    //    that accepts user image uploads.
    const baseName = req.file.filename.replace(/\.[^.]+$/, '');
    const safeFilename = baseName + '.jpg';
    const outputPath = path.join(UPLOADS_DIR, safeFilename);

    try {
      await sharp(filePath).rotate().jpeg({ quality: 85 }).toFile(outputPath);
      if (filePath !== outputPath) {
        fs.unlinkSync(filePath);
      }
    } catch (reencodeErr) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        error: 'File could not be re-encoded as a safe image. Upload rejected.',
      });
    }

    const username = req.body.username || 'Alex Rivera';
    const bio =
      req.body.bio ||
      'Growth marketer at a Series B startup. Always happy to connect with founders and PMs.';

    const profile = {
      id: String(Date.now()),
      username,
      bio,
      avatarUrl: '/uploads/' + safeFilename,
      uploadedAt: new Date().toISOString(),
    };

    profiles.unshift(profile);
    res.status(201).json(profile);
  });
});

// ✅ FIX (Option A): Content-Disposition: attachment — browser downloads instead of rendering
// ✅ FIX (Option B): CSP blocks script execution even if a hostile file were opened as a document
app.use('/uploads', function (req, res, next) {
  res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
}, express.static(UPLOADS_DIR));

app.listen(PORT, () => {
  console.log(`ConnectHub PROTECTED server running on http://localhost:${PORT}`);
  console.log(`Upload endpoint: POST /api/upload (field name: avatar) — Sharp re-encoding enabled`);
  console.log(`Safe file serving: GET /uploads/<filename> (Content-Disposition: attachment)`);
  console.log(`(Compare with vulnerable server on http://localhost:3007)`);
});
