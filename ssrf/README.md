# SSRF Attack Demo — DevShare Link Preview

## Port Reference

| Port | Role | File |
|------|------|------|
| 3018 | Attack guide | `attack-guide-server.js` |
| 3019 | Vulnerable victim (DevShare) | `victim-server.js` |
| 3020 | Internal API (simulated private service) | `internal-server.js` |
| 3021 | Protected victim (DevShare) | `victim-server-protected.js` |

> ⚠️ Port 3018 conflicts with reverse-tabnabbing's protected server — never run both demos simultaneously.

---

## Attack Flow

```
Attacker browser ——tells——→ DevShare (3019) ——fetches——→ Internal API (3020)
                                    ↓
                      returns internal data back to browser

The browser cannot reach 3020 directly (it's "internal").
The server can. DevShare becomes an unintentional proxy into its own network.

Real-world target: http://169.254.169.254/ → AWS IAM credentials
```

---

## How to Run

```bash
cd demo-attacked/ssrf
npm install
```

Four terminals:

```
npm run vulnerable           # :3019
npm run internal             # :3020
npm run guide                # :3018
npm run secure               # :3021
```

---

## Attack Walkthrough

1. Open **localhost:3018** — read the attack flow and available internal endpoints.
2. Open **localhost:3020** — browse the internal API endpoints (`/internal/env`, `/internal/users`, etc.).
3. Copy `http://localhost:3020/internal/env`.
4. Open **localhost:3019**, paste the URL into the preview form, click **Generate Preview →**.
5. The DevShare server fetches the internal API and returns your fake database password, JWT secret, and AWS keys in the preview card.
6. Try `http://localhost:3020/internal/users` — you get the entire user table.

Use the victim switcher on the attack console (bottom-left) to open **3019** or **3021** in a new tab.

---

## Protected Demo

1. Terminal 4: `npm run secure` → protected DevShare at **localhost:3021**
2. Paste the same `http://localhost:3020/internal/env` URL.
3. Result: **⛔ Blocked: Private/loopback address blocked**

---

## Vulnerable Lines

```js
// ⚠️ Server fetches any URL — reaches internal network the browser cannot
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

---

## The Fix

```js
// ✅ Block private IPs, loopback, metadata endpoints, non-HTTP schemes
const safety = isUrlSafe(url);
if (!safety.safe) {
  return res.json({ blocked: true, reason: safety.reason });
}
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

---

## Why It Works

The browser cannot reach 3020 directly (it's "internal"). The server can. DevShare becomes an unintentional proxy into its own network.

---

## Defense Details

1. **Scheme allowlist** — only `http:` and `https:`. Blocks `file://`, `gopher://`, `dict://`, and other dangerous schemes.
2. **Hostname denylist** — blocks loopback (`127.x.x.x`, `::1`, `localhost`), link-local (`169.254.0.0/16`), and RFC-1918 private ranges.
3. **DNS resolution check** (not implemented here, but correct approach) — resolve hostname to IP before fetching, validate the IP, fetch to the IP. Prevents DNS rebinding.
4. **Response size limit** — cap response bytes to prevent reading huge files if SSRF is partially achieved.
5. **Internal network segmentation** — internal services should not be reachable from application servers at all. SSRF is only possible because `victim-server.js` and `internal-server.js` share a network. In production, use VPC security groups, firewalls, or service mesh policies to enforce this separation at the network layer — defense in depth.

Protected validation lives in `preview-utils.js` (`isUrlSafe`) and is applied in `victim-server-protected.js` before any fetch.

---

## Why This Attack Is Dangerous

The browser can only reach public internet addresses. The server lives inside the same network as databases, caches, admin APIs, and cloud infrastructure. SSRF turns the server into an **unintentional proxy**:

```
Attacker browser → [public internet] → DevShare server (3019)
                                              ↓ (internal network)
                                       Internal API (3020) ← never supposed to be reachable
```

Real-world SSRF targets:

- **AWS EC2 metadata** (`169.254.169.254`) — returns IAM credentials for the instance's role. Full cloud account takeover in one HTTP request.
- **GCP/Azure metadata** — same pattern, different URL.
- **Elasticsearch** (`localhost:9200`) — unauthenticated by default in older versions. `GET /_cat/indices` lists all data.
- **Redis** (`localhost:6379`) — writable via HTTP in older configs.
- **Internal Kubernetes API** (`10.x.x.x`) — cluster management.
- **CI/CD secrets** — Jenkins at `localhost:8080`, Vault at `localhost:8200`.

---

## Why the Denylist Is Insufficient — DNS Rebinding

The protected server checks the URL's **hostname** before fetching. An attacker can bypass this with DNS rebinding:

1. Register `ssrf.attacker.com` with a short TTL (e.g. 10 seconds).
2. First DNS query returns a legitimate public IP — passes the denylist check.
3. TTL expires. DNS record updated to point to `127.0.0.1`.
4. Server performs the actual fetch — DNS now resolves to loopback.
5. Server fetches `http://127.0.0.1/internal/env` — denylist was bypassed.

**Robust fix:** resolve the hostname to an IP address first, validate the resulting IP, and then immediately open a connection to that IP (not the hostname) — so the same DNS resolution is used for both the check and the fetch. This is called **TOCTOU-safe SSRF prevention** (Time-Of-Check Time-Of-Use). Libraries like `ssrf-req-filter` implement this correctly.

The demo uses the simpler denylist approach because DNS rebinding cannot be demonstrated locally. This limitation is intentional.

---

## Internal API Endpoints

All return JSON (`Content-Type: application/json`):

| Route | Contents |
|-------|----------|
| `GET /internal` | Service discovery |
| `GET /internal/env` | Fake credentials & secrets |
| `GET /internal/users` | User database dump |
| `GET /internal/config` | Infrastructure config |
| `GET /internal/health` | DB/Redis connection strings |

These routes simulate a private microservice. They are reachable from the DevShare server on the same machine, but not directly from the attacker's browser — which is exactly what SSRF exploits.
