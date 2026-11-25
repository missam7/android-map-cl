(function (root) {
'use strict';
const FM = root.FM, { el, toast } = FM;
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const UA = 'FieldMap/0.5 (Android field survey app)';
const TYPE_FA = { florist: 'گل‌فروشی', greengrocer: 'میوه‌فروشی', bakery: 'نانوایی', supermarket: 'سوپرمارکت', convenience: 'خواروبار', butcher: 'قصابی', clothes: 'پوشاک', hairdresser: 'آرایشگاه', pharmacy: 'داروخانه', restaurant: 'رستوران', cafe: 'کافه', fast_food: 'فست‌فود', bank: 'بانک', atm: 'خودپرداز', fuel: 'پمپ‌بنزین', hospital: 'بیمارستان', clinic: 'درمانگاه', school: 'مدرسه', place_of_worship: 'مسجد/عبادتگاه', parking: 'پارکینگ', park: 'پارک', garden: 'باغ', playground: 'زمین بازی', hotel: 'هتل' };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const Http = root.Lib && root.Lib.Http;
  if (Http) { const r = await Http.get({ url, headers: { 'User-Agent': UA }, responseType: 'json', connectTimeout: 6000, readTimeout: 9000 }); if (r.status !== 200) throw new Error('HTTP ' + r.status); return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; }
  const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
}
/* صف سریالی + کش + تکرار با تأخیر (جلوی ۴۲۹ را می‌گیرد) */
let chain = Promise.resolve(), lastAt = 0, mi = 0; const cache = new Map();
function overpass(q) {
  const c = cache.get(q); if (c && Date.now() - c.t < 6e5) return Promise.resolve(c.j);
  const job = chain.then(async () => {
    let err = null;
    for (let k = 0; k < MIRRORS.length * 2; k++) {
      const w = lastAt + 2000 - Date.now(); if (w > 0) await sleep(w);
      lastAt = Date.now();
      try { const j = await getJson(MIRRORS[mi % MIRRORS.length] + '?data=' + encodeURIComponent(q)); cache.set(q, { t: Date.now(), j }); return j; }
      catch (e) { err = e; mi++; if (/429|502|503|504/.test(e.message)) await sleep(3000 + 2000 * k); }
    }
    throw err;
  });
  chain = job.catch(() => {}); return job;
}
  async function overpassFast(q) {
  const c = cache.get(q); if (c && Date.now() - c.t < 6e5) return c.j;
  const j = await Promise.any(MIRRORS.slice(0, 2).map((m) => getJson(m + '?data=' + encodeURIComponent(q))));
  cache.set(q, { t: Date.now(), j }); return j;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('زمان پاسخ تمام شد')), ms))]);
function parse(j) {
  return ((j && j.elements) || []).map((e) => {
    const t = e.tags || {}, lat = e.lat != null ? e.lat : (e.center && e.center.lat), lng = e.lon != null ? e.lon : (e.center && e.center.lon);
    const k = t.shop || t.amenity || t.leisure || t.tourism || t.office || t.craft || t.landuse || '';
    return lat == null ? null : { name: t['name:fa'] || t.name || '', kind: TYPE_FA[k] || k, lat, lng };
  }).filter((x) => x && x.name);
}
/* ───── نزدیک‌ترین کاربری، از چند منبع ───── */
const dist = (a, b, c, d) => FM.haversine({ lat: a, lng: b }, { lat: c, lng: d });
const fmtD = (m) => (m < 1 ? 'همین‌جا' : FM.nf(Math.round(m)) + ' متر');
async function nearOsm(lat, lng) {
  const la = lat.toFixed(5), lo = lng.toFixed(5), a = `(around:150,${la},${lo})`;
  const q = `[out:json][timeout:8];(nwr${a}["name"]["shop"];nwr${a}["name"]["amenity"];nwr${a}["name"]["tourism"];nwr${a}["name"]["leisure"];nwr${a}["name"]["office"];);out center tags 30;`;
  return parse(await overpassFast(q)).map((p) => Object.assign(p, { d: dist(lat, lng, p.lat, p.lng) })).sort((x, y) => x.d - y.d).slice(0, 1);
}
let nomAt = 0;
async function nearNominatim(lat, lng) {
  const w = nomAt + 1200 - Date.now(); if (w > 0) await sleep(w); nomAt = Date.now();
  const j = await getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=fa&zoom=18&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`);
  if (!j || j.error) return [];
  const nm = j.name || ''; return nm ? [{ name: nm, kind: TYPE_FA[j.type] || j.type || '', d: dist(lat, lng, +j.lat, +j.lon) }] : [];
}
async function nearGoogle(lat, lng) {
  const key = FM.store.get('googleKey', ''); if (!key) throw new Error('کلید گوگل تنظیم نشده');
  const Http = root.Lib && root.Lib.Http; if (!Http) throw new Error('شبکه‌ی بومی در دسترس نیست');
  const r = await Http.post({ url: 'https://places.googleapis.com/v1/places:searchNearby', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.location,places.primaryTypeDisplayName' }, data: { maxResultCount: 3, rankPreference: 'DISTANCE', languageCode: 'fa', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 200 } } }, responseType: 'json', connectTimeout: 12000, readTimeout: 20000 });
  const j = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  if (r.status >= 400) throw new Error('HTTP ' + r.status + (j && j.error && j.error.message ? ' — ' + String(j.error.message).slice(0, 70) : ''));
  return ((j && j.places) || []).filter((p) => p.location).map((p) => ({ name: (p.displayName && p.displayName.text) || '', kind: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || '', d: dist(lat, lng, p.location.latitude, p.location.longitude) })).filter((p) => p.name).sort((x, y) => x.d - y.d).slice(0, 1);
}
async function nearest(lat, lng) {
  const S = [['OpenStreetMap', nearOsm], ['Nominatim', nearNominatim], ['Google Maps', nearGoogle]];
  const res = await Promise.allSettled(S.map(([, f]) => f(lat, lng)));
  return res.map((r, i) => ({ src: S[i][0], list: r.status === 'fulfilled' ? r.value : null, err: r.status === 'rejected' ? String((r.reason && r.reason.message) || r.reason) : '' }));
}

/* نشانگرهای موقت */
const group = L.featureGroup(); let chip = null, fitT = null; const seen = new Set();
function ensureUi() {
  if (chip) return;
  const st = document.createElement('style');
  st.textContent = '.poi-pin span{display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e8641b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}#poi-chip{position:fixed;top:calc(env(safe-area-inset-top,0px) + 118px);left:50%;transform:translateX(-50%);z-index:1200;background:#14303a;color:#fff;border:0;border-radius:18px;padding:8px 14px;font:inherit}';
  document.head.appendChild(st);
  chip = el('button', { id: 'poi-chip', type: 'button' }); chip.hidden = true; chip.addEventListener('click', clear); document.body.appendChild(chip);
}
function clear() { group.clearLayers(); seen.clear(); if (chip) chip.hidden = true; }
function popup(p) {
  const w = el('div', { class: 'pop' }), ll = L.latLng(p.lat, p.lng);
  w.appendChild(el('div', { class: 'pop-title', text: p.name })); w.appendChild(el('div', { class: 'pop-sub', text: p.kind || '' }));
  const b = el('div', { class: 'pop-btns' });
  b.appendChild(el('button', { type: 'button', text: 'مبدا', onclick: () => { FM.route.setOrigin(ll); FM.map.closePopup(); } }));
  b.appendChild(el('button', { type: 'button', text: 'مقصد', onclick: () => { FM.route.setDest(ll); FM.map.closePopup(); } }));
  w.appendChild(b); return w;
}
function addMarkers(list) {
  ensureUi(); group.addTo(FM.map);
  list.forEach((p) => {
    const key = p.lat.toFixed(5) + p.lng.toFixed(5) + p.name; if (seen.has(key)) return; seen.add(key);
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'poi-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).bindPopup(() => popup(p)).addTo(group);
  });
  const n = group.getLayers().length; if (!n) { chip.hidden = true; return; }
  chip.textContent = '✕ پاک کردن ' + n + ' نتیجه'; chip.hidden = false;
  clearTimeout(fitT); fitT = setTimeout(() => { const b = group.getBounds(); if (b.isValid()) FM.map.fitBounds(b, { padding: [60, 60], maxZoom: 17 }); }, 700);
}
/* نتایج فهرست جستجو (نشان/Nominatim) را هم روی نقشه می‌گذارد */
function plotItems(items) {
  addMarkers((items || []).filter((x) => x.type === 'place' && isFinite(x.lat) && isFinite(x.lng)).map((x) => ({ name: x.title, kind: x.tag || '', lat: x.lat, lng: x.lng })));
}
function bbox() { const b = FM.map.getBounds(), c = b.getCenter(), h = 0.03; return [Math.max(b.getSouth(), c.lat - h), Math.max(b.getWest(), c.lng - h), Math.min(b.getNorth(), c.lat + h), Math.min(b.getEast(), c.lng + h)].map((x) => x.toFixed(4)).join(','); }
async function search(text) {
  const fl = filtersFor(text); if (!fl.length) return;
  toast('در حال یافتن «' + text + '» در اطراف…', 2500);
  try { addMarkers(parse(await overpass(`[out:json][timeout:25];(${fl.map((f) => `nwr${f}(${bbox()});`).join('')});out center tags 80;`))); }
  catch (e) { toast('سرور نقشه شلوغ است (' + e.message + '). چند ثانیه بعد دوباره امتحان کنید.', 6000); }
}

/* پنجره‌ی اطلاعات ⓘ: نزدیک‌ترین کاربری + دکمه‌ی پلاک + دکمه‌ی هواشناسی */
FM.map.on('popupopen', (e) => {
  const pop = e.popup; if (pop._source || pop._poiDone) return;
  const c = pop.getContent(); if (!(c instanceof HTMLElement)) return;
  pop._poiDone = true; const ll = pop.getLatLng();
  const box = el('div', { class: 'pop-desc admin', text: 'در حال یافتن نزدیک‌ترین کاربری…' });
  const wx = el('div', { class: 'wx-box' });
  const btns = el('div', { class: 'pop-btns' });
  if (FM.vec && FM.vec.parcelClick) btns.appendChild(el('button', { type: 'button', text: 'پلاک / کد نوسازی ملک', onclick: () => { FM.map.closePopup(); FM.vec.parcelClick(ll); } }));
  btns.appendChild(el('button', { type: 'button', text: 'وضعیت هواشناسی', onclick: async () => {
    wx.textContent = 'در حال دریافت هواشناسی…'; pop.update();
    try { const j = await FM.weather.fetch(ll); wx.textContent = ''; wx.appendChild(FM.wxchart.build(j, ll)); }
    catch (er) { wx.textContent = 'دریافت هواشناسی ممکن نشد: ' + er.message; }
    pop.update();
  } }));
  c.appendChild(box); c.appendChild(btns); c.appendChild(wx); pop.update();
  box.textContent = ''; box.appendChild(el('b', { text: 'نزدیک‌ترین کاربری به این نقطه:' }));
  [['OpenStreetMap', nearOsm], ['Nominatim', nearNominatim], ['Google Maps', nearGoogle]].forEach(([src, fn]) => {
    const row = el('div', { text: '• ' + src + ': در حال جستجو…' }); box.appendChild(row);
    withTimeout(fn(ll.lat, ll.lng), 10000).then((list) => {
      const x = list && list[0];
      row.textContent = '• ' + src + ': ' + (x ? x.name + (x.kind ? ' (' + x.kind + ')' : '') + ' — ' + fmtD(x.d) : 'موردی نزدیک نبود');
    }).catch((er) => { row.textContent = '• ' + src + ': خطا (' + String(er.message).slice(0, 60) + ')'; }).finally(() => pop.update());
  });
});

/* Enter در کادر جستجو: همه‌ی نتایج را روی نقشه علامت می‌زند، بدون نیاز به انتخاب یکی */
const clr = document.getElementById('sb-clear'); if (clr) clr.addEventListener('click', clear);
const inp = document.getElementById('sb-input'); let lastSub = 0;
async function submit(text) {
  const q = String(text || '').trim(); if (!q || Date.now() - lastSub < 1500) return; lastSub = Date.now();
  clear(); const rb = document.getElementById('sb-results');
  if (filtersFor(q).length) { if (rb) rb.hidden = true; if (inp) inp.blur(); search(q); return; }
  const items = await FM.search.run(q), pl = (items || []).filter((x) => x.type === 'place');
  if (pl.length >= 2) { if (rb) rb.hidden = true; if (inp) inp.blur(); plotItems(pl); }
  else if (items && items.length) FM.search.choose(items[0]);
}
if (inp) {
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); submit(inp.value); } });
  inp.addEventListener('search', () => { if (inp.value) submit(inp.value); });
}
FM.places = { nearest, search, submit, plotItems, clear, isCategory: (q) => filtersFor(q).length > 0 };
})(window);
