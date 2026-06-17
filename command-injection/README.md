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

## What this demonstrates

`child_process.exec()` concatenates a user-supplied string into a shell command. The OS shell interprets `&`, `;`, `|`, and `$()` as control characters — the attacker uses these to append arbitrary commands.

---

## Vulnerable line

`victim-server.js`:

```js
const command = `ping -n 4 ${hostname}`;   // ← hostname is unsanitized user input
exec(command, callback);                    // ← exec() invokes a shell
```

---

## Attack

Input `localhost & whoami` into the Ping tool. The shell receives:

```
ping -n 4 localhost & whoami
```

It runs both commands. The response includes the output of `whoami` — the OS user the Node.js process is running as.

---

## Fix

Two layers, both required:

1. **`execFile()` over `exec()`** — no shell is invoked; `&` is just a text character
2. **Input allowlist** — reject anything that isn't a valid hostname before it reaches the OS

---

## Run the demo

```bash
cd demo-attacked/command-injection
npm install
npm run vulnerable           # terminal 1 → localhost:3037
npm run guide         # terminal 2 → localhost:3038
npm run secure # terminal 3 → localhost:3039
```

### Walkthrough

1. Open **localhost:3037** — sign in as `alice` / `alice123`
2. Open **localhost:3038** — copy payloads, paste token from DevTools → localStorage → `authToken`
3. In Ping tool at :3037, paste `localhost & whoami` — see injected command output
4. Try **Live Test** buttons on :3038
5. Open **localhost:3039** — same payload returns 400 Invalid hostname

---

## Credentials

| User | Password | Role |
|------|----------|------|
| alice | alice123 | developer |
| bob | bob123 | developer |
| admin | admin456 | admin |
