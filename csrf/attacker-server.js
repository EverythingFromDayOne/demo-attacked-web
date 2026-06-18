/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/csrf && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/csrf && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3010  ← Log in as john.doe / password123
 * 2. http://localhost:3011  ← Read attack flow, open lure page
 * 3. Lure auto-submits transfer — return to NetBank to see drained balance
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3011;
const VICTIM_PORT = 3010;
const PROTECTED_PORT = 3012;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({ victimPort: VICTIM_PORT, protectedPort: PROTECTED_PORT });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.get('/lure', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lure.html'));
});

app.listen(PORT, () => {
  console.log(`CSRF attacker server running at http://localhost:${PORT}`);
  console.log(`Lure page: http://localhost:${PORT}/lure`);
});
