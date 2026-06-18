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
const path = require('path');
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
  res.json({ mode: 'vulnerable', port: PORT });
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
  console.log('CloudVault (VULNERABLE) running at http://localhost:' + PORT);
});
