// Builds facebook-feed.csv (Meta catalog data feed) from inventory.json.
// Runs on every Netlify deploy (see netlify.toml), so the feed always matches the website.
const fs = require('fs');
const path = require('path');

const SITE = 'https://www.lakeandlandrec.com';
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'inventory.json'), 'utf8'));
const units = (data && data.units) || (Array.isArray(data) ? data : []);

const abs = (p) => !p ? '' : /^https?:\/\//.test(p) ? p : SITE + '/' + String(p).replace(/^\/+/, '');
const photoList = (u) => {
  const list = (u.photos || []).map((p) => typeof p === 'string' ? p : (p && (p.photo || p.src || p.url)) || '').filter(Boolean);
  if (list.length) return list.map(abs);
  const slug = String(u.slug || u.id || u.stock || '').toLowerCase();
  return slug ? [abs('photos/' + slug + '-1.jpg')] : [];
};
const priceOf = (u) => { const n = parseFloat(String(u.price || '').replace(/[^0-9.]/g, '')); return n > 0 ? n.toFixed(2) + ' USD' : ''; };
const availability = (s) => s === 'In Stock' ? 'in stock' : s === 'In Transit' ? 'preorder' : s === 'Sale Pending' ? 'available for order' : 'out of stock';
const brandOf = (u) => u.category === 'pontoon' ? (/lounger/i.test(u.fullName || u.model || '') ? 'Lake Lounger' : 'Flagship') : 'Trophy Trailers';
const typeOf = (u) => u.category === 'pontoon' ? 'Boats > Pontoon Boats' : u.category === 'pontoon-trailer' ? 'Trailers > Pontoon Trailers' : 'Trailers > Utility Trailers';
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const csv = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

const head = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type', 'item_group_id'];
const rows = [head];
let skipped = 0;
for (const u of units) {
  if (u.active === false || u.status === 'Sold') continue;
  const imgs = photoList(u); const now = priceOf(u); const was = priceOf({ price: u.wasPrice });
  const price = was && parseFloat(was) > parseFloat(now) ? was : now; const sale = price === now ? '' : now;
  const id = String(u.stock || u.id || '').trim();
  if (!id || !imgs.length || !price) { skipped++; continue; } // Meta needs an id, a photo and a price
  const title = clean(u.fullName || u.seoTitle || [u.year, brandOf(u), u.model].filter(Boolean).join(' ')).slice(0, 150);
  const desc = clean(u.desc || u.seoDesc || title + '. In Owen, WI. Call or text 715-797-4782.').slice(0, 5000);
  rows.push([id, title, desc, availability(u.status || 'In Stock'), u.condition === 'Used' ? 'used' : 'new', price, sale,
    SITE + '/#unit-' + encodeURIComponent(u.id || id), imgs[0], imgs.slice(1, 10).join(','), brandOf(u), typeOf(u), u.category || 'trailer']);
}
fs.writeFileSync(path.join(root, 'facebook-feed.csv'), rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
console.log(`facebook-feed.csv: ${rows.length - 1} units listed, ${skipped} skipped (need stock #, photo and price).`);
