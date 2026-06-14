# XSS Attack Demonstration Lab

Cross-Site Scripting (XSS) is a class of injection attack where untrusted data is interpreted as executable code by a victim's browser. Unlike SQL injection, which targets the database, XSS targets the document context — the HTML, JavaScript, and cookie environment the browser assembles when it renders a page.

This lab covers three distinct variants that differ in **persistence**, **delivery vector**, and **attack surface**:

| Variant | Persistence | Delivery | Root cause |
|---------|-------------|----------|------------|
| [Stored XSS](stored/README.md) | Payload saved to DB | Automatic on every page load | `innerHTML` with unsanitized DB content |
| [Reflected XSS](reflected/README.md) | None — URL only | Phishing link | Unencoded query param in SSR HTML |
| [SVG Upload XSS](svg-upload/README.md) | File on disk | User opens raw file URL | File-serving policy, not frontend code |

The SVG Upload demo intentionally uses clean frontend code — no `innerHTML`, no reflected parameters — to show that XSS is not always a frontend developer mistake.

---

## Port Reference

| Port | Attack | Role |
|------|--------|------|
| 3001 | Stored XSS | Vulnerable victim (NovaCRM) |
| 3002 | Stored XSS | Attacker collector |
| 3009 | Stored XSS | Protected victim |
| 3003 | Reflected XSS | Vulnerable victim (ShopNest) |
| 3004 | Reflected XSS | Attacker collector |
| 3008 | Reflected XSS | Protected victim |
| 3005 | SVG Upload XSS | Vulnerable victim (ConnectHub) |
| 3006 | SVG Upload XSS | Attacker collector |
| 3007 | SVG Upload XSS | Protected victim |

All 9 servers can run simultaneously — all ports are unique.

---

## Run All Demos Simultaneously

```bash
# Stored XSS
cd xss/stored   && npm install && npm run victim          # :3001
cd xss/stored   && npm run attacker                       # :3002
cd xss/stored   && npm run victim-protected               # :3009

# Reflected XSS
cd xss/reflected && npm install && npm run victim         # :3003
cd xss/reflected && npm run attacker                      # :3004
cd xss/reflected && npm run victim-protected              # :3008

# SVG Upload XSS
cd xss/svg-upload && npm install && npm run victim        # :3005
cd xss/svg-upload && npm run attacker                     # :3006
cd xss/svg-upload && npm run victim-protected             # :3007
```

---

## Defense Summary

| Attack | Vulnerable line | Fix | Residual risk |
|--------|----------------|-----|---------------|
| Stored — innerHTML | `victim.html:279` | `textContent` | None if applied consistently |
| Stored — cookie | `victim-server.js:55` | `httpOnly: true` | Script still runs, just can't read cookie |
| Stored — input | `victim-server.js:67` | `sanitizeText()` | Encoding at render still required |
| Reflected — SSR | `victim-server.js:92,224` | `htmlEncode(q)` | Only correct for HTML context |
| Reflected — cookie | `victim-server.js:31` | `httpOnly: true` | Same as above |
| SVG — upload filter | `victim-server.js:78` | `rasterOnlyFilter` | Bypassable via renamed file |
| SVG — magic bytes | (missing) | `matchesMagicBytes()` | Bypassable via polyglot |
| SVG — polyglot | (missing) | Sharp re-encoding | Requires Sharp installed |
| SVG — serving | `victim-server.js:142` | `Content-Disposition: attachment` + CSP | Best server-side defense |
| SVG — architecture | N/A | Separate cookieless CDN domain | Eliminates cookie theft entirely |
