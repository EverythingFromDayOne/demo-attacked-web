/*
 * Terminal 1: cd demo-attacked/jwt-attacks && npm install && npm run vulnerable
 * Attack lab: npm run guide → http://localhost:3035
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');

const app = express();
const PORT = 3034;

const JWT_SECRET = 'secret';
const JWT_EXPIRES = '2h';

// In-memory denylist — stores jti values of logged-out tokens
const tokenDenylist = new Set();

const USERS = [
  { id: 1, username: 'alice', password: 'hunter2', role: 'developer' },
  { id: 2, username: 'bob', password: 'correct-horse', role: 'developer' },
  { id: 3, username: 'admin', password: 'Adm1nS3cr3t!', role: 'admin' },
];

const MOCK_KEYS = [
  { name: 'Production API', prefix: 'sk_live_', visible: 'sk_live_••••••••••••••••' },
  { name: 'Staging API', prefix: 'sk_test_', visible: 'sk_test_••••••••••••••••' },
  { name: 'Webhook Signing', prefix: 'whsec_', visible: 'whsec_••••••••••••••••' },
];

app.use(cors({ origin: 'http://localhost:3035' }));
app.use(express.json());

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

    if (header.alg === 'none') {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.jti && tokenDenylist.has(payload.jti)) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
      req.user = payload;
      return next();
    }

    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.jti && tokenDenylist.has(req.user.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token error: ' + err.message });
  }
}

function sharedCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      line-height: 1.5;
    }
    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .demo-banner {
      padding: 0.65rem 1.5rem;
      font-size: 0.82rem;
      text-align: center;
      font-weight: 500;
    }
    .demo-banner.vulnerable {
      background: #ffedd5;
      border-bottom: 2px solid #ea580c;
      color: #9a3412;
    }
    .layout {
      display: flex;
      min-height: calc(100vh - 42px);
    }
    .sidebar {
      width: 240px;
      background: #1e293b;
      color: #e2e8f0;
      padding: 1.5rem 1rem;
      flex-shrink: 0;
    }
    .sidebar-brand {
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 2rem;
      color: #fff;
    }
    .sidebar-brand span { color: #818cf8; }
    .sidebar-nav a {
      display: block;
      color: #94a3b8;
      text-decoration: none;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.88rem;
      margin-bottom: 0.25rem;
    }
    .sidebar-nav a:hover { background: #334155; color: #e2e8f0; }
    .sidebar-nav a.active { background: #334155; color: #fff; }
    .user-card {
      margin-top: 2rem;
      padding: 1rem;
      background: #0f172a;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .user-name { font-weight: 600; font-size: 0.9rem; }
    .role-badge {
      display: inline-block;
      margin-top: 0.35rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .role-badge.developer { background: #1e3a5f; color: #93c5fd; }
    .role-badge.admin { background: #450a0a; color: #fca5a5; }
    .main {
      flex: 1;
      padding: 1.75rem 2rem 3rem;
      background: #fff;
    }
    .panel {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }
    .panel h2 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #0f172a;
    }
    .token-area {
      width: 100%;
      min-height: 72px;
      padding: 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.75rem;
      background: #fff;
      color: #334155;
      resize: vertical;
    }
    .decoded-json {
      margin-top: 0.75rem;
      padding: 0.75rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.78rem;
      white-space: pre-wrap;
      word-break: break-all;
      color: #475569;
    }
    .btn {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin-top: 0.75rem;
    }
    .btn:hover { background: #4f46e5; }
    .btn-outline {
      background: #fff;
      color: #6366f1;
      border: 1px solid #6366f1;
    }
    .btn-outline:hover { background: #eef2ff; }
    .key-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.82rem;
    }
    .key-name { color: #64748b; font-family: inherit; font-size: 0.85rem; }
    .key-value { color: #94a3b8; letter-spacing: 0.05em; }
    .note { font-size: 0.82rem; color: #64748b; margin-top: 0.75rem; }
    .locked-panel {
      text-align: center;
      padding: 2.5rem;
      color: #64748b;
    }
    .locked-panel .lock { font-size: 2rem; margin-bottom: 0.75rem; }
    .admin-alert {
      background: #450a0a;
      border: 2px solid #dc2626;
      color: #fca5a5;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.88rem;
      margin-bottom: 1rem;
    }
    .team-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .team-table th, .team-table td {
      text-align: left;
      padding: 0.65rem 0.85rem;
      border: 1px solid #e2e8f0;
    }
    .team-table th { background: #fff; color: #475569; }
    .login-wrap {
      max-width: 400px;
      margin: 4rem auto;
      padding: 2rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }
    .login-wrap h1 { font-size: 1.35rem; margin-bottom: 0.5rem; }
    .login-wrap p { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 0.35rem; }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.65rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.9rem;
      margin-bottom: 1rem;
      font-family: inherit;
    }
    input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
    .login-error { color: #dc2626; font-size: 0.85rem; margin-bottom: 1rem; display: none; }
    .login-error.visible { display: block; }
    .admin-result {
      margin-top: 1rem;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .admin-result.error { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
    .admin-result.success { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
  `;
}

function buildSidebar(active) {
  return (
    '<aside class="sidebar">' +
      '<div class="sidebar-brand"><span>Auth</span>Vault</div>' +
      '<nav class="sidebar-nav">' +
        '<a href="/"' + (active === 'dashboard' ? ' class="active"' : '') + '>Dashboard</a>' +
        '<a href="/#keys"' + (active === 'keys' ? ' class="active"' : '') + '>API Keys</a>' +
        '<a href="/#team"' + (active === 'team' ? ' class="active"' : '') + '>Team</a>' +
        '<a href="/admin-panel"' + (active === 'admin' ? ' class="active"' : '') + '>Admin</a>' +
      '</nav>' +
      '<div class="user-card" id="user-card" style="display:none">' +
        '<div class="user-avatar" id="user-avatar">?</div>' +
        '<div class="user-name" id="sidebar-username">—</div>' +
        '<span class="role-badge developer" id="sidebar-role">developer</span>' +
        '<button id="btn-logout" style="' +
          'margin-top:1rem;width:100%;padding:0.5rem;background:transparent;' +
          'border:1px solid #475569;color:#94a3b8;border-radius:4px;cursor:pointer;font-size:0.8rem' +
        '">Sign Out</button>' +
      '</div>' +
    '</aside>'
  );
}

function buildDashboardHtml() {
  const keyRows = MOCK_KEYS.map(function (k) {
    return (
      '<div class="key-row">' +
        '<span class="key-name">' + escapeHtml(k.name) + '</span>' +
        '<span class="key-value">' + escapeHtml(k.visible) + '</span>' +
      '</div>'
    );
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AuthVault — API Key Management</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="demo-banner vulnerable">
    ⚠  VULNERABLE: JWT middleware trusts alg header — accepts unsigned tokens; secret is "secret"
  </div>
  <div class="layout">
    ${buildSidebar('dashboard')}
    <main class="main">
      <div class="panel" id="jwt-panel">
        <h2>Your JWT</h2>
        <textarea class="token-area" id="token-display" readonly placeholder="No token — sign in first"></textarea>
        <button type="button" class="btn btn-outline" id="btn-copy-token">Copy Token</button>
        <div class="decoded-json" id="decoded-header">Header: —</div>
        <div class="decoded-json" id="decoded-payload">Payload: —</div>
      </div>

      <div class="panel" id="keys">
        <h2>API Keys</h2>
        ${keyRows}
        <p class="note" id="keys-note">Login required. Your role: —. Admin keys are hidden.</p>
      </div>

      <div class="panel" id="team">
        <h2>Team</h2>
        <div id="team-content">
          <div class="locked-panel">
            <div class="lock">🔒</div>
            <p>Admin access required.</p>
          </div>
        </div>
      </div>
    </main>
  </div>
  <script>
    var STORAGE_KEY = 'authToken';

    function b64urlDecode(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      return atob(str);
    }

    function decodeToken(token) {
      try {
        var parts = token.split('.');
        if (parts.length < 2) return null;
        return {
          header: JSON.parse(b64urlDecode(parts[0])),
          payload: JSON.parse(b64urlDecode(parts[1]))
        };
      } catch (e) { return null; }
    }

    function renderTeam(role) {
      var el = document.getElementById('team-content');
      if (role !== 'admin') {
        el.innerHTML = '<div class="locked-panel"><div class="lock">🔒</div><p>Admin access required.</p></div>';
        return;
      }
      fetch('/api/admin', { headers: { Authorization: 'Bearer ' + localStorage.getItem(STORAGE_KEY) } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.users) {
            el.innerHTML = '<div class="locked-panel"><p>' + (data.error || 'Access denied') + '</p></div>';
            return;
          }
          var rows = data.users.map(function (u) {
            return '<tr><td>' + u.username + '</td><td>' + u.role + '</td><td><code>' + u.apiKey + '</code></td></tr>';
          }).join('');
          el.innerHTML =
            '<div class="admin-alert">🚨 ADMIN ACCESS GRANTED — all team secrets visible</div>' +
            '<table class="team-table"><thead><tr><th>User</th><th>Role</th><th>API Key</th></tr></thead><tbody>' + rows + '</tbody></table>';
        });
    }

    function loadDashboard() {
      var token = localStorage.getItem(STORAGE_KEY);
      if (!token) {
        window.location.href = '/login';
        return;
      }
      document.getElementById('token-display').value = token;
      var decoded = decodeToken(token);
      if (decoded) {
        document.getElementById('decoded-header').textContent = 'Header: ' + JSON.stringify(decoded.header, null, 2);
        document.getElementById('decoded-payload').textContent = 'Payload: ' + JSON.stringify(decoded.payload, null, 2);
      }
      fetch('/api/whoami', { headers: { Authorization: 'Bearer ' + token } })
        .then(function (r) { return r.json(); })
        .then(function (user) {
          if (user.error) {
            localStorage.removeItem(STORAGE_KEY);
            window.location.href = '/login';
            return;
          }
          var role = user.role || 'developer';
          var username = user.username || 'user';
          document.getElementById('user-card').style.display = 'block';
          document.getElementById('user-avatar').textContent = username.charAt(0).toUpperCase();
          document.getElementById('sidebar-username').textContent = username;
          var badge = document.getElementById('sidebar-role');
          badge.textContent = role;
          badge.className = 'role-badge ' + role;
          document.getElementById('keys-note').textContent =
            'Login required. Your role: ' + role + '. Admin keys are hidden.';
          renderTeam(role);
        });
    }

    document.getElementById('btn-copy-token').addEventListener('click', function () {
      var token = document.getElementById('token-display').value;
      navigator.clipboard.writeText(token).then(function () {
        document.getElementById('btn-copy-token').textContent = 'Copied!';
        setTimeout(function () { document.getElementById('btn-copy-token').textContent = 'Copy Token'; }, 1500);
      });
    });

    document.getElementById('btn-logout').addEventListener('click', async function () {
      var token = localStorage.getItem('authToken');
      if (!token) { localStorage.clear(); window.location.href = '/login'; return; }
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        });
      } catch (e) { /* ignore */ }
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    });

    loadDashboard();
  </script>
</body>
</html>`;
}

function buildLoginHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — AuthVault</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="demo-banner vulnerable">
    ⚠  VULNERABLE: JWT middleware trusts alg header — accepts unsigned tokens; secret is "secret"
  </div>
  <div class="login-wrap">
    <h1>AuthVault</h1>
    <p>Sign in to manage your API keys</p>
    <div class="login-error" id="login-error"></div>
    <form id="login-form">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" value="alice" autocomplete="username">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" value="hunter2" autocomplete="current-password">
      <button type="submit" class="btn" style="width:100%;margin-top:0">Sign In</button>
    </form>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('login-error');
      errEl.className = 'login-error';
      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('username').value,
          password: document.getElementById('password').value
        })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok) {
            errEl.textContent = res.data.error || 'Login failed';
            errEl.className = 'login-error visible';
            return;
          }
          localStorage.setItem('authToken', res.data.token);
          window.location.href = '/';
        })
        .catch(function (err) {
          errEl.textContent = err.message;
          errEl.className = 'login-error visible';
        });
    });
  </script>
</body>
</html>`;
}

function buildAdminPanelHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel — AuthVault</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="demo-banner vulnerable">
    ⚠  VULNERABLE: JWT middleware trusts alg header — accepts unsigned tokens; secret is "secret"
  </div>
  <div class="layout">
    ${buildSidebar('admin')}
    <main class="main">
      <h1 style="font-size:1.25rem;margin-bottom:1rem">Admin Panel</h1>
      <p style="color:#64748b;font-size:0.9rem;margin-bottom:1rem">Fetches <code>GET /api/admin</code> with your stored JWT.</p>
      <button type="button" class="btn" id="btn-fetch-admin">Fetch Admin Data</button>
      <div class="admin-result" id="admin-result">Click Fetch to test your token.</div>
    </main>
  </div>
  <script>
    var STORAGE_KEY = 'authToken';

    document.getElementById('btn-fetch-admin').addEventListener('click', function () {
      var token = localStorage.getItem(STORAGE_KEY);
      var el = document.getElementById('admin-result');
      if (!token) {
        el.className = 'admin-result error';
        el.textContent = 'No token — sign in at /login first';
        return;
      }
      el.className = 'admin-result';
      el.textContent = 'Loading...';
      fetch('/api/admin', { headers: { Authorization: 'Bearer ' + token } })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (res.ok) {
            el.className = 'admin-result success';
            el.textContent = '🚨 ADMIN ACCESS GRANTED\\n\\n' + JSON.stringify(res.data, null, 2);
          } else {
            el.className = 'admin-result error';
            el.textContent = '✗ ' + (res.data.error || 'Access denied');
          }
        })
        .catch(function (err) {
          el.className = 'admin-result error';
          el.textContent = err.message;
        });
    });
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildDashboardHtml());
});

app.get('/login', function (req, res) {
  res.send(buildLoginHtml());
});

app.get('/admin-panel', function (req, res) {
  res.send(buildAdminPanelHtml());
});

app.post('/api/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  const user = USERS.find(function (u) {
    return u.username === username && u.password === password;
  });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
      jti: randomBytes(16).toString('hex'),
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES }
  );
  res.json({ token: token, user: { username: user.username, role: user.role } });
});

app.post('/api/logout', verifyToken, function (req, res) {
  if (req.user.jti) {
    tokenDenylist.add(req.user.jti);
  }
  res.json({ message: 'Logged out — token revoked' });
});

app.get('/api/profile', verifyToken, function (req, res) {
  res.json(req.user);
});

app.get('/api/whoami', verifyToken, function (req, res) {
  res.json(req.user);
});

app.get('/api/admin', verifyToken, function (req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  res.json({
    users: USERS.map(function (u) {
      return {
        username: u.username,
        role: u.role,
        apiKey: 'sk_live_' + u.username + '_' + String(u.id).padStart(4, '0') + '_SECRET',
      };
    }),
  });
});

app.listen(PORT, function () {
  console.log('AuthVault (vulnerable) running at http://localhost:' + PORT);
});
