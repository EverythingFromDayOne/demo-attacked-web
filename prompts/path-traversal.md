# Cursor Prompt: Path Traversal Demo — FileVault (Ports 3043–3045)

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attacker server / Attack guide | Clone `DASHBOARD_HTML` from `reverse-tabnabbing/attacker-server.js` — `#0a0a0a` bg, `#00ff41` text, `'Courier New'` font. Copy `<style>` verbatim. |
| Internal / target server | Muted corporate — `#1a1a2e` bg, `#e2e8f0` text |
| Victim servers | Realistic product UI matching their brand |

**Attacker/guide pages — non-negotiable rules:**
- Copy the `<style>` block from `DASHBOARD_HTML` in `reverse-tabnabbing/attacker-server.js` **verbatim**. Never recreate or paraphrase it.
- Body layout: `padding: 2rem` on body. No max-width wrapper div. No centering.
- Panels: use `.flow-box` and `.credentials-panel` classes (defined in that style block). These must be full-width — never add `max-width` to them, not in CSS and not as inline `style` attributes. Only `<p>` text elements may use `max-width` for line-length readability.
- Navigation: **fixed bottom-left `target-switcher` only.** No other open/link buttons anywhere on the page.

---

## Context

**Attack:** Path Traversal (Directory Traversal)
**App name:** FileVault — a private document storage portal
**Tagline:** "Your files, always available"
**Folder:** `demo-attacked/path-traversal/`

FileVault lets authenticated users upload and download their own documents. The download endpoint takes a filename from the query string and serves it from an `uploads/` directory. Because the filename is passed directly to `path.join()` without sanitization, an attacker can use `../` sequences to escape the uploads directory and read any file the Node.js process has access to — including the server's own source code, `package.json`, and on real systems: private keys, `.env` files, and `/etc/passwd`.

**Why it matters:** Path traversal is one of the simplest attacks to execute — it requires only a browser. Any feature that serves files by user-supplied name is a candidate: download endpoints, log viewers, template loaders, file converters. The fix is two lines.

---

## Port Layout

| Port | Role | App |
|------|------|-----|
| 3043 | Vulnerable victim | FileVault (unsanitized path join) |
| 3044 | Attack guide | Path Traversal Lab (hacker terminal) |
| 3045 | Protected victim | FileVault (path containment enforced) |

---

## Port 3043 — Vulnerable FileVault

### File: `path-traversal/victim-server.js`

**Dependencies:** `express ^4.18.2`, `cors ^2.8.5`

Enable CORS for the attack guide:
```js
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3044' }));
```

### Uploads directory — seed on server start

On startup, create `path-traversal/uploads/` if it doesn't exist, then write these three files:

```js
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Seed sample files
fs.writeFileSync(path.join(uploadsDir, 'q2-report.txt'),
  'Q2 Financial Report\n====================\nRevenue: $1,240,000\nExpenses: $890,000\nNet: $350,000\n');

fs.writeFileSync(path.join(uploadsDir, 'meeting-notes.txt'),
  'Meeting Notes — 2026-06-15\n==========================\nAttendees: Alice, Bob, Charlie\nDecision: Launch delayed to Q3.\n');

fs.writeFileSync(path.join(uploadsDir, 'readme.txt'),
  'FileVault — Private Document Storage\nUpload your files here. Only you can access them.\n');
```

### Auth mechanism

```js
const crypto = require('crypto');
const sessions = new Map();

const USERS = [
  { id: 1, username: 'alice', password: 'alice123' },
  { id: 2, username: 'bob',   password: 'bob123'   },
];

app.use(express.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, username: user.username });
  res.json({ token, user: { username: user.username } });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!sessions.get(token)) return res.status(401).json({ error: 'Not authenticated' });
  req.user = sessions.get(token);
  next();
}

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.headers.authorization.slice(7));
  res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));
```

### Vulnerable download endpoint

```js
// ⚠️ VULNERABLE: filename from query string joined directly into path
app.get('/api/download', requireAuth, (req, res) => {
  const filename = req.query.file;
  if (!filename) return res.status(400).json({ error: 'No file specified' });

  const filePath = path.join(__dirname, 'uploads', filename);
  // ⚠️ path.join normalizes the path but does NOT prevent escaping the uploads dir
  // 'uploads' + '../../package.json' → resolves to parent/package.json

  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  // Return file content as text so the attack is visible in the browser
  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ filename, content });
});
```

Also add `GET /api/files` — lists only seeded files (NOT vulnerable — only shows known filenames):
```js
app.get('/api/files', requireAuth, (req, res) => {
  const files = ['q2-report.txt', 'meeting-notes.txt', 'readme.txt'];
  res.json(files);
});
```

### UI design — clean cloud storage app

Colors: `#f8fafc` background, `#1e293b` sidebar, `#0f172a` text, `#6366f1` accent.

Layout: left sidebar (nav: My Files, Upload) + main content area. Top bar: "FileVault" logo + user badge (top-right) + "Sign Out" button.

**Amber top banner:**
```
⚠ VULNERABLE: /api/download?file= uses path.join() with no containment check — traversal possible
```

**Main content — file list:**
Shows the three seeded files as cards with a "Download" button each. "Download" button fetches `GET /api/download?file=<filename>` with the auth token and renders the content in a modal/panel below.

**Login page CSS — apply `class="login-input"` to both fields:**
```css
.login-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  color: #0f172a;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}
.login-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
```

Apply `class="login-input"` to both `<input type="text">` (username) and `<input type="password">`.

**Logout JS:**
```js
document.getElementById('btn-logout').addEventListener('click', async function() {
  var token = localStorage.getItem('authToken');
  if (token) { try { await fetch('/api/logout', { method:'POST', headers:{'Authorization':'Bearer '+token} }); } catch(e) {} }
  localStorage.removeItem('authToken');
  window.location.href = '/login';
});
```

**`package.json` scripts:**
```json
{
  "scripts": { "victim": "node victim-server.js" },
  "dependencies": { "express": "^4.18.2", "cors": "^2.8.5" }
}
```

---

## Port 3044 — Path Traversal Lab (attack guide)

### File: `path-traversal/attack-guide-server.js`

Open `reverse-tabnabbing/attacker-server.js`. Find `DASHBOARD_HTML`. Copy its entire `<style>` block **verbatim**.

### Page content

**Title:** `📂 Path Traversal Attack Lab — FileVault`

**Section 1 — Credentials** (`.credentials-panel` table):

| Field | Value |
|-------|-------|
| Target | http://localhost:3043 |
| Username | alice / alice123 |
| Vulnerable endpoint | GET /api/download?file= |

**Section 2 — Login** (`.flow-box`)

Same login panel pattern as other guides: username/password inputs, "Login → :3043" button, stores token internally.

**Section 3 — Attack Payloads** (`.flow-box`)

Heading: `💀 Traversal Payloads`

Show these as a table with copy buttons:

| Payload | Target file | Impact |
|---------|-------------|--------|
| `q2-report.txt` | uploads/q2-report.txt | Baseline — normal download |
| `../../package.json` | package.json | Exposes dependencies + app metadata |
| `../../victim-server.js` | victim-server.js | **Reads the server's own source code** |
| `../../../demo-attacked/.gitignore` | Root .gitignore | Confirms directory structure |
| `../../.env` | .env (if exists) | Database credentials, API keys |
| `../../../../Windows/System32/drivers/etc/hosts` | System hosts file (Windows) | OS-level file access |

Below the table, an input + fetch button:

```html
<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-top:1rem">
  <label style="font-size:0.82rem;color:#94a3b8">file=</label>
  <input class="field" id="traversal-input" value="../../package.json" style="flex:1;min-width:200px">
  <button class="demo-btn" id="btn-fetch">GET /api/download?file=</button>
</div>
<div class="result-banner" id="fetch-result"></div>
<pre class="decoded-box" id="fetch-output" style="min-height:120px;white-space:pre-wrap;word-break:break-all">Response will appear here</pre>
```

Show the live URL being constructed:
```html
<div style="font-size:0.78rem;color:#64748b;margin-top:0.4rem">
  Request: <span id="live-url" style="color:#00ff41">http://localhost:3043/api/download?file=../../package.json</span>
</div>
```

Update `#live-url` in real time as the input changes.

**Section 4 — Why It Works** (`.flow-box`)

```
path.join(__dirname, 'uploads', filename)

When filename = '../../package.json':

  __dirname             = /path/to/demo-attacked/path-traversal
  'uploads'             = /path/to/demo-attacked/path-traversal/uploads
  + '../../package.json'

path.join normalizes:  uploads/../../package.json
                     = ../../package.json  (relative to __dirname)
                     = /path/to/demo-attacked/path-traversal/../../package.json
                     = /path/to/demo-attacked/package.json

The file exists → server reads and returns it.
path.join does NOT check whether the result is inside 'uploads/'.
```

**Section 5 — The Fix** (`.flow-box`)

```js
// ✅ Resolve both paths to absolute, then verify containment
const uploadsDir = path.resolve(__dirname, 'uploads');
const requestedPath = path.resolve(uploadsDir, filename);

// startsWith check: is the resolved path still inside uploads/?
if (!requestedPath.startsWith(uploadsDir + path.sep)) {
  return res.status(403).json({ error: 'Access denied: path traversal detected' });
}
// Only now is it safe to read the file
```

**Navigation:** Fixed bottom-left `target-switcher` only.

### JavaScript

```js
var authToken = null;

function showBanner(id, type, msg) {
  var el = document.getElementById(id);
  el.className = 'result-banner ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}

// Update live URL display
document.getElementById('traversal-input').addEventListener('input', function() {
  document.getElementById('live-url').textContent =
    'http://localhost:3043/api/download?file=' + encodeURIComponent(this.value);
});

// Login
document.getElementById('btn-login').addEventListener('click', async function() {
  try {
    var res = await fetch('http://localhost:3043/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('login-user').value,
        password: document.getElementById('login-pass').value
      })
    });
    var data = await res.json();
    if (!res.ok) { showBanner('login-result', 'failure', '✗ ' + data.error); return; }
    authToken = data.token;
    showBanner('login-result', 'success', '✓ Logged in as ' + data.user.username);
  } catch(e) { showBanner('login-result', 'failure', '✗ ' + e.message); }
});

// Fetch file
document.getElementById('btn-fetch').addEventListener('click', async function() {
  if (!authToken) { showBanner('fetch-result', 'failure', '✗ Login first'); return; }
  var file = document.getElementById('traversal-input').value;
  try {
    var res = await fetch('http://localhost:3043/api/download?file=' + encodeURIComponent(file), {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    var data = await res.json();
    if (res.ok) {
      showBanner('fetch-result', 'success', '✓ File read: ' + data.filename + ' (' + data.content.length + ' bytes)');
      document.getElementById('fetch-output').textContent = data.content;
    } else {
      showBanner('fetch-result', 'failure', '✗ ' + data.error);
      document.getElementById('fetch-output').textContent = '';
    }
  } catch(e) { showBanner('fetch-result', 'failure', '✗ ' + e.message); }
});

// Copy buttons (use navigator.clipboard.writeText for each payload)
```

---

## Port 3045 — Protected FileVault

### File: `path-traversal/victim-protected-server.js`

Identical to port 3043 — same seeded files, same auth, same UI, same logout. Same CORS. Same `.login-input` CSS.

**Only change — the download endpoint:**

```js
app.get('/api/download', requireAuth, (req, res) => {
  const filename = req.query.file;
  if (!filename) return res.status(400).json({ error: 'No file specified' });

  // ✅ Resolve to absolute paths and verify containment
  const uploadsDir = path.resolve(__dirname, 'uploads');
  const requestedPath = path.resolve(uploadsDir, filename);

  // ✅ Ensure the resolved path is still inside the uploads directory
  if (!requestedPath.startsWith(uploadsDir + path.sep)) {
    return res.status(403).json({ error: 'Access denied: path traversal detected' });
  }

  if (!fs.existsSync(requestedPath)) return res.status(404).json({ error: 'File not found' });

  const content = fs.readFileSync(requestedPath, 'utf8');
  res.json({ filename, content });
});
```

**Why `path.resolve()` instead of `path.join()`:**
- `path.join()` normalizes slashes but still produces a path that can escape the uploads dir
- `path.resolve()` produces an absolute path — then `startsWith(uploadsDir)` is an unambiguous containment check
- The `+ path.sep` (adds `/` on Unix, `\` on Windows) prevents a path like `/uploads-extra/file` from passing a check against `/uploads`

**Green top banner:**
```
✅ PROTECTED: path.resolve() + startsWith() containment check — traversal blocked
```

When traversal is attempted, show in the UI:
```
403 — Access denied: path traversal detected
(The resolved path escaped the uploads directory. Request blocked.)
```

---

## Shared `package.json`

```json
{
  "name": "path-traversal-demo",
  "version": "1.0.0",
  "scripts": {
    "victim":           "node victim-server.js",
    "attacker":         "node attack-guide-server.js",
    "victim-protected": "node victim-protected-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
```

---

## README at `path-traversal/README.md`

### What this demonstrates

`path.join(__dirname, 'uploads', userInput)` normalizes the path but does not prevent escape from the `uploads/` directory. `../` sequences are valid path components. The server reads and returns any file the Node.js process can access.

### Vulnerable line

```js
const filePath = path.join(__dirname, 'uploads', filename); // ← no containment check
```

### The fix

```js
const uploadsDir = path.resolve(__dirname, 'uploads');
const requestedPath = path.resolve(uploadsDir, filename);
if (!requestedPath.startsWith(uploadsDir + path.sep)) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### Run

```bash
cd demo-attacked/path-traversal
npm install
npm run victim           # :3043
npm run attacker         # :3044
npm run victim-protected # :3045
```

### Walkthrough

1. Log in at localhost:3044 as alice
2. Fetch `../../package.json` → server returns its own dependency list
3. Fetch `../../victim-server.js` → **server returns its own source code**
4. Switch to :3045 → same payloads return 403

### Key technical note

`path.sep` in the containment check matters. Without it, `/uploads-secret/file` would pass a `startsWith('/uploads')` check. With `path.sep` appended, the check is `/uploads/` — unambiguous.
