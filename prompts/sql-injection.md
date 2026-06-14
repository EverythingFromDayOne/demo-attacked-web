# Cursor Prompt: SQL Injection Demo — DevLinks

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attacker server / Attack guide | Clone `DASHBOARD_HTML` from `reverse-tabnabbing/attacker-server.js` — `#0a0a0a` bg, `#00ff41` text, `'Courier New'` font. Copy `<style>` verbatim. |
| Internal / target server (e.g. SSRF port 3020) | Muted corporate — `#1a1a2e` bg, `#e2e8f0` text |
| Victim servers | Realistic product UI matching their brand |

**Attacker/guide pages — non-negotiable rules:**
- Copy the `<style>` block from `DASHBOARD_HTML` in `reverse-tabnabbing/attacker-server.js` **verbatim**. Never recreate or paraphrase it.
- Body layout: `padding: 2rem` on body. No max-width wrapper div. No centering.
- Panels: use `.flow-box` and `.credentials-panel` classes (defined in that style block). These must be full-width — never add `max-width` to them, not in CSS and not as inline `style` attributes. Only `<p>` text elements may use `max-width` for line-length readability.
- Navigation: **fixed bottom-left `target-switcher` only.** No other open/link buttons anywhere on the page.

## Context

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (3001–3009), CSRF (3010–3012), Clickjacking (3013–3015),
Reverse Tabnabbing (3016–3018), SSRF (3019–3021), NoSQL Injection (3022–3024).
This demo lives under `demo-attacked/sql-injection/` using ports 3025–3027.

Tech stack: Node.js + Express. All HTML as template literals. Vanilla CSS/JS.
Use `better-sqlite3` for a real SQLite database — this is a synchronous driver
that requires no async handling and makes the vulnerable vs. protected code
difference immediately obvious. Do NOT simulate SQL — use actual SQLite so
that real injection payloads produce real results.

---

## Files to create

```
demo-attacked/sql-injection/
├── victim-server.js           # DevLinks vulnerable    — port 3025
├── attack-guide-server.js     # SQL attack guide       — port 3026
├── victim-server-protected.js # DevLinks protected     — port 3027
├── package.json
└── README.md
```

`package.json` scripts:
```json
{
  "scripts": {
    "victim":           "node victim-server.js",
    "guide":            "node attack-guide-server.js",
    "victim-protected": "node victim-server-protected.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3"
  }
}
```

---

## Scenario

**DevLinks** — a developer resource search and bookmark platform. Developers
search for curated links (articles, tools, repos) by keyword. There is also
an admin login page. Both features are vulnerable to SQL injection in different
ways: the search uses string concatenation into a LIKE clause; the login uses
string concatenation into a WHERE clause.

This covers two classic SQL injection patterns in one demo:
1. **Data extraction** — search field → dump other tables via UNION
2. **Authentication bypass** — login field → bypass WHERE clause with `OR 1=1`

---

## Database schema (same in all three servers)

Use `better-sqlite3` to create an in-memory SQLite database on startup.

```sql
CREATE TABLE resources (
  id      INTEGER PRIMARY KEY,
  title   TEXT NOT NULL,
  url     TEXT NOT NULL,
  tags    TEXT,
  author  TEXT
);

CREATE TABLE users (
  id       INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role     TEXT NOT NULL,
  email    TEXT NOT NULL
);
```

Seed data for `resources`:

| title | url | tags | author |
|-------|-----|------|--------|
| V8 Engine Deep Dive | https://v8.dev/blog | javascript,engine | alice |
| Node.js Performance Guide | https://nodejs.org/docs | nodejs,performance | bob |
| MDN Web Docs | https://developer.mozilla.org | reference,web | carol |
| CSS Grid Complete Guide | https://css-tricks.com/snippets/css/complete-guide-grid | css,layout | alice |
| TypeScript Handbook | https://www.typescriptlang.org/docs/handbook | typescript,types | dave |

Seed data for `users`:

| username | password | role | email |
|----------|----------|------|-------|
| alice | hunter2 | developer | alice@devlinks.io |
| bob | correct-horse | developer | bob@devlinks.io |
| admin | Adm1nS3cr3t! | admin | admin@devlinks.io |
| carol | letmein | developer | carol@devlinks.io |

---

## Port 3025 — Vulnerable DevLinks

### What makes it vulnerable

Two injection points, both using string concatenation:

```js
// ⚠️ VULNERABLE SEARCH — string interpolation in LIKE clause
app.get('/search', (req, res) => {
  const q = req.query.q || '';
  // Attacker controls q — can inject: ' UNION SELECT id,username,password,email FROM users--
  const results = db.prepare(
    `SELECT id, title, url, tags, author FROM resources WHERE title LIKE '%${q}%' OR tags LIKE '%${q}%'`
  ).all();
  res.send(buildSearchPage(q, results));
});

// ⚠️ VULNERABLE LOGIN — string interpolation in WHERE clause
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Attacker sends username: admin'-- (password check commented out)
  const user = db.prepare(
    `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`
  ).get();
  // ...
});
```

### Pages

**`GET /`** — DevLinks home

DevLinks branding. Clean light-mode design (white/slate). Navigation: Search,
Bookmarks, Admin.

Top banner (amber):
```
⚠  VULNERABLE: search and login queries built by string concatenation — SQL injection possible
```

Featured resources listed as cards (title, URL, tags, author).
Search bar at the top of the main content area — `GET /search?q=`.

**`GET /search?q=`** — Search results

Executes the vulnerable query. Displays results as resource cards.

Below the search bar, a small muted note:
```
Search queries resources.title and resources.tags
```

Include a subtle hint panel (collapsible) labeled "Try injecting":
```
Normal search:    javascript
Login bypass:     Open /admin — username: admin'--  password: anything
UNION dump:       ' UNION SELECT id,username,password,email FROM users--
```

**`GET /admin`** — Admin login page

Simple login form (username + password). On success → `GET /admin/dashboard`.
On failure → login page with "Invalid credentials".

**`GET /admin/dashboard`** — Admin panel

Shows all users from the `users` table (id, username, password, role, email).

Red top banner:
```
🚨 ADMIN ACCESS GRANTED — Full user database visible including hashed passwords.
```

---

## Port 3026 — Attack Guide Server

### UI — MANDATORY: clone from reverse-tabnabbing dashboard

Open `demo-attacked/reverse-tabnabbing/attacker-server.js`. Find the
`DASHBOARD_HTML` constant. Copy its entire `<style>` block **verbatim** — every
rule, every value, character for character — into this page's `<style>`. Do not
reinterpret or recreate any CSS. Also copy `SWITCHER_CSS` verbatim.

Body layout: no wrapper div, no max-width centering. The body itself has
`padding: 2rem` — same as the tabnabbing dashboard. Panels use `.flow-box` and
`.credentials-panel` classes exactly as the tabnabbing dashboard uses them.

**Navigation — fixed bottom-left switcher ONLY.** There must be no other
"open victim" / "open protected" buttons anywhere on the page.

```html
<div class="target-switcher">
  <button class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (:3025)</button>
  <button class="btn-protected" id="btn-switcher-protected">Protected (:3027)</button>
</div>
```

Switcher JS:
```js
document.getElementById('btn-switcher-vulnerable').addEventListener('click', function () {
  window.open('http://localhost:3025', '_blank');
});
document.getElementById('btn-switcher-protected').addEventListener('click', function () {
  window.open('http://localhost:3027', '_blank');
});
```

### `GET /` — page content

```html
<body>
  <h1>SQL Injection — Attack Guide</h1>
  <p class="subtitle">How string concatenation turns user input into executable SQL</p>

  <div class="flow-box" style="max-width:900px">
    <strong>THE VULNERABLE PATTERN</strong><br><br>
    <pre>-- Developer intended:
SELECT * FROM resources WHERE title LIKE '%javascript%'

-- What happens when attacker inputs:  ' UNION SELECT id,username,password,email FROM users--
SELECT * FROM resources
WHERE title LIKE '%' UNION SELECT id,username,password,email FROM users--%'
-- The -- comments out the rest of the original query
-- UNION appends results from the users table to the resources results
-- attacker now sees usernames and passwords in the search results</pre>
  </div>

  <div class="flow-box" style="max-width:900px">
    <strong>LOGIN BYPASS</strong><br><br>
    <pre>-- Developer intended:
SELECT * FROM users WHERE username = 'admin' AND password = 'wrongpassword'
-- → returns nothing — wrong password

-- Attacker sends username: admin'--   password: anything
SELECT * FROM users WHERE username = 'admin'--' AND password = 'anything'
-- Everything after -- is a comment
-- Password check never runs
-- → returns the admin row — login succeeds</pre>
  </div>

  <div class="credentials-panel">
    <h2>Attack Payloads to Try</h2>
    <table><!-- use buildPayloadRows() --></table>
    <p style="font-size:0.82rem;color:#94a3b8;margin-top:0.75rem">
      Note: the original search query selects 5 columns. Add a 5th column
      ('' or role) to the UNION payload so column counts match.
    </p>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>SQL vs NoSQL Injection</h2>
    <pre>SQL injection works on any string input — form-encoded or JSON.
The attacker injects SQL keywords and syntax directly into the query string.

NoSQL operator injection (see port 3023) only works on JSON endpoints.
The attacker injects a MongoDB operator object instead of a string value.

Both are caused by the same root issue: user input treated as query logic
rather than query data.</pre>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Why the UNION Attack Works</h2>
    <p style="font-size:0.85rem;color:#94a3b8;line-height:1.7;max-width:640px">
      UNION combines SELECT results — both queries must have the same number of
      columns. The original query selects 5 columns (id, title, url, tags,
      author). The injected query must also select exactly 5 columns. If column
      counts don't match, SQLite throws an error — the attacker adjusts.
      UNION SELECT is how attackers enumerate and dump arbitrary tables.
    </p>
  </div>

  <!-- fixed bottom-left switcher — see above -->
</body>
```

---

## Port 3027 — Protected DevLinks

### What the fix is

Use parameterized queries (prepared statements with `?` placeholders):

```js
// ✅ PROTECTED SEARCH — parameterized LIKE
app.get('/search', (req, res) => {
  const q = req.query.q || '';
  // ✅ The ? placeholder is always treated as a literal string value.
  // SQLite's driver handles escaping — user input can never become SQL syntax.
  const results = db.prepare(
    'SELECT id, title, url, tags, author FROM resources WHERE title LIKE ? OR tags LIKE ?'
  ).all(`%${q}%`, `%${q}%`);
  res.send(buildSearchPage(q, results));
});

// ✅ PROTECTED LOGIN — parameterized WHERE
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ?'
  ).get(username, password);
  // ...
});
```

### Pages

Same layout as port 3025 but with green banner:
```
✅ PROTECTED: parameterized queries — user input is always data, never syntax
```

Admin login rejects injection attempts — `admin'--` fails to log in because
it's treated as the literal string `admin'--` and no user has that username.

---

## README.md

### Port Reference

| Port | Role | File |
|------|------|------|
| 3025 | Vulnerable DevLinks | `victim-server.js` |
| 3026 | Attack guide | `attack-guide-server.js` |
| 3027 | Protected DevLinks | `victim-server-protected.js` |

### Setup

```bash
cd demo-attacked/sql-injection
npm install   # installs better-sqlite3 (compiles native bindings — takes ~30s)
```

### Attack Walkthrough — Data Extraction

1. Terminal 1: `npm run victim`
2. Open **localhost:3025**
3. Search for `javascript` — see normal results
4. Search for `' UNION SELECT id,username,password,email FROM users--`
5. Results now include rows from the `users` table — usernames, passwords visible

### Attack Walkthrough — Login Bypass

1. Open **localhost:3025/admin**
2. Username: `admin'--`  Password: `anything`
3. Click Sign In
4. Admin dashboard loads — full user database displayed

### Vulnerable Lines (Exact)

Search:
```js
db.prepare(`SELECT id, title, url, tags, author FROM resources WHERE title LIKE '%${q}%' OR tags LIKE '%${q}%'`).all()
```

Login:
```js
db.prepare(`SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`).get()
```

### The Fix

Replace string interpolation with `?` placeholders:
```js
db.prepare('SELECT ... WHERE title LIKE ? OR tags LIKE ?').all(`%${q}%`, `%${q}%`)
db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password)
```

`better-sqlite3` (like all proper database drivers) separates query structure
from query data. The `?` placeholder is never substituted by string
concatenation — the value is sent to SQLite as a typed parameter. SQLite's
parser sees the query structure first and treats parameter values as data, not
as SQL tokens. A `'` in a parameter value is just a character, not a string
delimiter.

### Why parameterized queries work

The vulnerability exists because string interpolation happens before SQLite's
parser sees the query. By the time SQLite reads `... LIKE '%' UNION SELECT...`,
it cannot distinguish the original SQL from the injected SQL — it's one string.

With parameterized queries, the structure is compiled first:
```
SELECT ... WHERE title LIKE ? OR tags LIKE ?
```
Then the runtime binds `%javascript%` to each `?`. SQLite knows those are
values, not syntax. A UNION keyword inside a value is not a SQL UNION — it's
just characters.

### SQL vs NoSQL Injection

| | SQL Injection | NoSQL Operator Injection |
|---|---|---|
| Database | Relational (SQLite, Postgres, MySQL) | Document (MongoDB) |
| Attack vector | String concatenated into SQL query | Object field passed as query parameter |
| Input format required | Any (string) | JSON (nested object) |
| Injected payload | SQL keywords: `OR`, `UNION`, `--`, `;` | MongoDB operators: `$gt`, `$ne`, `$regex` |
| Defense | Parameterized queries / prepared statements | Type validation (enforce string input) |
| What can be extracted | Any table, any column the DB user can access | Any document the query can match |
| Login bypass payload | `admin'--` or `' OR 1=1--` | `{ "password": { "$gt": "" } }` |

### Defense Details

**Parameterized queries** are the complete defense. There is no scenario where
a parameterized query can be SQL-injected — the separation of structure and
data is enforced by the driver, not the developer's escaping.

**What does NOT work:**
- Manual escaping (replacing `'` with `''`) — fragile, encoding-dependent, always
  incomplete. A new edge case will eventually bypass it.
- Allowlist validation of input characters — fragile for search fields where
  users legitimately search for special characters.
- ORMs — they use parameterized queries internally, so they are safe by default,
  but raw query escape hatches (`.query()`, `.raw()`) re-introduce the vulnerability.
