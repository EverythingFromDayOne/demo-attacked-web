/*
 * Terminal 2: cd demo-attacked/sql-injection && npm run guide
 */

const path = require('path');
const express = require('express');

const app = express();
const PORT = 3026;
const VICTIM_PORT = 3025;
const PROTECTED_PORT = 3027;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ victimPort: VICTIM_PORT, protectedPort: PROTECTED_PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.listen(PORT, function () {
  console.log('SQL attack guide running at http://localhost:' + PORT);
});
