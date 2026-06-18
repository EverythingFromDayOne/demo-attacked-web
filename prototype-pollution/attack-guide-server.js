/*
 * Terminal 2: cd demo-attacked/prototype-pollution && npm run guide
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3029;
const VICTIM_PORT = 3028;
const PROTECTED_PORT = 3030;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ victimPort: VICTIM_PORT, protectedPort: PROTECTED_PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.listen(PORT, function () {
  console.log('Prototype pollution attack guide running at http://localhost:' + PORT);
});
