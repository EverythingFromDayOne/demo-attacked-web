/*
 * Terminal 3: cd demo-attacked/sql-injection && npm run secure
 */

const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3027;

const SEED_RESOURCES = [
  { title: 'V8 Engine Deep Dive', url: 'https://v8.dev/blog', tags: 'javascript,engine', author: 'alice' },
  { title: 'Node.js Performance Guide', url: 'https://nodejs.org/docs', tags: 'nodejs,performance', author: 'bob' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', tags: 'reference,web', author: 'carol' },
  { title: 'CSS Grid Complete Guide', url: 'https://css-tricks.com/snippets/css/complete-guide-grid', tags: 'css,layout', author: 'alice' },
  { title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook', tags: 'typescript,types', author: 'dave' },
];

const SEED_USERS = [
  { username: 'alice', password: 'hunter2', role: 'developer', email: 'alice@devlinks.io' },
  { username: 'bob', password: 'correct-horse', role: 'developer', email: 'bob@devlinks.io' },
  { username: 'admin', password: 'Adm1nS3cr3t!', role: 'admin', email: 'admin@devlinks.io' },
  { username: 'carol', password: 'letmein', role: 'developer', email: 'carol@devlinks.io' },
];

function initDb() {
  const db = new Database(':memory:');

  db.exec(`
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
  `);

  const insertResource = db.prepare(
    'INSERT INTO resources (title, url, tags, author) VALUES (?, ?, ?, ?)'
  );
  SEED_RESOURCES.forEach(function (row) {
    insertResource.run(row.title, row.url, row.tags, row.author);
  });

  const insertUser = db.prepare(
    'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)'
  );
  SEED_USERS.forEach(function (row) {
    insertUser.run(row.username, row.password, row.role, row.email);
  });

  return db;
}

const db = initDb();

const PROTECTED_BANNER =
  '<div class="demo-banner protected">' +
  '✅ PROTECTED: parameterized queries — user input is always data, never syntax' +
  '</div>';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    .demo-banner.protected {
      background: #dcfce7;
      border-bottom: 2px solid #16a34a;
      color: #166534;
    }
    .demo-banner.legitimate {
      background: #052e16;
      border-bottom: 2px solid #16a34a;
      color: #bbf7d0;
      text-align: left;
      padding: 0.75rem 1.5rem;
    }
    .topnav {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 1.5rem;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .wordmark {
      font-weight: 700;
      font-size: 1.15rem;
      color: #0f172a;
    }
    .wordmark span { color: #6366f1; }
    .nav-links { display: flex; gap: 1.5rem; }
    .nav-links a {
      color: #64748b;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .nav-links a:hover { color: #6366f1; }
    .nav-links a.active { color: #6366f1; }
    .shell {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.75rem 1.5rem 3rem;
    }
    .search-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .search-input {
      flex: 1;
      padding: 0.65rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .search-input:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }
    .btn-search, .btn-primary {
      padding: 0.65rem 1.25rem;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-search:hover, .btn-primary:hover { background: #4f46e5; }
    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .section-sub {
      color: #64748b;
      font-size: 0.88rem;
      margin-bottom: 1.25rem;
    }
    .resource-grid {
      display: grid;
      gap: 1rem;
    }
    .resource-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.15rem 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    }
    .resource-card:hover { border-color: #cbd5e1; }
    .resource-title {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.35rem;
    }
    .resource-url {
      font-size: 0.82rem;
      color: #6366f1;
      word-break: break-all;
      margin-bottom: 0.5rem;
    }
    .resource-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.78rem;
      color: #64748b;
    }
    .tag-pill {
      background: #eef2ff;
      color: #4338ca;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
    }
    .empty-state {
      background: #fff;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 2rem;
      text-align: center;
      color: #64748b;
    }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 1rem;
      color: #991b1b;
      font-size: 0.88rem;
      margin-bottom: 1rem;
      font-family: 'Courier New', monospace;
      word-break: break-word;
    }
    .hint-note {
      color: #64748b;
      font-size: 0.82rem;
      margin-bottom: 1rem;
    }
    details.hint-panel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.82rem;
      color: #475569;
    }
    details.hint-panel summary {
      cursor: pointer;
      color: #64748b;
      font-weight: 500;
    }
    details.hint-panel pre {
      margin-top: 0.75rem;
      font-family: 'Courier New', monospace;
      font-size: 0.78rem;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .login-card {
      max-width: 400px;
      margin: 2rem auto;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 2rem;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }
    .login-card h1 {
      font-size: 1.35rem;
      margin-bottom: 0.25rem;
    }
    .login-card p {
      color: #64748b;
      font-size: 0.88rem;
      margin-bottom: 1.5rem;
    }
    .field-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .field-input {
      width: 100%;
      padding: 0.65rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.95rem;
      margin-bottom: 1rem;
      font-family: inherit;
    }
    .login-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 0.65rem 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      font-size: 0.88rem;
    }
    th {
      text-align: left;
      padding: 0.65rem 0.85rem;
      background: #f1f5f9;
      color: #64748b;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:last-child td { border-bottom: none; }
    .role-admin { color: #b45309; font-weight: 600; }
  `;
}

function buildNav(active) {
  return (
    '<header class="topnav">' +
      '<div class="wordmark">Dev<span>Links</span></div>' +
      '<nav class="nav-links">' +
        '<a href="/"' + (active === 'home' ? ' class="active"' : '') + '>Search</a>' +
        '<a href="#">Bookmarks</a>' +
        '<a href="/admin"' + (active === 'admin' ? ' class="active"' : '') + '>Admin</a>' +
      '</nav>' +
    '</header>'
  );
}

function buildResourceCards(results) {
  if (!results.length) {
    return '<div class="empty-state">No resources found for this query.</div>';
  }

  return (
    '<div class="resource-grid">' +
    results.map(function (row) {
      return (
        '<article class="resource-card">' +
          '<div class="resource-title">' + escapeHtml(row.title) + '</div>' +
          '<div class="resource-url">' + escapeHtml(row.url) + '</div>' +
          '<div class="resource-meta">' +
            '<span class="tag-pill">' + escapeHtml(row.tags || '') + '</span>' +
            '<span>by ' + escapeHtml(row.author || '') + '</span>' +
          '</div>' +
        '</article>'
      );
    }).join('') +
    '</div>'
  );
}

function buildSearchForm(q) {
  const value = escapeHtml(q || '');
  return (
    '<form class="search-bar" method="GET" action="/search">' +
      '<input class="search-input" type="text" name="q" value="' + value + '" placeholder="Search resources by title or tags…">' +
      '<button class="btn-search" type="submit">Search</button>' +
    '</form>'
  );
}

function buildPageShell(options) {
  const banner = options.banner || '';
  const nav = buildNav(options.navActive || 'home');
  const content = options.content || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title || 'DevLinks')}</title>
  <style>${sharedCss()}</style>
</head>
<body>
  ${banner}
  ${nav}
  <div class="shell">${content}</div>
</body>
</html>`;
}

function buildHomePage() {
  const results = db.prepare('SELECT id, title, url, tags, author FROM resources').all();

  return buildPageShell({
    title: 'DevLinks — Developer Resources',
    navActive: 'home',
    banner:
      PROTECTED_BANNER,
    content:
      buildSearchForm('') +
      '<div class="section-title">Featured Resources</div>' +
      '<div class="section-sub">Curated links for developers — search above or browse below</div>' +
      buildResourceCards(results),
  });
}

function buildSearchPage(q, results, searchError) {
  const errorBlock = searchError
    ? '<div class="error-box">SQLite error: ' + escapeHtml(searchError) + '</div>'
    : '';

  return buildPageShell({
    title: 'DevLinks — Search',
    navActive: 'home',
    banner:
      PROTECTED_BANNER,
    content:
      buildSearchForm(q) +
      errorBlock +
      '<p class="hint-note">Search queries resources.title and resources.tags</p>' +
      '<details class="hint-panel">' +
        '<summary>Try injecting</summary>' +
        '<pre>Normal search:    javascript\n' +
        'Login bypass:     Open /admin — username: admin\'--  password: anything\n' +
        'UNION dump:       \' UNION SELECT id,username,password,email,\'\' FROM users--</pre>' +
      '</details>' +
      '<div class="section-title">Search Results</div>' +
      '<div class="section-sub">' + (q ? 'Query: ' + escapeHtml(q) : 'Enter a search term') + '</div>' +
      buildResourceCards(results),
  });
}

function buildAdminLoginPage(hasError) {
  const errorBlock = hasError ? '<div class="login-error">Invalid credentials</div>' : '';

  return buildPageShell({
    title: 'DevLinks — Admin Login',
    navActive: 'admin',
    banner:
      PROTECTED_BANNER,
    content:
      '<div class="login-card">' +
        '<h1>Admin Login</h1>' +
        '<p>Sign in to manage DevLinks resources and users.</p>' +
        errorBlock +
        '<form method="POST" action="/login">' +
          '<label class="field-label" for="username">Username</label>' +
          '<input class="field-input" type="text" id="username" name="username" required>' +
          '<label class="field-label" for="password">Password</label>' +
          '<input class="field-input" type="password" id="password" name="password" required>' +
          '<button class="btn-primary" type="submit" style="width:100%">Sign In</button>' +
        '</form>' +
      '</div>',
  });
}

function buildAdminDashboardPage() {
  const users = db.prepare('SELECT id, username, password, role, email FROM users').all();
  const rows = users.map(function (user) {
    const roleClass = user.role === 'admin' ? ' class="role-admin"' : '';
    return (
      '<tr>' +
        '<td>' + user.id + '</td>' +
        '<td>' + escapeHtml(user.username) + '</td>' +
        '<td><code>' + escapeHtml(user.password) + '</code></td>' +
        '<td' + roleClass + '>' + escapeHtml(user.role) + '</td>' +
        '<td>' + escapeHtml(user.email) + '</td>' +
      '</tr>'
    );
  }).join('');

  return buildPageShell({
    title: 'DevLinks — Admin Dashboard',
    navActive: 'admin',
    banner:
      '<div class="demo-banner legitimate">' +
      '✅ Admin access — credentials verified via parameterized query.' +
      '</div>',
    content:
      '<div class="section-title">User Database</div>' +
      '<div class="section-sub">All registered accounts — ' + users.length + ' users</div>' +
      '<table>' +
        '<thead><tr><th>ID</th><th>Username</th><th>Password</th><th>Role</th><th>Email</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>',
  });
}

app.use(express.urlencoded({ extended: false }));

app.get('/', function (req, res) {
  res.send(buildHomePage());
});

// ✅ PROTECTED SEARCH — parameterized LIKE
app.get('/search', function (req, res) {
  const q = req.query.q || '';
  let results = [];
  let searchError = null;

  try {
    results = db.prepare(
      'SELECT id, title, url, tags, author FROM resources WHERE title LIKE ? OR tags LIKE ?'
    ).all('%' + q + '%', '%' + q + '%');
  } catch (err) {
    searchError = err.message;
  }

  res.send(buildSearchPage(q, results, searchError));
});

app.get('/admin', function (req, res) {
  res.send(buildAdminLoginPage(req.query.error === '1'));
});

// ✅ PROTECTED LOGIN — parameterized WHERE
app.post('/login', function (req, res) {
  const username = req.body.username || '';
  const password = req.body.password || '';

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ?'
  ).get(username, password);

  if (!user) {
    return res.redirect('/admin?error=1');
  }

  res.redirect('/admin/dashboard');
});

app.get('/admin/dashboard', function (req, res) {
  res.send(buildAdminDashboardPage());
});

app.listen(PORT, function () {
  console.log('DevLinks (PROTECTED) running at http://localhost:' + PORT);
});
