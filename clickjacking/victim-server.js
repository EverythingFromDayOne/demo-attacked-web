/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/clickjacking && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/clickjacking && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3013  ← CloudVault dashboard (6 files)
 * 2. http://localhost:3014  ← CloudBoost lure — click "Claim My Free Upgrade"
 * 3. Return to CloudVault — all files deleted
 */

const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3013;

const SESSION_VALUE = 'VaultUser_demo_TOKEN';

const SEED_FILES = [
  { name: 'Q2-Financial-Report.xlsx', type: 'Spreadsheet', size: '2.4 MB', modified: '2 days ago' },
  { name: 'Product-Roadmap-2026.pdf', type: 'PDF', size: '1.1 MB', modified: '5 days ago' },
  { name: 'Team-Photo-Offsite.jpg', type: 'Image', size: '4.8 MB', modified: '1 week ago' },
  { name: 'Client-Contract-NDA.docx', type: 'Document', size: '890 KB', modified: '2 weeks ago' },
  { name: 'Architecture-Diagram-v3.png', type: 'Image', size: '3.2 MB', modified: '3 weeks ago' },
  { name: 'Backup-Config-prod.tar.gz', type: 'Archive', size: '12.1 MB', modified: '1 month ago' },
];

const vaultState = {
  files: SEED_FILES.map(function (f) { return Object.assign({}, f); }),
  deleted: false,
  accountPublic: false,
};

// ⚠️ VULNERABILITY: No X-Frame-Options or CSP frame-ancestors header.
//    Any page on any origin can embed this app inside an <iframe> and
//    position invisible interactive elements over it.

app.use(cookieParser());
app.use(express.json());

app.use(function (req, res, next) {
  if (req.cookies.vault_session !== SESSION_VALUE) {
    res.cookie('vault_session', SESSION_VALUE, { httpOnly: false, path: '/' });
  }
  next();
});

const ATTACKER_ORIGIN = 'http://localhost:3014';

function buildDashboardHtml(embed) {
  const files = vaultState.files;
  const deleted = vaultState.deleted;

  const fileRows = files.map(function (f) {
    return (
      '<tr>' +
        '<td>' + f.name + '</td>' +
        '<td>' + f.type + '</td>' +
        '<td>' + f.size + '</td>' +
        '<td>' + f.modified + '</td>' +
      '</tr>'
    );
  }).join('');

  const fileListSection = deleted || files.length === 0
    ? '<div class="empty-state">No files found. Your storage is empty.</div>'
    : '<table class="file-table">' +
        '<thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead>' +
        '<tbody>' + fileRows + '</tbody>' +
      '</table>';

  const deleteBanner = deleted
    ? '<div class="alert-banner">⚠️ All files have been permanently deleted.</div>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudVault — File Storage</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      line-height: 1.5;
      min-height: 100vh;
    }
    /* Embed mode: attacker iframe syncs delete-button position via postMessage */
    body.embed-mode .btn-warning { display: none; }
    body.embed-mode .actions { border-top: none; padding-top: 0; }
    body.embed-mode #btn-delete-all {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      margin: 0;
      z-index: 100;
      top: -9999px;
    }
    .demo-banner {
      background: #fee2e2;
      border-bottom: 2px solid #dc2626;
      color: #991b1b;
      padding: 0.6rem 1.5rem;
      font-size: 0.85rem;
      text-align: center;
      font-weight: 500;
    }
    header {
      background: #0f172a;
      color: #fff;
      padding: 0 2rem;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo { font-size: 1.35rem; font-weight: 700; }
    nav { display: flex; gap: 1.5rem; }
    nav a { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
    nav a:hover { color: #fff; }
    .header-right { display: flex; align-items: center; gap: 1rem; }
    .avatar {
      width: 36px; height: 36px;
      background: #334155;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.9rem;
    }
    main { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    .card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 2rem;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
      margin-bottom: 1.5rem;
    }
    .card h2 { font-size: 1.15rem; margin-bottom: 1.25rem; color: #0f172a; }
    .storage-bar-wrap { margin-bottom: 0.5rem; }
    .storage-label { font-size: 0.9rem; color: #475569; margin-bottom: 0.5rem; }
    .storage-bar {
      height: 10px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .storage-bar-fill {
      height: 100%;
      width: 33%;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
      border-radius: 999px;
    }
    .file-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .file-table th {
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 2px solid #e2e8f0;
      color: #64748b;
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .file-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .file-table tr:hover td { background: #f8fafc; }
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #94a3b8;
      font-size: 1rem;
    }
    .actions {
      margin-top: 2.5rem;
      padding-top: 2rem;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .btn-warning {
      display: block;
      margin: 0 auto 1.25rem;
      width: 220px;
      background: #fef3c7;
      color: #92400e;
      border: 2px solid #f59e0b;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-warning:hover { background: #fde68a; }
    .btn-danger {
      display: block;
      margin: 2rem auto;
      width: 220px;
      background: #dc2626;
      color: #fff;
      border: none;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.95rem;
    }
    .btn-danger:hover { background: #b91c1c; }
    .alert-banner {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-weight: 600;
      text-align: center;
    }
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: #fff;
      border-radius: 12px;
      padding: 2rem;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal p { margin-bottom: 1.5rem; color: #475569; }
    .modal .btn-close {
      background: #0f172a;
      color: #fff;
      border: none;
      padding: 0.6rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
  </style>
</head>
<body class="${embed ? 'embed-mode' : ''}">
  <div class="demo-banner">⚠️ VULNERABLE: No X-Frame-Options — this page can be loaded inside any iframe</div>

  <header>
    <div class="logo">CloudVault 🗄️</div>
    <nav>
      <a href="#">Files</a>
      <a href="#">Shared</a>
      <a href="#">Trash</a>
      <a href="#">Settings</a>
    </nav>
    <div class="header-right">
      <div class="avatar">V</div>
    </div>
  </header>

  <main>
    ${deleteBanner}

    <div class="card">
      <h2>Storage</h2>
      <div class="storage-bar-wrap">
        <div class="storage-label">${deleted ? '0 of 15 GB used' : '5 of 15 GB used'}</div>
        <div class="storage-bar">
          <div class="storage-bar-fill" style="width: ${deleted ? '0%' : '33%'}"></div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>My Files</h2>
      <div id="file-list">${fileListSection}</div>

      <div class="actions">
        <button class="btn-warning" id="btn-public">Make Account Public</button>
        <button class="btn-danger" id="btn-delete-all">Delete All Files</button>
      </div>
    </div>
  </main>

  <div class="modal-overlay" id="public-modal">
    <div class="modal">
      <p>Account is now public — anyone can view your files.</p>
      <button class="btn-close" id="modal-close">OK</button>
    </div>
  </div>

  <script>
    document.getElementById('btn-public').addEventListener('click', function () {
      fetch('/make-public', { method: 'POST' });
      document.getElementById('public-modal').classList.add('open');
    });

    document.getElementById('modal-close').addEventListener('click', function () {
      document.getElementById('public-modal').classList.remove('open');
    });

    document.getElementById('btn-delete-all').addEventListener('click', function () {
      if (!confirm('Are you sure? This cannot be undone.')) return;

      fetch('/delete-all', { method: 'POST' })
        .then(function () { window.location.reload(); });
    });
    ${embed ? `
    window.addEventListener('message', function (e) {
      if (e.origin !== '${ATTACKER_ORIGIN}') return;
      if (!e.data || e.data.type !== 'align-delete') return;
      var btn = document.getElementById('btn-delete-all');
      btn.style.top = e.data.top + 'px';
      btn.style.width = e.data.width + 'px';
    });
    ` : ''}
    /*
     * ❌ FAILED DEFENCE — DO NOT USE
     *
     * Frame-buster: if this page is inside an iframe, break out of it.
     *
     * if (window.top !== window.self) {
     *   window.top.location = window.self.location;
     * }
     *
     * This fails because attackers use the sandbox attribute on the iframe:
     *
     * <!-- sandbox WITHOUT allow-top-navigation prevents the frame-buster from
     *      redirecting the parent page. The script runs but window.top.location
     *      assignment is silently blocked by the sandbox. -->
     * <iframe src="http://victim.com" sandbox="allow-scripts allow-forms"></iframe>
     *
     * JavaScript cannot defend against clickjacking. Only HTTP headers can.
     */
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildDashboardHtml(req.query.embed === '1'));
});

app.post('/delete-all', function (req, res) {
  vaultState.files = [];
  vaultState.deleted = true;
  res.json({ success: true });
});

app.post('/make-public', function (req, res) {
  vaultState.accountPublic = true;
  res.json({ success: true });
});

app.post('/reset', function (req, res) {
  vaultState.files = SEED_FILES.map(function (f) { return Object.assign({}, f); });
  vaultState.deleted = false;
  vaultState.accountPublic = false;
  res.json({ success: true });
});

app.listen(PORT, function () {
  console.log('CloudVault (VULNERABLE) running at http://localhost:' + PORT);
});
