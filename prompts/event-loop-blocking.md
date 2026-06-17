# Cursor Prompt: Event Loop Blocking Demo — DevUtils

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attacker server / Attack console | Clone `DASHBOARD_HTML` from `reverse-tabnabbing/attacker-server.js` — `#0a0a0a` bg, `#00ff41` text, `'Courier New'` font. Copy `<style>` verbatim. |
| Internal / target server | Muted corporate — `#1a1a2e` bg, `#e2e8f0` text |
| Victim servers | Realistic product UI matching their brand |

**Attacker/guide pages — non-negotiable rules:**
- Copy the `<style>` block from `DASHBOARD_HTML` in `reverse-tabnabbing/attacker-server.js` **verbatim**. Never recreate or paraphrase it.
- Body layout: `padding: 2rem` on body. No max-width wrapper div. No centering.
- Panels: use `.flow-box` and `.credentials-panel` classes (defined in that style block). These must be full-width — never add `max-width` to them, not in CSS and not as inline `style` attributes. Only `<p>` text elements may use `max-width` for line-length readability.
- Navigation: **fixed bottom-left `target-switcher` only.** No other open/link buttons anywhere on the page.

---

## Context

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (3001–3009), CSRF (3010–3012), Clickjacking (3013–3015),
Reverse Tabnabbing (3016–3018), SSRF (3019–3021), NoSQL Injection (3022–3024),
SQL Injection (3025–3027), Prototype Pollution (3028–3030).
This demo lives under `demo-attacked/event-loop-blocking/` using ports 3031–3033.

Tech stack: Node.js + Express. All HTML as template literals. Vanilla CSS/JS.
`worker_threads` is built into Node.js — no extra npm packages beyond express.

---

## Files to create

```
demo-attacked/event-loop-blocking/
├── victim-server.js           # DevUtils vulnerable     — port 3031
├── attack-console-server.js   # Attack console          — port 3032
├── victim-server-protected.js # DevUtils protected      — port 3033
├── worker.js                  # Worker thread (used by port 3033 only)
├── package.json
└── README.md
```

`package.json` scripts:
```json
{
  "scripts": {
    "victim":           "node victim-server.js",
    "console":          "node attack-console-server.js",
    "victim-protected": "node victim-server-protected.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

---

## Scenario

**DevUtils** — a developer utility service offering three endpoints: a compute
endpoint that runs N iterations of a CPU-heavy calculation, a regex endpoint that
applies user-supplied patterns to a large text corpus, and a health endpoint that
should always respond instantly.

Node.js runs on a single thread. When any synchronous operation takes a long
time, the event loop cannot process any other callbacks — including incoming
HTTP requests. A single attacker request with a large `n` or a catastrophic
regex pattern can freeze the entire server for seconds, queuing or dropping
every other user's requests.

The attack console (port 3032) sends the blocking request AND simultaneously
polls `/health` on both servers, making the freeze visible in real time.

---

## The two attack vectors

### Vector 1 — CPU loop

```js
// ⚠️ VULNERABLE — synchronous loop blocks the event loop entirely
app.get('/api/compute', (req, res) => {
  const n = parseInt(req.query.n) || 1000;
  let result = 0;
  for (let i = 0; i < n; i++) {
    result += Math.sqrt(i * Math.PI) * Math.log(i + 1);
  }
  res.json({ result, iterations: n });
});
```

Attack: `GET /api/compute?n=50000000`
Effect: blocks the event loop for ~3–6 seconds depending on hardware.

### Vector 2 — ReDoS (Regular Expression Denial of Service)

```js
// ⚠️ VULNERABLE — user-supplied regex with no complexity limit
app.post('/api/regex', (req, res) => {
  const { pattern, text } = req.body;
  const re = new RegExp(pattern);  // ← catastrophic backtracking possible
  const match = re.test(text);
  res.json({ match, pattern, textLength: text.length });
});
```

Attack: pattern `(a+)+b` on text `aaaaaaaaaaaaaaaaaaaaaaaaaaaa` (28 a's, no b).
Effect: exponential backtracking — blocks the event loop for seconds to minutes.

---

## Port 3031 — Vulnerable DevUtils

### Pages

**`GET /`** — DevUtils dashboard

Clean light-mode product UI. Navigation bar: `DevUtils` logo + links
`Compute · Regex · Health`.

Amber top banner:
```
⚠  VULNERABLE: all endpoints run synchronously on the main thread — one slow request blocks everything
```

Three tool panels:

**Panel 1 — Compute**
- Number input `Iterations` (default: `1000`, max shown: no limit)
- `Run` button → `GET /api/compute?n={value}`
- Result display: shows computed value + time taken (ms)
- Small hint (collapsed `<details>`):
  ```
  Normal:  ?n=1000000    (~50ms)
  Attack:  ?n=50000000   (~5s — freezes server)
  ```

**Panel 2 — Regex Search**
- Text input `Pattern` (default: `\d+`)
- Textarea `Text to search` (default: a 500-word Lorem Ipsum block)
- `Test` button → `POST /api/regex`
- Result display: match found/not found
- Small hint (collapsed `<details>`):
  ```
  Normal:  pattern=\d+   text=hello world
  Attack:  pattern=(a+)+b   text=aaaaaaaaaaaaaaaaaaaaaaaaaaaa
  ```

**Panel 3 — Health**
- `Ping` button → `GET /health`
- Shows last response time in ms
- Auto-pings every 3 seconds; shows last 5 response times as a mini history list

**`GET /health`**

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

This endpoint is the canary. While a blocking request is in-flight on the same
server, this endpoint cannot respond — it sits in the queue.

**`GET /api/compute`**

Synchronous loop as shown above. No iteration cap.

**`POST /api/compute`**

Body: `{ n: number }` — same as GET but via JSON body (for the attack console).

**`POST /api/regex`**

Body: `{ pattern: string, text: string }`. Synchronous `new RegExp(pattern).test(text)`.
No timeout, no complexity limit.

---

## Port 3032 — Attack Console

### UI — MANDATORY: clone from reverse-tabnabbing dashboard

Open `demo-attacked/reverse-tabnabbing/attacker-server.js`. Find the
`DASHBOARD_HTML` constant. Copy its entire `<style>` block **verbatim** — every
rule, every value, character for character — into this page's `<style>`. Do not
reinterpret or recreate any CSS. Also copy `SWITCHER_CSS` verbatim.

Body layout: no wrapper div, no max-width centering. Body has `padding: 2rem`.
Panels use `.flow-box` and `.credentials-panel` classes from that style block.

**Navigation — fixed bottom-left switcher ONLY:**
```html
<div class="target-switcher">
  <button class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (:3031)</button>
  <button class="btn-protected" id="btn-switcher-protected">Protected (:3033)</button>
</div>
```

Switcher JS:
```js
document.getElementById('btn-switcher-vulnerable').addEventListener('click', function () {
  window.open('http://localhost:3031', '_blank');
});
document.getElementById('btn-switcher-protected').addEventListener('click', function () {
  window.open('http://localhost:3033', '_blank');
});
```

### `GET /` — page content

```html
<body>
  <h1>Event Loop Blocking — Attack Console</h1>
  <p class="subtitle">One synchronous request can freeze an entire Node.js server</p>

  <!-- Attack flow -->
  <div class="flow-box">
    <strong>HOW IT WORKS</strong><br><br>
    1. Node.js processes all requests on a single thread<br>
    2. A synchronous operation (CPU loop, ReDoS regex) runs to completion before<br>
       the event loop can handle anything else<br>
    3. All other incoming requests queue behind it — including health checks<br>
    4. From the outside, the server appears to hang or crash<br>
    5. A single attacker request is a denial-of-service for all other users
  </div>

  <!-- Live health monitor — the key visualization -->
  <div class="credentials-panel">
    <h2>Live Health Monitor</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:1rem;max-width:640px">
      Polls <code>/health</code> on both servers every 500ms.
      Fire an attack below and watch the vulnerable server stop responding.
    </p>
    <table>
      <thead>
        <tr>
          <th>Server</th>
          <th>Status</th>
          <th>Last Response Time</th>
          <th>Last 5 pings</th>
        </tr>
      </thead>
      <tbody>
        <tr id="row-vulnerable">
          <td>Vulnerable :3031</td>
          <td id="status-3031">—</td>
          <td id="latency-3031">—</td>
          <td id="history-3031" style="font-size:0.75rem;color:#64748b">—</td>
        </tr>
        <tr id="row-protected">
          <td>Protected :3033</td>
          <td id="status-3033">—</td>
          <td id="latency-3033">—</td>
          <td id="history-3033" style="font-size:0.75rem;color:#64748b">—</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Attack panel 1: CPU loop -->
  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Attack 1 — CPU Loop</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:1rem;max-width:640px">
      Sends a compute request with 50,000,000 iterations to the vulnerable server.
      Simultaneously continues polling health on both servers.
    </p>
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
      <label style="font-size:0.82rem;color:#94a3b8">Iterations:</label>
      <input type="number" id="cpu-n" value="50000000" min="1000" step="1000000"
        style="background:#111;border:1px solid #1a3a1a;color:#00ff41;padding:0.4rem 0.6rem;
               border-radius:4px;font-family:inherit;font-size:0.82rem;width:160px">
      <button type="button" id="btn-cpu-attack" class="demo-btn">
        ⚡ Fire CPU Attack → :3031
      </button>
    </div>
    <div id="cpu-result" style="font-size:0.82rem;color:#64748b;min-height:1.5rem"></div>
  </div>

  <!-- Attack panel 2: ReDoS -->
  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Attack 2 — ReDoS (Catastrophic Regex Backtracking)</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:1rem;max-width:640px">
      Sends a regex pattern that causes exponential backtracking.
      The regex engine tries every possible combination before giving up.
    </p>
    <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1rem;max-width:500px">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <label style="font-size:0.82rem;color:#94a3b8;min-width:70px">Pattern:</label>
        <input type="text" id="regex-pattern" value="(a+)+b"
          style="flex:1;background:#111;border:1px solid #1a3a1a;color:#facc15;
                 padding:0.4rem 0.6rem;border-radius:4px;font-family:inherit;font-size:0.82rem">
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <label style="font-size:0.82rem;color:#94a3b8;min-width:70px">Text:</label>
        <input type="text" id="regex-text" value="aaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          style="flex:1;background:#111;border:1px solid #1a3a1a;color:#00ff41;
                 padding:0.4rem 0.6rem;border-radius:4px;font-family:inherit;font-size:0.82rem">
      </div>
      <button type="button" id="btn-regex-attack" class="demo-btn" style="align-self:flex-start">
        ⚡ Fire ReDoS Attack → :3031
      </button>
    </div>
    <div id="regex-result" style="font-size:0.82rem;color:#64748b;min-height:1.5rem"></div>
  </div>

  <!-- fixed bottom-left switcher -->
</body>
```

### JavaScript for the attack console

Health monitor — polls both servers every 500ms:
```js
const history3031 = [];
const history3033 = [];

function ping(port, statusId, latencyId, historyId, historyArr) {
  const start = Date.now();
  fetch('http://localhost:' + port + '/health', { signal: AbortSignal.timeout(6000) })
    .then(function (r) { return r.json(); })
    .then(function () {
      var ms = Date.now() - start;
      historyArr.unshift(ms + 'ms');
      if (historyArr.length > 5) historyArr.pop();
      var color = ms < 100 ? '#00ff41' : ms < 1000 ? '#facc15' : '#ef4444';
      document.getElementById(statusId).innerHTML =
        '<span style="color:' + color + '">● ok</span>';
      document.getElementById(latencyId).innerHTML =
        '<span style="color:' + color + '">' + ms + 'ms</span>';
      document.getElementById(historyId).textContent = historyArr.join(' · ');
    })
    .catch(function () {
      var ms = Date.now() - start;
      historyArr.unshift('TIMEOUT');
      if (historyArr.length > 5) historyArr.pop();
      document.getElementById(statusId).innerHTML =
        '<span style="color:#ef4444">● blocked</span>';
      document.getElementById(latencyId).innerHTML =
        '<span style="color:#ef4444">' + ms + 'ms (queued/timeout)</span>';
      document.getElementById(historyId).textContent = historyArr.join(' · ');
    });
}

setInterval(function () {
  ping(3031, 'status-3031', 'latency-3031', 'history-3031', history3031);
  ping(3033, 'status-3033', 'latency-3033', 'history-3033', history3033);
}, 500);

// Initial ping
ping(3031, 'status-3031', 'latency-3031', 'history-3031', history3031);
ping(3033, 'status-3033', 'latency-3033', 'history-3033', history3033);
```

CPU attack button:
```js
document.getElementById('btn-cpu-attack').addEventListener('click', function () {
  var n = parseInt(document.getElementById('cpu-n').value) || 50000000;
  var result = document.getElementById('cpu-result');
  var start = Date.now();
  result.innerHTML = '<span style="color:#facc15">⏳ Firing... watch :3031 health monitor above</span>';
  fetch('http://localhost:3031/api/compute?n=' + n)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var ms = Date.now() - start;
      result.innerHTML = '<span style="color:#00ff41">✓ Completed in ' + ms + 'ms — result: ' + data.result.toFixed(4) + '</span>';
    })
    .catch(function (err) {
      result.innerHTML = '<span style="color:#ef4444">✗ ' + err.message + '</span>';
    });
});
```

ReDoS attack button:
```js
document.getElementById('btn-regex-attack').addEventListener('click', function () {
  var pattern = document.getElementById('regex-pattern').value;
  var text = document.getElementById('regex-text').value;
  var result = document.getElementById('regex-result');
  var start = Date.now();
  result.innerHTML = '<span style="color:#facc15">⏳ Firing ReDoS... watch :3031 health monitor above</span>';
  fetch('http://localhost:3031/api/regex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern: pattern, text: text })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var ms = Date.now() - start;
      result.innerHTML = '<span style="color:#00ff41">✓ Completed in ' + ms + 'ms — match: ' + data.match + '</span>';
    })
    .catch(function (err) {
      result.innerHTML = '<span style="color:#ef4444">✗ ' + err.message + '</span>';
    });
});
```

---

## Port 3033 — Protected DevUtils

Same UI as port 3031. Replace amber banner with green:
```
✅ PROTECTED: CPU work runs in worker threads — event loop stays free
```

### worker.js

```js
const { workerData, parentPort } = require('worker_threads');

if (workerData.type === 'compute') {
  let result = 0;
  const n = workerData.n;
  for (let i = 0; i < n; i++) {
    result += Math.sqrt(i * Math.PI) * Math.log(i + 1);
  }
  parentPort.postMessage({ result, iterations: n });
}

if (workerData.type === 'regex') {
  const re = new RegExp(workerData.pattern);
  const match = re.test(workerData.text);
  parentPort.postMessage({ match });
}
```

### Protected compute endpoint

```js
// ✅ CPU work runs in a worker thread — does not block the event loop
const { Worker } = require('worker_threads');

app.get('/api/compute', (req, res) => {
  const n = Math.min(parseInt(req.query.n) || 1000, 100_000_000); // reasonable cap
  const worker = new Worker('./worker.js', { workerData: { type: 'compute', n } });

  const timeout = setTimeout(function () {
    worker.terminate();
    res.status(408).json({ error: 'Computation timed out after 10s' });
  }, 10000);

  worker.once('message', function (data) {
    clearTimeout(timeout);
    res.json(data);
  });
  worker.once('error', function (err) {
    clearTimeout(timeout);
    res.status(500).json({ error: err.message });
  });
});
```

### Protected regex endpoint

```js
// ✅ Regex runs in a worker thread with a 5s timeout
// Even a catastrophic ReDoS pattern cannot block the main event loop
app.post('/api/regex', (req, res) => {
  const { pattern, text } = req.body;

  let re;
  try {
    re = new RegExp(pattern); // validate syntax first (fast, no matching yet)
  } catch (err) {
    return res.status(400).json({ error: 'Invalid regex: ' + err.message });
  }

  const worker = new Worker('./worker.js', {
    workerData: { type: 'regex', pattern, text }
  });

  const timeout = setTimeout(function () {
    worker.terminate();
    // ✅ After timeout, event loop is still free — other requests keep working
    res.status(408).json({ error: 'Regex timed out — pattern may cause catastrophic backtracking' });
  }, 5000);

  worker.once('message', function (data) {
    clearTimeout(timeout);
    res.json(data);
  });
  worker.once('error', function (err) {
    clearTimeout(timeout);
    res.status(500).json({ error: err.message });
  });
});
```

### Health endpoint (same on both servers)

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

On port 3033 this responds instantly even while worker threads are busy —
the event loop is never blocked.

---

## README.md

### Attack Flow

```
Attacker sends: POST /api/process?input=aaaaaaaaaaaaaaaaaaaaa!
        ↓
DevUtils (3031) runs catastrophic ReDoS regex on the main thread
        ↓
Event loop blocked — Node.js can process nothing else (10–30 seconds)
        ↓
All other users' requests queue behind it → server appears completely down

                    ┌─────────────────────────────────────────┐
  Protected (3033): │ Regex runs in a worker_thread            │
                    │ Main thread stays free → /health: 200 OK │
                    └─────────────────────────────────────────┘
```

### Port Reference

| Port | Role | File |
|------|------|------|
| 3031 | Vulnerable DevUtils | `victim-server.js` |
| 3032 | Attack console | `attack-console-server.js` |
| 3033 | Protected DevUtils | `victim-server-protected.js` |

### Setup

```bash
cd demo-attacked/event-loop-blocking
npm install
```

### Attack Walkthrough

**Terminal 1:** `npm run vulnerable`
**Terminal 2:** `npm run guide`
**Terminal 3:** `npm run secure`

1. Open **localhost:3032** — the attack console. Both health monitors show ● ok
2. Click **⚡ Fire CPU Attack → :3031** with 50,000,000 iterations
3. Watch the health monitor: `:3031` immediately shows `● blocked`, `:3033` stays `● ok`
4. After 3–6 seconds, the attack completes and `:3031` recovers
5. Now click **⚡ Fire ReDoS Attack → :3031**
6. Same effect — the server is unresponsive while backtracking runs
7. Open **localhost:3031** directly during an attack — the page won't load
8. Open **localhost:3033** during an attack — loads instantly

### Vulnerable Lines

```js
// CPU: no cap on n, synchronous loop blocks the event loop
for (let i = 0; i < n; i++) {
  result += Math.sqrt(i * Math.PI) * Math.log(i + 1);
}

// ReDoS: user-supplied regex with no timeout or complexity limit
const re = new RegExp(pattern);
const match = re.test(text);  // can run forever on catastrophic patterns
```

### The Fix

**Worker threads** (`worker_threads` module, built into Node.js 12+):
- CPU-heavy work runs in a separate OS thread
- The main event loop continues processing requests
- A timeout on the worker prevents infinite hangs

**Why `setTimeout` alone does not help:**
Synchronous code in Node.js cannot be interrupted by `setTimeout`. The timer
callback sits in the event queue but the event loop is busy running the
synchronous loop — it never reaches the timer. Only truly async operations
(worker threads, child processes, native async I/O) keep the event loop free.

### Defense in Depth

| Defense | What it solves |
|---------|---------------|
| Worker threads for CPU work | Event loop stays free during heavy computation |
| Timeout on workers | Prevents infinite hangs; returns 408 to the client |
| Input cap on `n` | Prevents absurdly large requests (secondary defense) |
| Regex complexity limit (e.g. `safe-regex` npm package) | Detects ReDoS-vulnerable patterns before running them |
