/*
 * Terminal 2: cd demo-attacked/jwt-attacks && npm run guide
 */

const path = require('path');
const express = require('express');

const app = express();
const PORT = 3035;
const VICTIM_PORT = 3034;
const PROTECTED_PORT = 3036;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ victimPort: VICTIM_PORT, protectedPort: PROTECTED_PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.listen(PORT, function () {
  console.log('JWT Attack Lab running at http://localhost:' + PORT);
});
