# Event Loop Blocking Attack Demo — DevUtils

## Port Reference

| Port | Role | File |
|------|------|------|
| 3031 | Vulnerable DevUtils | `victim-server.js` |
| 3032 | Attack console | `attack-console-server.js` |
| 3033 | Protected DevUtils | `victim-server-protected.js` |

---

## How to Run

```bash
cd demo-attacked/event-loop-blocking
npm install
```

Three terminals:

```
npm run victim           # :3031
npm run console          # :3032
npm run victim-protected # :3033
```

---

## Attack Walkthrough

1. Open **localhost:3032** — the attack console. Both health monitors show ● ok
2. Click **⚡ Fire CPU Attack → :3031** with 50,000,000 iterations
3. Watch the health monitor: `:3031` immediately shows `● blocked`, `:3033` stays `● ok`
4. After 3–6 seconds, the attack completes and `:3031` recovers
5. Now click **⚡ Fire ReDoS Attack → :3031**
6. Same effect — the server is unresponsive while backtracking runs
7. Open **localhost:3031** directly during an attack — the page won't load
8. Open **localhost:3033** during an attack — loads instantly

---

## Vulnerable Lines

```js
// CPU: no cap on n, synchronous loop blocks the event loop
for (let i = 0; i < n; i++) {
  result += Math.sqrt(i * Math.PI) * Math.log(i + 1);
}

// ReDoS: user-supplied regex with no timeout or complexity limit
const re = new RegExp(pattern);
const match = re.test(text);  // can run forever on catastrophic patterns
```

---

## The Fix

**Worker threads** (`worker_threads` module, built into Node.js 12+):

- CPU-heavy work runs in a separate OS thread
- The main event loop continues processing requests
- A timeout on the worker prevents infinite hangs

**Why `setTimeout` alone does not help:**

Synchronous code in Node.js cannot be interrupted by `setTimeout`. The timer
callback sits in the event queue but the event loop is busy running the
synchronous loop — it never reaches the timer. Only truly async operations
(worker threads, child processes, native async I/O) keep the event loop free.

---

## Defense in Depth

| Defense | What it solves |
|---------|---------------|
| Worker threads for CPU work | Event loop stays free during heavy computation |
| Timeout on workers | Prevents infinite hangs; returns 408 to the client |
| Input cap on `n` | Prevents absurdly large requests (secondary defense) |
| Regex complexity limit (e.g. `safe-regex` npm package) | Detects ReDoS-vulnerable patterns before running them |
