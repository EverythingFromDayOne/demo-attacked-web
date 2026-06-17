/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/xss/reflected && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/xss/reflected && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3004        ← ShopNest storefront (normal use)
 * 2. http://localhost:3005        ← Attacker dashboard — generate phishing email here
 * 3. Click the CTA link in the generated email → lands on /search?q=<payload>
 * 4. Watch the cookie appear on the attacker dashboard
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3004;

const PRODUCTS = [
  { id: 1, name: 'Sony WH-1000XM5 Wireless Headphones', price: 349.99, category: 'Electronics', rating: 4.8, imageEmoji: '🎧' },
  { id: 2, name: 'Patagonia Better Sweater Fleece Jacket', price: 139.0, category: 'Clothing', rating: 4.7, imageEmoji: '🧥' },
  { id: 3, name: 'KitchenAid Artisan Stand Mixer', price: 449.99, category: 'Home', rating: 4.9, imageEmoji: '🍰' },
  { id: 4, name: 'Apple AirPods Pro (2nd Gen)', price: 249.0, category: 'Electronics', rating: 4.6, imageEmoji: '🎵' },
  { id: 5, name: 'Levi\'s 501 Original Fit Jeans', price: 69.5, category: 'Clothing', rating: 4.5, imageEmoji: '👖' },
  { id: 6, name: 'Dyson V15 Detect Cordless Vacuum', price: 749.99, category: 'Home', rating: 4.7, imageEmoji: '🧹' },
];

app.use(express.static(path.join(__dirname)));

// ⚠️ VULNERABILITY: HttpOnly omitted — JS can read this cookie
// ✅ PROTECTED: Set HttpOnly=true so JavaScript cannot access shopper_session
app.use((req, res, next) => {
  if (!req.headers.cookie || !req.headers.cookie.includes('shopper_session=')) {
    res.setHeader(
      'Set-Cookie',
      'shopper_session=ShopperJane_t0k3n_ABC456; Path=/'
    );
  }
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'victim.html'));
});

app.get('/api/products', (req, res) => {
  res.json(PRODUCTS);
});

function buildProductCards() {
  const displayProducts = PRODUCTS.slice(0, 5);
  return displayProducts
    .map(
      (p) => `
      <div class="product-card">
        <div class="product-emoji">${p.imageEmoji}</div>
        <div class="product-info">
          <span class="product-category">${p.category}</span>
          <h3 class="product-name">${p.name}</h3>
          <div class="product-rating">${'★'.repeat(Math.floor(p.rating))}${'☆'.repeat(5 - Math.floor(p.rating))} <span>${p.rating}</span></div>
          <div class="product-price">$${p.price.toFixed(2)}</div>
          <button class="btn-cart" type="button">Add to Cart</button>
        </div>
      </div>`
    )
    .join('');
}

app.get('/search', (req, res) => {
  const q = req.query.q || '';

  // ⚠️ VULNERABILITY: Server-Side Reflection — payload embedded in HTML before browser
  // receives the response. The browser parses this as legitimate HTML, not injected content.
  // ✅ PROTECTED: HTML-encode req.query.q before interpolation.
  //         '<' becomes '&lt;', '>' becomes '&gt;', '"' becomes '&quot;'
  //         A one-liner: q.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

  const productCards = buildProductCards();
  const resultCount = 5;

  // ⚠️ VULNERABILITY: raw req.query.q interpolated into HTML (title + h2 below)
  // ✅ PROTECTED: use a sanitize function to HTML-encode the value before interpolation

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- ⚠️ VULNERABILITY: raw req.query.q interpolated into HTML -->
  <!-- ✅ PROTECTED: use a sanitize function to HTML-encode the value before interpolation -->
  <title>ShopNest — Search: ${q}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafa;
      color: #1a2e2e;
      line-height: 1.5;
    }
    .demo-banner {
      background: #fef3c7;
      border-bottom: 2px solid #f59e0b;
      color: #92400e;
      padding: 0.6rem 1.5rem;
      font-size: 0.85rem;
      text-align: center;
    }
    .demo-banner strong { font-weight: 700; }
    header {
      background: #0d6e6e;
      color: #fff;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
    }
    .logo { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.5px; }
    nav a {
      color: rgba(255,255,255,0.85);
      text-decoration: none;
      margin: 0 1rem;
      font-size: 0.9rem;
      font-weight: 500;
    }
    nav a:hover { color: #fff; }
    .header-right { display: flex; align-items: center; gap: 1.25rem; font-size: 1.25rem; }
    .search-hero {
      background: linear-gradient(135deg, #0d6e6e 0%, #0a5555 100%);
      padding: 2rem;
      text-align: center;
    }
    .search-form {
      display: flex;
      max-width: 560px;
      margin: 0 auto;
      gap: 0.5rem;
    }
    .search-form input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
    }
    .search-form button {
      background: #f59e0b;
      color: #1a2e2e;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      cursor: pointer;
    }
    main { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }
    .results-header { margin-bottom: 1.5rem; }
    .results-header h2 { font-size: 1.5rem; color: #0d6e6e; margin-bottom: 0.35rem; }
    .results-count { color: #64748b; font-size: 0.9rem; }
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.25rem;
    }
    .product-card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .product-card:hover { box-shadow: 0 8px 24px rgba(13, 110, 110, 0.12); }
    .product-emoji {
      background: #f0fafa;
      font-size: 3rem;
      text-align: center;
      padding: 1.5rem;
    }
    .product-info { padding: 1rem; }
    .product-category { font-size: 0.75rem; color: #0d6e6e; text-transform: uppercase; letter-spacing: 0.5px; }
    .product-name { font-size: 0.95rem; margin: 0.35rem 0; font-weight: 600; }
    .product-rating { font-size: 0.8rem; color: #f59e0b; margin-bottom: 0.5rem; }
    .product-rating span { color: #64748b; margin-left: 0.25rem; }
    .product-price { font-size: 1.1rem; font-weight: 700; color: #0d6e6e; margin-bottom: 0.75rem; }
    .btn-cart {
      width: 100%;
      background: #0d6e6e;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-cart:hover { background: #0a5555; }
  </style>
</head>
<body>
  <div class="demo-banner">
    ⚠️ Demo: Your session cookie is: <strong id="cookie-display"></strong>
  </div>
  <header>
    <div class="logo">ShopNest 🛒</div>
    <nav>
      <a href="/">Categories</a>
      <a href="/">Deals</a>
      <a href="/">New Arrivals</a>
      <a href="/">Help</a>
    </nav>
    <div class="header-right">
      <span title="Cart">🛍️</span>
      <span title="Account">👤</span>
    </div>
  </header>
  <div class="search-hero">
    <form class="search-form" action="/search" method="GET">
      <input type="text" name="q" placeholder="Search products..." value="${q.replace(/"/g, '&quot;')}">
      <button type="submit">Search</button>
    </form>
  </div>
  <main>
    <div class="results-header">
      <h2>Search results for: ${q}</h2>
      <p class="results-count">Showing ${resultCount} results</p>
    </div>
    <div class="product-grid">
      ${productCards}
    </div>
  </main>
  <script>
    document.getElementById('cookie-display').textContent = document.cookie || '(none)';
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`ShopNest victim server running on http://localhost:${PORT}`);
  console.log(`Vulnerable route: http://localhost:${PORT}/search?q=<YOUR_PAYLOAD>`);
});
