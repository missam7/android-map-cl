(function (root) {
'use strict';
const FM = root.FM, { el, esc, toast } = FM;
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const TYPE_FA = { florist: 'گل‌فروشی', greengrocer: 'میوه‌فروشی', bakery: 'نانوایی', supermarket: 'سوپرمارکت', convenience: 'خواروبار', butcher: 'قصابی', clothes: 'پوشاک', hairdresser: 'آرایشگاه', mobile_phone: 'موبایل‌فروشی', pharmacy: 'داروخانه', restaurant: 'رستوران', cafe: 'کافه', fast_food: 'فست‌فود', bank: 'بانک', atm: 'خودپرداز', fuel: 'پمپ‌بنزین', hospital: 'بیمارستان', clinic: 'درمانگاه', school: 'مدرسه', place_of_worship: 'مسجد/عبادتگاه', parking: 'پارکینگ', park: 'پارک', garden: 'باغ', playground: 'زمین بازی', hotel: 'هتل' };
const KEYWORDS = [
  [/گل[\s\u200c]*فروشی/, '["shop"="florist"]'], [/میوه/, '["shop"="greengrocer"]'], [/نانوایی|نان/, '["shop"="bakery"]'],
  [/داروخانه|دارو/, '["amenity"="pharmacy"]'], [/پارک/, '["leisure"="park"]'], [/کافه|قهوه/, '["amenity"="cafe"]'],
  [/رستوران|غذا/, '["amenity"="restaurant"]'], [/بانک/, '["amenity"="bank"]'], [/خودپرداز/, '["amenity"="atm"]'],
  [/پمپ[\s\u200c]*بنزین|بنزین/, '["amenity"="fuel"]'], [/سوپر|خواروبار/, '["shop"~"^(supermarket|convenience)$"]'],
  [/بیمارستان/, '["amenity"="hospital"]'], [/مسجد/, '["amenity"="place_of_worship"]'], [/مدرسه/, '["amenity"="school"]'],
  [/هتل/, '["tourism"="hotel"]'], [/آرایشگاه|سلمانی/, '["shop"~"^(hairdresser|barber)$"]']
];
const norm = (s) => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
const filtersFor = (q) => KEYWORDS.filter(([re]) => re.test(norm(q))).map(([, f]) => f);
async function overpass(q) {
  const Http = root.Lib && root.Lib.Http; let last = null;
  for (const url of OVERPASS) {
    try {
      if (Http) { const r = await Http.post({ url, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, data: 'data=' + encodeURIComponent(q), responseType: 'json', connectTimeout: 15000, readTimeout: 30000 }); if (r.status !== 200) throw new Error('HTTP ' + r.status); return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; }
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q) }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json();
    } catch (e) { last = e; }
  }
  throw last || new Error('بدون پاسخ');
}
function parse(j) {
  return ((j && j.elements) || []).map((e) => {
    const t = e.tags || {}, lat = e.lat != null ? e.lat : (e.center && e.center.lat), lng = e.lon != null ? e.lon : (e.center && e.center.lon);
    const k = t.shop || t.amenity || t.leisure || t.tourism || t.office || t.craft || '';
    return lat == null ? null : { name: t['name:fa'] || t.name || '', kind: TYPE_FA[k] || k, lat, lng };
  }).filter((x) => x && x.name);
}
/* کاربری‌های اطراف یک نقطه (برای دکمه‌ی اطلاعات) */
async function around(lat, lng, r) {
  r = r || 80; const a = `(around:${r},${lat},${lng})`;
  const q = `[out:json][timeout:25];is_in(${lat},${lng})->.a;(way(pivot.a)["name"]["leisure"];nwr${a}["name"]["amenity"];nwr${a}["name"]["shop"];nwr${a}["name"]["leisure"];nwr${a}["name"]["tourism"];nwr${a}["name"]["office"];);out center tags 40;`;
  return parse(await overpass(q));
}
/* جستجوی دسته‌ای با نشانگر موقت */
const group = L.layerGroup(); let chip = null;
function ensureUi() {
  if (chip) return;
  const st = document.createElement('style');
  st.textContent = '.poi-pin span{display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e8641b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}#poi-chip{position:fixed;top:calc(env(safe-area-inset-top,0px) + 118px);left:50%;transform:translateX(-50%);z-index:1200;background:#14303a;color:#fff;border:0;border-radius:18px;padding:8px 14px;font:inherit}';
  document.head.appendChild(st);
  chip = el('button', { id: 'poi-chip', type: 'button', onclick: clear }); chip.hidden = true; document.body.appendChild(chip);
}
function clear() { group.clearLayers(); if (chip) chip.hidden = true; }
function popup(p) {
  const w = el('div', { class: 'pop' }), ll = L.latLng(p.lat, p.lng);
  w.appendChild(el('div', { class: 'pop-title', text: p.name })); w.appendChild(el('div', { class: 'pop-sub', text: p.kind }));
  const b = el('div', { class: 'pop-btns' });
  b.appendChild(el('button', { type: 'button', text: 'مبدا', onclick: () => { FM.route.setOrigin(ll); FM.map.closePopup(); } }));
  b.appendChild(el('button', { type: 'button', text: 'مقصد', onclick: () => { FM.route.setDest(ll); FM.map.closePopup(); } }));
  w.appendChild(b); return w;
}
function bbox() { const m = FM.map, b = m.getBounds(), c = b.getCenter(), h = 0.03; return [Math.max(b.getSouth(), c.lat - h), Math.max(b.getWest(), c.lng - h), Math.min(b.getNorth(), c.lat + h), Math.min(b.getEast(), c.lng + h)].map((x) => x.toFixed(5)).join(','); }
async function search(text) {
  ensureUi(); const fl = filtersFor(text), bb = bbox();
  const parts = fl.length ? fl.map((f) => `nwr${f}(${bb});`) : [`nwr["name"~"${norm(text).replace(/[\\"^$.*+?()[\]{}|]/g, '\\$&')}",i](${bb});`];
  toast('در حال یافتن «' + text + '» در اطراف…', 2500);
  let items; try { items = parse(await overpass(`[out:json][timeout:25];(${parts.join('')});out center tags 80;`)); } catch (e) { toast('جستجو ممکن نشد: ' + e.message, 5000); return; }
  group.clearLayers(); group.addTo(FM.map);
  if (!items.length) { chip.hidden = true; toast('موردی در این محدوده پیدا نشد.', 3500); return; }
  items.forEach((p) => L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'poi-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).bindPopup(() => popup(p)).addTo(group));
  chip.textContent = '✕ پاک کردن ' + items.length + ' نتیجه'; chip.hidden = false;
  FM.map.fitBounds(L.latLngBounds(items.map((p) => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 17 });
}
/* بدون دست‌زدن به search.js: با Enter در کادر جستجو، اگر کلمه یک دسته بود، نشانگرها هم گذاشته می‌شوند */
document.addEventListener('keydown', (ev) => { const t = ev.target; if (ev.key === 'Enter' && t && t.tagName === 'INPUT' && t.type === 'search' && filtersFor(t.value).length) search(t.value); }, true);
FM.places = { around, search, clear, isCategory: (q) => filtersFor(q).length > 0, TYPE_FA };
})(window);
