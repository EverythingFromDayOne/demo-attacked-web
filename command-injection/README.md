# Command Injection Attack Demo — NetProbe

## Port Reference

| Port | Role | File |
|------|------|------|
| 3037 | Vulnerable NetProbe | `victim-server.js` |
| 3038 | Attack guide | `attack-guide-server.js` |
| 3039 | Protected NetProbe | `victim-protected-server.js` |

---

## Attack Flow

```
Attacker input: "localhost && cat /etc/passwd"
        ↓
NetProbe (3037): exec(`ping -n 4 ${hostname}`)
        ↓
OS shell receives: ping -n 4 localhost && cat /etc/passwd
        ↓
Shell interprets && as "run next command if first succeeds"
        ↓
ping runs → succeeds → cat /etc/passwd runs → output returned to attacker
```

---

## How to Run

```bash
cd demo-attacked/command-injection
npm install
```

Three terminals:

```
npm run vulnerable           # :3037
npm run guide                # :3038
npm run secure               # :3039
```

---

## Attack Walkthrough

1. Open **localhost:3037** — sign in as `alice` / `alice123`
2. Open **localhost:3038** — copy payloads, paste token from DevTools → localStorage → `authToken`
3. In Ping tool at :3037, paste `localhost & whoami` — see injected command output
4. Try **Live Test** buttons on :3038

Input `localhost & whoami` into the Ping tool. The shell receives:

```
ping -n 4 localhost & whoami
```

It runs both commands. The response includes the output of `whoami` — the OS user the Node.js process is running as.

---

## Protected Demo

1. Open **localhost:3039** — same payload returns 400 Invalid hostname

---

## Vulnerable Lines

```js
// ⚠️ exec() spawns a shell — ; && | chain additional commands
const command = 'ping ' + PING_FLAG + ' ' + hostname;
exec(command, { timeout: 10000 }, callback);
```

---

## The Fix

```js
// ✅ execFile() — no shell; hostname passed as array argument
if (!isValidHostname(hostname)) {
  return res.status(400).json({ error: 'Invalid hostname' });
}
execFile('ping', PING_ARGS.concat(hostname), { timeout: 10000 }, callback);
```

---

## Why It Works

`child_process.exec()` concatenates a user-supplied string into a shell command. The OS shell interprets `&`, `;`, `|`, and `$()` as control characters — the attacker uses these to append arbitrary commands.

---

## Defense Details

Two layers, both required:

1. **`execFile()` over `exec()`** — no shell is invoked; `&` is just a text character
2. **Input allowlist** — reject anything that isn't a valid hostname before it reaches the OS

---

## Credentials

| User | Password | Role |
|------|----------|------|
| alice | alice123 | developer |
| bob | bob123 | developer |
| admin | admin456 | admin |
