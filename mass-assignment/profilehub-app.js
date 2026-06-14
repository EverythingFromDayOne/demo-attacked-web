/*
 * Shared ProfileHub app factory — used by victim-server.js and victim-protected-server.js
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const ALLOWED_PROFILE_FIELDS = ['bio', 'jobTitle', 'company', 'email'];

function freshUsers() {
  return [
    { id: 1, username: 'alice', password: 'alice123', email: 'alice@profilehub.com', bio: 'Software engineer. Coffee enthusiast.', jobTitle: 'Senior Engineer', company: 'Acme Corp', isAdmin: false, isPremium: false, plan: 'free' },
    { id: 2, username: 'bob', password: 'bob123', email: 'bob@profilehub.com', bio: 'Product designer with 8 years experience.', jobTitle: 'Lead Designer', company: 'Designco', isAdmin: false, isPremium: true, plan: 'pro' },
    { id: 3, username: 'charlie', password: 'charlie123', email: 'charlie@profilehub.com', bio: 'Startup founder, ex-FAANG.', jobTitle: 'Founder & CEO', company: 'StartupXYZ', isAdmin: false, isPremium: true, plan: 'pro' },
    { id: 4, username: 'admin', password: 'admin123', email: 'admin@profilehub.com', bio: 'Platform administrator.', jobTitle: 'Platform Admin', company: 'ProfileHub', isAdmin: true, isPremium: true, plan: 'admin' },
  ];
}

function sharedCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #1e293b;
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
      width: 240px;
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      padding: 1.5rem 1rem;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }
    .sidebar-user {
      text-align: center;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 1rem;
    }
    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #6366f1;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 auto 0.75rem;
    }
    .sidebar-username { font-weight: 700; font-size: 0.95rem; margin-bottom: 0.35rem; }
    .plan-badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .plan-badge.free { background: #e2e8f0; color: #475569; }
    .plan-badge.pro { background: #d1fae5; color: #065f46; }
    .plan-badge.admin { background: #fef3c7; color: #92400e; }
    .sidebar nav a {
      display: block;
      color: #64748b;
      text-decoration: none;
      padding: 0.55rem 0.85rem;
      border-radius: 8px;
      font-size: 0.88rem;
      margin-bottom: 0.25rem;
    }
    .sidebar nav a:hover, .sidebar nav a.active { background: #eef2ff; color: #4338ca; }
    .sidebar nav a.disabled { opacity: 0.45; pointer-events: none; }
    .main-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #fff; }
    .topbar {
      border-bottom: 1px solid #e2e8f0;
      padding: 0 2rem;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .topbar h1 { font-size: 1.05rem; font-weight: 600; }
    .topbar-right { display: flex; align-items: center; gap: 0.75rem; }
    .user-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.82rem;
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
    .btn-logout:hover { background: #f8fafc; }
    .content { padding: 2rem; flex: 1; }
    .profile-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.75rem;
      max-width: 720px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .profile-card h2 { font-size: 1.2rem; margin-bottom: 0.25rem; }
    .profile-meta { color: #64748b; font-size: 0.9rem; margin-bottom: 1rem; }
    .profile-bio { color: #334155; margin-bottom: 1.25rem; line-height: 1.7; }
    .badge-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .status-badge {
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-badge.admin { background: #fef3c7; color: #92400e; }
    .status-badge.premium { background: #d1fae5; color: #065f46; }
    .status-badge.member { background: #e2e8f0; color: #475569; }
    .field-grid { display: grid; gap: 1rem; max-width: 520px; }
    label.field-label { display: block; font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 0.35rem; }
    .field-input, .field-textarea {
      width: 100%;
      padding: 0.6rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.95rem;
      color: #0f172a;
      background: #fff;
      font-family: inherit;
    }
    .field-textarea { min-height: 100px; resize: vertical; }
    .field-input:focus, .field-textarea:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }
    .btn-primary {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin-top: 0.5rem;
    }
    .btn-primary:hover { background: #4f46e5; }
    .save-msg { margin-top: 0.75rem; font-size: 0.85rem; }
    .save-msg.success { color: #059669; }
    .save-msg.error { color: #dc2626; }
    .admin-table-wrap { overflow-x: auto; max-width: 900px; }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    table.data-table th {
      text-align: left;
      padding: 0.65rem 0.75rem;
      border-bottom: 2px solid #e2e8f0;
      color: #64748b;
      font-weight: 600;
    }
    table.data-table td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      font-size: 0.88rem;
      max-width: 640px;
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
    ? '✅ PROTECTED: Explicit field allowlist — isAdmin, isPremium, plan cannot be written by users'
    : '⚠ VULNERABLE: PATCH /api/profile uses Object.assign(user, req.body) — any field including isAdmin can be overwritten';
}

function sharedAppScript(isProtected) {
  return `
    var authToken = localStorage.getItem('authToken');
    var currentUser = null;
    var isAdminAccess = false;
    var isProtected = ${isProtected};

    function authHeaders(json) {
      var h = { 'Authorization': 'Bearer ' + authToken };
      if (json) h['Content-Type'] = 'application/json';
      return h;
    }

    function planBadgeClass(plan) {
      if (plan === 'admin') return 'admin';
      if (plan === 'pro') return 'pro';
      return 'free';
    }

    function planLabel(plan) {
      if (plan === 'admin') return 'ADMIN';
      if (plan === 'pro') return 'PRO';
      return 'FREE';
    }

    function renderSidebarUser(user) {
      document.getElementById('sidebar-avatar').textContent = (user.username || '?').charAt(0).toUpperCase();
      document.getElementById('sidebar-username').textContent = user.username;
      var badge = document.getElementById('plan-badge');
      if (isProtected) {
        badge.textContent = 'MEMBER';
        badge.className = 'plan-badge free';
      } else {
        badge.textContent = planLabel(user.plan);
        badge.className = 'plan-badge ' + planBadgeClass(user.plan);
      }
      document.getElementById('user-badge').textContent = user.username;
      updateAdminNav();
    }

    function updateAdminNav() {
      var link = document.getElementById('nav-admin');
      if (!link) return;
      if (isProtected) {
        link.classList.remove('disabled');
      } else {
        link.classList.toggle('disabled', !(currentUser && currentUser.isAdmin));
      }
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
      return fetch('/api/me', { headers: authHeaders() })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function(user) {
          currentUser = user;
          if (!isProtected && user.isAdmin) isAdminAccess = true;
          renderSidebarUser(user);
          return user;
        })
        .catch(function() {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          return Promise.reject();
        });
    }

    function checkAdminAccess() {
      return fetch('/api/admin/users', { headers: authHeaders() })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(res) {
          isAdminAccess = res.ok;
          updateAdminNav();
          return res;
        });
    }
  `;
}

function sidebarHtml(active, isProtected) {
  const adminClass = active === 'admin' ? ' class="active"' : ' id="nav-admin" class="disabled"';
  return (
    '<aside class="sidebar">' +
      '<div class="sidebar-user">' +
        '<div class="avatar" id="sidebar-avatar">?</div>' +
        '<div class="sidebar-username" id="sidebar-username">—</div>' +
        '<span class="plan-badge free" id="plan-badge">FREE</span>' +
      '</div>' +
      '<nav>' +
        '<a href="/"' + (active === 'profile' ? ' class="active"' : '') + '>My Profile</a>' +
        '<a href="/edit"' + (active === 'edit' ? ' class="active"' : '') + '>Edit Profile</a>' +
        '<a href="/admin"' + adminClass + '>Admin Panel</a>' +
      '</nav>' +
    '</aside>'
  );
}

function topbarHtml(title, isProtected) {
  const securityBadge = isProtected ? '<span class="security-badge">🛡 Mass Assignment Protected</span>' : '';
  return (
    '<header class="topbar">' +
      '<h1>' + title + '</h1>' +
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
  <title>Sign In — ProfileHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="login-wrap">
    <div class="login-card">
      <h1><span>Profile</span>Hub</h1>
      <p>Build your professional presence</p>
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

function buildProfileHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Profile — ProfileHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('profile', isProtected)}
    <div class="main-wrap">
      ${topbarHtml('My Profile', isProtected)}
      <main class="content">
        <div class="profile-card">
          <h2 id="profile-name">—</h2>
          <div class="profile-meta" id="profile-meta">—</div>
          <div class="badge-row" id="badge-row"></div>
          <div class="profile-bio" id="profile-bio">—</div>
        </div>
      </main>
    </div>
  </div>
  <script>
    ${sharedAppScript(isProtected)}
    ensureAuth().then(function(user) {
      document.getElementById('profile-name').textContent = user.username;
      document.getElementById('profile-meta').textContent = user.jobTitle + ' at ' + user.company;
      document.getElementById('profile-bio').textContent = user.bio;
      var badges = document.getElementById('badge-row');
      if (isProtected) {
        badges.innerHTML = '<span class="status-badge member">Member</span>';
      } else {
        var html = '';
        if (user.isAdmin) html += '<span class="status-badge admin">Admin</span>';
        if (user.isPremium) html += '<span class="status-badge premium">Premium</span>';
        html += '<span class="status-badge member">Plan: ' + user.plan + '</span>';
        badges.innerHTML = html;
      }
    }).catch(function() {});
  </script>
</body>
</html>`;
}

function buildEditHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Profile — ProfileHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('edit', isProtected)}
    <div class="main-wrap">
      ${topbarHtml('Edit Profile', isProtected)}
      <main class="content">
        <div class="profile-card">
          <form id="edit-form" class="field-grid">
            <div>
              <label class="field-label" for="bio">Bio</label>
              <textarea class="field-textarea" id="bio" name="bio"></textarea>
            </div>
            <div>
              <label class="field-label" for="jobTitle">Job Title</label>
              <input class="field-input" id="jobTitle" name="jobTitle">
            </div>
            <div>
              <label class="field-label" for="company">Company</label>
              <input class="field-input" id="company" name="company">
            </div>
            <div>
              <label class="field-label" for="email">Email</label>
              <input class="field-input" id="email" name="email" type="email">
            </div>
            <button type="submit" class="btn-primary">Save Profile</button>
          </form>
          <div class="save-msg" id="save-msg"></div>
        </div>
      </main>
    </div>
  </div>
  <script>
    ${sharedAppScript(isProtected)}
    ensureAuth().then(function(user) {
      document.getElementById('bio').value = user.bio || '';
      document.getElementById('jobTitle').value = user.jobTitle || '';
      document.getElementById('company').value = user.company || '';
      document.getElementById('email').value = user.email || '';
    }).catch(function() {});

    document.getElementById('edit-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var msg = document.getElementById('save-msg');
      var body = {
        bio: document.getElementById('bio').value,
        jobTitle: document.getElementById('jobTitle').value,
        company: document.getElementById('company').value,
        email: document.getElementById('email').value
      };
      fetch('/api/profile', {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify(body)
      })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(res) {
          currentUser = res.data;
          renderSidebarUser(res.data);
          msg.textContent = 'Profile saved successfully.';
          msg.className = 'save-msg success';
        })
        .catch(function(err) {
          msg.textContent = err.message;
          msg.className = 'save-msg error';
        });
    });
  </script>
</body>
</html>`;
}

function buildAdminHtml(isProtected) {
  const bannerClass = isProtected ? 'demo-banner protected' : 'demo-banner';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel — ProfileHub</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="${bannerClass}">${bannerText(isProtected)}</div>
  <div class="layout">
    ${sidebarHtml('admin', isProtected)}
    <div class="main-wrap">
      ${topbarHtml('Admin Panel', isProtected)}
      <main class="content">
        <div id="admin-denied" class="error-box hidden">403 — Forbidden: Admin access required</div>
        <div id="admin-content" class="hidden">
          <p style="color:#64748b;font-size:0.88rem;margin-bottom:1rem">All registered users on the platform.</p>
          <div class="admin-table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Username</th><th>Email</th><th>Job Title</th><th>isAdmin</th><th>Plan</th></tr>
              </thead>
              <tbody id="admin-body"></tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  </div>
  <script>
    ${sharedAppScript(isProtected)}
    ensureAuth().then(function() {
      return fetch('/api/admin/users', { headers: authHeaders() });
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(res) {
        if (!res.ok) {
          document.getElementById('admin-denied').classList.remove('hidden');
          document.getElementById('admin-denied').textContent = '403 — ' + (res.data.error || 'Forbidden');
          return;
        }
        isAdminAccess = true;
        updateAdminNav();
        document.getElementById('admin-content').classList.remove('hidden');
        document.getElementById('admin-body').innerHTML = res.data.map(function(u) {
          return '<tr>' +
            '<td>' + u.username + '</td>' +
            '<td>' + u.email + '</td>' +
            '<td>' + u.jobTitle + '</td>' +
            '<td>' + (u.isAdmin !== undefined ? u.isAdmin : '—') + '</td>' +
            '<td>' + (u.plan !== undefined ? u.plan : '—') + '</td>' +
          '</tr>';
        }).join('');
      })
      .catch(function() {});
  </script>
</body>
</html>`;
}

function createProfileHubApp(options) {
  const port = options.port;
  const isProtected = options.protected;
  const label = options.label;

  let users = freshUsers();
  const sessions = new Map();

  const app = express();
  app.use(cors({ origin: 'http://localhost:3047' }));
  app.use(express.json());

  function publicUser(u) {
    if (isProtected) {
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        bio: u.bio,
        jobTitle: u.jobTitle,
        company: u.company,
      };
    }
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      bio: u.bio,
      jobTitle: u.jobTitle,
      company: u.company,
      isAdmin: u.isAdmin,
      isPremium: u.isPremium,
      plan: u.plan,
    };
  }

  function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const userId = sessions.get(token);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    req.user = users.find(function (u) { return u.id === userId; });
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  }

  app.get('/login', function (req, res) {
    res.send(buildLoginHtml());
  });

  app.get('/', function (req, res) {
    res.send(buildProfileHtml(isProtected));
  });

  app.get('/edit', function (req, res) {
    res.send(buildEditHtml(isProtected));
  });

  app.get('/admin', function (req, res) {
    res.send(buildAdminHtml(isProtected));
  });

  app.post('/api/reset', function (req, res) {
    users = freshUsers();
    sessions.clear();
    res.json({ message: 'Demo reset' });
  });

  app.post('/api/login', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const user = users.find(function (u) {
      return u.username === username && u.password === password;
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, user.id);
    res.json({ token: token, user: publicUser(user) });
  });

  app.post('/api/logout', requireAuth, function (req, res) {
    sessions.delete(req.headers.authorization.slice(7));
    res.json({ message: 'Logged out' });
  });

  app.get('/api/me', requireAuth, function (req, res) {
    res.json(publicUser(req.user));
  });

  app.patch('/api/profile', requireAuth, function (req, res) {
    if (isProtected) {
      const update = {};
      ALLOWED_PROFILE_FIELDS.forEach(function (field) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          update[field] = req.body[field];
        }
      });
      Object.assign(req.user, update);
    } else {
      Object.assign(req.user, req.body);
    }
    res.json(publicUser(req.user));
  });

  app.get('/api/admin/users', requireAuth, function (req, res) {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    res.json(users.map(publicUser));
  });

  app.listen(port, function () {
    console.log(label + ' running at http://localhost:' + port);
  });
}

module.exports = { createProfileHubApp, freshUsers, ALLOWED_PROFILE_FIELDS };
