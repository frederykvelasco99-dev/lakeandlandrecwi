// Builds one real page per trailer at /inventory/<stock>/ from inventory.json,
// plus sitemap.xml and robots.txt. Runs on every Netlify deploy (see netlify.toml),
// so the trailer pages always match the CRM export.
const fs = require('fs');
const path = require('path');

const SITE = 'https://www.lakeandlandrec.com';
const PHONE = '715-797-4782';
const TEL = 'tel:7157974782';
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'inventory.json'), 'utf8'));
const all = ((data && data.units) || []).filter((u) => u.active !== false && u.status !== 'Sold');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => SITE + '/' + String(p || '').replace(/^\/+/, '');
const slugOf = (u) => String(u.slug || u.id).toLowerCase();
const urlOf = (u) => '/inventory/' + slugOf(u) + '/';
const num = (s) => parseFloat(String(s || '').replace(/[^0-9.]/g, '')) || 0;
const kind = (u) => (u.category === 'pontoon-trailer' ? 'pontoon trailer' : u.category === 'pontoon' ? 'pontoon' : 'trailer');

function blocks(desc) {
  // first paragraph is the intro; checkmark lines become bullets; drop lines the page already shows elsewhere
  const paras = String(desc || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const intro = paras.shift() || '';
  const bullets = []; const extra = [];
  for (const p of paras) {
    const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => /^[\u2714\u2713\u2022-]/.test(l))) lines.forEach((l) => bullets.push(l.replace(/^[\u2714\u2713\u2022-]\s*/, '')));
    else if (/price|precio|call or text|837 W|hablamos/i.test(p)) continue;
    else extra.push(p);
  }
  return { intro, bullets, extra };
}

function similar(u) {
  const others = all.filter((x) => x.id !== u.id);
  const area = (x) => { const [w, l] = String(x.size || '0x0').split('x').map(Number); return (w || 0) * (l || 0); };
  return others.sort((a, b) => Math.abs(area(a) - area(u)) - Math.abs(area(b) - area(u)) || num(a.price) - num(b.price)).slice(0, 4);
}

const CSS = `
:root{--bg:#F3F3F0;--panel:#22381C;--panel-2:#2F4A26;--rust:#E8930C;--rust-dark:#B46F09;--ink:#1A1E17;--muted:#5F635A;--card:#fff;--line:#DBDBD3}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;padding-bottom:76px}
a{color:inherit}
h1,h2,.ost{font-family:Oswald,"Arial Narrow",Arial,sans-serif;text-transform:uppercase;letter-spacing:.01em;margin:0;line-height:1.1}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
.top{background:#fff;border-bottom:3px solid var(--rust);position:sticky;top:0;z-index:20}
.top .wrap{display:flex;align-items:center;gap:12px;height:60px}
.top img{height:40px;width:auto}
.top .back{font-size:14px;font-weight:600;text-decoration:none;color:var(--panel);margin-right:auto}
.top .call{background:var(--rust);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:9px 14px;border-radius:4px;white-space:nowrap}
.grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px;padding:22px 0}
@media(max-width:860px){.grid{grid-template-columns:minmax(0,1fr);gap:16px;padding:12px 0}}
.gal{position:relative;background:#111;border-radius:8px;overflow:hidden}
.track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;aspect-ratio:4/3}
.track::-webkit-scrollbar{display:none}
.track img{flex:0 0 100%;width:100%;height:100%;object-fit:cover;scroll-snap-align:center}
.count{position:absolute;right:10px;bottom:10px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:600;padding:3px 9px;border-radius:20px}
.arrow{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.9);font-size:24px;line-height:1;cursor:pointer;color:var(--ink)}
.arrow.p{left:10px}.arrow.n{right:10px}
.thumbs{display:flex;gap:8px;overflow-x:auto;padding:8px 0;scrollbar-width:none}
.thumbs button{flex:0 0 72px;height:54px;border:2px solid transparent;border-radius:4px;padding:0;overflow:hidden;cursor:pointer;background:#ddd}
.thumbs button.on{border-color:var(--rust)}
.thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.b{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:4px 9px;border-radius:3px;background:#E3EEDC;color:#24521A}
.b.hot{background:var(--rust);color:#fff}
h1{font-size:clamp(24px,5.4vw,34px)}
.price{margin:12px 0 2px;font-family:Oswald,Arial,sans-serif;font-size:34px;font-weight:600}
.price s{font-size:20px;color:var(--muted);font-weight:500;margin-right:8px}
.price small{font-family:Inter,sans-serif;font-size:14px;color:var(--muted);font-weight:500}
.save{display:inline-block;font-size:13px;font-weight:700;color:#8a4d00;background:#FDEBC8;padding:2px 8px;border-radius:3px}
.stock{font:500 13px ui-monospace,Menlo,monospace;color:var(--muted);margin-top:6px}
.intro{margin:14px 0 0;font-size:16px}
.ctas{display:grid;gap:10px;margin:18px 0 6px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-weight:700;border-radius:6px;padding:15px 16px;font-size:17px;text-align:center}
.btn.call{background:var(--rust);color:#fff;font-size:19px}
.btn.call span{display:block;font-size:13px;font-weight:500;opacity:.95}
.btn.alt{background:#fff;border:2px solid var(--panel);color:var(--panel)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.es{font-size:14px;color:var(--muted);margin:6px 0 0}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0}
.chip{background:#fff;border:1px solid var(--line);border-radius:20px;padding:6px 12px;font-size:13px;font-weight:600}
section.blk{background:#fff;border:1px solid var(--line);border-radius:8px;padding:18px;margin:0 0 16px}
section.blk h2{font-size:20px;margin-bottom:10px}
ul.ck{list-style:none;padding:0;margin:0}
ul.ck li{padding:5px 0 5px 28px;position:relative}
ul.ck li:before{content:"\\2713";position:absolute;left:4px;color:var(--rust);font-weight:800}
table{width:100%;border-collapse:collapse;font-size:15px}
td{padding:9px 6px;border-bottom:1px solid var(--line);vertical-align:top}
td:first-child{color:var(--muted);width:42%}
td:last-child{font-weight:600}
.trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}
.trust div{background:var(--panel);color:#fff;border-radius:8px;padding:12px}
.trust b{display:block;font-family:Oswald,Arial,sans-serif;font-size:17px;text-transform:uppercase;color:#F0C98A}
.trust span{font-size:13px;opacity:.9}
@media(max-width:700px){.trust{grid-template-columns:1fr 1fr}}
.more{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media(max-width:860px){.more{grid-template-columns:1fr 1fr}}
.card{background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden;text-decoration:none;display:block}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.card div{padding:9px 10px}
.card b{display:block;font-size:14px;line-height:1.3}
.card span{font-size:14px;font-weight:700;color:var(--rust-dark)}
.visit{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;justify-content:space-between}
.visit p{margin:0}
details.tc{background:#fff;border:1px solid var(--line);border-radius:8px;margin:0 0 16px}
details.tc summary{cursor:pointer;padding:12px 16px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.04em;list-style:none;display:flex;justify-content:space-between}
details.tc summary::-webkit-details-marker{display:none}
details.tc summary:after{content:"+";color:var(--rust);font-size:18px;line-height:1}
details.tc[open] summary:after{content:"\\2212"}
details.tc p{padding:0 16px 14px;margin:0;font-size:13px;color:var(--muted)}
.foot{background:#0D1809;color:#A9B1A3;font-size:13px;padding:20px 0 26px;text-align:center}
.foot a{color:#CFCBBE}
.sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:1.6fr 1fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line);box-shadow:0 -4px 16px rgba(0,0,0,.08)}
.sticky a{display:flex;align-items:center;justify-content:center;text-decoration:none;font-weight:700;border-radius:6px;padding:13px 8px;font-size:16px}
.sticky .c{background:var(--rust);color:#fff}.sticky .t{border:2px solid var(--panel);color:var(--panel)}
@media(min-width:861px){.sticky{display:none}body{padding-bottom:0}}
`;

function page(u, i) {
  const { intro, bullets, extra } = blocks(u.desc);
  const photos = (u.photos || []);
  const thumbs = (u.thumbs || photos);
  const title = u.fullName || u.model;
  const was = num(u.wasPrice), now = num(u.price);
  const save = was > now ? '$' + (was - now).toLocaleString('en-US') : '';
  const sms = 'sms:7157974782?&body=' + encodeURIComponent(`Hi, is stock ${u.stock} (${u.model}) still available?`);
  const reserve = '/?reserve=' + encodeURIComponent(u.id);
  const seoTitle = `${title} | ${u.price} + tax | Owen, WI`;
  const seoDesc = (intro.replace(/\s+/g, ' ').replace(/\.$/, '') + `. ${u.price} + tax, in stock now. Call ${PHONE}.`).slice(0, 158);
  const img0 = photos[0] ? abs(photos[0]) : SITE + '/logo.png';
  const brand = u.category === 'pontoon' ? 'Lake & Land Rec' : 'Trophy Trailers';
  const ld = [{
    '@context': 'https://schema.org', '@type': 'Product', name: title, sku: u.stock, brand: { '@type': 'Brand', name: brand },
    category: kind(u) === 'trailer' ? 'Aluminum utility trailer' : 'Aluminum pontoon trailer', image: photos.slice(0, 6).map(abs),
    description: intro, itemCondition: 'https://schema.org/' + (u.condition === 'Used' ? 'UsedCondition' : 'NewCondition'),
    offers: { '@type': 'Offer', url: SITE + urlOf(u), priceCurrency: 'USD', price: String(now), availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/' + (u.condition === 'Used' ? 'UsedCondition' : 'NewCondition'),
      seller: { '@type': 'AutoDealer', name: 'Lake & Land Rec LLC', telephone: '+1-715-797-4782',
        address: { '@type': 'PostalAddress', streetAddress: '837 West 3rd Street', addressLocality: 'Owen', addressRegion: 'WI', postalCode: '54460', addressCountry: 'US' } } }
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Inventory', item: SITE + '/#inventory' },
      { '@type': 'ListItem', position: 3, name: title, item: SITE + urlOf(u) }]
  }];
  const badge = [u.condition === 'Used' ? 'Used' : 'New', 'In stock'];
  const hot = u.tag ? `<span class="b hot">${esc(u.tag)}</span>` : '';
  const others = similar(u);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(seoTitle)}</title>
<meta name="description" content="${esc(seoDesc)}">
<link rel="canonical" href="${SITE}${urlOf(u)}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(title)} · ${esc(u.price)} + tax">
<meta property="og:description" content="${esc(seoDesc)}">
<meta property="og:image" content="${img0}">
<meta property="og:url" content="${SITE}${urlOf(u)}">
<meta property="product:price:amount" content="${now}">
<meta property="product:price:currency" content="USD">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
${photos[0] ? `<link rel="preload" as="image" href="/${photos[0]}">` : ''}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a href="/"><img src="/logo.png" alt="Lake &amp; Land Rec" width="60" height="40"></a>
  <a class="back" href="/#inventory">&larr; All trailers</a>
  <a class="call" href="${TEL}">Call ${PHONE}</a>
</div></header>
<main class="wrap">
  <div class="grid">
    <div>
      <div class="gal">
        <div class="track" id="track">${photos.map((p, k) => `<img src="/${p}" alt="${esc(title)}, photo ${k + 1}" ${k ? 'loading="lazy"' : 'fetchpriority="high"'} width="1400" height="1050">`).join('')}</div>
        ${photos.length > 1 ? `<button class="arrow p" type="button" aria-label="Previous photo" data-go="-1">&lsaquo;</button><button class="arrow n" type="button" aria-label="Next photo" data-go="1">&rsaquo;</button>` : ''}
        <span class="count" id="count">1 / ${photos.length}</span>
      </div>
      <div class="thumbs" id="thumbs">${thumbs.map((p, k) => `<button type="button" data-i="${k}" class="${k ? '' : 'on'}" aria-label="Photo ${k + 1}"><img src="/${p}" alt="" loading="lazy"></button>`).join('')}</div>
    </div>
    <div>
      <div class="badges">${hot}${badge.map((b) => `<span class="b">${b}</span>`).join('')}</div>
      <h1>${esc(title)}</h1>
      <div class="price">${was > now ? `<s>${esc(u.wasPrice)}</s>` : ''}${esc(u.price)} <small>+ tax</small></div>
      ${save ? `<span class="save">You save ${save}</span>` : ''}
      <div class="stock">Stock #${esc(u.stock)}${u.vin ? ' · VIN \u2026' + esc(String(u.vin).slice(-4)) : ''}${u.qty > 1 ? ' · ' + u.qty + ' available' : ''}</div>
      <p class="intro">${esc(intro)}</p>
      <div class="ctas">
        <a class="btn call" href="${TEL}"><div>Call today<span>${PHONE} · a real person answers</span></div></a>
        <div class="row2"><a class="btn alt" href="${sms}">Text us</a><a class="btn alt" href="${reserve}">Hold this ${kind(u)}</a></div>
      </div>
      <p class="es">¿Prefieres español? Llámanos o mándanos un mensaje, con gusto te atendemos.</p>
      <div class="chips">${(u.chips || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
    </div>
  </div>
  ${bullets.length ? `<section class="blk"><h2>Why you'll like it</h2><ul class="ck">${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${extra.map((p) => `<p>${esc(p)}</p>`).join('')}</section>` : ''}
  <section class="blk"><h2>Specs</h2><table><tbody>${(u.specs || []).map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}<tr><td>Stock #</td><td>${esc(u.stock)}</td></tr></tbody></table></section>
  <div class="trust">
    <div><b>18 years</b><span>Authorized Trophy dealer in Owen</span></div>
    <div><b>Price + tax</b><span>No doc fees, no surprises</span></div>
    <div><b>No rust</b><span>All-aluminum, made in the USA</span></div>
    <div><b>Hablamos español</b><span>Te atendemos en tu idioma</span></div>
  </div>
  <section class="blk visit">
    <div><h2>See it in person</h2><p>837 W 3rd St, Owen, WI 54460 · By appointment, call or text to set a time.</p></div>
    <a class="btn alt" href="https://www.google.com/maps/search/?api=1&query=837+West+3rd+Street+Owen+WI+54460" target="_blank" rel="noopener">Get directions</a>
  </section>
  ${others.length ? `<section class="blk"><h2>More on our lot</h2><div class="more">${others.map((o) => `<a class="card" href="${urlOf(o)}"><img src="/${(o.thumbs || o.photos || [''])[0]}" alt="${esc(o.fullName || o.model)}" loading="lazy"><div><b>${esc(o.model)}</b><span>${esc(o.price)} + tax</span></div></a>`).join('')}</div></section>` : ''}
  <details class="tc"><summary>Terms &amp; Conditions</summary><p>Price is plus sales tax, title and registration. Subject to prior sale. Photos are of this unit; options can vary. Specs come from the manufacturer label, so confirm the build, weights and your vehicle's tow rating with us before you buy, and never exceed the trailer GVWR. A hold request is not a completed sale and no payment is taken on this site. Texts about your request may be sent to the number you give us; reply STOP to opt out. <a href="/#terms">Full terms</a> · <a href="/#privacy">Privacy</a></p></details>
</main>
<footer class="foot"><div class="wrap">Lake &amp; Land Rec LLC · 837 W 3rd St, Owen, WI 54460 · <a href="${TEL}">${PHONE}</a> · <a href="/">lakeandlandrec.com</a></div></footer>
<div class="sticky"><a class="c" href="${TEL}">Call today</a><a class="t" href="${sms}">Text us</a></div>
<script>
(function(){var t=document.getElementById('track');if(!t)return;var n=t.children.length,c=document.getElementById('count'),th=document.querySelectorAll('#thumbs button');
function cur(){return Math.round(t.scrollLeft/t.clientWidth);}
function go(i){i=(i+n)%n;t.scrollTo({left:i*t.clientWidth,behavior:'smooth'});}
t.addEventListener('scroll',function(){var i=cur();c.textContent=(i+1)+' / '+n;th.forEach(function(b,k){b.classList.toggle('on',k===i);});},{passive:true});
document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){go(cur()+parseInt(b.getAttribute('data-go'),10));};});
th.forEach(function(b){b.onclick=function(){go(parseInt(b.getAttribute('data-i'),10));};});})();
</script>
</body>
</html>
`;
}

const outDir = path.join(root, 'inventory');
fs.rmSync(outDir, { recursive: true, force: true });
all.forEach((u, i) => {
  const dir = path.join(outDir, slugOf(u)); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(u, i));
});
const today = new Date().toISOString().slice(0, 10);
const urls = ['/', ...all.map(urlOf)];
fs.writeFileSync(path.join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /setup/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`inventory pages: ${all.length} built, sitemap.xml + robots.txt written.`);
