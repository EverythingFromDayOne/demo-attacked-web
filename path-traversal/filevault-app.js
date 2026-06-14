/*
 * Shared FileVault app factory — used by victim-server.js and victim-protected-server.js
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS = [
  { id: 1, username: 'alice', password: 'alice123' },
  { id: 2, username: 'bob', password: 'bob123' },
];

const SEEDED_FILES = ['q2-report.txt', 'meeting-notes.txt', 'readme.txt'];

function seedUploadsDir(baseDir) {
  const uploadsDir = path.join(baseDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  fs.writeFileSync(
    path.join(uploadsDir, 'q2-report.txt'),
    'Q2 Financial Report\n====================\nRevenue: $1,240,000\nExpenses: $890,000\nNet: $350,000\n'
  );
  fs.writeFileSync(
    path.join(uploadsDir, 'meeting-notes.txt'),
    'Meeting Notes — 2026-06-15\n==========================\nAttendees: Alice, Bob, Charlie\nDecision: Launch delayed to Q3.\n'
  );
  fs.writeFileSync(
    path.join(uploadsDir, 'readme.txt'),
    'FileVault — Private Document Storage\nUpload your files here. Only you can access them.\n'
  );

  return uploadsDir;
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
    .demo-banner {
      background: #ffedd5;
      border-bottom: 2px solid #ea580c;
      color: #9a3412;
      padding: 0.6rem 1.5rem;
      font-size: 0.82rem;
      text-align: center;
      font-weight: 500;
    }
    .demo-banner.protected {
      background: #dcfce7;
      border-bottom-color: #16a34a;
      color: #166534;
    }
    .layout { display: flex; min-height: calc(100vh - 40px); }
    .sidebar {
      width: 220px;
      background: #1e293b;
      color: #e2e8f0;
      padding: 1.25rem 0.75rem;
      flex-shrink: 0;
    }
    .sidebar-brand {
      font-weight: 700;
      font-size: 1.05rem;
      color: #fff;
      padding: 0 0.85rem 1.25rem;
      border-bottom: 1px solid #334155;
      margin-bottom: 1rem;
    }
    .sidebar-brand span { color: #818cf8; }
    .sidebar a {
      display: block;
      color: #94a3b8;
      text-decoration: none;
      padding: 0.55rem 0.85rem;
      border-radius: 6px;
      font-size: 0.88rem;
      margin-bottom: 0.2rem;
    }
    .sidebar a:hover, .sidebar a.active { background: #334155; color: #fff; }
    .main-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 1.75rem;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 1px 2px rgba(15,23,42,0.04);
    }
    .logo { font-weight: 700; font-size: 1.1rem; color: #0f172a; }
    .logo span { color: #6366f1; }
    .topbar-right { display: flex; align-items: center; gap: 0.75rem; }
    .user-badge {
      background: #eef2ff;
      color: #4338ca;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .security-badge {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .btn-logout {
      background: transparent;
      border: 1px solid #cbd5e1;
      color: #64748b;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.82rem;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-logout:hover { background: #f1f5f9; }
    .content { padding: 1.75rem 2rem 3rem; flex: 1; }
    .content h2 { font-size: 1.15rem; margin-bottom: 0.35rem; }
    .content .subtitle { color: #64748b; font-size: 0.88rem; margin-bottom: 1.5rem; }
    .file-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .file-info h3 { font-size: 0.95rem; margin-bottom: 0.2rem; }
    .file-info p { font-size: 0.82rem; color: #64748b; font-family: 'Courier New', monospace; }
    .btn-download {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-download:hover { background: #4f46e5; }
    .btn-download:disabled { opacity: 0.6; cursor: not-allowed; }
    .preview-panel {
      margin-top: 1.5rem;
      background: #0d0d0d;
      color: #f1f5f9;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 120px;
      display: none;
    }
    .preview-panel.visible { display: block; }
    .preview-label {
      font-size: 0.78rem;
      color: #64748b;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      display: none;
    }
    .preview-label.visible { display: block; }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      font-size: 0.88rem;
      margin-top: 1rem;
      display: none;
    }
    .error-box.visible { display: block; }
    .error-box .hint { margin-top: 0.5rem; font-size: 0.82rem; color: #991b1b; }
    .upload-card {
      background: #fff;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 2rem;
      text-align: center;
      max-width: 480px;
      color: #64748b;
      font-size: 0.9rem;
    }
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
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
    label.field-label { display: block; font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 0.4rem; }
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
    }
    .btn-signin:hover { background: #4f46e5; }
    .hidden { display: none !important; }
  `;
}

function bannerText(isProtected) {
  return isProtected
    ? '✅ PROTECTED: path.resolve() + startsWith() containment check — traversal blocked'
    : '⚠ VULNERABLE: /api/download?file= uses path.join() with no containment check — traversal possible';
}

function sharedAppScript() {
  return `
    var authToken = localStorage.getItem('authToken');

    function authHeaders() {
      return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken };
    }

    function bootUser(user) {
      var badge = document.getElementById('user-badge');
      if (badge) badge.textContent = user.username;
    }

    document.getElementById('btn-logout').addEventListener('click', async function() {
      var token = localStorage.getItem('authToken');
      if (token) {
        try { await fetch('/api/logout', { method:'POST', headers:{'Authorization':'Bearer '+token} }); }
        catch(e) {}
      }
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    });

    function ensureAuth() {
      if (!authToken) { window.location.href = '/login'; return Promise.reject(); }
      return fetch('/api/me', { headers: { Authorization: 'Bearer ' + authToken } })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function(user) { bootUser(user); return user; })
        .catch(function() {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          return Promise.reject();
        });
    }
  `;
}

function sidebarHtml(active) {
  return (
    '<aside class="sidebar">' +
      '<div class="sidebar-brand"><span>File</span>Vault</div>' +
      '<nav>' +
        '<a href="/"' + (active === 'files' ? ' class="active"' : '') + '>My Files</a>' +
        '<a href="/upload"' + (active === 'upload' ? ' class="active"' : '') + '>Upload</a>' +
      '</nav>' +
    '</aside>'
  );
}

function topbarHtml(isProtected) {
  const securityBadge = isProtected
    ? '<span class="security-badge">🛡 Path Traversal Protected</span>'
    : '';
  return (
    '<header class="topbar">' +
      '<div class="logo"><span>File</span>Vault</div>' +
      '<div class="topbar-right">' +
        securityBadge +
        '<div class="user-badge" id="user-badge">—</div>' +
        '<button type="button" class="btn-logout" id="btn-logout">Sign Out</button>' +
      '</div>' +
    '</header>'
  );
}

function buildLoginHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — FileVault</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="login-wrap">
    <div class="login-card">
      <h1><span>File</span>Vault</h1>
      <p>Your files, always available</p>
      <div class="login-error" id="login-error"></div>
      <form id="login-form">
        <label class="field-label" for="username">Username</label>
        <input type="text" class="login-input" id="username" value="alice" autocomplete="username">
        <label class="field-label" for="password">Password</label>
        <input type="password" class="login-input" id="password" value="alice123" autocomplete="current-password">
        <button type="submit" class="btn-signin">Sign In</button>
      </form>
    </div>
  </div>
  <script>
    if (localStorage.getItem('authToken')) window.location.href = '/';
    document.getElementById('login-form').addEventListener('submit', function(e) {
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
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(res) {
          if (!res.ok) {
            errEl.textContent = res.data.error || 'Login failed';
            errEl.className = 'login-error visible';
            return;
          }
          localStorage.setItem('authToken', res.data.token);
          window.location.href = '/';
        })
        .catch(function(err) {
          errEl.textContent = err.message;
          errEl.className = 'login-error visible';
        });
    });
  </script>
</body>
</html>`;
}

function buildFilesHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  const protectedHint = isProtected
    ? '<p class="hint">The resolved path escaped the uploads directory. Request blocked.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Files — FileVault</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('files')}
    <div class="main-wrap">
      ${topbarHtml(isProtected)}
      <main class="content">
        <h2>My Files</h2>
        <p class="subtitle">Download your private documents</p>
        <div id="file-list"></div>
        <div class="error-box" id="download-error">403 — Access denied: path traversal detected${protectedHint}</div>
        <div class="preview-label" id="preview-label">File contents:</div>
        <div class="preview-panel" id="preview-panel"></div>
      </main>
    </div>
  </div>
  <script>
    ${sharedAppScript()}
    ensureAuth().then(function() {
      return fetch('/api/files', { headers: authHeaders() });
    }).then(function(r) { return r.json(); })
      .then(function(files) {
        var list = document.getElementById('file-list');
        list.innerHTML = files.map(function(name) {
          return '<div class="file-card">' +
            '<div class="file-info"><h3>' + name + '</h3><p>uploads/' + name + '</p></div>' +
            '<button type="button" class="btn-download" data-file="' + name + '">Download</button>' +
          '</div>';
        }).join('');

        document.querySelectorAll('.btn-download').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var filename = btn.getAttribute('data-file');
            var errBox = document.getElementById('download-error');
            var preview = document.getElementById('preview-panel');
            var label = document.getElementById('preview-label');
            errBox.className = 'error-box';
            preview.className = 'preview-panel';
            label.className = 'preview-label';
            preview.textContent = 'Loading...';
            preview.className = 'preview-panel visible';
            label.className = 'preview-label visible';
            btn.disabled = true;

            fetch('/api/download?file=' + encodeURIComponent(filename), { headers: authHeaders() })
              .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
              .then(function(res) {
                btn.disabled = false;
                if (!res.ok) {
                  preview.className = 'preview-panel';
                  label.className = 'preview-label';
                  if (res.status === 403) {
                    errBox.className = 'error-box visible';
                  } else {
                    preview.textContent = res.data.error || 'Error';
                    preview.className = 'preview-panel visible';
                    label.className = 'preview-label visible';
                  }
                  return;
                }
                preview.textContent = res.data.content;
              })
              .catch(function(e) {
                btn.disabled = false;
                preview.textContent = 'Error: ' + e.message;
              });
          });
        });
      })
      .catch(function() {});
  </script>
</body>
</html>`;
}

function buildUploadHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload — FileVault</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('upload')}
    <div class="main-wrap">
      ${topbarHtml(isProtected)}
      <main class="content">
        <h2>Upload</h2>
        <p class="subtitle">Add new documents to your vault</p>
        <div class="upload-card">
          Upload is disabled in this security demo.<br>
          Use the attack guide at localhost:3044 to test path traversal payloads.
        </div>
      </main>
    </div>
  </div>
  <script>${sharedAppScript()} ensureAuth().catch(function() {});</script>
</body>
</html>`;
}

function createFileVaultApp(options) {
  const port = options.port;
  const isProtected = options.protected;
  const label = options.label;
  const baseDir = __dirname;

  seedUploadsDir(baseDir);

  const app = express();
  const sessions = new Map();

  app.use(cors({ origin: 'http://localhost:3044' }));
  app.use(express.json());

  function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const session = sessions.get(token);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    req.user = session;
    next();
  }

  app.get('/login', function (req, res) {
    res.send(buildLoginHtml());
  });

  app.get('/', function (req, res) {
    res.send(buildFilesHtml(isProtected));
  });

  app.get('/upload', function (req, res) {
    res.send(buildUploadHtml(isProtected));
  });

  app.post('/api/login', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const user = USERS.find(function (u) {
      return u.username === username && u.password === password;
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.id, username: user.username });
    res.json({ token: token, user: { username: user.username } });
  });

  app.post('/api/logout', requireAuth, function (req, res) {
    sessions.delete(req.headers.authorization.slice(7));
    res.json({ message: 'Logged out' });
  });

  app.get('/api/me', requireAuth, function (req, res) {
    res.json(req.user);
  });

  app.get('/api/files', requireAuth, function (req, res) {
    res.json(SEEDED_FILES);
  });

  app.get('/api/download', requireAuth, function (req, res) {
    const filename = req.query.file;
    if (!filename) return res.status(400).json({ error: 'No file specified' });

    if (isProtected) {
      const uploadsDir = path.resolve(baseDir, 'uploads');
      const requestedPath = path.resolve(uploadsDir, filename);

      if (!requestedPath.startsWith(uploadsDir + path.sep)) {
        return res.status(403).json({ error: 'Access denied: path traversal detected' });
      }

      if (!fs.existsSync(requestedPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const content = fs.readFileSync(requestedPath, 'utf8');
      return res.json({ filename: filename, content: content });
    }

    const filePath = path.join(baseDir, 'uploads', filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ filename: filename, content: content });
  });

  app.listen(port, function () {
    console.log(label + ' running at http://localhost:' + port);
  });
}

module.exports = { createFileVaultApp };
