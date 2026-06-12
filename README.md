# Security Attack Demonstration Lab

A hands-on lab for understanding real-world web security vulnerabilities. Each attack is a self-contained running demo — not theory, not slides. You run the servers, execute the attack yourself, and see exactly what breaks and why.

Every demo follows the same structure: a realistic victim app, an attacker server, and a protected version of the victim that shows the fix side-by-side.

---

## Attack Index

| # | Attack | Folder | Ports | Status |
|---|--------|--------|-------|--------|
| 1 | Stored XSS | `xss/stored/` | 3001–3003 | ✅ Complete |
| 2 | Reflected XSS | `xss/reflected/` | 3004–3006 | ✅ Complete |
| 3 | SVG Upload XSS | `xss/svg-upload/` | 3007–3009 | ✅ Complete |
| 4 | CSRF | `csrf/` | 3010–3012 | ✅ Complete |
| 5 | Clickjacking | `clickjacking/` | 3013–3015 | 🔧 In progress |
| 6 | Reverse Tabnabbing | `reverse-tabnabbing/` | 3016–3018 | 📋 Planned |
| 7 | SSRF | `ssrf/` | 3019–3021 | 📋 Planned |
| 8 | NoSQL Injection | `nosql-injection/` | 3022–3024 | 📋 Planned |
| 9 | Prototype Pollution | `prototype-pollution/` | 3025–3027 | 📋 Planned |
| 10 | Event Loop Blocking | `event-loop-blocking/` | 3028–3030 | 📋 Planned |

Each attack block uses 3 consecutive ports: `vulnerable victim → attacker → protected victim`.

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
| 3003 | Stored XSS | Protected victim |
| 3004 | Reflected XSS | Vulnerable victim (ShopNest) |
| 3005 | Reflected XSS | Attacker collector |
| 3006 | Reflected XSS | Protected victim |
| 3007 | SVG Upload XSS | Vulnerable victim (ConnectHub) |
| 3008 | SVG Upload XSS | Attacker collector |
| 3009 | SVG Upload XSS | Protected victim |
| 3010 | CSRF | Vulnerable victim (NetBank) |
| 3011 | CSRF | Attacker lure + dashboard |
| 3012 | CSRF | Protected victim |
| 3013 | Clickjacking | Vulnerable victim |
| 3014 | Clickjacking | Attacker overlay |
| 3015 | Clickjacking | Protected victim |
| 3016 | Reverse Tabnabbing | Vulnerable victim |
| 3017 | Reverse Tabnabbing | Attacker page |
| 3018 | Reverse Tabnabbing | Protected victim |
| 3019 | SSRF | Vulnerable victim |
| 3020 | SSRF | Internal service (simulated) |
| 3021 | SSRF | Protected victim |
| 3022 | NoSQL Injection | Vulnerable victim |
| 3023 | NoSQL Injection | Attacker dashboard |
| 3024 | NoSQL Injection | Protected victim |
| 3025 | Prototype Pollution | Vulnerable victim |
| 3026 | Prototype Pollution | Attacker payload server |
| 3027 | Prototype Pollution | Protected victim |
| 3028 | Event Loop Blocking | Vulnerable server |
| 3029 | Event Loop Blocking | Load tester |
| 3030 | Event Loop Blocking | Protected server |

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
MongoDB query operators (`$ne`, `$gt`, `$regex`) injected into a JSON login body bypass authentication entirely. `{ "password": { "$ne": "" } }` matches every user. Stopped by input validation and ODM schema enforcement. → [`nosql-injection/README.md`](nosql-injection/README.md)

### 9 · Prototype Pollution
A malicious JSON payload with `__proto__` or `constructor.prototype` keys corrupts `Object.prototype` for the entire Node.js process. All subsequent objects inherit the attacker's properties — privilege escalation without touching the auth system. → [`prototype-pollution/README.md`](prototype-pollution/README.md)

### 10 · Event Loop Blocking
A synchronous CPU-heavy operation (large regex, JSON parse of a huge payload, tight loop) on a single Express endpoint freezes the entire Node.js event loop. Every other request queues behind it — a single attacker request can make the whole server unresponsive for seconds. → [`event-loop-blocking/README.md`](event-loop-blocking/README.md)

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
├── reverse-tabnabbing/
├── ssrf/
├── nosql-injection/
├── prototype-pollution/
├── event-loop-blocking/
└── prompts/                   ← Cursor prompts used to build each demo
```
