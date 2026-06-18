/*
 * How to Run:
 *
 * Terminal 3: cd demo-attacked/ssrf && npm run guide
 *
 * Attack console:
 * http://localhost:3018  ← copy internal URLs, open DevShare victims
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3018;
const VICTIM_PORT = 3019;
const PROTECTED_PORT = 3021;
const INTERNAL_PORT = 3020;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/api/config', function (req, res) {
  res.json({
    victimPort: VICTIM_PORT,
    protectedPort: PROTECTED_PORT,
    internalPort: INTERNAL_PORT,
  });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.listen(PORT, function () {
  console.log('SSRF attack console running at http://localhost:' + PORT);
});
