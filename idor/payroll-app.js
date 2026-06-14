/*
 * Shared PayrollHub app factory — used by victim-server.js and victim-protected-server.js
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function initDb() {
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
  return db;
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
      display: flex;
      flex-direction: column;
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
    .sidebar-footer {
      margin-top: auto;
      padding-top: 1.25rem;
      border-top: 1px solid #334155;
    }
    .user-card {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.75rem;
      padding: 0 0.25rem;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #6366f1;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .user-name { font-size: 0.82rem; color: #cbd5e1; word-break: break-all; }
    .main-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 1.75rem;
      height: 52px;
      display: flex;
      align-items: center;
      box-shadow: 0 1px 2px rgba(15,23,42,0.04);
    }
    .security-badge {
      margin-left: auto;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .breadcrumb { font-size: 0.9rem; color: #64748b; }
    .breadcrumb strong { color: #0f172a; font-weight: 600; }
    .content { padding: 1.75rem 2rem 3rem; flex: 1; }
    .payslip-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.85rem;
    }
    .card-header h3 { font-size: 1rem; color: #0f172a; }
    .card-id { font-size: 0.78rem; color: #94a3b8; font-family: 'Courier New', monospace; }
    .card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 2rem;
      font-size: 0.88rem;
      color: #475569;
      margin-bottom: 1rem;
    }
    .card-grid span { color: #0f172a; font-weight: 600; }
    .btn-view {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 0.45rem 1rem;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .btn-view:hover { background: #4f46e5; }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      max-width: 640px;
    }
    .detail-item {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
    }
    .detail-item label { display: block; font-size: 0.75rem; color: #64748b; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-item .value { font-size: 1.1rem; font-weight: 700; color: #0f172a; }
    .detail-item .value.salary { color: #6366f1; }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      font-size: 0.88rem;
      display: none;
    }
    .error-box.visible { display: block; }
    .error-box .hint { margin-top: 0.5rem; font-size: 0.82rem; color: #991b1b; }
    .profile-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.5rem;
      max-width: 480px;
    }
    .profile-card h2 { font-size: 1.1rem; margin-bottom: 1rem; }
    .profile-row { display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    .profile-row:last-child { border-bottom: none; }
    .profile-row span:first-child { color: #64748b; }
    .empty-state { color: #64748b; font-size: 0.9rem; padding: 2rem 0; }
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
    ? '✅ PROTECTED: /api/payslips/:id enforces AND user_id = ? — ownership verified on every request'
    : '⚠ VULNERABLE: /api/payslips/:id has no ownership check — any authenticated user can access any payslip by ID';
}

function securityBadgeHtml(isProtected) {
  return isProtected ? '<span class="security-badge">🛡 IDOR Protected</span>' : '';
}

function sharedLayoutScript() {
  return `
    var authToken = localStorage.getItem('authToken');

    function authHeaders() {
      return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken };
    }

    function redirectLogin() {
      window.location.href = '/login';
    }

    function initUserCard(user) {
      var avatar = document.getElementById('user-avatar');
      var nameEl = document.getElementById('sidebar-name');
      if (avatar) avatar.textContent = (user.fullName || user.username || '?').charAt(0).toUpperCase();
      if (nameEl) nameEl.textContent = user.fullName || user.username;
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
      if (!authToken) { redirectLogin(); return Promise.reject(); }
      return fetch('/api/me', { headers: { Authorization: 'Bearer ' + authToken } })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function(user) { initUserCard(user); return user; })
        .catch(function() {
          localStorage.removeItem('authToken');
          redirectLogin();
          return Promise.reject();
        });
    }
  `;
}

function sidebarHtml(active) {
  return (
    '<aside class="sidebar">' +
      '<div class="sidebar-brand"><span>Payroll</span>Hub</div>' +
      '<nav>' +
        '<a href="/"' + (active === 'payslips' ? ' class="active"' : '') + '>My Payslips</a>' +
        '<a href="/profile"' + (active === 'profile' ? ' class="active"' : '') + '>Profile</a>' +
      '</nav>' +
      '<div class="sidebar-footer">' +
        '<div class="user-card">' +
          '<div class="user-avatar" id="user-avatar">?</div>' +
          '<div class="user-name" id="sidebar-name">—</div>' +
        '</div>' +
        '<button id="btn-logout" style="' +
          'margin-top:auto;width:100%;padding:0.5rem;' +
          'background:transparent;border:1px solid #475569;' +
          'color:#94a3b8;border-radius:4px;cursor:pointer;font-size:0.8rem' +
        '">Sign Out</button>' +
      '</div>' +
    '</aside>'
  );
}

function buildLoginHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — PayrollHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="login-wrap">
    <div class="login-card">
      <h1><span>Payroll</span>Hub</h1>
      <p>Your payslips, anywhere</p>
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
    if (localStorage.getItem('authToken')) {
      window.location.href = '/';
    }
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

function buildDashboardHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Payslips — PayrollHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('payslips')}
    <div class="main-wrap">
      <header class="topbar">
        <div class="breadcrumb"><strong>My Payslips</strong></div>
        ${securityBadgeHtml(isProtected)}
      </header>
      <main class="content">
        <div id="payslip-list" class="empty-state">Loading payslips...</div>
      </main>
    </div>
  </div>
  <script>
    ${sharedLayoutScript()}
    function formatMoney(n) {
      return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    ensureAuth().then(function() {
      return fetch('/api/payslips', { headers: authHeaders() });
    }).then(function(r) { return r.json(); })
      .then(function(payslips) {
        var container = document.getElementById('payslip-list');
        if (!payslips.length) {
          container.textContent = 'No payslips found.';
          container.className = 'empty-state';
          return;
        }
        container.className = '';
        container.innerHTML = payslips.map(function(p) {
          return '<div class="payslip-card">' +
            '<div class="card-header">' +
              '<h3>' + p.period + '</h3>' +
              '<span class="card-id">ID: #' + p.id + '</span>' +
            '</div>' +
            '<div class="card-grid">' +
              '<div>Net Pay: <span>' + formatMoney(p.net_pay) + '</span></div>' +
              '<div>Gross: <span>' + formatMoney(p.gross_pay) + '</span></div>' +
              '<div>Tax Withheld: <span>' + formatMoney(p.tax_withheld) + '</span></div>' +
              '<div>Annual Salary: <span>' + formatMoney(p.annual_salary) + '</span></div>' +
            '</div>' +
            '<a class="btn-view" href="/payslip?id=' + p.id + '">View Details</a>' +
          '</div>';
        }).join('');
      })
      .catch(function() {});
  </script>
</body>
</html>`;
}

function buildPayslipHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  const protectedHint = isProtected
    ? "<p class=\"hint\">If you're seeing this on the protected server, the ownership check worked. This payslip exists but doesn't belong to you.</p>"
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip Details — PayrollHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('payslips')}
    <div class="main-wrap">
      <header class="topbar">
        <div class="breadcrumb"><a href="/" style="color:#6366f1;text-decoration:none">My Payslips</a> &rsaquo; <strong id="breadcrumb-period">Details</strong></div>
        ${securityBadgeHtml(isProtected)}
      </header>
      <main class="content">
        <div class="error-box" id="error-box">404 — Payslip not found${protectedHint}</div>
        <div id="detail-content" class="hidden">
          <div class="detail-grid" id="detail-grid"></div>
        </div>
      </main>
    </div>
  </div>
  <script>
    ${sharedLayoutScript()}
    function formatMoney(n) {
      return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    var params = new URLSearchParams(window.location.search);
    var payslipId = params.get('id');
    if (!payslipId) { window.location.href = '/'; }

    ensureAuth().then(function() {
      return fetch('/api/payslips/' + payslipId, { headers: authHeaders() });
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(res) {
        if (!res.ok) {
          document.getElementById('error-box').className = 'error-box visible';
          return;
        }
        var p = res.data;
        document.getElementById('breadcrumb-period').textContent = p.period;
        document.getElementById('detail-content').classList.remove('hidden');
        document.getElementById('detail-grid').innerHTML =
          '<div class="detail-item"><label>Period</label><div class="value">' + p.period + '</div></div>' +
          '<div class="detail-item"><label>Payslip ID</label><div class="value">#' + p.id + '</div></div>' +
          '<div class="detail-item"><label>Gross Pay</label><div class="value">' + formatMoney(p.gross_pay) + '</div></div>' +
          '<div class="detail-item"><label>Net Pay</label><div class="value">' + formatMoney(p.net_pay) + '</div></div>' +
          '<div class="detail-item"><label>Tax Withheld</label><div class="value">' + formatMoney(p.tax_withheld) + '</div></div>' +
          '<div class="detail-item"><label>Annual Salary</label><div class="value salary">' + formatMoney(p.annual_salary) + '</div></div>' +
          '<div class="detail-item"><label>Department</label><div class="value">' + p.department + '</div></div>' +
          '<div class="detail-item"><label>Owner user_id</label><div class="value">' + p.user_id + '</div></div>';
      })
      .catch(function() {});
  </script>
</body>
</html>`;
}

function buildProfileHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profile — PayrollHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('profile')}
    <div class="main-wrap">
      <header class="topbar">
        <div class="breadcrumb"><strong>Profile</strong></div>
        ${securityBadgeHtml(isProtected)}
      </header>
      <main class="content">
        <div class="profile-card" id="profile-card">
          <h2>Employee Profile</h2>
          <div class="profile-row"><span>Full Name</span><span id="pf-name">—</span></div>
          <div class="profile-row"><span>Username</span><span id="pf-user">—</span></div>
          <div class="profile-row"><span>User ID</span><span id="pf-id">—</span></div>
        </div>
      </main>
    </div>
  </div>
  <script>
    ${sharedLayoutScript()}
    ensureAuth().then(function(user) {
      document.getElementById('pf-name').textContent = user.fullName || '—';
      document.getElementById('pf-user').textContent = user.username;
      document.getElementById('pf-id').textContent = user.id;
    }).catch(function() {});
  </script>
</body>
</html>`;
}

function createPayrollApp(options) {
  const port = options.port;
  const isProtected = options.protected;
  const label = options.label;

  const app = express();
  const db = initDb();
  const sessions = new Map();

  app.use(cors({ origin: 'http://localhost:3041' }));
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
    res.send(buildDashboardHtml(isProtected));
  });

  app.get('/payslip', function (req, res) {
    res.send(buildPayslipHtml(isProtected));
  });

  app.get('/profile', function (req, res) {
    res.send(buildProfileHtml(isProtected));
  });

  app.post('/api/login', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.id, username: user.username, fullName: user.full_name });
    res.json({
      token: token,
      user: { id: user.id, username: user.username, fullName: user.full_name },
    });
  });

  app.get('/api/me', requireAuth, function (req, res) {
    res.json(req.user);
  });

  app.post('/api/logout', requireAuth, function (req, res) {
    const token = req.headers.authorization.slice(7);
    sessions.delete(token);
    res.json({ message: 'Logged out' });
  });

  app.get('/api/payslips', requireAuth, function (req, res) {
    const payslips = db.prepare('SELECT * FROM payslips WHERE user_id = ?').all(req.user.id);
    res.json(payslips);
  });

  app.get('/api/payslips/:id', requireAuth, function (req, res) {
    let payslip;
    if (isProtected) {
      payslip = db.prepare('SELECT * FROM payslips WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!payslip) return res.status(404).json({ error: 'Payslip not found' });
    } else {
      payslip = db.prepare('SELECT * FROM payslips WHERE id = ?').get(req.params.id);
      if (!payslip) return res.status(404).json({ error: 'Not found' });
    }
    res.json(payslip);
  });

  app.listen(port, function () {
    console.log(label + ' running at http://localhost:' + port);
  });
}

module.exports = { createPayrollApp };
