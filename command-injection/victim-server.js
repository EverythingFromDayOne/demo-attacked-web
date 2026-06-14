/*
 * Terminal 1: cd demo-attacked/command-injection && npm install && npm run victim
 * Attack guide: npm run attacker → http://localhost:3038
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();
const PORT = 3037;
const IS_WIN = process.platform === 'win32';
const PING_FLAG = IS_WIN ? '-n 4' : '-c 4';

const USERS = [
  { username: 'alice', password: 'alice123', role: 'developer' },
  { username: 'bob', password: 'bob123', role: 'developer' },
  { username: 'admin', password: 'admin456', role: 'admin' },
];

const sessions = new Map();

app.use(cors({ origin: 'http://localhost:3038' }));
app.use(express.json());

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.user = session;
  next();
}

function sharedCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      color: #1e293b;
      min-height: 100vh;
      line-height: 1.5;
    }
    .topbar {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 1.5rem;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo { font-weight: 700; font-size: 1.15rem; color: #1e293b; }
    .logo span { color: #6366f1; }
    .user-badge {
      background: #eef2ff;
      color: #4338ca;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .layout { display: flex; min-height: calc(100vh - 56px); }
    .sidebar {
      width: 220px;
      background: #1e1e2e;
      color: #e2e8f0;
      padding: 1.25rem 0.75rem;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }
    .sidebar a {
      display: block;
      color: #94a3b8;
      text-decoration: none;
      padding: 0.55rem 0.85rem;
      border-radius: 6px;
      font-size: 0.88rem;
      margin-bottom: 0.2rem;
      cursor: pointer;
    }
    .sidebar a:hover, .sidebar a.active { background: #2d2d44; color: #fff; }
    .sidebar-footer {
      margin-top: auto;
      padding-top: 1.25rem;
      border-top: 1px solid #2d2d44;
    }
    .sidebar-user {
      font-size: 0.82rem;
      color: #cbd5e1;
      margin-bottom: 0.5rem;
      word-break: break-all;
    }
    .session-note {
      margin-top: 0.75rem;
      font-size: 0.68rem;
      color: #64748b;
      line-height: 1.5;
      font-family: 'Courier New', Courier, monospace;
    }
    .main { flex: 1; padding: 1.75rem 2rem 3rem; }
    .tool-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      max-width: 720px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .tool-card h2 { font-size: 1.1rem; margin-bottom: 0.35rem; }
    .tool-desc { color: #64748b; font-size: 0.88rem; margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 0.4rem; }
    input[type="text"] {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.95rem;
      margin-bottom: 1rem;
      font-family: inherit;
    }
    input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
    .btn-run {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-run:hover { background: #4f46e5; }
    .btn-run:disabled { opacity: 0.6; cursor: not-allowed; }
    .output {
      margin-top: 1.25rem;
      padding: 1rem;
      background: #0d0d0d;
      color: #f1f5f9;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 120px;
    }
    .error-msg { color: #dc2626; font-size: 0.85rem; margin-top: 0.75rem; display: none; }
    .error-msg.visible { display: block; }
    .hidden { display: none !important; }
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      padding: 1.5rem;
    }
    .login-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 16px rgba(15,23,42,0.06);
    }
    .login-card h1 { font-size: 1.5rem; margin-bottom: 0.35rem; }
    .login-card h1 span { color: #6366f1; }
    .login-card p { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
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
      margin-bottom: 1rem;
    }
    .login-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }
    .login-error { color: #dc2626; font-size: 0.85rem; margin-bottom: 1rem; display: none; }
    .login-error.visible { display: block; }
    .btn-signin {
      width: 100%;
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 0.75rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }
    .btn-signin:hover { background: #4f46e5; }
    .demo-banner {
      background: #ffedd5;
      border-bottom: 2px solid #ea580c;
      color: #9a3412;
      padding: 0.6rem 1.5rem;
      font-size: 0.82rem;
      text-align: center;
      font-weight: 500;
    }
  `;
}

function buildAppHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NetProbe — Network Diagnostics</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div id="login-view" class="login-wrap">
    <div class="login-card">
      <h1><span>Net</span>Probe</h1>
      <p>Instant network diagnostics for developers</p>
      <div class="login-error" id="login-error"></div>
      <form id="login-form">
        <label for="username">Username</label>
        <input type="text" class="login-input" id="username" value="alice" autocomplete="username">
        <label for="password">Password</label>
        <input type="password" class="login-input" id="password" value="alice123" autocomplete="current-password">
        <button type="submit" class="btn-signin">Sign In</button>
      </form>
    </div>
  </div>

  <div id="app-view" class="hidden">
    <div class="demo-banner">
      ⚠ VULNERABLE: user input passed to child_process.exec() — shell metacharacters execute arbitrary commands
    </div>
    <header class="topbar">
      <div class="logo"><span>Net</span>Probe</div>
      <div class="user-badge" id="user-badge">—</div>
    </header>
    <div class="layout">
      <nav class="sidebar">
        <a href="#" data-tool="ping" class="active">Ping</a>
        <a href="#" data-tool="dns">DNS Lookup</a>
        <a href="#" data-tool="http">HTTP Check</a>
        <div class="sidebar-footer">
          <div class="sidebar-user" id="sidebar-user">—</div>
          <button id="btn-logout" style="
            margin-top:1rem;width:100%;padding:0.5rem;
            background:transparent;border:1px solid #475569;
            color:#94a3b8;border-radius:4px;cursor:pointer;font-size:0.8rem;
          ">Sign Out</button>
          <p class="session-note">Unlike JWT, server-side session logout is complete and instant. sessions.delete(token) removes the token — no denylist needed. Compare: jwt-attacks demo requires an in-memory Set just to approximate this.</p>
        </div>
      </nav>
      <main class="main">
        <div class="tool-card" id="tool-ping">
          <h2>Ping</h2>
          <p class="tool-desc">Send 4 ICMP packets to a target host.</p>
          <label for="ping-host">Target Hostname</label>
          <input type="text" id="ping-host" value="localhost" placeholder="e.g. localhost">
          <button type="button" class="btn-run" id="btn-ping">Run Diagnostic</button>
          <div class="error-msg" id="ping-error"></div>
          <div class="output" id="ping-output">Output will appear here.</div>
        </div>
        <div class="tool-card hidden" id="tool-dns">
          <h2>DNS Lookup</h2>
          <p class="tool-desc">Resolve a hostname to IP addresses.</p>
          <label for="dns-host">Target Hostname</label>
          <input type="text" id="dns-host" value="localhost" placeholder="e.g. example.com">
          <button type="button" class="btn-run" id="btn-dns">Run Diagnostic</button>
          <div class="error-msg" id="dns-error"></div>
          <div class="output" id="dns-output">Output will appear here.</div>
        </div>
        <div class="tool-card hidden" id="tool-http">
          <h2>HTTP Check</h2>
          <p class="tool-desc">Fetch response headers for a URL.</p>
          <label for="http-url">Target URL</label>
          <input type="text" id="http-url" value="http://localhost" placeholder="https://example.com">
          <button type="button" class="btn-run" id="btn-http">Run Diagnostic</button>
          <div class="error-msg" id="http-error"></div>
          <div class="output" id="http-output">Output will appear here.</div>
        </div>
      </main>
    </div>
  </div>

  <script>
    var authToken = localStorage.getItem('authToken');

    function authHeaders() {
      return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken };
    }

    function showTool(name) {
      ['ping', 'dns', 'http'].forEach(function (t) {
        document.getElementById('tool-' + t).classList.toggle('hidden', t !== name);
      });
      document.querySelectorAll('.sidebar a').forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('data-tool') === name);
      });
    }

    document.querySelectorAll('.sidebar a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        showTool(a.getAttribute('data-tool'));
      });
    });

    function runDiagnostic(endpoint, body, outputId, errorId, btn) {
      var out = document.getElementById(outputId);
      var err = document.getElementById(errorId);
      err.className = 'error-msg';
      err.textContent = '';
      out.textContent = 'Running...';
      btn.disabled = true;
      fetch(endpoint, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok && res.data.error) {
            err.textContent = res.data.error;
            err.className = 'error-msg visible';
            out.textContent = JSON.stringify(res.data, null, 2);
            return;
          }
          var text = res.data.output || '';
          if (res.data.error) text += (text ? '\\n\\n' : '') + 'stderr: ' + res.data.error;
          out.textContent = text || JSON.stringify(res.data, null, 2);
        })
        .catch(function (e) {
          btn.disabled = false;
          out.textContent = 'Error: ' + e.message;
        });
    }

    document.getElementById('btn-ping').addEventListener('click', function () {
      runDiagnostic('/api/ping', { hostname: document.getElementById('ping-host').value },
        'ping-output', 'ping-error', document.getElementById('btn-ping'));
    });
    document.getElementById('btn-dns').addEventListener('click', function () {
      runDiagnostic('/api/dns', { hostname: document.getElementById('dns-host').value },
        'dns-output', 'dns-error', document.getElementById('btn-dns'));
    });
    document.getElementById('btn-http').addEventListener('click', function () {
      runDiagnostic('/api/http-check', { url: document.getElementById('http-url').value },
        'http-output', 'http-error', document.getElementById('btn-http'));
    });

    document.getElementById('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('login-error');
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
          authToken = res.data.token;
          localStorage.setItem('authToken', authToken);
          bootApp(res.data.user);
        })
        .catch(function (err) {
          errEl.textContent = err.message;
          errEl.className = 'login-error visible';
        });
    });

    function bootApp(user) {
      document.getElementById('login-view').classList.add('hidden');
      document.getElementById('app-view').classList.remove('hidden');
      var label = user.username + ' (' + user.role + ')';
      document.getElementById('user-badge').textContent = label;
      document.getElementById('sidebar-user').textContent = label;
    }

    document.getElementById('btn-logout').addEventListener('click', async function() {
      var token = localStorage.getItem('authToken');
      if (token) {
        try { await fetch('/api/logout', { method:'POST', headers:{'Authorization':'Bearer '+token} }); }
        catch(e) {}
      }
      localStorage.removeItem('authToken');
      authToken = null;
      window.location.href = '/login';
    });

    if (authToken) {
      fetch('/api/me', { headers: { Authorization: 'Bearer ' + authToken } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (user) { bootApp(user); })
        .catch(function () {
          localStorage.removeItem('authToken');
          authToken = null;
        });
    }
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildAppHtml());
});

app.get('/login', function (req, res) {
  res.send(buildAppHtml());
});

app.post('/api/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  const user = USERS.find(function (u) {
    return u.username === username && u.password === password;
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: user.username, role: user.role });
  res.json({ token: token, user: { username: user.username, role: user.role } });
});

app.get('/api/me', requireAuth, function (req, res) {
  res.json(req.user);
});

app.post('/api/logout', requireAuth, function (req, res) {
  const token = req.headers.authorization.slice(7);
  sessions.delete(token);
  res.json({ message: 'Logged out' });
});

app.post('/api/ping', requireAuth, function (req, res) {
  const hostname = req.body.hostname || '';
  const command = 'ping ' + PING_FLAG + ' ' + hostname;
  exec(command, { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.post('/api/dns', requireAuth, function (req, res) {
  const hostname = req.body.hostname || '';
  exec('nslookup ' + hostname, { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.post('/api/http-check', requireAuth, function (req, res) {
  const url = req.body.url || '';
  exec('curl -I --max-time 5 ' + url, { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.listen(PORT, function () {
  console.log('NetProbe (vulnerable) running at http://localhost:' + PORT);
});
