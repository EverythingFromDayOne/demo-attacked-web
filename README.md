# Security Attack Demonstration Lab

A hands-on lab for understanding real-world web security vulnerabilities. Each attack is a self-contained running demo — not theory, not slides. You run the servers, execute the attack yourself, and see exactly what breaks and why.

Every demo follows the same structure: a realistic victim app, an attacker server, and a protected version of the victim that shows the fix side-by-side.

---

## Attack Index

| # | Attack | Folder | Ports | Status |
|---|--------|--------|-------|--------|
| 1 | Stored XSS | `xss/stored/` | 3001, 3002, 3009 | ✅ Complete |
| 2 | Reflected XSS | `xss/reflected/` | 3003, 3004, 3008 | ✅ Complete |
| 3 | SVG Upload XSS | `xss/svg-upload/` | 3005, 3006, 3007 | ✅ Complete |
| 4 | CSRF | `csrf/` | 3010–3012 | ✅ Complete |
| 5 | Clickjacking | `clickjacking/` | 3013–3015 | ✅ Complete |
| 6 | Reverse Tabnabbing | `reverse-tabnabbing/` | 3016–3018 | ✅ Complete |
| 7 | SSRF | `ssrf/` | 3019–3021 | ✅ Complete |
| 8 | NoSQL Injection | `nosql-injection/` | 3022–3024 | ✅ Complete |
| 9 | SQL Injection | `sql-injection/` | 3025–3027 | ✅ Complete |
| 10 | Prototype Pollution | `prototype-pollution/` | 3028–3030 | 📋 Prompt ready |
| 11 | Event Loop Blocking | `event-loop-blocking/` | 3031–3033 | 📋 Prompt ready |
| 12 | JWT Attacks | `jwt-attacks/` | 3034–3036 | ✅ Complete |
| 13 | Command Injection | `command-injection/` | 3037–3039 | ✅ Complete |
| 14 | IDOR | `idor/` | 3040–3042 | ✅ Complete |
| 15 | Path Traversal | `path-traversal/` | 3043–3045 | ✅ Complete |
| 16 | Mass Assignment | `mass-assignment/` | 3046–3048 | ✅ Complete |

Port layout: each demo uses `vulnerable victim → attacker/guide → protected victim`.

---

## Prerequisites

- Node.js 18+
- npm 9+
- A browser (Chrome recommended — DevTools are used heavily)

No global installs required. Each attack folder has its own `package.json`.

---

## How to Run Any Demo

```bash
# 1. Enter the attack folder
cd xss/stored        # or csrf/, clickjacking/, etc.

# 2. Install dependencies (first time only)
npm install

# 3. Start the servers — each in a separate terminal
npm run victim         # vulnerable server
npm run attacker       # attacker server
npm run victim-protected  # protected server (for comparison)
```

Each attack's `README.md` has the exact walkthrough, vulnerable line references, and fix explanations.

---

## Port Reference — All Attacks

| Port | Attack | Role |
|------|--------|------|
| 3001 | Stored XSS | Vulnerable victim (NovaCRM) |
| 3002 | Stored XSS | Attacker collector |
| 3003 | Reflected XSS | Vulnerable victim (ShopNest) |
| 3004 | Reflected XSS | Attacker collector |
| 3005 | SVG Upload XSS | Vulnerable victim (ConnectHub) |
| 3006 | SVG Upload XSS | Attacker collector |
| 3007 | SVG Upload XSS | Protected victim |
| 3008 | Reflected XSS | Protected victim |
| 3009 | Stored XSS | Protected victim |
| 3010 | CSRF | Vulnerable victim (NetBank) |
| 3011 | CSRF | Attacker lure + dashboard |
| 3012 | CSRF | Protected victim |
| 3013 | Clickjacking | Vulnerable victim (CloudVault) |
| 3014 | Clickjacking | Attacker overlay (CloudBoost) |
| 3015 | Clickjacking | Protected victim |
| 3016 | Reverse Tabnabbing | Vulnerable victim (TechBlog) |
| 3017 | Reverse Tabnabbing | Attacker page + phishing clone |
| 3018 | Reverse Tabnabbing | Protected victim |
| 3019 | SSRF | Vulnerable victim (DevShare) |
| 3020 | SSRF | Internal API (attack target) |
| 3021 | SSRF | Protected victim |
| 3022 | NoSQL Injection | Vulnerable victim (DevAuth) |
| 3023 | NoSQL Injection | Attack guide |
| 3024 | NoSQL Injection | Protected victim |
| 3025 | SQL Injection | Vulnerable victim (DevLinks) |
| 3026 | SQL Injection | Attack guide |
| 3027 | SQL Injection | Protected victim |
| 3028 | Prototype Pollution | Vulnerable victim |
| 3029 | Prototype Pollution | Attacker payload server |
| 3030 | Prototype Pollution | Protected victim |
| 3031 | Event Loop Blocking | Vulnerable server |
| 3032 | Event Loop Blocking | Load tester |
| 3033 | Event Loop Blocking | Protected server |

| 3034 | JWT Attacks | Vulnerable victim (AuthVault) |
| 3035 | JWT Attacks | Attack lab |
| 3036 | JWT Attacks | Protected victim |
| 3037 | Command Injection | Vulnerable victim (NetProbe) |
| 3038 | Command Injection | Attack guide |
| 3039 | Command Injection | Protected victim |
| 3040 | IDOR | Vulnerable victim (PayrollHub) |
| 3041 | IDOR | Attack lab |
| 3042 | IDOR | Protected victim |
| 3043 | Path Traversal | Vulnerable victim (FileVault) |
| 3044 | Path Traversal | Attack guide |
| 3045 | Path Traversal | Protected victim |
| 3046 | Mass Assignment | Vulnerable victim (ProfileHub) |
| 3047 | Mass Assignment | Attack guide |
| 3048 | Mass Assignment | Protected victim |

All ports are unique. Every demo can run simultaneously.

---

## Attack Summaries

### 1–3 · XSS (Cross-Site Scripting)
Untrusted data is interpreted as executable JavaScript in the victim's browser. Three injection vectors: persistent database storage, URL reflection via SSR, and user-uploaded SVG files. → [`xss/README.md`](xss/README.md)

### 4 · CSRF (Cross-Site Request Forgery)
A forged form on an attacker's page submits a wire transfer to a banking app. The browser auto-attaches the victim's session cookie — no JavaScript access to the cookie required. HttpOnly does not help. → [`csrf/README.md`](csrf/README.md)

### 5 · Clickjacking
A transparent iframe overlays a legitimate site's UI on top of a fake attacker page. The victim clicks what appears to be a "Claim Prize" button but actually clicks "Delete Account" on the underlying site. Stopped by `X-Frame-Options` and `Content-Security-Policy: frame-ancestors`. → [`clickjacking/README.md`](clickjacking/README.md)

### 6 · Reverse Tabnabbing
A page opens a link with `target="_blank"`. The new tab (attacker-controlled) accesses `window.opener` and redirects the original tab to a phishing clone. Stopped by `rel="noopener noreferrer"`. → [`reverse-tabnabbing/README.md`](reverse-tabnabbing/README.md)

### 7 · SSRF (Server-Side Request Forgery)
User input controls a URL that the server fetches. The attacker supplies an internal address (`http://169.254.169.254/`, `http://localhost:9200/`) that the browser could never reach but the server can. The server becomes a proxy into its own internal network. → [`ssrf/README.md`](ssrf/README.md)

### 8 · NoSQL Injection
MongoDB query operators (`$gt`, `$ne`, `$regex`) injected into a JSON login body bypass authentication entirely. `{ "password": { "$gt": "" } }` evaluates to true for every user. Only works on JSON endpoints — form-encoded requests cannot send nested objects. The critical implementation detail: the browser's form submit handler must `JSON.parse()` the typed value before serializing, otherwise operators arrive as literal strings and the attack fails silently. Stopped by enforcing `typeof password === 'string'` before querying. → [`nosql-injection/README.md`](nosql-injection/README.md)

### 9 · SQL Injection
String concatenation into SQL queries lets attackers inject SQL keywords directly. Two vectors: UNION attack on a search field dumps the entire users table; login bypass with `admin'--` comments out the password check entirely. Stopped by parameterized queries (`?` placeholders in `better-sqlite3`) — query structure is compiled before values are bound; a `'` in a parameter is just a character, not a delimiter. → [`sql-injection/README.md`](sql-injection/README.md)

### 10 · Prototype Pollution
A single JSON merge request containing `{"__proto__": {"isAdmin": true}}` corrupts `Object.prototype` for the entire Node.js process. Every subsequent `{}` inherits `isAdmin: true` — the admin gate unlocks for every user, every request, until server restart. Unlike injection attacks scoped to one query or one browser, prototype pollution is process-wide and permanent. Fixed by using `Object.keys()` (own keys only), an explicit `__proto__`/`constructor`/`prototype` blocklist, and `Object.create(null)` for merge targets. → [`prototype-pollution/README.md`](prototype-pollution/README.md)

### 12 · JWT Attacks
Two attack vectors against JSON Web Tokens. The `alg:none` attack exploits servers that read the algorithm from the token header itself — the attacker strips the signature, sets `alg: none`, and the server skips verification entirely. The weak-secret attack brute-forces a common `JWT_SECRET` (`"secret"`) client-side using the Web Crypto API, then re-signs a token with `role: admin`. Fixed by whitelisting `algorithms: ['HS256']` in `jwt.verify()` and generating secrets with `crypto.randomBytes(64)`. → [`jwt-attacks/README.md`](jwt-attacks/README.md)

### 15 · Path Traversal
`path.join(__dirname, 'uploads', req.query.file)` normalizes the path but does not prevent escape from the uploads directory. `../` sequences are valid — `../../victim-server.js` reads the server's own source code. Fixed by `path.resolve()` + `startsWith(uploadsDir + path.sep)` containment check. The `path.sep` suffix prevents `/uploads-extra/` from passing a `/uploads` check. → [`path-traversal/README.md`](path-traversal/README.md)

### 16 · Mass Assignment
`Object.assign(user, req.body)` merges every field in the HTTP request body into the user record — including `isAdmin`, which the developer forgot to exclude. Sending `{"bio": "test", "isAdmin": true}` in a profile PATCH escalates any authenticated user to admin. Fixed by an explicit allowlist of user-writable fields. Defense in depth: also strip `isAdmin` from API responses so the attacker can't monitor its value. → [`mass-assignment/README.md`](mass-assignment/README.md)

### 14 · IDOR (Insecure Direct Object Reference)
The server checks authentication but not authorization. Payslip IDs are sequential integers — any logged-in employee can read any other employee's salary by incrementing the number in the URL. The automated enumerator fetches all 12 payslips across 4 salary bands in under a second. Fix: add `AND user_id = ?` to every resource query. Returns 404 (not 403) on ownership failure — a 403 would confirm the object exists, leaking information to the attacker. → [`idor/README.md`](idor/README.md)

### 13 · Command Injection
User-supplied input is concatenated directly into a shell command via `child_process.exec()`. The OS shell interprets `&`, `;`, `|`, and `$()` as control operators — the attacker appends a second command to a legitimate ping request and gets arbitrary OS-level code execution. A "ping localhost" becomes "ping localhost && cat /etc/passwd". Fixed by switching to `execFile()` (no shell is invoked) plus a hostname allowlist that rejects any character outside `[a-zA-Z0-9\-.]`. → [`command-injection/README.md`](command-injection/README.md)

### 11 · Event Loop Blocking
Node.js runs on a single thread. A synchronous CPU loop or a catastrophic ReDoS regex pattern blocks the event loop entirely — no other request can be processed until it finishes. The attack console (port 3032) fires the blocking request and simultaneously polls `/health` on both servers every 500ms, making the freeze visible in real time: the vulnerable server goes dark while the protected server (using `worker_threads`) keeps responding instantly. → [`event-loop-blocking/README.md`](event-loop-blocking/README.md)

---

## Design Principles

**Run the attack yourself.** Every demo is built so you can execute the exploit in under 5 minutes. Reading about CSRF is not the same as watching $9,000 disappear from a bank account you just logged into.

**Vulnerable and protected side-by-side.** Every victim server has a `-protected` counterpart running on the next port. The only differences are the security fixes — same UI, same logic, different outcome.

**Exact line references.** Every README points to the specific line of code that is the vulnerability, not a general description of the category.

**Real-world framing.** Each demo uses a realistic application scenario — a CRM, an e-commerce search, a social platform, a bank. The attacks are the same ones that appear in real CVEs and bug bounty reports.

---

## Repository Structure

```
demo-attacked/
├── README.md                  ← you are here
├── xss/
│   ├── README.md              ← XSS overview + all 3 variants
│   ├── stored/
│   ├── reflected/
│   └── svg-upload/
├── csrf/
│   └── README.md
├── clickjacking/
│   └── README.md
├── reverse-tabnabbing/
│   └── README.md
├── ssrf/
│   └── README.md
├── nosql-injection/
│   └── README.md
├── sql-injection/
├── prototype-pollution/       ← ConfigHub merge demo
├── event-loop-blocking/       ← DevUtils CPU + ReDoS demo
├── jwt-attacks/                 ← AuthVault JWT forgery demo
├── command-injection/           ← NetProbe exec() demo
└── prompts/                   ← one canonical .md per attack
    ├── xss.md
    ├── csrf.md
    ├── clickjacking.md
    ├── reverse-tabnabbing.md
    ├── ssrf.md
    ├── nosql-injection.md
    ├── sql-injection.md
    ├── prototype-pollution.md
    ├── event-loop-blocking.md
    ├── jwt-attacks.md
    ├── command-injection.md
    ├── idor.md
    ├── path-traversal.md
    └── mass-assignment.md
```
