# Cursor Prompt: Add Referer Leakage Demo to Reverse Tabnabbing

## Context

Extension of the existing reverse-tabnabbing demo at
`demo-attacked/reverse-tabnabbing/` (ports 3016–3018).

The existing demo proves that `rel="noopener"` blocks the tabnabbing attack
(`window.opener` is null). This extension adds a second, completely separate
demo that proves `rel="noopener"` alone does NOT stop Referer header leakage —
you also need `rel="noreferrer"`.

Do NOT modify any existing routes or logic. Add new routes only.

---

## What to add

### 1. `victim-server.js` (port 3016) — add `GET /newsletter`

Serve a modified TechBlog page that simulates arriving via a newsletter email
link. The URL itself contains the sensitive data:

```
http://localhost:3016/newsletter?subscriber_id=ALEX_READER_TOKEN_f3a9c2b1&utm_campaign=q2_digest&utm_source=email
```

The page should make `subscriber_id` visually prominent — render it at the top
inside a highlighted box labeled:

```
📧 Newsletter Link Detected
Your subscriber token: ALEX_READER_TOKEN_f3a9c2b1
(This token identifies you uniquely in our database)
```

**Demo banner (orange):**
```
⚠️ NOOPENER ONLY: Tabnabbing blocked — but Referer header will carry this full URL
(including your subscriber_id) to any external site you click.
```

**Page content:** Same TechBlog layout. One article card, labeled:

> **"How AI Is Reshaping Frontend Development ↗ External"**
> 8 min read · AI & Tools
>
> [Read Full Article →]

The link points to `http://localhost:3017/article` and uses:

```html
<!-- ✅ noopener: window.opener is null — tabnabbing blocked
     ⚠️ noreferrer NOT set: browser will send the full Referer header,
        including the subscriber_id token in the URL, to the external site -->
<a href="http://localhost:3017/article" target="_blank" rel="noopener nofollow">
  Read Full Article →
</a>
```

Below the article card, add a clear warning panel:

```
⚠️ What the external site will receive when you click:
Referer: http://localhost:3016/newsletter?subscriber_id=ALEX_READER_TOKEN_f3a9c2b1&utm_campaign=q2_digest&utm_source=email

Your subscriber token is now in the external server's access logs.
```

---

### 2. `victim-server-protected.js` (port 3018) — add `GET /newsletter`

Identical page and layout. Changes:

**Demo banner (green):**
```
✅ NOOPENER + NOREFERRER: Tabnabbing blocked AND Referer header suppressed —
external site receives no information about where you came from.
```

The link uses:

```html
<!-- ✅ noopener: window.opener is null — tabnabbing blocked
     ✅ noreferrer: Referer header suppressed — subscriber_id token never leaves this tab -->
<a href="http://localhost:3017/article" target="_blank" rel="noopener noreferrer nofollow">
  Read Full Article →
</a>
```

The warning panel below the article card becomes:

```
✅ What the external site will receive when you click:
Referer: (none — header suppressed by rel="noreferrer")

Your subscriber token never leaves this tab.
```

---

### 3. `attacker-server.js` (port 3017) — add `GET /article`

This is the most important addition. The fake external article page must
prominently display the `Referer` header it received from the browser.

Read the Referer from the incoming request:
```js
app.get('/article', (req, res) => {
  const referer = req.headers['referer'] || req.headers['referrer'] || null;
  // render the page with referer value visible
});
```

**Page layout:**

Top section — Referer display box (most prominent element, render before article content):

**If `referer` is present:**

```
┌─────────────────────────────────────────────────────────┐
│  🚨 REFERER HEADER RECEIVED                             │
│                                                         │
│  Your browser told us you came from:                    │
│                                                         │
│  http://localhost:3016/newsletter                       │
│    ?subscriber_id=ALEX_READER_TOKEN_f3a9c2b1           │
│    &utm_campaign=q2_digest                              │
│    &utm_source=email                                    │
│                                                         │
│  Extracted token: ALEX_READER_TOKEN_f3a9c2b1           │
│                                                         │
│  This token is now in our access log. We can use it    │
│  to identify you, unsubscribe you from TechBlog, or    │
│  combine it with other tracking data.                  │
└─────────────────────────────────────────────────────────┘
```

Style: dark red background (`#450a0a`), red border (`#dc2626`), white text.

Parse the Referer URL and extract query parameters individually — show them
in a small table:

| Parameter | Value |
|-----------|-------|
| subscriber_id | ALEX_READER_TOKEN_f3a9c2b1 |
| utm_campaign | q2_digest |
| utm_source | email |

**If `referer` is null or empty:**

```
┌─────────────────────────────────────────────────────────┐
│  ✅ NO REFERER RECEIVED                                 │
│                                                         │
│  Your browser sent no Referer header.                  │
│  rel="noreferrer" suppressed it.                       │
│  We have no information about where you came from.     │
└─────────────────────────────────────────────────────────┘
```

Style: dark green background (`#052e16`), green border (`#16a34a`), white text.

**Below the Referer box:** render a normal-looking fake article about AI
(a few paragraphs of real content) so the page looks like a legitimate
external article, not just a test page.

**Add to the attacker dashboard (`GET /dashboard`):**

New section below the existing stolen credentials table:

```
## Referer Leak Demo

Open localhost:3016/newsletter (vulnerable — noopener only) or
localhost:3018/newsletter (protected — noopener + noreferrer)
then click the article link.

The /article page will show whether the subscriber_id token was received.
```

With quick-open buttons:
- "Open Vulnerable TechBlog Newsletter" → opens `http://localhost:3016/newsletter?subscriber_id=ALEX_READER_TOKEN_f3a9c2b1&utm_campaign=q2_digest&utm_source=email` in new tab
- "Open Protected TechBlog Newsletter" → opens `http://localhost:3018/newsletter?subscriber_id=ALEX_READER_TOKEN_f3a9c2b1&utm_campaign=q2_digest&utm_source=email` in new tab
- "Open Article Page" → opens `http://localhost:3017/article` in new tab

---

## Demo walkthrough (for README update)

Add this section to `README.md` under a new heading `## Referer Leakage Demo`:

### Setup

Same servers as the main demo (all three must be running).

### Vulnerable path (noopener only — Referer leaks)

1. Open `http://localhost:3017/dashboard` and click **"Open Vulnerable TechBlog Newsletter"**.
2. Notice the URL: `localhost:3016/newsletter?subscriber_id=ALEX_READER_TOKEN_f3a9c2b1&...`
3. The page highlights your subscriber token — it's in the URL, as it would be in a real newsletter link.
4. Click **"Read Full Article →"** — a new tab opens at `localhost:3017/article`.
5. The article page immediately shows a red box: **"Referer header received"** with your full URL and extracted `subscriber_id` token.
6. The tabnabbing attack did NOT fire (window.opener is null) — but the token leaked anyway via the Referer header.

### Protected path (noopener + noreferrer — both blocked)

1. Click **"Open Protected TechBlog Newsletter"** from the dashboard.
2. Same URL, same token in the address bar.
3. Click **"Read Full Article →"**.
4. The article page shows a green box: **"No Referer received"** — the token never left your browser.

### Key insight

```
rel="noopener"            → window.opener = null  ✅  (tabnabbing blocked)
                          → Referer header sent   ⚠️  (token leaked to external site)

rel="noopener noreferrer" → window.opener = null  ✅  (tabnabbing blocked)
                          → Referer header absent ✅  (token never sent)
```

`noopener` and `noreferrer` block two different channels of information flow:
- `noopener`: blocks the new tab from reaching BACK into your tab
- `noreferrer`: blocks your tab from sending data FORWARD to the new tab

---

## What NOT to change

- All existing routes (`/`, `/phish`, `/api/steal`, `/api/stolen`, `/dashboard`,
  `/articles/:id`) must remain exactly as-is.
- Existing styling, port numbers, package.json, .gitignore — unchanged.
- The victim switcher on the dashboard — unchanged.
