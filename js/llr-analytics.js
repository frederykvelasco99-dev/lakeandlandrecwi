// Google Analytics 4 for lakeandlandrec.com, loaded only after the visitor taps Accept on the cookie bar.
// Also tracks the clicks that matter: Call, Text, Hold/Reserve and form sends.
(function () {
  var GA_ID = 'G-NJJWQJNWQJ';
  var KEY = 'llr_cookie_consent';
  var loaded = false;
  function consent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function load() {
    if (loaded || consent() !== 'accepted') return; loaded = true;
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    if (window.LLR_ITEM) window.gtag('event', 'view_item', { currency: 'USD', value: window.LLR_ITEM.price, items: [window.LLR_ITEM] });
  }
  function track(name, params) { if (loaded && window.gtag) window.gtag('event', name, params || {}); }
  window.llrTrack = track;
  window.llrConsent = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} if (v === 'accepted') load(); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a,button'); if (!a) return;
    var href = a.getAttribute('href') || '';
    var item = (window.LLR_ITEM && window.LLR_ITEM.item_id) || '';
    if (/^tel:/.test(href)) track('generate_lead', { method: 'call', item_id: item });
    else if (/^sms:/.test(href)) track('generate_lead', { method: 'text', item_id: item });
    else if (/reserve=/.test(href) || /openReserve/.test(a.getAttribute('onclick') || '')) track('hold_click', { item_id: item });
  }, true);
  if (document.readyState !== 'loading') load(); else document.addEventListener('DOMContentLoaded', load);
})();
