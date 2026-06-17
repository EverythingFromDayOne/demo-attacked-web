/*
 * Terminal 3: cd demo-attacked/nosql-injection && npm run secure
 */

const express = require('express');

const app = express();
const PORT = 3024;

const users = [
  { id: 1, username: 'alice', password: 'hunter2', role: 'developer', email: 'alice@devteam.io', team: 'Frontend' },
  { id: 2, username: 'bob', password: 'correct-horse', role: 'developer', email: 'bob@devteam.io', team: 'Backend' },
  { id: 3, username: 'admin', password: 'Adm1nS3cr3t!', role: 'admin', email: 'admin@devteam.io', team: 'Platform' },
  { id: 4, username: 'carol', password: 'letmein', role: 'developer', email: 'carol@devteam.io', team: 'DevOps' },
];

function evaluateCondition(fieldValue, condition) {
  if (typeof condition !== 'object' || condition === null) {
    return fieldValue === condition;
  }
  if ('$gt' in condition) return fieldValue > condition['$gt'];
  if ('$gte' in condition) return fieldValue >= condition['$gte'];
  if ('$lt' in condition) return fieldValue < condition['$lt'];
  if ('$ne' in condition) return fieldValue !== condition['$ne'];
  if ('$regex' in condition) {
    return new RegExp(condition['$regex'], condition['$options'] || '').test(fieldValue);
  }
  if ('$exists' in condition) {
    return condition['$exists'] ? fieldValue !== undefined : fieldValue === undefined;
  }
  return false;
}

function findOne(query) {
  return users.find(function (user) {
    return Object.keys(query).every(function (key) {
      return evaluateCondition(user[key], query[key]);
    });
  }) || null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function avatarBg(role) {
  return role === 'admin' ? '#92400e' : '#1e3a5f';
}

function roleBadge(role) {
  if (role === 'admin') {
    return '<span class="role-badge admin">admin</span>';
  }
  return '<span class="role-badge developer">developer</span>';
}

function sharedCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100vh;
      line-height: 1.5;
    }
    a { color: inherit; }
    .top-banner {
      width: 100%;
      padding: 0.6rem 1.5rem;
      font-size: 0.8rem;
      line-height: 1.55;
      text-align: center;
    }
    .top-banner.protected {
      background: #14532d;
      color: #bbf7d0;
    }
    .top-banner.legitimate {
      background: #052e16;
      border-bottom: 2px solid #16a34a;
      color: #fff;
      padding: 0.75rem 1.5rem;
      font-size: 0.82rem;
      text-align: left;
    }
    .login-wrap {
      min-height: calc(100vh - 42px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 2.5rem 2rem;
    }
    .lock-icon {
      display: flex;
      justify-content: center;
      margin-bottom: 1rem;
      color: #6366f1;
    }
    .brand-title {
      text-align: center;
      font-size: 1.6rem;
      font-weight: 700;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .brand-sub {
      text-align: center;
      font-size: 0.85rem;
      color: #94a3b8;
      margin: 0.25rem 0 1.5rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .rule {
      border: none;
      border-top: 1px solid #334155;
      margin-bottom: 1.5rem;
    }
    .error-box {
      background: #450a0a;
      border: 1px solid #dc2626;
      border-radius: 6px;
      padding: 0.6rem 1rem;
      color: #fca5a5;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .field-label {
      display: block;
      color: #94a3b8;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      margin-bottom: 0.4rem;
    }
    .field-input {
      width: 100%;
      background: #0f172a;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 0.6rem 0.75rem;
      color: #f1f5f9;
      font-family: inherit;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    .field-input:focus {
      outline: none;
      border-color: #6366f1;
    }
    .btn-signin {
      width: 100%;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 0.75rem;
      font-size: 1rem;
      font-family: inherit;
      cursor: pointer;
    }
    .btn-signin:hover { background: #4f46e5; }
    .forgot {
      text-align: center;
      color: #94a3b8;
      font-size: 0.8rem;
      margin-top: 1.25rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .topnav {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .topnav-left {
      display: flex;
      align-items: center;
      gap: 2rem;
    }
    .wordmark {
      font-weight: 700;
      color: #6366f1;
      font-size: 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .nav-links {
      display: flex;
      gap: 1.25rem;
    }
    .nav-links a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.85rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .nav-links a:hover { color: #f1f5f9; }
    .topnav-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .nav-user {
      font-size: 0.85rem;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      flex-shrink: 0;
      text-transform: uppercase;
    }
    .avatar.nav { background: #6366f1; }
    .btn-signout {
      background: #334155;
      color: #94a3b8;
      border: 1px solid #475569;
      border-radius: 4px;
      padding: 0.3rem 0.75rem;
      font-size: 0.8rem;
      text-decoration: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .btn-signout:hover { color: #f1f5f9; }
    .main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.5rem;
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 860px) {
      .main { grid-template-columns: 1fr; }
      .nav-links { display: none; }
    }
    .section-title {
      color: #f1f5f9;
      font-size: 1.1rem;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .section-sub {
      color: #94a3b8;
      font-size: 0.85rem;
      margin: 0.25rem 0 1.25rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .member-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .member-card:hover { border-color: #475569; }
    .avatar.member { width: 40px; height: 40px; font-size: 0.95rem; }
    .member-info { flex: 1; min-width: 0; }
    .member-name {
      color: #f1f5f9;
      font-weight: 600;
      font-size: 0.95rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .member-email {
      color: #94a3b8;
      font-size: 0.8rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .member-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.35rem;
      margin-left: auto;
    }
    .member-team {
      color: #94a3b8;
      font-size: 0.8rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .role-badge {
      font-size: 0.72rem;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      text-transform: capitalize;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .role-badge.admin { color: #fbbf24; background: #451a03; }
    .role-badge.developer { color: #818cf8; background: #1e1b4b; }
    .side-panel {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1.25rem;
    }
    .side-panel + .side-panel { margin-top: 1rem; }
    .panel-title {
      color: #94a3b8;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.85rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .signed-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.65rem;
    }
    .signed-name {
      font-weight: 600;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .meta-row {
      color: #94a3b8;
      font-size: 0.82rem;
      margin-bottom: 0.3rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .meta-row strong { color: #f1f5f9; font-weight: 500; }
  `;
}

function buildLoginPage(hasError) {
  const errorBlock = hasError
    ? '<div class="error-box">Invalid credentials</div>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevAuth — Sign In</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="top-banner protected">
    ✅ PROTECTED: input type validated before query — operator injection rejected
  </div>
  <div class="login-wrap">
    <div class="login-card">
      <div class="lock-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <div class="brand-title">DevAuth</div>
      <div class="brand-sub">Developer Identity Portal</div>
      <hr class="rule">
      ${errorBlock}
      <form id="login-form">
        <label class="field-label" for="username">USERNAME</label>
        <input class="field-input" type="text" id="username" name="username" required autocomplete="username">
        <label class="field-label" for="password">PASSWORD</label>
        <input class="field-input" type="password" id="password" name="password" required autocomplete="current-password">
        <button class="btn-signin" type="submit">Sign In</button>
      </form>
      <p class="forgot">Forgot password? Contact your admin.</p>
    </div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var username = document.getElementById('username').value;
      var password = document.getElementById('password').value;
      var res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      window.location = res.url;
    });
  </script>
</body>
</html>`;
}

function findUser(username) {
  return users.find(function (u) { return u.username === username; }) || null;
}

function buildMemberCards() {
  return users.map(function (user) {
    const initial = escapeHtml(user.username.charAt(0).toUpperCase());
    return (
      '<div class="member-card">' +
        '<div class="avatar member" style="background:' + avatarBg(user.role) + '">' + initial + '</div>' +
        '<div class="member-info">' +
          '<div class="member-name">' + escapeHtml(user.username) + '</div>' +
          '<div class="member-email">' + escapeHtml(user.email) + '</div>' +
        '</div>' +
        '<div class="member-meta">' +
          roleBadge(user.role) +
          '<span class="member-team">' + escapeHtml(user.team) + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function buildDashboardPage(username) {
  const safeUser = escapeHtml(username);
  const initial = escapeHtml((username.charAt(0) || '?').toUpperCase());
  const current = findUser(username);
  const email = current ? escapeHtml(current.email) : '—';
  const role = current ? escapeHtml(current.role) : '—';
  const team = current ? escapeHtml(current.team) : '—';
  const signedAvatarBg = current ? avatarBg(current.role) : '#6366f1';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevAuth — Dashboard</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="top-banner legitimate">
    ✅ LEGITIMATE LOGIN — password verified by exact string match.<br>
    &nbsp;&nbsp;&nbsp;Operator injection rejected before the query ran.
  </div>
  <header class="topnav">
    <div class="topnav-left">
      <div class="wordmark">DevAuth</div>
      <nav class="nav-links">
        <a href="/dashboard?user=${encodeURIComponent(username)}">Dashboard</a>
        <a href="#">Team</a>
        <a href="#">Settings</a>
      </nav>
    </div>
    <div class="topnav-right">
      <div class="avatar nav">${initial}</div>
      <span class="nav-user">${safeUser}</span>
      <a class="btn-signout" href="/logout">Sign Out</a>
    </div>
  </header>
  <div class="main">
    <section>
      <div class="section-title">Team Registry</div>
      <div class="section-sub">All registered developers — ${users.length} members</div>
      ${buildMemberCards()}
    </section>
    <aside>
      <div class="side-panel">
        <div class="panel-title">Signed in as</div>
        <div class="signed-row">
          <div class="avatar member" style="background:${signedAvatarBg}">${initial}</div>
          <span class="signed-name">${safeUser}</span>
        </div>
        <div class="meta-row">${email}</div>
        <div class="meta-row">Role: <strong>${role}</strong></div>
        <div class="meta-row">Team: <strong>${team}</strong></div>
      </div>
      <div class="side-panel">
        <div class="panel-title">Session</div>
        <div class="meta-row">Authenticated via:</div>
        <div class="meta-row"><strong>MongoDB query match</strong></div>
        <div class="meta-row">IP: <strong>127.0.0.1</strong></div>
        <div class="meta-row">Time: <strong>${timestamp}</strong></div>
      </div>
    </aside>
  </div>
</body>
</html>`;
}

app.use(express.json());

app.get('/', function (req, res) {
  res.redirect('/login');
});

app.get('/login', function (req, res) {
  res.send(buildLoginPage(req.query.error === '1'));
});

// ✅ PROTECTED: reject non-string body fields.
// MongoDB operators only execute when the query field is an object.
// Enforcing typeof === 'string' means the query always uses exact equality.
app.post('/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.redirect('/login?error=1');
  }

  const user = findOne({ username: username, password: password });

  if (!user) {
    return res.redirect('/login?error=1');
  }

  res.cookie('session', user.username, { httpOnly: true, path: '/' });
  res.redirect('/dashboard?user=' + encodeURIComponent(user.username));
});

app.get('/dashboard', function (req, res) {
  const username = req.query.user;
  if (!username) {
    return res.redirect('/login');
  }
  res.send(buildDashboardPage(username));
});

app.get('/logout', function (req, res) {
  res.clearCookie('session');
  res.redirect('/login');
});

app.listen(PORT, function () {
  console.log('DevAuth (PROTECTED) running at http://localhost:' + PORT);
});
