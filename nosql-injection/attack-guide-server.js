/*
 * Terminal 2: cd demo-attacked/nosql-injection && npm run guide
 */

const path = require('path');
const express = require('express');

const app = express();
const PORT = 3023;
const VICTIM_PORT = 3022;
const PROTECTED_PORT = 3024;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ victimPort: VICTIM_PORT, protectedPort: PROTECTED_PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.listen(PORT, function () {
  console.log('NoSQL attack guide running at http://localhost:' + PORT);
});
