/*
 * How to Run (protected):
 *
 * Terminal 1: cd demo-attacked/clickjacking && npm run secure
 * Terminal 2: cd demo-attacked/clickjacking && npm run guide
 *
 * Compare:
 *   http://localhost:3013  ← vulnerable (iframes allowed)
 *   http://localhost:3015  ← protected (iframe blocked by browser)
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3015;

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

// ✅ PROTECTED (primary): X-Frame-Options tells the browser to refuse rendering this
//    page inside any <iframe>, <frame>, or <object> element.
//    DENY = no framing by anyone.
//    SAMEORIGIN = framing allowed only from the same origin.
app.use(function (req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');

  // ✅ PROTECTED (modern): CSP frame-ancestors supersedes X-Frame-Options in all
  //    modern browsers. More flexible — can specify multiple allowed origins.
  //    'none' = equivalent to X-Frame-Options: DENY.
  //    'self' = equivalent to X-Frame-Options: SAMEORIGIN.
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());
app.use(express.json());

app.use(function (req, res, next) {
  if (req.cookies.vault_session !== SESSION_VALUE) {
    res.cookie('vault_session', SESSION_VALUE, { httpOnly: false, path: '/' });
  }
  next();
});

app.get('/api/config', function (req, res) {
  res.json({ mode: 'protected', port: PORT });
});

app.get('/api/files', function (req, res) {
  res.json({ files: vaultState.files, deleted: vaultState.deleted });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
  console.log('CloudVault (PROTECTED) running at http://localhost:' + PORT);
});
