/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/xss/svg-upload && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/xss/svg-upload && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3008        ← Attacker dashboard — download payload.svg here
 * 2. http://localhost:3007        ← ConnectHub — upload payload.svg as your profile photo
 * 3. Your profile appears in the community grid with a teal colored avatar
 * 4. Open the profile modal → click "View Full Photo"
 * 5. Raw SVG opens in new tab → script fires → cookie stolen
 * 6. Cookie appears on attacker dashboard at http://localhost:3008
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = 3007;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

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

// ⚠️ VULNERABLE — HttpOnly omitted. JavaScript inside a served SVG can read
//    member_session via document.cookie when the file opens as a top-level document.
app.use((req, res, next) => {
  if (!req.headers.cookie || !req.headers.cookie.includes('member_session=')) {
    res.setHeader(
      'Set-Cookie',
      'member_session=MemberSarah_t0k3n_DEF012; Path=/'
    );
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

// ⚠️ VULNERABLE — no file type restriction. SVG is XML that can contain inline
//    <script> tags, bypassing image-type checks. Scripts run when the SVG URL is
//    opened directly (not when embedded in <img>, which sandboxes script execution).
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
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

app.post('/api/upload', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // ⚠️ VULNERABLE — file content not inspected. SVG with <script> stored and served
  //    as-is at /uploads/<filename> with no Content-Disposition or CSP headers.
  const username = req.body.username || 'Alex Rivera';
  const bio =
    req.body.bio ||
    'Growth marketer at a Series B startup. Always happy to connect with founders and PMs.';

  const profile = {
    id: String(Date.now()),
    username,
    bio,
    avatarUrl: '/uploads/' + req.file.filename,
    uploadedAt: new Date().toISOString(),
  };

  profiles.unshift(profile);
  res.status(201).json(profile);
});

// ⚠️ VULNERABLE — express.static serves uploads with no Content-Disposition or CSP.
//    Browser opens .svg as a full XML document in the same origin — scripts execute.
app.use('/uploads', express.static(UPLOADS_DIR));

app.listen(PORT, () => {
  console.log(`ConnectHub victim server running on http://localhost:${PORT}`);
  console.log(`Upload endpoint: POST /api/upload (field name: avatar)`);
  console.log(`Vulnerable file serving: GET /uploads/<filename>`);
});
