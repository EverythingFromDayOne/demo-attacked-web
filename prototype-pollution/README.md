# Prototype Pollution Attack Demo — ConfigHub

## Port Reference

| Port | Role | File |
|------|------|------|
| 3028 | Vulnerable ConfigHub | `victim-server.js` |
| 3029 | Attack guide | `attack-guide-server.js` |
| 3030 | Protected ConfigHub | `victim-server-protected.js` |

---

## Attack Flow

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

---

## How to Run

```bash
cd demo-attacked/prototype-pollution
npm install
```

Three terminals:

```
npm run vulnerable           # :3028
npm run guide                # :3029
npm run secure               # :3030
```

---

## Attack Walkthrough

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

---

## Protected Demo

1. Open **localhost:3030** — send the same `__proto__` payload via Merge Workbench
2. Prototype status stays 🟢 clean
3. Visit **localhost:3030/admin** — access remains denied

---

## Vulnerable Lines

```js
// The recursive merge writes to Object.prototype when key === '__proto__'
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], source[key]);  // ← pollution happens here
    } else {
      target[key] = source[key];
    }
  }
}
```

---

## The Fix

```js
// ✅ PROTECTED — Object.keys() only returns own enumerable keys (not inherited),
// and the blocklist explicitly rejects __proto__, constructor, prototype.
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = Object.create(null);
      }
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
```

Three defenses combined: `Object.keys()` for own keys only, explicit blocklist for `__proto__` / `constructor` / `prototype`, and `Object.create(null)` for intermediate objects so there is no prototype to pollute. Any one alone is sufficient; all three is defense in depth.

---

## Why It Works

Unlike SQL injection (one query) or XSS (one user's browser), prototype pollution
is **process-wide and permanent until server restart**. One request from one
attacker breaks authentication for every user on the server simultaneously.

This is why supply-chain attacks that introduce prototype pollution in npm
packages (lodash `merge`, jQuery `extend`, `qs`) are considered critical severity.

---

## Defense Details

Three defenses combined:

1. `Object.keys(source)` instead of `for...in` — own keys only
2. Explicit blocklist: skip `__proto__`, `constructor`, `prototype`
3. `Object.create(null)` for intermediate objects — no prototype to pollute

Any one of the three alone is sufficient. All three together is defense in depth.
