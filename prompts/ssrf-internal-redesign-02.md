# Cursor Prompt: Redesign port 3020 internal server UI

## Context

`demo-attacked/ssrf/internal-server.js` runs on port 3020. It currently
renders an "SSRF Attack Console" — dark terminal styling, hacker aesthetics,
"HOW TO USE" attack guide. This is conceptually wrong.

Port 3020 is the **target** of the attack, not the attacker. It simulates a
private internal company microservice — the kind that lives on `10.0.0.x` or
`db.internal` inside a production VPC, never exposed to the public internet.
The current UI makes it look like the attacker's tool, which reverses the
mental model for anyone learning from the demo.

Redesign port 3020's root page (`GET /`) only. Do not change any of the
`/internal/*` JSON API routes — those stay exactly as-is. Do not change
`victim-server.js` or `victim-server-protected.js`.

---

## What port 3020 should feel like

Bland, boring enterprise internal tooling. Think: a developer stumbled onto
an internal admin page by accident after getting inside the network. No
hacker aesthetic. No attack instructions. The page should feel like something
that was never designed to be seen by an outsider — because in the real
scenario, it isn't.

---

## New root page design (`GET /`)

### Header / identity

```
DevShare Platform — Internal Services
devshare-internal.corp  ·  NOT FOR PUBLIC ACCESS
```

Small monospace font. Muted color palette — think `#1a1a2e` background,
`#e2e8f0` text, `#334155` borders. No neon. No green terminal glow.

Below the header, one subdued banner:

```
⚠  This service has no authentication — it assumes network-level isolation.
   Access from outside the internal network means your perimeter is broken.
```

Style: amber/yellow text (`#fbbf24`), no background box — just a single line.

---

### Service registry table

Title: `Internal Endpoints`

A simple HTML table. No copy buttons on the main view — just a clean list:

| Path | Description | Response |
|------|-------------|----------|
| `/internal` | Service discovery | JSON |
| `/internal/env` | Runtime environment & secrets | JSON |
| `/internal/users` | User database snapshot | JSON |
| `/internal/config` | Infrastructure configuration | JSON |
| `/internal/health` | DB / Redis connection strings | JSON |

Plain table styling. Alternating row shading. No action buttons here — this
is documentation, not a toolkit.

Below the table, a muted note in small text:

```
These endpoints return live data. No auth required — access control is
handled at the network layer (VPC security groups / firewall rules).
```

---

### "Why you can reach this" demo callout

This is the ONLY place that breaks the internal-server fiction and
acknowledges the demo context. Style it as a collapsed `<details>` element
(closed by default), labeled:

```
▶ Demo context — why this page is reachable
```

When expanded:

```
In production, port 3020 would be on a private subnet unreachable from
your browser. This demo runs everything on localhost so you can see the
internal API directly — but that's not how SSRF works in the real attack.

In the real attack:
  Your browser cannot reach http://localhost:3020/internal/env
  DevShare's server (port 3019) CAN reach it — same machine, same network
  You trick DevShare into fetching it for you via the URL preview feature
  DevShare returns the response to your browser

That's Server-Side Request Forgery: you forged a request the server made.

To run the attack:
  1. Open http://localhost:3019 (vulnerable DevShare)
  2. Paste any /internal/* URL into the preview field
  3. Click Generate Preview
  4. Read the secrets in the preview card
```

Plain text inside the details element. No styling beyond readable prose.

---

### Demo controls (bottom of page, clearly separated)

A horizontal rule, then a small section labeled `Demo Controls` in muted text.

Two buttons only:
- `Vulnerable DevShare :3019` — opens `http://localhost:3019` in new tab
- `Protected DevShare :3021` — opens `http://localhost:3021` in new tab

Style: small, secondary-looking buttons. `border: 1px solid #475569`,
`background: transparent`, `color: #94a3b8`. Not prominent.

No copy buttons on this page. No "paste this URL" instructions. Those
belonged to the "attack console" framing, which is gone.

---

## What to remove entirely

- The "SSRF Attack Console — Internal API" title
- The "Simulated private microservice · port 3020 · not reachable from the
  browser directly" subtitle (the demo callout `<details>` replaces this)
- The "AVAILABLE INTERNAL ENDPOINTS TO PROBE" section with copy buttons
- The "HOW TO USE" numbered instructions
- All neon green / terminal color scheme
- The dark hacker aesthetic overall

---

## What must not change

- All `/internal/*` routes and their JSON responses — untouched
- Port number (3020)
- `package.json` scripts
- `victim-server.js` and `victim-server-protected.js` — not in scope
