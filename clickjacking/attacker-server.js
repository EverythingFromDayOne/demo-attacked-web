/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/clickjacking && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/clickjacking && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3013  ← CloudVault (note 6 files)
 * 2. http://localhost:3014  ← CloudBoost lure — toggle overlay to see alignment
 * 3. Click "Claim My Free Upgrade" — confirm dialog appears (from hidden iframe)
 * 4. Return to localhost:3013 — all files deleted
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3014;
const VICTIM_PORT = 3013;
const PROTECTED_PORT = 3015;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ victimPort: VICTIM_PORT, protectedPort: PROTECTED_PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.listen(PORT, function () {
  console.log('CloudBoost attacker lure running at http://localhost:' + PORT);
});
