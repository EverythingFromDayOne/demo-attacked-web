# Cursor Prompt — SVG Upload XSS Demo: Social Profile Platform

## Context

This is the third demo in the XSS series. It demonstrates a class of vulnerability
that is fundamentally different from Stored and Reflected XSS:

- Stored XSS: payload injected via innerHTML in the browser
- Reflected XSS: payload injected by the server into an HTML response
- SVG Upload XSS: the frontend code is 100% clean, the server code is 100% clean,
  the vulnerability is in the FILE-SERVING POLICY. The server accepts SVG uploads and
  serves them back directly under its own domain. An SVG opened as a standalone document
  is a full XML+JavaScript runtime — same-origin as the server that served it.

This attack pattern has been documented in CVEs against GitHub (profile avatar upload),
GitLab, Confluence, Jira, and dozens of platforms that allowed SVG uploads without
Content-Disposition or CSP headers on the served files.

All intentional vulnerabilities must be marked with `// ⚠️ VULNERABILITY:` comments.
All fixes must be in `// ✅ FIX:` comments directly below.
No TypeScript. Plain JS, CommonJS. No build step. Inline CSS only.

---

## Real-World Scenario

**Target:** ConnectHub — a professional networking platform (think LinkedIn-lite).
**Victim:** "Sarah Chen", a logged-in user browsing other members' profiles.
**Attacker:** A threat actor who registered an account and discovered the avatar
upload accepts SVG files and serves them with no restrictions.

**Attack chain:**
1. Attacker crafts a malicious SVG file containing an embedded `<script>` tag.
2. Attacker uploads it as their ConnectHub profile avatar via the normal upload form.
3. Server stores the file in `/uploads/` and serves it statically — no Content-Disposition,
   no CSP header on the response.
4. Attacker's profile appears on ConnectHub. Their avatar shows as a normal (or broken)
   image in the community grid — the `<img>` tag sandboxes SVG scripts, so nothing fires yet.
5. Sarah browses ConnectHub, sees the attacker's profile card. She clicks "View Profile"
   to learn more about this person.
6. The profile detail page shows the avatar larger and has a "View Photo" link that opens
   the raw SVG URL directly: `http://localhost:3005/uploads/<filename>.svg`
7. The browser opens the SVG as a standalone document. Same origin as localhost:3005.
   The `<script>` inside the SVG fires. Sarah's session cookie is silently exfiltrated.
8. Sarah's browser shows what looks like a blank image or a colored shape. Nothing suspicious.

**The critical lesson:** ConnectHub's HTML files contain zero `innerHTML`, zero reflected
params. The frontend developer did everything right. The hole is that the server treats
the uploads/ directory as a generic static file host with no policy enforcement.

---

## File Structure

All files inside `demo-attacked/xss/svg-upload/`:

```
svg-upload/
  victim-server.js      — ConnectHub backend (port 3005)
  attacker-server.js    — Cookie collector (port 3006)
  victim.html           — ConnectHub community page (clean code)
  attacker.html         — SVG payload generator + cookie collector dashboard
  package.json          — dependencies: express, cors, multer
  uploads/              — directory created by server on startup (mkdir if not exists)
```

Ports 3005 and 3006 allow all three XSS demos to run simultaneously.

---

## File 1: `victim-server.js` (port 3005)

**Cookie setup:**
On every request, if `member_session` cookie is not set, set:
`member_session=MemberSarah_t0k3n_DEF012; Path=/`
No HttpOnly. Comment: `// ⚠️ VULNERABILITY: HttpOnly omitted — JS can read this cookie`

**Multer setup:**
Use multer with `diskStorage`. Store files in `./uploads/` directory.
File filter: accept ALL file types including `.svg` — do NOT restrict by mimetype or extension.
Comment above the filter:
```
// ⚠️ VULNERABILITY: No file type restriction — SVG files accepted as "images"
// ✅ FIX: Whitelist only safe raster formats: jpg, jpeg, png, gif, webp
//         SVG must never be accepted as a user upload without server-side sanitization
```
Filename: use a timestamp prefix + original filename to avoid collisions.
Max file size: 5MB.

**Routes:**

`GET /` → serves `victim.html`.

`GET /profile/:filename` → serves `victim.html` (SPA-style, client handles routing).

`POST /api/upload` → handles avatar upload via multer.
After successful upload, store the profile in an in-memory array:
`{ id, username, bio, avatarUrl: '/uploads/<filename>', uploadedAt }`
Respond with the created profile object.
NO validation of file content. Comment:
```
// ⚠️ VULNERABILITY: File content not inspected — SVG with <script> stored and served as-is
// ✅ FIX: For SVGs, parse and strip all <script> tags, event handlers (onload, onerror),
//         and javascript: hrefs before saving. Or reject SVGs entirely.
```

`GET /api/profiles` → returns all profiles as JSON array, newest first.
Pre-seed 3 legitimate profiles on startup (no avatars — use null for avatarUrl,
the frontend will show a default avatar placeholder emoji for those).

`GET /uploads/*` → serve the uploads directory statically.
**CRITICAL — THE VULNERABILITY:**
The static middleware serves files with NO additional headers.
It will serve `attacker.svg` with `Content-Type: image/svg+xml` and nothing else.
Comment above the static middleware:
```
// ⚠️ VULNERABILITY: Uploaded files served with no Content-Disposition or CSP header.
//    When a browser opens an SVG URL directly, it renders it as a full XML document
//    with JavaScript execution in the same origin as this server.
// ✅ FIX (Option A): app.use('/uploads', (req, res, next) => {
//      res.setHeader('Content-Disposition', 'attachment');
//      next();
//    })
//    Content-Disposition: attachment forces download — browser never executes the SVG.
// ✅ FIX (Option B): res.setHeader('Content-Security-Policy', "default-src 'none'")
//    Blocks all script execution inside the SVG even when opened as a document.
```

`GET /api/profiles/:id` → returns a single profile by id.

**Startup:**
Create the `uploads/` directory if it does not exist (`fs.mkdirSync`).
Pre-seed 3 profiles with realistic names, bios, null avatarUrl:
  - Priya Sharma, "Product Designer at Fintech startup. Dog lover."
  - Marcus Webb, "Backend engineer. Coffee → code."
  - Yuki Tanaka, "UX researcher. Ask me about usability testing."

Log on startup:
```
ConnectHub victim server running on http://localhost:3005
Upload endpoint: POST /api/upload (field name: avatar)
Vulnerable file serving: GET /uploads/<filename>
```

---

## File 2: `attacker-server.js` (port 3006)

**Routes:**

`GET /steal` → read `req.query.c`, store with timestamp, respond with 1x1 transparent GIF
+ `Cache-Control: no-store`. Log: `[STOLEN] Cookie: <value>`.

`GET /api/stolen` → returns JSON array of stolen cookies, newest first.

`GET /` → serves `attacker.html`.

`GET /payload.svg` → dynamically generates and returns the malicious SVG file.
The SVG must:
- Be valid SVG (viewBox, namespace, a visible element like a colored rectangle or circle)
- Contain a `<script>` tag that exfiltrates `document.cookie` to port 3006 /steal
- Use `encodeURIComponent(document.cookie)` in the payload
- Use the `new Image()` technique (not fetch, to avoid CORS preflight)
- The visible element makes the SVG look like a legitimate image (not blank)
  Use a gradient rectangle in ConnectHub's color scheme (teal/slate) as the visual content.
  This makes the uploaded avatar look like a custom colored avatar — not suspicious.

Set `Content-Type: image/svg+xml` on this response.
The user will download this file and upload it to ConnectHub.

**CORS:** enable for all origins.

---

## File 3: `victim.html` — ConnectHub Community Page

Design: Professional networking site. Clean white/slate color scheme. Deep teal (#1e6b6b)
for header. Fake logo: "ConnectHub 🔗".

**Header:** Logo left, nav: "Home", "Network", "Jobs", "Messages". Right: notification bell,
"Sarah Chen" with avatar initials "SC" (hardcoded, she's the logged-in user). No auth UI needed.

**Yellow demo banner** at very top:
`⚠️ Demo: Sarah's session cookie: <document.cookie dynamically>`

**Two-column layout:**

Left column (30%) — "Your Profile" card:
- Shows Sarah Chen's name, "Member" badge
- Her current avatar (hardcoded default: "SC" initials in a teal circle)
- An "Upload Profile Photo" section with a file input (accept: "image/*,.svg")
- On file select, POST to `/api/upload` via FormData (field name: avatar)
- On success: show "Photo updated!" and reload the profile grid
- Note below the upload button in small text: "Supported: JPG, PNG, GIF, SVG"
  This makes it clear SVG is advertised as supported.

Right column (70%) — "Community Members" grid:
- Fetch `GET /api/profiles` on load and after every upload
- Render each profile as a card: avatar image (or initials fallback), name, bio excerpt,
  "View Profile →" link
- The avatar: `<img src="<avatarUrl>">` — this is the safe, sandboxed display
- For profiles with null avatarUrl: show a gray circle with the first letter of their name

**Profile modal (shown when "View Profile →" is clicked):**
Open an overlay modal showing:
- Large avatar (still via `<img>` tag — still safe)
- Full name, full bio
- Member since date
- A teal button: "🔍 View Full Photo" — this is the trigger
  The button opens the raw `/uploads/<filename>` URL in a new tab
  (`window.open(profile.avatarUrl, '_blank')`)
  Comment in JS:
  ```
  // ⚠️ VULNERABILITY: Opening the raw SVG URL in a new tab renders it as a
  //    standalone document in the same origin. Scripts inside the SVG execute.
  //    The <img> tag above is safe — browsers sandbox SVG scripts inside <img>.
  //    But window.open() removes that sandbox.
  // ✅ FIX: Never provide a direct link to user-uploaded SVG files.
  //         Or ensure the server adds Content-Disposition: attachment so the
  //         browser downloads instead of renders.
  ```
- A "Connect" button (cosmetic, no function)

**IMPORTANT:** victim.html must contain ZERO innerHTML calls with user data.
All profile data rendered with textContent or safe DOM methods.
The only unsafe thing is `window.open(profile.avatarUrl)` with the comment above.
This is intentional to show the hole is NOT in innerHTML — it's in the file serving.

---

## File 4: `attacker.html` — Attack Dashboard

Design: Dark background. Split two-panel layout same as reflected XSS demo.

### Left panel — SVG Payload Generator

Title: "Step 1: Craft the Malicious Avatar"

Show a preview of what the malicious SVG looks like when rendered as an image:
An inline SVG element (the same teal gradient rectangle) displayed in a 120x120 box.
Label: "This is what your avatar will look like — a normal colored image."
This drives home that the malicious SVG is visually indistinguishable from a real image.

Below the preview:
A button "⬇ Download payload.svg" — links to `http://localhost:3006/payload.svg`.

A step-by-step attack instructions panel:
```
Step 1: Download payload.svg above
Step 2: Go to http://localhost:3005 (ConnectHub)
Step 3: Upload payload.svg as your profile photo
Step 4: Your profile appears with a teal avatar — looks normal
Step 5: Wait for victim to open your profile and click "View Full Photo"
Step 6: Their cookie appears on the right →
```

Below that, show the raw SVG source code in a styled `<pre>` block.
Fetch it from `GET /api/stolen` on load? No — fetch the SVG source from
`/payload.svg` and display it. This lets the user read the embedded script.
Label: "SVG Source (what's inside the file you're uploading):"

### Right panel — Cookie Collector

Title: "Step 2: Wait for the Victim"

Identical to previous demos:
- Poll `GET http://localhost:3006/api/stolen` every 1.5 seconds
- "Listening on port 3006..." blinking cursor while empty
- Green flash + captured cookie display when received
- Counter: "Cookies stolen: N"

**Key lesson panel** at bottom of left column, styled as an info box:
```
WHY THE FRONTEND IS NOT TO BLAME

ConnectHub's HTML uses <img> tags — browsers sandbox SVG scripts inside <img>.
Sarah's profile page has no innerHTML, no reflected params. The code is clean.

The hole: the server serves /uploads/ as a static directory with no policy.
When a browser opens an SVG URL directly (not inside <img>), it's treated as
a full document. Scripts run. Same origin applies. Cookies are readable.

The fix is not a frontend change. It's a one-line server header.
```

---

## File 5: `package.json`

Name: `xss-svg-upload-demo`.
Scripts: `"victim": "node victim-server.js"`, `"attacker": "node attacker-server.js"`.
Dependencies: `express`, `cors`, `multer`.

---

## How to Run (comment block at top of both server files)

```
Terminal 1: cd demo-attacked/xss/svg-upload && npm install && npm run victim
Terminal 2: cd demo-attacked/xss/svg-upload && npm run attacker

Attack sequence:
1. http://localhost:3006        ← Attacker dashboard — download payload.svg here
2. http://localhost:3005        ← ConnectHub — upload payload.svg as your avatar
3. Your profile appears in the community grid with a teal colored avatar
4. Open the profile modal → click "View Full Photo"
5. Raw SVG opens in new tab → script fires → cookie stolen
6. Cookie appears on attacker dashboard at http://localhost:3006
```

---

## Code Quality

- Every intentional vulnerability: `// ⚠️ VULNERABILITY:` with precise explanation
- Every fix: `// ✅ FIX:` directly below
- victim.html must demonstrably use safe DOM methods — textContent, createElement, setAttribute
  for all user-provided data. The only exception is window.open(avatarUrl) with its comment.
- The teal gradient rectangle in the SVG must look like a real avatar — not an obviously
  malicious file. A real attacker would make the SVG look exactly like a profile photo.
- No lorem ipsum. All names, bios, and copy must be realistic professional networking language.
- The malicious SVG served from /payload.svg must be a complete, valid SVG document.
