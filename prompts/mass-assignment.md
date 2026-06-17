# Cursor Prompt: Mass Assignment Demo — ProfileHub (Ports 3046–3048)

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attacker server / Attack guide | Clone `DASHBOARD_HTML` from `reverse-tabnabbing/attacker-server.js` — `#0a0a0a` bg, `#00ff41` text, `'Courier New'` font. Copy `<style>` verbatim. |
| Victim servers | Realistic product UI matching their brand |

**Attacker/guide pages — non-negotiable rules:**
- Copy the `<style>` block from `DASHBOARD_HTML` in `reverse-tabnabbing/attacker-server.js` **verbatim**. Never recreate or paraphrase it.
- Body layout: `padding: 2rem` on body. No max-width wrapper div. No centering.
- Panels: use `.flow-box` and `.credentials-panel` classes (defined in that style block). These must be full-width — never add `max-width` to them, not in CSS and not as inline `style` attributes. Only `<p>` text elements may use `max-width` for line-length readability.
- Navigation: **fixed bottom-left `target-switcher` only.** No other open/link buttons anywhere on the page.

---

## Context

**Attack:** Mass Assignment
**App name:** ProfileHub — a professional networking & profile management platform
**Tagline:** "Build your professional presence"
**Folder:** `demo-attacked/mass-assignment/`

ProfileHub lets users manage their profile: name, bio, job title, company. Users are normal members by default. Admin users can access an admin panel to manage all accounts. The vulnerability: the profile update endpoint uses `Object.assign(existingUser, req.body)` (or an equivalent spread) without filtering which fields can be changed. A user who sends `{"bio": "hello", "isAdmin": true}` in the PATCH body gets `isAdmin` silently merged into their record — full admin access, no password required.

**Why it matters:** Any framework with auto-binding — Rails' `params.permit()` without allowlisting, Django REST Framework without `read_only_fields`, Express with `Object.assign(record, req.body)` — is vulnerable. The developer added admin functionality, forgot to mark it server-only, and the API exposed it. Happens constantly in real applications. High-severity: privilege escalation from any authenticated user to admin.

---

## Port Layout

| Port | Role | App |
|------|------|-----|
| 3046 | Vulnerable victim | ProfileHub (Object.assign with full body) |
| 3047 | Attack guide | Mass Assignment Lab (hacker terminal) |
| 3048 | Protected victim | ProfileHub (explicit field allowlist) |

---

## Port 3046 — Vulnerable ProfileHub

### File: `mass-assignment/victim-server.js`

**Dependencies:** `express ^4.18.2`, `cors ^2.8.5`

Enable CORS for the attack guide:
```js
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3047' }));
app.use(express.json());
```

### User store (in-memory)

```js
const crypto = require('crypto');

// Deep-clone users on startup so mutations don't persist to next test run
function freshUsers() {
  return [
    { id: 1, username: 'alice',   password: 'alice123',  email: 'alice@profilehub.com',   bio: 'Software engineer. Coffee enthusiast.',    jobTitle: 'Senior Engineer',    company: 'Acme Corp',    isAdmin: false, isPremium: false, plan: 'free'  },
    { id: 2, username: 'bob',     password: 'bob123',    email: 'bob@profilehub.com',     bio: 'Product designer with 8 years experience.', jobTitle: 'Lead Designer',      company: 'Designco',     isAdmin: false, isPremium: true,  plan: 'pro'   },
    { id: 3, username: 'charlie', password: 'charlie123',email: 'charlie@profilehub.com', bio: 'Startup founder, ex-FAANG.',               jobTitle: 'Founder & CEO',      company: 'StartupXYZ',   isAdmin: false, isPremium: true,  plan: 'pro'   },
    { id: 4, username: 'admin',   password: 'admin123',  email: 'admin@profilehub.com',   bio: 'Platform administrator.',                  jobTitle: 'Platform Admin',     company: 'ProfileHub',   isAdmin: true,  isPremium: true,  plan: 'admin' },
  ];
}

let users = freshUsers();
```

(Include a `POST /api/reset` endpoint that resets `users = freshUsers()` and `sessions.clear()` — makes it easy to redo the demo.)

### Auth mechanism

```js
const sessions = new Map();

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, user.id);
  res.json({ token, user: publicUser(user) });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const userId = sessions.get(token);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  req.user = users.find(u => u.id === userId);
  if (!req.user) return res.status(401).json({ error: 'User not found' });
  next();
}

function publicUser(u) {
  // Returns the full user object — this is intentional in the vulnerable version
  // to make the attack's effect visible
  return { id: u.id, username: u.username, email: u.email, bio: u.bio,
           jobTitle: u.jobTitle, company: u.company, isAdmin: u.isAdmin,
           isPremium: u.isPremium, plan: u.plan };
}

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.headers.authorization.slice(7));
  res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => res.json(publicUser(req.user)));
```

### Vulnerable update endpoint

```js
// ⚠️ VULNERABLE: merges the entire request body into the user object
app.patch('/api/profile', requireAuth, (req, res) => {
  // ⚠️ No allowlist — any field in req.body gets assigned
  Object.assign(req.user, req.body);
  // Because req.user is a reference into the users array,
  // this mutation is permanent for the session
  res.json(publicUser(req.user));
});
```

Also add:

```js
// Admin-only endpoint — lists all users
app.get('/api/admin/users', requireAuth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });
  res.json(users.map(publicUser));
});
```

### UI design — professional social/networking platform

Colors: `#ffffff` background, `#f8fafc` sidebar, `#1e293b` text, `#6366f1` accent, `#10b981` success/premium badge.

Layout: Two-panel layout.
- **Left sidebar (240px)**: User avatar (initials), username, plan badge (FREE/PRO/ADMIN), vertical nav (My Profile, Edit Profile, Admin Panel — last one grayed out unless isAdmin).
- **Main content**: Profile card with bio, job title, company, isAdmin/isPremium badges.

**Admin Panel section** (only visible if `isAdmin: true`):
Shows a table of all users fetched from `GET /api/admin/users`. Column: username, email, job title, isAdmin, plan.

After the user mass-assigns `isAdmin: true`, this panel should become accessible and show all users — making the privilege escalation visually obvious.

**Amber top banner:**
```
⚠ VULNERABLE: PATCH /api/profile uses Object.assign(user, req.body) — any field including isAdmin can be overwritten
```

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

**Logout button** (top-right, next to user badge):
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

## Port 3047 — Mass Assignment Lab (attack guide)

### File: `mass-assignment/attack-guide-server.js`

Open `reverse-tabnabbing/attacker-server.js`. Find `DASHBOARD_HTML`. Copy its entire `<style>` block **verbatim**.

### Page content

**Title:** `🔑 Mass Assignment Attack Lab — ProfileHub`

**Section 1 — Credentials** (`.credentials-panel` table):

| Field | Value |
|-------|-------|
| Target | http://localhost:3046 |
| Username | alice / alice123 |
| Profile update | PATCH /api/profile |
| Admin endpoint | GET /api/admin/users |

**Section 2 — Login** (`.flow-box`)

Standard login panel: username/password inputs, "Login → :3046" button, stores token. Shows current user data (username, isAdmin, plan) after login.

**Section 3 — Step-by-Step Attack** (`.flow-box`)

**Step 1 — Check current privileges:**
Button "GET /api/me" → shows response including `"isAdmin": false`.

**Step 2 — Update profile normally:**
```json
{ "bio": "Updated bio", "jobTitle": "Software Engineer" }
```
Button "PATCH (normal)" → profile updates, isAdmin still false.

**Step 3 — Mass assign admin:**
```json
{ "bio": "Hacker was here", "isAdmin": true, "isPremium": true, "plan": "admin" }
```
Button "PATCH (attack)" → response shows `"isAdmin": true`. Attacker is now admin.

**Step 4 — Access admin endpoint:**
Button "GET /api/admin/users" → returns all user records, proving admin access.

Show each request and response inline. Highlight `"isAdmin": true` in the response with green/success styling.

**Section 4 — Attack Payloads** (`.flow-box`)

Interactive payload builder — editable JSON textarea + send button:

```html
<label style="font-size:0.82rem;color:#94a3b8">PATCH /api/profile — request body:</label>
<textarea class="field" id="payload" rows="8" style="width:100%;font-family:monospace;font-size:0.85rem">
{
  "bio": "Hacker was here",
  "isAdmin": true,
  "isPremium": true,
  "plan": "admin"
}
</textarea>
<button class="demo-btn" id="btn-send">Send PATCH request</button>
<div class="result-banner" id="patch-result"></div>
<pre class="decoded-box" id="patch-output">Response will appear here</pre>
```

**Section 5 — Why It Works** (`.flow-box`)

```
PATCH /api/profile request body:
  { "bio": "Hacker was here", "isAdmin": true }

Server code:
  Object.assign(req.user, req.body)

Object.assign merges ALL enumerable own properties from req.body
into req.user — including isAdmin, which was never meant to be
user-writable.

The developer intended to expose only: bio, jobTitle, company
They forgot that isAdmin lives on the same object and
Object.assign has no concept of read-only fields.

Express doesn't know which fields are safe — it just parses JSON.
Object.assign doesn't know which fields are safe — it just copies.
The developer must explicitly define the allowlist.
```

**Section 6 — The Fix** (`.flow-box`)

```js
// ✅ Explicit allowlist — only these fields may be changed by the user
const ALLOWED_PROFILE_FIELDS = ['bio', 'jobTitle', 'company', 'email'];

app.patch('/api/profile', requireAuth, (req, res) => {
  const update = {};
  for (const field of ALLOWED_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      update[field] = req.body[field];
    }
  }
  // Only safe fields are merged — isAdmin, isPremium, plan are never touched
  Object.assign(req.user, update);
  res.json(publicUser(req.user));
});
```

**Bonus — other mass assignment vectors:**

```
ORM auto-binding (Mongoose):
  User.findByIdAndUpdate(id, req.body)  // ⚠️ updates any field
  User.findByIdAndUpdate(id, { $set: req.body })  // ⚠️ still vulnerable

Sequelize:
  user.update(req.body)  // ⚠️ uses all attributes by default

Django REST Framework:
  class UserSerializer(serializers.ModelSerializer):
    class Meta:
      model = User
      fields = '__all__'  // ⚠️ exposes is_staff, is_superuser

Rails:
  @user.update(params[:user])  // ⚠️ before strong parameters were mandatory
```

**Navigation:** Fixed bottom-left `target-switcher` only.

### JavaScript

```js
var authToken = null;
var currentUser = null;

function showBanner(id, type, msg) {
  var el = document.getElementById(id);
  el.className = 'result-banner ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}

// Login
document.getElementById('btn-login').addEventListener('click', async function() {
  try {
    var res = await fetch('http://localhost:3046/api/login', {
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
    currentUser = data.user;
    showBanner('login-result', 'success',
      '✓ Logged in as ' + data.user.username +
      ' | isAdmin: ' + data.user.isAdmin +
      ' | plan: ' + data.user.plan);
  } catch(e) { showBanner('login-result', 'failure', '✗ ' + e.message); }
});

// GET /api/me
document.getElementById('btn-me').addEventListener('click', async function() {
  if (!authToken) { showBanner('me-result', 'failure', '✗ Login first'); return; }
  try {
    var res = await fetch('http://localhost:3046/api/me', { headers: { 'Authorization': 'Bearer ' + authToken } });
    var data = await res.json();
    document.getElementById('me-output').textContent = JSON.stringify(data, null, 2);
    showBanner('me-result', 'success', '✓ Current user state');
  } catch(e) { showBanner('me-result', 'failure', '✗ ' + e.message); }
});

// PATCH (attack)
document.getElementById('btn-send').addEventListener('click', async function() {
  if (!authToken) { showBanner('patch-result', 'failure', '✗ Login first'); return; }
  var payload;
  try { payload = JSON.parse(document.getElementById('payload').value); }
  catch(e) { showBanner('patch-result', 'failure', '✗ Invalid JSON: ' + e.message); return; }
  try {
    var res = await fetch('http://localhost:3046/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    document.getElementById('patch-output').textContent = JSON.stringify(data, null, 2);
    if (data.isAdmin) {
      showBanner('patch-result', 'success', '✓ isAdmin: true — PRIVILEGE ESCALATION SUCCESSFUL');
    } else {
      showBanner('patch-result', 'success', '✓ Profile updated | isAdmin: ' + data.isAdmin);
    }
  } catch(e) { showBanner('patch-result', 'failure', '✗ ' + e.message); }
});

// GET /api/admin/users
document.getElementById('btn-admin').addEventListener('click', async function() {
  if (!authToken) { showBanner('admin-result', 'failure', '✗ Login first'); return; }
  try {
    var res = await fetch('http://localhost:3046/api/admin/users', { headers: { 'Authorization': 'Bearer ' + authToken } });
    var data = await res.json();
    if (res.ok) {
      showBanner('admin-result', 'success', '✓ Admin access granted — all ' + data.length + ' users returned');
      document.getElementById('admin-output').textContent = JSON.stringify(data, null, 2);
    } else {
      showBanner('admin-result', 'failure', '✗ ' + data.error);
      document.getElementById('admin-output').textContent = '';
    }
  } catch(e) { showBanner('admin-result', 'failure', '✗ ' + e.message); }
});
```

---

## Port 3048 — Protected ProfileHub

### File: `mass-assignment/victim-protected-server.js`

Identical to port 3046 — same users, same auth, same UI, same logout. Same CORS. Same `.login-input` CSS.

**Only change — the profile update endpoint and the response serializer:**

```js
// ✅ Only these fields may be updated by the user
const ALLOWED_PROFILE_FIELDS = ['bio', 'jobTitle', 'company', 'email'];

app.patch('/api/profile', requireAuth, (req, res) => {
  const update = {};
  for (const field of ALLOWED_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      update[field] = req.body[field];
    }
  }
  Object.assign(req.user, update);
  res.json(publicUser(req.user));
});
```

Also: the `publicUser()` function in the protected version should **not** return `isAdmin` or `isPremium` or `plan` in the response — these are server-internal fields the client should never read directly. The UI can infer admin status from session state, not from a field the attacker could monitor:

```js
function publicUser(u) {
  // ✅ Server-internal fields stripped from response
  return { id: u.id, username: u.username, email: u.email, bio: u.bio,
           jobTitle: u.jobTitle, company: u.company };
}
```

And the admin panel visibility should be determined server-side (via `GET /api/admin/users` returning 403) rather than client-side based on an `isAdmin` field in the API response.

**Green top banner:**
```
✅ PROTECTED: Explicit field allowlist — isAdmin, isPremium, plan cannot be written by users
```

When the attacker sends `{"isAdmin": true}` in a PATCH body, the response shows the same profile unchanged. The admin endpoint still returns 403.

---

## Shared `package.json`

```json
{
  "name": "mass-assignment-demo",
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

## README at `mass-assignment/README.md`

### Attack Flow

```
Attacker sends: PATCH /api/profile
  { "bio": "hello", "isAdmin": true, "plan": "admin" }
        ↓
ProfileHub (3046): Object.assign(req.user, req.body)
        ↓
req.user.isAdmin = true  ←  merged from request body without filtering
        ↓
Attacker now has admin access. Admin panel unlocks. All user records visible.
No password change. No privilege escalation UI. Just one HTTP request.
```

### What this demonstrates

`Object.assign(existingRecord, req.body)` blindly merges every field in the HTTP request body into the user object. If the user model has an `isAdmin` field and the developer forgot to exclude it, any authenticated user can escalate to admin by including `"isAdmin": true` in any profile update.

### Vulnerable line

```js
Object.assign(req.user, req.body); // ← no field filtering
```

### The fix

```js
const ALLOWED_PROFILE_FIELDS = ['bio', 'jobTitle', 'company', 'email'];
const update = {};
for (const field of ALLOWED_PROFILE_FIELDS) {
  if (Object.prototype.hasOwnProperty.call(req.body, field)) update[field] = req.body[field];
}
Object.assign(req.user, update);
```

### Run

```bash
cd demo-attacked/mass-assignment
npm install
npm run vulnerable           # :3046
npm run guide         # :3047
npm run secure # :3048
```

### Walkthrough

1. Log in at :3047 as alice
2. Click "GET /api/me" — confirm `isAdmin: false`
3. Send PATCH with `{"bio": "test", "isAdmin": true, "isPremium": true, "plan": "admin"}`
4. Response shows `"isAdmin": true` — privilege escalated
5. Click "GET /api/admin/users" — now returns all users
6. Switch to :3048 — same attack returns no change

### Key technical notes

**Two layers of defense in the protected version:**
1. Allowlist on write — `isAdmin` can never be set via PATCH
2. Strip from read — `publicUser()` never returns `isAdmin` in the API response, so the attacker can't confirm the current value via the API either

**Real-world variants:** Rails (before strong params were mandatory, `params[:user]` assigned all fields), Mongoose (`Model.findByIdAndUpdate(id, req.body)`), Django REST Framework (`fields = '__all__'` without `read_only_fields`). The pattern is universal across languages and ORMs.
