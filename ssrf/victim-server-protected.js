/*
 * How to Run:
 *
 * Terminal 3: cd demo-attacked/ssrf && npm run victim-protected
 *
 * Protected demo:
 * 1. http://localhost:3021  ← DevShare (protected)
 * 2. Paste http://localhost:3020/internal/env → blocked with validation message
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const { buildPreviewFromFetch, isUrlSafe } = require('./preview-utils');

const app = express();
const PORT = 3021;

const SESSION_VALUE = 'DevUser_demo_TOKEN_999';

const SEED_LINKS = [
  {
    title: 'V8 Engine Deep Dive',
    domain: 'v8.dev',
    description: 'Official documentation and blog posts about the V8 JavaScript engine.',
  },
  {
    title: 'TC39 Proposals Tracker',
    domain: 'tc39.es',
    description: 'Track the status of ECMAScript proposals from stage 0 to finished.',
  },
  {
    title: 'Node.js Performance Docs',
    domain: 'nodejs.org',
    description: 'Best practices for profiling and optimizing Node.js applications.',
  },
  {
    title: 'Rust for JS Developers',
    domain: 'rustforjs.dev',
    description: 'A guided introduction to Rust aimed at JavaScript engineers.',
  },
];

app.use(cookieParser());
app.use(express.json());

app.use(function (req, res, next) {
  if (req.cookies.devshare_session !== SESSION_VALUE) {
    res.cookie('devshare_session', SESSION_VALUE, { httpOnly: false, path: '/' });
  }
  next();
});

function sharedStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
    }
    .demo-banner {
      padding: 0.6rem 1.5rem;
      font-size: 0.85rem;
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
    .app-shell { display: flex; min-height: calc(100vh - 42px); }
    .sidebar {
      width: 260px;
      background: #0f172a;
      color: #e2e8f0;
      padding: 1.5rem 1.25rem;
      flex-shrink: 0;
    }
    .sidebar-logo {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 2rem;
      line-height: 1.4;
    }
    .sidebar-logo span { color: #818cf8; }
    .sidebar nav a {
      display: block;
      color: #94a3b8;
      text-decoration: none;
      padding: 0.5rem 0;
      font-size: 0.9rem;
    }
    .sidebar nav a:hover { color: #fff; }
    .main-wrap { flex: 1; display: flex; flex-direction: column; }
    .topbar {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 1.5rem;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .topbar nav { display: flex; gap: 1.5rem; }
    .topbar nav a {
      color: #64748b;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .topbar nav a:hover { color: #6366f1; }
    .avatar {
      width: 34px; height: 34px;
      background: #6366f1;
      color: #fff;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.85rem;
    }
    .content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      padding: 1.5rem;
      flex: 1;
    }
    @media (max-width: 960px) {
      .content { grid-template-columns: 1fr; }
      .sidebar { display: none; }
    }
    .panel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
    }
    .panel h2 {
      font-size: 1.05rem;
      margin-bottom: 1.25rem;
      color: #0f172a;
    }
    .link-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem 1.1rem;
      margin-bottom: 0.85rem;
      display: flex;
      gap: 0.85rem;
      align-items: flex-start;
    }
    .favicon {
      width: 36px; height: 36px;
      background: #eef2ff;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: #6366f1;
      flex-shrink: 0;
    }
    .link-card h3 { font-size: 0.95rem; margin-bottom: 0.25rem; }
    .link-card p { font-size: 0.82rem; color: #64748b; line-height: 1.5; }
    .domain-badge {
      display: inline-block;
      margin-top: 0.35rem;
      font-size: 0.72rem;
      background: #f1f5f9;
      color: #475569;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .form-label {
      display: block;
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.85rem;
      color: #0f172a;
    }
    .url-input {
      width: 100%;
      padding: 0.85rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    .url-input:focus {
      outline: 2px solid #6366f1;
      border-color: #6366f1;
    }
    .btn-preview {
      background: #6366f1;
      color: #fff;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
    }
    .btn-preview:hover { background: #4f46e5; }
    .btn-preview:disabled { opacity: 0.6; cursor: wait; }
    .result-area { margin-top: 1.5rem; }
    .result-card {
      border: 1px solid #c7d2fe;
      background: #f5f3ff;
      border-radius: 10px;
      padding: 1.25rem;
    }
    .result-card.blocked {
      border-color: #fecaca;
      background: #fef2f2;
    }
    .result-card h3 { font-size: 1rem; margin-bottom: 0.5rem; color: #312e81; }
    .result-card.blocked h3 { color: #991b1b; }
    .result-meta {
      font-size: 0.78rem;
      color: #64748b;
      margin-top: 0.75rem;
      line-height: 1.7;
    }
    .result-meta code {
      background: rgba(255,255,255,0.7);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .json-body {
      background: #0f172a;
      color: #4ade80;
      border-radius: 8px;
      padding: 1rem;
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin-top: 0.75rem;
      max-height: 320px;
      overflow-y: auto;
    }
    .status-warn {
      display: inline-block;
      margin-top: 0.5rem;
      font-size: 0.78rem;
      color: #b45309;
      font-weight: 600;
    }
    .error-msg { color: #dc2626; font-size: 0.9rem; margin-top: 1rem; }
  `;
}

function buildSeedCards() {
  return SEED_LINKS.map(function (link) {
    const initial = link.domain.charAt(0).toUpperCase();
    return (
      '<div class="link-card">' +
        '<div class="favicon">' + initial + '</div>' +
        '<div>' +
          '<h3>' + link.title + '</h3>' +
          '<p>' + link.description + '</p>' +
          '<span class="domain-badge">' + link.domain + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function buildPageHtml(bannerClass, bannerText) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevShare — Developer Link Hub</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <div class="demo-banner ${bannerClass}">${bannerText}</div>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">DevShare <span>&lt;/&gt;</span><br>Developer Link Hub</div>
      <nav>
        <a href="#">Feed</a>
        <a href="#">Bookmarks</a>
        <a href="#">Collections</a>
        <a href="#">Trending</a>
      </nav>
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <nav>
          <a href="#">Feed</a>
          <a href="#">Bookmarks</a>
          <a href="#">Collections</a>
          <a href="#">Trending</a>
        </nav>
        <div class="avatar">D</div>
      </header>
      <div class="content">
        <section class="panel">
          <h2>Recent Shared Links</h2>
          ${buildSeedCards()}
        </section>
        <section class="panel">
          <h2>Add a Link</h2>
          <form id="preview-form">
            <label class="form-label" for="url-input">Paste any URL to generate a preview</label>
            <input class="url-input" type="url" id="url-input" name="url"
              placeholder="https://example.com" required>
            <button class="btn-preview" type="submit" id="btn-preview">Generate Preview →</button>
          </form>
          <div class="result-area" id="result-area"></div>
        </section>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('preview-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var url = document.getElementById('url-input').value.trim();
      var btn = document.getElementById('btn-preview');
      var area = document.getElementById('result-area');

      btn.disabled = true;
      btn.textContent = 'Fetching…';
      area.innerHTML = '';

      try {
        var res = await fetch('/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url })
        });
        var data = await res.json();

        if (data.blocked) {
          area.innerHTML =
            '<div class="result-card blocked">' +
              '<h3>⛔ Blocked: ' + data.reason + '</h3>' +
              '<div class="result-meta">Target URL: <code>' + url + '</code></div>' +
            '</div>';
          return;
        }

        if (!data.success) {
          area.innerHTML = '<p class="error-msg">Error: ' + (data.error || 'Preview failed') + '</p>';
          return;
        }

        var jsonBlock = data.rawJson
          ? '<pre class="json-body">' + data.rawJson.replace(/</g, '&lt;') + '</pre>'
          : '<p style="margin-top:0.5rem;font-size:0.9rem;color:#475569;line-height:1.6;">' +
            (data.description || '').replace(/</g, '&lt;') + '</p>';

        var statusWarn = data.status !== 200
          ? '<div class="status-warn">⚠️ HTTP status ' + data.status + '</div>'
          : '';

        area.innerHTML =
          '<div class="result-card">' +
            '<h3>' + (data.title || url).replace(/</g, '&lt;') + '</h3>' +
            jsonBlock +
            statusWarn +
            '<div class="result-meta">' +
              'Target: <code>' + (data.url || url).replace(/</g, '&lt;') + '</code><br>' +
              'Status: <code>' + data.status + '</code> · ' +
              'Content-Type: <code>' + (data.contentType || 'unknown') + '</code>' +
            '</div>' +
          '</div>';
      } catch (err) {
        area.innerHTML = '<p class="error-msg">Request failed: ' + err.message + '</p>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Preview →';
      }
    });
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildPageHtml(
    'protected',
    '✅ PROTECTED: URL validation blocks private addresses, loopback, and non-HTTP schemes'
  ));
});

app.post('/api/preview', async function (req, res) {
  const url = (req.body && req.body.url) ? String(req.body.url).trim() : '';

  if (!url) {
    return res.json({ success: false, error: 'URL is required' });
  }

  const safety = isUrlSafe(url);
  if (!safety.safe) {
    return res.json({ blocked: true, reason: safety.reason });
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await response.text();
    res.json(buildPreviewFromFetch(url, response, body));
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(PORT, function () {
  console.log('DevShare (PROTECTED) running at http://localhost:' + PORT);
});
