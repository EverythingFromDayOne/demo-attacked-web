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

## How to Run

```bash
cd demo-attacked/path-traversal
npm install
```

Three terminals:

```
npm run vulnerable           # :3043
npm run guide                # :3044
npm run secure               # :3045
```

---

## Attack Walkthrough

1. Open **localhost:3044** and log in as `alice` / `alice123`
2. Fetch `../package.json` → server returns its own dependency list
3. Fetch `../victim-server.js` → server returns its own source code

---

## Protected Demo

1. Switch to **:3045** → same payloads return 403

---

## Vulnerable Lines

```js
// ⚠️ path.join normalises ../ but does NOT enforce containment inside uploads/
const filePath = path.join(baseDir, 'uploads', filename);
const content = fs.readFileSync(filePath, 'utf8');
```

---

## The Fix

```js
// ✅ path.resolve() + startsWith() is the boundary check that actually works
const uploadsDir = path.resolve(baseDir, 'uploads');
const requestedPath = path.resolve(uploadsDir, filename);
if (!requestedPath.startsWith(uploadsDir + path.sep)) {
  return res.status(403).json({ error: 'Access denied: path traversal detected' });
}
```

---

## Why It Works

`path.join(__dirname, 'uploads', userInput)` normalizes the path but does not prevent escape from the `uploads/` directory. `../` sequences are valid path components. The server reads and returns any file the Node.js process can access.

---

## Defense Details

`path.sep` in the containment check matters. Without it, `/uploads-secret/file` would pass a `startsWith('/uploads')` check. With `path.sep` appended, the check is `/uploads/` — unambiguous.

---

## Credentials

| User | Password |
|------|----------|
| alice | alice123 |
| bob | bob123 |
