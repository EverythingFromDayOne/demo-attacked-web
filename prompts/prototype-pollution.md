# Cursor Prompt: Prototype Pollution Demo — ConfigHub

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attacker server / Attack guide | Clone `DASHBOARD_HTML` from `reverse-tabnabbing/attacker-server.js` — `#0a0a0a` bg, `#00ff41` text, `'Courier New'` font. Copy `<style>` verbatim. |
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
SQL Injection (3025–3027).
This demo lives under `demo-attacked/prototype-pollution/` using ports 3028–3030.

Tech stack: Node.js + Express. All HTML as template literals. Vanilla CSS/JS.
No database. In-memory state only. No extra npm packages beyond express.

---

## Files to create

```
demo-attacked/prototype-pollution/
├── victim-server.js           # ConfigHub vulnerable    — port 3028
├── attack-guide-server.js     # Attack guide            — port 3029
├── victim-server-protected.js # ConfigHub protected     — port 3030
├── package.json
└── README.md
```

`package.json` scripts:
```json
{
  "scripts": {
    "victim":           "node victim-server.js",
    "guide":            "node attack-guide-server.js",
    "victim-protected": "node victim-server-protected.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

---

## Scenario

**ConfigHub** — a developer tool for saving and merging JSON configuration
presets. Teams share base configs (linting rules, build options, deploy settings)
and apply patches on top. The merge endpoint takes a `base` object and a `patch`
object and deep-merges them using a recursive function.

The vulnerability: the recursive merge uses `for...in` and writes directly to
`target[key]`. When `patch` contains `{"__proto__": {"isAdmin": true}}`, the
merge function calls itself with `target['__proto__']` as the target — which is
`Object.prototype`. After that one request, every plain object `{}` in the
process inherits `isAdmin: true`. The admin panel becomes accessible to anyone.

---

## The vulnerable merge function (used in port 3028)

```js
// ⚠️ VULNERABLE — for...in iterates inherited keys, and target['__proto__']
// resolves to Object.prototype, so merge() mutates the global prototype.
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
```

Attack payload that exploits it:
```json
{
  "base": {},
  "patch": { "__proto__": { "isAdmin": true, "role": "superadmin" } }
}
```

After this POST hits `/api/merge`, every subsequent `{}` in the process has
`isAdmin: true` and `role: "superadmin"` implicitly.

---

## The protected merge function (used in port 3030)

```js
// ✅ PROTECTED — Object.keys() only returns own enumerable keys (not inherited),
// and the blocklist explicitly rejects __proto__, constructor, prototype.
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue; // ✅ skip prototype-polluting keys
    }
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = Object.create(null); // ✅ no prototype on child objects
      }
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
```

---

## Port 3028 — Vulnerable ConfigHub

### In-memory state

```js
// Resets on server start. The attack persists until server restarts.
const presets = [
  { id: 1, name: 'ESLint Base', config: { rules: { 'no-console': 'warn' }, env: { node: true } } },
  { id: 2, name: 'Webpack Dev', config: { mode: 'development', devtool: 'source-map' } },
  { id: 3, name: 'TypeScript Strict', config: { strict: true, noImplicitAny: true } },
];
```

### Pages

**`GET /`** — ConfigHub dashboard

Clean light-mode product UI (white bg, slate text). Navigation bar with
`ConfigHub` logo + links `Presets · Merge · Admin`.

Amber top banner:
```
⚠  VULNERABLE: merge endpoint uses recursive deep-merge without prototype key filtering
```

Main content: two columns.

Left — **Preset Library**: cards for each preset showing name + JSON preview
(collapsed, monospace). Each card has a "Use as Base" button that populates the
merge form.

Right — **Merge Workbench**:
- Textarea `Base Config (JSON)` — pre-filled with `{}`
- Textarea `Patch Config (JSON)` — pre-filled with `{}`  
- `Merge →` button → POST `/api/merge`
- Result panel below (shows merged output or error)

Below the form, collapsible `<details>` labeled `▶ Try this payload`:
```json
{
  "base": {},
  "patch": { "__proto__": { "isAdmin": true, "role": "superadmin" } }
}
```
With a small note: "Paste into Patch Config and click Merge. Then visit /admin."

**`POST /api/merge`**

Body: `{ base: object, patch: object }`. Runs `merge(base, patch)` using the
vulnerable function. Returns `{ result: mergedObject }`.

Does NOT validate or sanitize keys. After a `__proto__` payload, `Object.prototype`
is permanently mutated for the lifetime of this Node.js process.

**`GET /admin`**

Admin gate check:
```js
app.get('/admin', (req, res) => {
  const user = {}; // plain empty object — inherits from Object.prototype
  if (user.isAdmin) {
    // ⚠️ After pollution: {} inherits isAdmin:true — anyone gets in
    res.send(buildAdminPage(true));
  } else {
    res.send(buildAdminPage(false));
  }
});
```

`buildAdminPage(granted)`:
- If `granted === false`: locked page — grey panel, padlock icon, text
  `"Admin access denied. You do not have the required privileges."`, no data shown.
- If `granted === true`: red alert banner `"🚨 ADMIN ACCESS GRANTED via prototype pollution"`,
  then a table showing all presets including their full config JSON, plus a row
  showing `Object.prototype` is now polluted:
  ```
  Object.prototype.isAdmin  = true
  Object.prototype.role     = superadmin
  ```
  And a callout: `"Every {} in this Node.js process now inherits these properties.
  Restart the server to clear the pollution."`

**`GET /api/proto-check`**

Returns JSON showing the current state of `Object.prototype`:
```js
app.get('/api/proto-check', (req, res) => {
  const probe = {};
  res.json({
    isAdmin: probe.isAdmin,
    role: probe.role,
    polluted: probe.isAdmin === true,
  });
});
```

The dashboard polls this every 2 seconds and shows a live "Prototype Status"
indicator:
- 🟢 `Object.prototype is clean` (grey, normal)
- 🔴 `Object.prototype POLLUTED — isAdmin: true, role: superadmin` (red pulsing)

---

## Port 3029 — Attack Guide Server

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
  <button class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (:3028)</button>
  <button class="btn-protected" id="btn-switcher-protected">Protected (:3030)</button>
</div>
```

Switcher JS:
```js
document.getElementById('btn-switcher-vulnerable').addEventListener('click', function () {
  window.open('http://localhost:3028', '_blank');
});
document.getElementById('btn-switcher-protected').addEventListener('click', function () {
  window.open('http://localhost:3030', '_blank');
});
```

### `GET /` — page content

```html
<body>
  <h1>Prototype Pollution — Attack Guide</h1>
  <p class="subtitle">One JSON key corrupts Object.prototype for the entire Node.js process</p>

  <div class="flow-box" style="max-width:900px">
    <strong>ATTACK FLOW</strong><br><br>
    1. Attacker sends <code>{"__proto__": {"isAdmin": true}}</code> to the merge endpoint<br>
    2. Vulnerable merge() calls itself with <code>target['__proto__']</code> as the next target<br>
    3. <code>target['__proto__']</code> resolves to <strong>Object.prototype</strong> — the global ancestor<br>
    4. merge() writes <code>isAdmin: true</code> onto Object.prototype<br>
    5. Every subsequent <code>{}</code> in the process inherits <code>isAdmin: true</code><br>
    6. Admin gate <code>if ({}.isAdmin)</code> now returns true for <strong>any request, any user</strong>
  </div>

  <div class="flow-box" style="max-width:900px">
    <strong>WHY IT WORKS — THE PROTOTYPE CHAIN</strong><br><br>
    <pre>// Every plain object inherits from Object.prototype:
const obj = {};
obj.__proto__ === Object.prototype  // true
Object.getPrototypeOf(obj) === Object.prototype  // true

// target['__proto__'] is the prototype setter:
target['__proto__'] = {x: 1}   // sets target's prototype
// In the vulnerable merge, target[key] where key === '__proto__'
// resolves to Object.prototype itself — not a key named __proto__

// So this:
merge({}, {"__proto__": {"isAdmin": true}})
// Is equivalent to:
Object.prototype.isAdmin = true

// And now:
({}).isAdmin          // true  ← any empty object
({}).isAdmin          // true  ← different object, same result
new SomeClass().isAdmin  // true  ← class instances too</pre>
  </div>

  <div class="credentials-panel">
    <h2>Attack Payloads to Try</h2>
    <table>
      <thead><tr><th>Target</th><th>Where</th><th>Payload (Patch field)</th><th></th></tr></thead>
      <tbody>
        <tr>
          <td>Admin bypass</td>
          <td>Merge Workbench → Patch</td>
          <td><code id="p0">{"__proto__": {"isAdmin": true, "role": "superadmin"}}</code></td>
          <td><button class="btn-copy" data-target="p0">Copy</button></td>
        </tr>
        <tr>
          <td>Silent pollution (no visible change)</td>
          <td>Merge Workbench → Patch</td>
          <td><code id="p1">{"__proto__": {"polluted": true}}</code></td>
          <td><button class="btn-copy" data-target="p1">Copy</button></td>
        </tr>
        <tr>
          <td>constructor.prototype variant</td>
          <td>Merge Workbench → Patch</td>
          <td><code id="p2">{"constructor": {"prototype": {"isAdmin": true}}}</code></td>
          <td><button class="btn-copy" data-target="p2">Copy</button></td>
        </tr>
        <tr>
          <td>curl direct</td>
          <td>Terminal</td>
          <td><code id="p3">curl -s -X POST http://localhost:3028/api/merge -H 'Content-Type: application/json' -d '{"base":{},"patch":{"__proto__":{"isAdmin":true}}}'</code></td>
          <td><button class="btn-copy" data-target="p3">Copy</button></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>The Vulnerable Merge Function</h2>
    <pre>function merge(target, source) {
  for (const key in source) {               // ⚠️ for..in includes inherited keys
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};   // ⚠️ target['__proto__'] = {} sets prototype
      merge(target[key], source[key]);      // ⚠️ recurses into Object.prototype
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// When source = {"__proto__": {"isAdmin": true}}:
// key = '__proto__'
// target['__proto__'] resolves to Object.prototype
// merge(Object.prototype, {isAdmin: true})
// → Object.prototype.isAdmin = true</pre>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>The Fix</h2>
    <pre>function safeMerge(target, source) {
  for (const key of Object.keys(source)) {  // ✅ own keys only, not inherited
    // ✅ explicit blocklist — skip all prototype-chain keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = Object.create(null);  // ✅ no prototype on child objects
      }
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// The three defenses working together:
// 1. Object.keys() — only own enumerable properties, never __proto__
// 2. Key blocklist — explicit rejection of known pollution vectors
// 3. Object.create(null) — child merge targets have no prototype to pollute</pre>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Scope of the Attack</h2>
    <p style="font-size:0.85rem;color:#94a3b8;line-height:1.7;max-width:640px">
      A single HTTP request can affect the entire Node.js process permanently
      (until restart). Because Node.js is single-threaded and shares one
      <code>Object.prototype</code> across all requests, the pollution affects every
      subsequent request from every user — not just the attacker.<br><br>
      This makes prototype pollution a process-wide privilege escalation. It
      differs from SQL/NoSQL injection which is scoped to a single query.
      It also differs from XSS which is scoped to a single victim browser.
      Prototype pollution is a server-side, global, persistent exploit.
    </p>
  </div>

  <!-- fixed bottom-left switcher — see above -->
</body>
```

Copy-button JS (keep all existing copy logic from other guide servers):
```js
document.querySelectorAll('.btn-copy').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var id = btn.getAttribute('data-target');
    var text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
    });
  });
});
```

---

## Port 3030 — Protected ConfigHub

Same layout and design as port 3028. Replace amber banner with green:
```
✅ PROTECTED: merge uses Object.keys() + __proto__ blocklist + Object.create(null)
```

Use `safeMerge()` instead of `merge()` on the `POST /api/merge` route.

`GET /admin` — uses the same gate check as port 3028:
```js
const user = {};
if (user.isAdmin) { ... }
```
But since the merge is safe, `Object.prototype` is never polluted, so `user.isAdmin`
remains `undefined` and admin access is always denied — even if the attacker
sends the `__proto__` payload.

`GET /api/proto-check` — same endpoint as port 3028. After sending the attack
payload to port 3030, `Object.prototype` stays clean:
```json
{ "isAdmin": undefined, "role": undefined, "polluted": false }
```

The prototype status indicator stays green.

---

## README.md

### Attack Flow

```
Attacker sends: POST /api/config/merge
  { "__proto__": { "isAdmin": true } }
        ↓
ConfigHub (3028): Object.assign(target, input)
  → sets Object.prototype.isAdmin = true
        ↓
Mutation is process-wide and permanent (until server restart)
        ↓
Every {} in the app now inherits isAdmin: true via prototype chain
        ↓
Admin panel opens for every user — no login as admin required
```

### Port Reference

| Port | Role | File |
|------|------|------|
| 3028 | Vulnerable ConfigHub | `victim-server.js` |
| 3029 | Attack guide | `attack-guide-server.js` |
| 3030 | Protected ConfigHub | `victim-server-protected.js` |

### Setup

```bash
cd demo-attacked/prototype-pollution
npm install
```

### Attack Walkthrough

**Terminal 1:** `npm run vulnerable`
**Terminal 2:** `npm run guide`

1. Open **localhost:3028** — note the prototype status indicator (🟢 clean)
2. Open **localhost:3028/admin** — access denied
3. In the Merge Workbench, set Patch to:
   ```json
   { "__proto__": { "isAdmin": true, "role": "superadmin" } }
   ```
4. Click `Merge →`
5. Watch the prototype status indicator flip to 🔴 POLLUTED
6. Open **localhost:3028/admin** again — admin panel is now unlocked
7. Open a new tab to **localhost:3028** — any request now has `isAdmin: true`

### Vulnerable Lines

```js
// The recursive merge writes to Object.prototype when key === '__proto__'
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object') {
      if (!target[key]) target[key] = {};
      merge(target[key], source[key]);  // ← pollution happens here
    } else {
      target[key] = source[key];
    }
  }
}
```

### The Fix

Three defenses combined:
1. `Object.keys(source)` instead of `for...in` — own keys only
2. Explicit blocklist: skip `__proto__`, `constructor`, `prototype`
3. `Object.create(null)` for intermediate objects — no prototype to pollute

Any one of the three alone is sufficient. All three together is defense in depth.

### Why This Is Dangerous

Unlike SQL injection (one query) or XSS (one user's browser), prototype pollution
is **process-wide and permanent until server restart**. One request from one
attacker breaks authentication for every user on the server simultaneously.

This is why supply-chain attacks that introduce prototype pollution in npm
packages (lodash `merge`, jQuery `extend`, `qs`) are considered critical severity.
