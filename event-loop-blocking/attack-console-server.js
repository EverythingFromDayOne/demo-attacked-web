/*
 * Terminal 2: cd demo-attacked/event-loop-blocking && npm run guide
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3032;
const VICTIM_PORT = 3031;
const PROTECTED_PORT = 3033;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ victimPort: VICTIM_PORT, protectedPort: PROTECTED_PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.listen(PORT, function () {
  console.log('Event loop blocking attack console running at http://localhost:' + PORT);
});
