# Path Traversal Attack Demo — FileVault

## Port Reference

| Port | Role | File |
|------|------|------|
| 3043 | Vulnerable FileVault | `victim-server.js` |
| 3044 | Attack guide | `attack-guide-server.js` |
| 3045 | Protected FileVault | `victim-protected-server.js` |

---

## Attack Flow

```
Attacker sends: GET /api/download?file=../../victim-server.js
        ↓
FileVault (3043): path.join(__dirname, 'uploads', '../../victim-server.js')
  normalizes to: /path/to/demo-attacked/path-traversal/victim-server.js
        ↓
path.join collapses ../ but does NOT verify the result is inside uploads/
        ↓
Server reads and returns its own source code
(On a real system: ../../.env, ../../../../etc/passwd, private keys)
```

---

## What this demonstrates

`path.join(__dirname, 'uploads', userInput)` normalizes the path but does not prevent escape from the `uploads/` directory. `../` sequences are valid path components. The server reads and returns any file the Node.js process can access.

---

## Vulnerable line

```js
const filePath = path.join(__dirname, 'uploads', filename); // ← no containment check
```

---

## The fix

```js
const uploadsDir = path.resolve(__dirname, 'uploads');
const requestedPath = path.resolve(uploadsDir, filename);
if (!requestedPath.startsWith(uploadsDir + path.sep)) {
  return res.status(403).json({ error: 'Access denied' });
}
```

---

## Run the demo

```bash
cd demo-attacked/path-traversal
npm install
npm run victim           # terminal 1 → localhost:3043
npm run attacker         # terminal 2 → localhost:3044
npm run victim-protected # terminal 3 → localhost:3045
```

### Walkthrough

1. Open **localhost:3044** and log in as `alice` / `alice123`
2. Fetch `../package.json` → server returns its own dependency list
3. Fetch `../victim-server.js` → server returns its own source code
4. Switch to **:3045** → same payloads return 403

---

## Key technical note

`path.sep` in the containment check matters. Without it, `/uploads-secret/file` would pass a `startsWith('/uploads')` check. With `path.sep` appended, the check is `/uploads/` — unambiguous.

---

## Credentials

| User | Password |
|------|----------|
| alice | alice123 |
| bob | bob123 |
