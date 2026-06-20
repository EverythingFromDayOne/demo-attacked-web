# Cursor Prompt: NoSQL Injection Demo — DevAuth

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attacker server / Attack guide | Copy the `<style>` block from `reverse-tabnabbing/public/guide.html` verbatim — `#0a0a0a` bg, `#00ff41` text, `'Courier New'` font. The HTML lives in `public/guide.html`, served via `res.sendFile`. |
| Internal / target server (e.g. SSRF port 3020) | Muted corporate — `#1a1a2e` bg, `#e2e8f0` text |
| Victim servers | Realistic product UI matching their brand |

**Attacker/guide pages — non-negotiable rules:**
- Copy the `<style>` block from `reverse-tabnabbing/public/guide.html` **verbatim**. Never recreate or paraphrase it.
- Body layout: `padding: 2rem` on body. No max-width wrapper div. No centering.
- Panels: use `.flow-box` and `.credentials-panel` classes (defined in that style block). These must be full-width — never add `max-width` to them, not in CSS and not as inline `style` attributes. Only `<p>` text elements may use `max-width` for line-length readability.
- Navigation: **fixed bottom-left `target-switcher` only.** No other open/link buttons anywhere on the page.

## Context

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (3001–3009), CSRF (3010–3012), Clickjacking (3013–3015),
Reverse Tabnabbing (3016–3018), SSRF (3019–3021).
This demo lives under `demo-attacked/nosql-injection/` using ports 3022–3024.

**Rewrite all existing files from scratch.** The previous version was built
piecemeal and has inconsistent UI. This prompt is the single source of truth.

Tech stack: Node.js + Express. Vanilla CSS/JS.
No real MongoDB — simulate MongoDB-style operator queries with a plain JS
in-memory array and a custom `findOne()` that evaluates `$gt`, `$ne`,
`$regex` operators. This makes the attack authentic without a running database.

**Serving architecture:** All HTML lives in static files under a `public/` subfolder.
Servers use `res.sendFile(path.join(__dirname, 'public', 'index.html'))` for `GET /`.
Victim and protected servers expose `GET /api/config → { mode, port }` for dynamic banner.
No inline HTML template literals in server files.

---

## Code Comment Standard — educational depth, not one-liners

Comments on vulnerable and protected lines are teaching material, not labels.
Each comment must answer: what is wrong/fixed, why it is exploitable/safe, how
the attack works mechanically, and any nuance a student would miss without
running the demo. Never shorten an existing detailed comment — only expand it.

**Required nuance for NoSQL injection:** explain that `express.json()` enables
the attack by parsing `{ "$gt": "" }` as a real nested JS object before it ever
reaches the route handler — the operator is live JavaScript by the time
`findOne()` sees it. Name at least one working payload directly in the comment
(`{ "$gt": "" }` is the canonical one). Also note that this attack is specific
to JSON endpoints: a form-encoded body cannot express a nested object, so
`password[$gt]=` would arrive as the literal string `"$gt="` — harmless.

---

## Files to create / overwrite

```
demo-attacked/nosql-injection/
├── victim-server.js           # DevAuth vulnerable     — port 3022
├── attack-guide-server.js     # NoSQL attack guide     — port 3023
├── victim-server-protected.js # DevAuth protected      — port 3024
├── public/
│   ├── index.html             # DevAuth login + dashboard (shared by victim + protected)
│   └── guide.html             # NoSQL attack guide UI
├── package.json
└── README.md
```

`package.json` scripts:
```json
{
  "scripts": {
    "vulnerable":  "node victim-server.js",
    "guide":       "node attack-guide-server.js",
    "secure":      "node victim-server-protected.js"
  },
  "dependencies": { "express": "^4.18.2" }
}
```

---

## Scenario

**DevAuth** — a developer identity and SSO portal. Teams use it as a login
gateway. A login form accepts `username` and `password` via JSON POST. On
success the user sees a dashboard listing all registered team members.

---

## Shared code (copy into all three server files)

### In-memory user store

```js
const users = [
  { id: 1, username: 'alice', password: 'hunter2',      role: 'developer', email: 'alice@devteam.io', team: 'Frontend' },
  { id: 2, username: 'bob',   password: 'correct-horse',role: 'developer', email: 'bob@devteam.io',   team: 'Backend'  },
  { id: 3, username: 'admin', password: 'Adm1nS3cr3t!', role: 'admin',     email: 'admin@devteam.io', team: 'Platform' },
  { id: 4, username: 'carol', password: 'letmein',      role: 'developer', email: 'carol@devteam.io', team: 'DevOps'   },
];
```

### Simulated MongoDB query engine

```js
function evaluateCondition(fieldValue, condition) {
  if (typeof condition !== 'object' || condition === null) {
    return fieldValue === condition;
  }
  if ('$gt'    in condition) return fieldValue >  condition['$gt'];
  if ('$gte'   in condition) return fieldValue >= condition['$gte'];
  if ('$lt'    in condition) return fieldValue <  condition['$lt'];
  if ('$ne'    in condition) return fieldValue !== condition['$ne'];
  if ('$regex' in condition) return new RegExp(condition['$regex'], condition['$options'] || '').test(fieldValue);
  return false;
}

function findOne(query) {
  return users.find(user =>
    Object.keys(query).every(key => evaluateCondition(user[key], query[key]))
  ) || null;
}
```

---

## UI Design — match the existing demo aesthetic

All demos in this lab use the same visual language: dark navy backgrounds,
monospace type, `#6366f1` indigo accent, card-based layouts. DevAuth should
feel like a real product in that same family — not minimal, not inconsistent.

**Color tokens:**
```
bg-base:    #0f172a   (page background)
bg-card:    #1e293b   (card / nav / panel background)
bg-hover:   #334155   (hover state)
border:     #334155
border-hi:  #475569   (highlighted border)
text-main:  #f1f5f9
text-muted: #94a3b8
accent:     #6366f1
red-bg:     #450a0a
red-border: #dc2626
green-bg:   #052e16
green-border:#16a34a
amber:      #fbbf24
```

---

## Port 3022 — Vulnerable DevAuth

### Routes

**`GET /`** — redirect to `/login`

**`GET /login`** — login page (see UI spec below)

**`POST /login`** — vulnerable login handler

```js
// ⚠️ VULNERABILITY: req.body fields are passed directly into the query object.
// express.json() parses nested JSON, so { "password": { "$gt": "" } } becomes
// a MongoDB operator — findOne evaluates it as a comparison, not a string match.
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = findOne({ username, password });
  if (!user) return res.redirect('/login?error=1');
  res.redirect(`/dashboard?user=${user.username}`);
});
```

**`GET /dashboard`** — dashboard (see UI spec below)

**`GET /logout`** — clears session, redirects to `/login`

```js
app.get('/logout', (req, res) => {
  res.clearCookie('session');
  res.redirect('/login');
});
```

---

### Login page UI (`GET /login`)

Full-viewport dark page (`bg-base`). Vertically and horizontally centered
login card.

**Amber top banner (full width, outside the card, fixed at top):**
```
⚠  VULNERABLE: login query built from raw JSON body — operator injection possible
```
`background: #78350f`, `color: #fef3c7`, `padding: 0.6rem 1.5rem`,
`font-family: monospace`, `font-size: 0.8rem`.

**Card** (`bg-card`, `border: 1px solid border`, `border-radius: 10px`,
`padding: 2.5rem 2rem`, `width: 100%`, `max-width: 400px`):

1. Lock icon SVG centered at top (simple padlock outline, 40×40, indigo color `#6366f1`)
2. `DevAuth` — `font-size: 1.6rem`, `font-weight: 700`, `color: text-main`, centered
3. `Developer Identity Portal` — `font-size: 0.85rem`, `color: text-muted`, centered
4. Thin horizontal rule (`border-color: border`)
5. If `?error=1` in URL: red error box inside card:
   `background: #450a0a`, `border: 1px solid #dc2626`, `border-radius: 6px`,
   `padding: 0.6rem 1rem`, `color: #fca5a5`, text: `Invalid credentials`
6. USERNAME label (`color: text-muted`, `font-size: 0.75rem`, `letter-spacing: 0.1em`)
   + text input (full width, `background: #0f172a`, `border: 1px solid border-hi`,
   `border-radius: 6px`, `padding: 0.6rem 0.75rem`, `color: text-main`)
7. PASSWORD label + password input (same styling)
8. Sign In button (full width, `background: accent`, `color: white`,
   `border: none`, `border-radius: 6px`, `padding: 0.75rem`, `font-size: 1rem`,
   `cursor: pointer`, hover: `background: #4f46e5`)
9. `Forgot password? Contact your admin.` — centered, `color: text-muted`,
   `font-size: 0.8rem`

The form POSTs JSON to `/login` via a small inline script:
```js
document.querySelector('form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const rawPassword = document.getElementById('password').value;

  // ⚠️ IMPORTANT: try JSON.parse on the password field.
  // If the user types a JSON operator payload like {"$gt":""}, this converts
  // the string into a real nested object before JSON.stringify sends it.
  // Without this, {"$gt":""} typed in a text input arrives as the literal
  // string '{"$gt":""}' — which is harmless and matches nothing.
  let password;
  try { password = JSON.parse(rawPassword); }
  catch { password = rawPassword; }

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  window.location = res.url;
});
```
This is critical — the form must send JSON (not form-encoded) so that the
injection payload `{ "$gt": "" }` can be delivered via the browser UI.
The JSON.parse step is what converts the typed string into a real object.
The attack guide also shows how to send it directly via curl/fetch.

---

### Dashboard UI (`GET /dashboard?user=<username>`)

**Red top banner (full width):**
```
🚨 ACCESS GRANTED — You are viewing the full user registry.
   Admin session acquired without the correct password via NoSQL operator injection.
```
`background: red-bg`, `border-bottom: 2px solid red-border`, `color: #fca5a5`,
`padding: 0.75rem 1.5rem`, `font-family: monospace`, `font-size: 0.82rem`.

**Top navigation bar** (`background: bg-card`, `border-bottom: 1px solid border`,
`padding: 0.75rem 1.5rem`, flex layout, full width):

Left: `DevAuth` wordmark in indigo + nav links `Dashboard · Team · Settings`
(links are `color: text-muted`, hover `color: text-main`)

Right: avatar circle (36×36, `background: accent`, `border-radius: 50%`,
`color: white`, shows first letter of username in uppercase) + username text
+ `Sign Out` anchor linking to `/logout` (`background: bg-hover`,
`color: text-muted`, `border: 1px solid border-hi`, `border-radius: 4px`,
`padding: 0.3rem 0.75rem`, `font-size: 0.8rem`, `text-decoration: none`)

**Main content** (`max-width: 1100px`, `margin: 0 auto`, `padding: 1.5rem`,
two-column CSS grid `grid-template-columns: 2fr 1fr`, `gap: 1.5rem`):

**Left column — Team Registry:**

Section header: `Team Registry` (`color: text-main`, `font-size: 1.1rem`,
`font-weight: 600`) + subtext `All registered developers — N members`
(`color: text-muted`, `font-size: 0.85rem`)

For each user, a card (`background: bg-card`, `border: 1px solid border`,
`border-radius: 8px`, `padding: 1rem 1.25rem`, `margin-bottom: 0.5rem`,
`display: flex`, `align-items: center`, `gap: 1rem`):

- Avatar circle (40×40, `border-radius: 50%`, first letter uppercase):
  - `admin` role → `background: #92400e` (amber-dark)
  - `developer` role → `background: #1e3a5f` (slate-blue)
- User info block:
  - Username (`color: text-main`, `font-weight: 600`, `font-size: 0.95rem`)
  - Email (`color: text-muted`, `font-size: 0.8rem`)
- Role badge (pushed right, `margin-left: auto`):
  - `admin` → `color: #fbbf24`, `background: #451a03`, pill badge
  - `developer` → `color: #818cf8`, `background: #1e1b4b`, pill badge
- Team text (`color: text-muted`, `font-size: 0.8rem`, right side)

Do NOT show passwords in the dashboard.

**Right column — two panels stacked:**

Panel 1 — Signed in as (`background: bg-card`, `border: 1px solid border`,
`border-radius: 8px`, `padding: 1.25rem`):
- Title: `Signed in as` (`color: text-muted`, small caps)
- Avatar + username (same style as nav)
- Email, Role, Team in muted small text rows

Panel 2 — Session (`background: bg-card`, `border: 1px solid border`,
`border-radius: 8px`, `padding: 1.25rem`, `margin-top: 1rem`):
- Title: `Session`
- `Authenticated via:` → `MongoDB query match`
- `IP:` → `127.0.0.1`
- `Time:` → current timestamp

---

## Port 3024 — Protected DevAuth

**Identical structure to port 3022** with two changes:

1. All banners switch from amber/red to green:
   - Login banner: `background: #14532d`, `color: #bbf7d0`
     ```
     ✅ PROTECTED: input type validated before query — operator injection rejected
     ```
   - Dashboard banner: `background: green-bg`, `border-bottom: 2px solid green-border`
     ```
     ✅ LEGITIMATE LOGIN — password verified by exact string match.
        Operator injection rejected before the query ran.
     ```

2. Login handler validates types before querying:
```js
// ✅ PROTECTED: reject non-string body fields.
// MongoDB operators only execute when the query field is an object.
// Enforcing typeof === 'string' means the query always uses exact equality.
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.redirect('/login?error=1');
  }
  const user = findOne({ username, password });
  if (!user) return res.redirect('/login?error=1');
  res.redirect(`/dashboard?user=${user.username}`);
});
```

All other routes (GET /logout, GET /dashboard) identical to port 3022.

---

## Port 3023 — Attack Guide Server

### UI — MANDATORY: clone from reverse-tabnabbing dashboard

Open `demo-attacked/reverse-tabnabbing/public/guide.html`. Copy its entire `<style>` block
**verbatim** — every rule, every value, character for character — into this page's `<style>`.
Do not reinterpret or recreate any CSS.

Body layout: no wrapper div, no max-width centering. The body itself has
`padding: 2rem` — same as the tabnabbing dashboard. Panels use `.flow-box` and
`.credentials-panel` classes exactly as the tabnabbing dashboard uses them.

**Navigation — fixed bottom-left switcher ONLY.** There must be no other
"open victim" / "open protected" buttons anywhere on the page.

```html
<div class="target-switcher">
  <button class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (:3022)</button>
  <button class="btn-protected" id="btn-switcher-protected">Protected (:3024)</button>
</div>
```

Switcher JS:
```js
document.getElementById('btn-switcher-vulnerable').addEventListener('click', function () {
  window.open('http://localhost:3022/login', '_blank');
});
document.getElementById('btn-switcher-protected').addEventListener('click', function () {
  window.open('http://localhost:3024/login', '_blank');
});
```

### `GET /` — page content

```html
<body>
  <h1>NoSQL Injection — Attack Guide</h1>
  <p class="subtitle">How operator injection bypasses MongoDB authentication</p>

  <div class="flow-box">
    <strong>HOW MONGODB LOGIN QUERIES WORK</strong><br><br>
    <pre>// Normal login — what the developer intended
db.users.findOne({ username: "alice", password: "hunter2" })
// → returns user object only if both fields match exactly</pre>
  </div>

  <div class="flow-box">
    <strong>THE INJECTION</strong><br><br>
    <pre>// What the attacker sends (HTTP request body):
{ "username": "admin", "password": { "$gt": "" } }

// What Express parses and the server builds:
db.users.findOne({ username: "admin", password: { $gt: "" } })
// → "$gt": "" means "password greater than empty string"
// → any non-empty password satisfies this — admin is returned
// → attacker is logged in without knowing the password</pre>
  </div>

  <div class="credentials-panel">
    <h2>Other Operators That Work</h2>
    <table>
      <thead><tr><th>Payload</th><th>Effect</th></tr></thead>
      <tbody>
        <tr><td><code>{ "$gt": "" }</code></td><td>Greater than empty string — matches any non-empty password</td></tr>
        <tr><td><code>{ "$ne": "x" }</code></td><td>Not equal to "x" — matches any password except "x"</td></tr>
        <tr><td><code>{ "$regex": ".*" }</code></td><td>Regex match-all — matches anything</td></tr>
        <tr><td><code>{ "$exists": true }</code></td><td>Field exists — matches any user with a password field</td></tr>
      </tbody>
    </table>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Copy Payloads</h2>
    <!-- payload-box: label + pre#curl-payload + copy button -->
    <!-- payload-box: label + pre#fetch-payload + copy button -->
    <!-- use existing CURL_PAYLOAD and FETCH_PAYLOAD constants -->
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Why JSON Endpoints Are Specifically Vulnerable</h2>
    <p style="font-size:0.85rem;color:#94a3b8;line-height:1.7;max-width:640px">
      This attack only works because the endpoint accepts JSON
      (Content-Type: application/json) and express.json() parses nested objects.
      A form-encoded endpoint (application/x-www-form-urlencoded) cannot send a
      nested object — password[$gt]= arrives as the literal string "$gt=".
      JSON is required for object injection.<br><br>
      SQL injection does not have this limitation — it works on any string input.
      That is why SQL and NoSQL injection have different but equally dangerous
      attack surfaces.
    </p>
  </div>

  <!-- fixed bottom-left switcher — see above -->
</body>
```

---

## README.md

### Canonical structure (required — write directly in this order)

Write `README.md` directly in this order, `---` between every top-level section:

```
# NoSQL Injection Demo — DevAuth

## Port Reference
## Attack Flow
## How to Run
## Attack Walkthrough
## Vulnerable Lines
## The Fix
## Why It Works
## Defense Details
[optional: Why JSON Endpoints Are Specifically Vulnerable, SQL vs NoSQL Injection Comparison]
```

Rename mapping: "Vulnerable Line (Exact)" → `## Vulnerable Lines`. "Why JSON
endpoints are specifically vulnerable" → `## Why It Works` (the SQL vs NoSQL
comparison table stays as its own optional section right after). There is no
separate protected-server walkthrough for this attack — skip `## Protected Demo`.
No `## Credentials` — login is the attack itself, there's no fixed account to document.

---

### Attack Flow

```
Attacker sends: POST /api/login
  { "username": "admin", "password": { "$gt": "" } }
        ↓
DevAuth (3022) passes body directly to MongoDB:
  db.users.findOne({ username: "admin", password: { $gt: "" } })
        ↓
MongoDB evaluates: "is password > empty string?" → TRUE for every user
        ↓
Login succeeds. No password required.
```

### Port Reference

| Port | Role | File |
|------|------|------|
| 3022 | Vulnerable DevAuth | `victim-server.js` |
| 3023 | Attack guide | `attack-guide-server.js` |
| 3024 | Protected DevAuth | `victim-server-protected.js` |

### How to run

```bash
cd demo-attacked/nosql-injection
npm install
```

Three terminals:
```
npm run vulnerable           # :3022
npm run guide                # :3023
npm run secure                # :3024
```

### Attack Walkthrough

1. Open **localhost:3023** — read how the attack works.
2. Open **localhost:3022** — try `admin` with wrong password → fails.
3. Open DevTools → Network tab.
4. Run the curl payload or browser console fetch from the guide.
5. Dashboard loads — full user registry visible, no correct password used.
6. Click **Sign Out** to reset.

### Vulnerable Line (Exact)

```js
// victim-server.js — POST /login
const user = findOne({ username, password });
// password was { "$gt": "" } — operator evaluated, password never compared
```

### The Fix

```js
if (typeof username !== 'string' || typeof password !== 'string') {
  return res.redirect('/login?error=1');
}
```

### Why JSON endpoints are specifically vulnerable

Form-encoded POST bodies cannot express nested objects — `password[$gt]=`
arrives as the string `"$gt="`. Only JSON requests can carry nested objects,
which is why this attack is specific to JSON APIs backed by document databases.

### SQL vs NoSQL Injection Comparison

| | SQL Injection | NoSQL Operator Injection |
|---|---|---|
| Attack vector | String concatenation in SQL | Object passed as query field |
| Input format required | Any string | JSON (nested object) |
| Injected payload | `OR 1=1`, `UNION SELECT`, `--` | `$gt`, `$ne`, `$regex` |
| Defense | Parameterized queries | Type validation (enforce string) |
| Login bypass payload | `admin'--` | `{ "password": { "$gt": "" } }` |
