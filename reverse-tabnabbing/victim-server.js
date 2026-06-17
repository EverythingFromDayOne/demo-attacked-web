/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/reverse-tabnabbing && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/reverse-tabnabbing && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3016  ← TechBlog (logged in as Alex Reader)
 * 2. Click external article → new tab opens attacker article at :3017
 * 3. Switch back to original tab → phishing clone at :3017/phish
 * 4. Submit credentials → check :3017/dashboard
 */

const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3016;
const ATTACKER_PORT = 3017;

const SESSION_VALUE = 'AlexReader_t0k3n_BLOG456';

const ARTICLES = {
  '1': {
    title: 'The Hidden Cost of Technical Debt',
    meta: '12 min read · Engineering',
    body: [
      'Technical debt is the implied cost of future rework caused by choosing an easy solution now instead of a better approach that would take longer. Every shortcut compounds.',
      'Teams that defer refactoring often find that feature velocity drops sharply after eighteen months. The codebase becomes a maze of workarounds, and onboarding new engineers takes weeks instead of days.',
      'The fix is not zero debt — shipping matters — but deliberate tracking. Treat debt like financial debt: know the balance, pay interest regularly, and avoid silent accumulation.',
    ],
  },
  '3': {
    title: 'Building Resilient Microservices',
    meta: '15 min read · Architecture',
    body: [
      'Microservices promise independent deployability, but resilience does not come for free. Without circuit breakers, retries with backoff, and clear timeout budgets, a single slow dependency can cascade into a full outage.',
      'Start with observability: distributed tracing and structured logs let you see failure paths before users report them. Design for partial failure — degrade gracefully instead of returning 500 for every edge case.',
      'The best microservice architectures look boring in production because failure modes were rehearsed in staging.',
    ],
  },
  '4': {
    title: 'CSS Container Queries in Production',
    meta: '6 min read · Frontend',
    body: [
      'Container queries let components respond to their parent\'s size instead of the viewport. That means a card grid and a sidebar widget can share the same component without media-query hacks.',
      'Browser support is now broad enough for production use. Pair `@container` rules with sensible fallbacks for older engines, and prefer container-relative units for padding and typography.',
      'The shift from page-level responsive design to component-level layout is one of the biggest practical wins in modern CSS.',
    ],
  },
};

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.use(function (req, res, next) {
  if (req.cookies.blog_session !== SESSION_VALUE) {
    res.cookie('blog_session', SESSION_VALUE, { httpOnly: false, path: '/' });
  }
  next();
});

function sharedStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      color: #1e293b;
      line-height: 1.6;
      min-height: 100vh;
    }
    .demo-banner {
      padding: 0.6rem 1.5rem;
      font-size: 0.85rem;
      text-align: center;
      font-weight: 500;
    }
    .demo-banner.vulnerable {
      background: #ffedd5;
      border-bottom: 2px solid #ea580c;
      color: #9a3412;
    }
    header {
      border-bottom: 1px solid #e2e8f0;
      padding: 0 2rem;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1100px;
      margin: 0 auto;
    }
    .logo {
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f172a;
      text-decoration: none;
    }
    nav { display: flex; gap: 1.75rem; }
    nav a {
      color: #64748b;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
    }
    nav a:hover { color: #0d9488; }
    .user-badge {
      background: #f0fdfa;
      color: #0f766e;
      border: 1px solid #99f6e4;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2.5rem 2rem 4rem;
    }
    .page-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.35rem;
      color: #0f172a;
    }
    .page-subtitle {
      color: #64748b;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }
    .article-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }
    @media (max-width: 768px) {
      .article-grid { grid-template-columns: 1fr; }
    }
    .article-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .article-card:hover {
      border-color: #99f6e4;
      box-shadow: 0 8px 24px rgba(13, 148, 136, 0.08);
    }
    .article-card h2 {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      line-height: 1.35;
    }
    .article-card h2 a {
      color: #0f172a;
      text-decoration: none;
    }
    .article-card h2 a:hover { color: #0d9488; }
    .article-meta {
      font-size: 0.8rem;
      color: #94a3b8;
      margin-bottom: 1rem;
    }
    .read-link {
      display: inline-block;
      color: #0d9488;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }
    .read-link:hover { text-decoration: underline; }
    .external-badge {
      display: inline-block;
      background: #f1f5f9;
      color: #64748b;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      margin-left: 0.35rem;
      vertical-align: middle;
    }
    .article-page h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #0f172a;
      line-height: 1.25;
    }
    .article-page .meta {
      color: #94a3b8;
      font-size: 0.9rem;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .article-page p {
      margin-bottom: 1.25rem;
      color: #334155;
      font-size: 1.05rem;
      line-height: 1.75;
    }
    .back-link {
      display: inline-block;
      color: #0d9488;
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 2rem;
      font-size: 0.9rem;
    }
    .back-link:hover { text-decoration: underline; }
    .newsletter-token-box {
      background: #f0fdfa;
      border: 2px solid #0d9488;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 2rem;
    }
    .newsletter-token-box h3 {
      font-size: 1rem;
      color: #0f766e;
      margin-bottom: 0.5rem;
    }
    .newsletter-token-box .token {
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      color: #0f172a;
      font-weight: 700;
      word-break: break-all;
    }
    .newsletter-token-box .hint {
      font-size: 0.85rem;
      color: #64748b;
      margin-top: 0.5rem;
    }
    .demo-banner.noopener-only {
      background: #ffedd5;
      border-bottom: 2px solid #ea580c;
      color: #9a3412;
    }
    .referer-warning {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-top: 2rem;
      font-size: 0.9rem;
      color: #991b1b;
      line-height: 1.7;
    }
    .referer-warning code {
      display: block;
      background: #fff;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin: 0.75rem 0;
      font-size: 0.8rem;
      word-break: break-all;
      color: #7f1d1d;
    }
    .referer-safe {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-top: 2rem;
      font-size: 0.9rem;
      color: #166534;
      line-height: 1.7;
    }
    .referer-safe code {
      display: block;
      background: #fff;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin: 0.75rem 0;
      font-size: 0.85rem;
      color: #14532d;
    }
  `;
}

function buildHeader() {
  return (
    '<header>' +
      '<a class="logo" href="/">TechBlog 📰</a>' +
      '<nav>' +
        '<a href="/">Home</a>' +
        '<a href="#">Topics</a>' +
        '<a href="#">Newsletter</a>' +
      '</nav>' +
      '<div class="user-badge">👤 Alex Reader</div>' +
    '</header>'
  );
}

function buildHomeHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechBlog — Tech News &amp; Insights</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <div class="demo-banner vulnerable">⚠️ VULNERABLE: External links use rel="opener" — window.opener accessible from new tab</div>
  ${buildHeader()}
  <main>
    <h1 class="page-title">Latest Articles</h1>
    <p class="page-subtitle">Curated reads for engineers, designers, and tech leaders.</p>

    <div class="article-grid">
      <article class="article-card">
        <h2><a href="/articles/1">The Hidden Cost of Technical Debt</a></h2>
        <div class="article-meta">12 min read · Engineering</div>
        <a class="read-link" href="/articles/1">Read Article →</a>
      </article>

      <article class="article-card">
        <h2>
          <a href="http://localhost:${ATTACKER_PORT}" target="_blank" rel="opener nofollow">
            How AI Is Reshaping Frontend Development
          </a>
          <span class="external-badge">↗ External</span>
        </h2>
        <div class="article-meta">8 min read · AI &amp; Tools</div>
        <!--
          ⚠️ VULNERABILITY: rel="opener" explicitly grants window.opener access.
          Without this, Chrome 88+ implicitly adds noopener and blocks the attack.
          In real codebases this appears in old code, third-party widgets, or
          libraries that predate the Chrome 88 default change (January 2021).
        -->
        <a href="http://localhost:${ATTACKER_PORT}" target="_blank" rel="opener nofollow" class="read-link">
          Read Full Article →
        </a>
      </article>

      <article class="article-card">
        <h2><a href="/articles/3">Building Resilient Microservices</a></h2>
        <div class="article-meta">15 min read · Architecture</div>
        <a class="read-link" href="/articles/3">Read Article →</a>
      </article>

      <article class="article-card">
        <h2><a href="/articles/4">CSS Container Queries in Production</a></h2>
        <div class="article-meta">6 min read · Frontend</div>
        <a class="read-link" href="/articles/4">Read Article →</a>
      </article>
    </div>
  </main>
</body>
</html>`;
}

function buildArticleHtml(id) {
  const article = ARTICLES[id];
  if (!article) return null;

  const paragraphs = article.body.map(function (p) {
    return '<p>' + p + '</p>';
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} — TechBlog</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <div class="demo-banner vulnerable">⚠️ VULNERABLE: External links use rel="opener" — window.opener accessible from new tab</div>
  ${buildHeader()}
  <main class="article-page">
    <a class="back-link" href="/">← Back to Home</a>
    <h1>${article.title}</h1>
    <div class="meta">${article.meta}</div>
    ${paragraphs}
  </main>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildHomeHtml());
});

app.get('/articles/:id', function (req, res) {
  const html = buildArticleHtml(req.params.id);
  if (!html) return res.status(404).send('Article not found');
  res.send(html);
});

function buildNewsletterHtml(req) {
  const subscriberId = req.query.subscriber_id || 'ALEX_READER_TOKEN_f3a9c2b1';
  const utmCampaign = req.query.utm_campaign || 'q2_digest';
  const utmSource = req.query.utm_source || 'email';
  const refererUrl =
    'http://localhost:' + PORT + '/newsletter' +
    '?subscriber_id=' + encodeURIComponent(subscriberId) +
    '&utm_campaign=' + encodeURIComponent(utmCampaign) +
    '&utm_source=' + encodeURIComponent(utmSource);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter — TechBlog</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <div class="demo-banner noopener-only">⚠️ NOOPENER ONLY: Tabnabbing blocked — but Referer header will carry this full URL (including your subscriber_id) to any external site you click.</div>
  ${buildHeader()}
  <main>
    <div class="newsletter-token-box">
      <h3>📧 Newsletter Link Detected</h3>
      <div>Your subscriber token: <span class="token">${subscriberId}</span></div>
      <p class="hint">(This token identifies you uniquely in our database)</p>
    </div>

    <h1 class="page-title">Recommended Reading</h1>
    <p class="page-subtitle">From this week's TechBlog digest — curated for you.</p>

    <article class="article-card" style="max-width: 520px;">
      <h2>
        <a href="http://localhost:${ATTACKER_PORT}/article" target="_blank" rel="noopener nofollow">
          How AI Is Reshaping Frontend Development
        </a>
        <span class="external-badge">↗ External</span>
      </h2>
      <div class="article-meta">8 min read · AI &amp; Tools</div>
      <!--
        ✅ noopener: window.opener is null — tabnabbing blocked
        ⚠️ noreferrer NOT set: browser will send the full Referer header,
           including the subscriber_id token in the URL, to the external site
      -->
      <a href="http://localhost:${ATTACKER_PORT}/article" target="_blank" rel="noopener nofollow" class="read-link">
        Read Full Article →
      </a>
    </article>

    <div class="referer-warning">
      <strong>⚠️ What the external site will receive when you click:</strong>
      <code>Referer: ${refererUrl}</code>
      Your subscriber token is now in the external server's access logs.
    </div>
  </main>
</body>
</html>`;
}

app.get('/newsletter', function (req, res) {
  // ⚠️ VULNERABILITY: Referrer-Policy: unsafe-url forces the browser to send the
  //    full URL — path + query params — as the Referer header on ALL navigations,
  //    including cross-origin ones.
  //
  //    Chrome 85+ default (strict-origin-when-cross-origin) would only send the
  //    bare origin (http://localhost:3016/) for cross-origin requests, stripping
  //    the subscriber_id. unsafe-url re-exposes it — exactly what analytics
  //    libraries, legacy CMSs, or misconfigured apps often do accidentally.
  res.setHeader('Referrer-Policy', 'unsafe-url');
  res.send(buildNewsletterHtml(req));
});

app.listen(PORT, function () {
  console.log('TechBlog (VULNERABLE) running at http://localhost:' + PORT);
});
