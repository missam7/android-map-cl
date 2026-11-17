/* آدرس‌یابی: شهر، محله، خیابان و کوچه‌ی هر نقطه از اطلاعات نقشه
   ترتیب منابع: جاده‌های ذخیره‌شده‌ی OpenStreetMap روی گوشی (آفلاین) ← نشان ← Nominatim */
(function (root) {
'use strict';
const FM = root.FM || (root.FM = {});
const { $, el, store, toast } = FM;
const Lb = () => root.Lib || {};
const CELL = 0.05, RAD = Math.PI / 180;
const clean = (s) => String(s == null ? '' : s).replace(/[\u200e\u200f]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();

/* ───── جاده‌های ذخیره‌شده (همان کش موتور مسیریابی) ───── */
function openRoads() {
  return new Promise((res) => {
    try {
      const r = root.indexedDB.open('fieldmap-roads', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('cells', { keyPath: 'k' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
const idbReq = (q) => new Promise((res) => { q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
async function cellWays(keys) {
  const db = await openRoads(); if (!db) return [];
  const out = [];
  try { for (const k of keys) { const rec = await idbReq(db.transaction('cells').objectStore('cells').get(k)); if (rec && rec.ways) out.push(...rec.ways); } } catch (e) { /* ignore */ }
  db.close(); return out;
}
function segDist(la, lo, ax, ay, bx, by) { // مختصات a و b برحسب (lon,lat) → متر
  const kx = Math.cos(la * RAD) * 111320, ky = 110540;
  const x1 = (ax - lo) * kx, y1 = (ay - la) * ky, x2 = (bx - lo) * kx, y2 = (by - la) * ky, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, (-x1 * dx - y1 * dy) / L2)) : 0;
  return Math.hypot(x1 + t * dx, y1 + t * dy);
}
async function nearestRoad(la, lo, maxM) {
  const cx = Math.floor(la / CELL), cy = Math.floor(lo / CELL), keys = [`${cx}:${cy}`];
  const fx = la / CELL - cx, fy = lo / CELL - cy, m = 0.0016 / CELL;
  if (fx < m) keys.push(`${cx - 1}:${cy}`); if (fx > 1 - m) keys.push(`${cx + 1}:${cy}`); if (fy < m) keys.push(`${cx}:${cy - 1}`); if (fy > 1 - m) keys.push(`${cx}:${cy + 1}`);
  const ways = await cellWays(keys); let best = null;
  for (const w of ways) {
    const t = w.t || {}, name = clean(t['name:fa'] || t.name || ''); if (!name) continue;
    for (let i = 0; i + 3 < w.g.length; i += 2) { const d = segDist(la, lo, w.g[i + 1], w.g[i], w.g[i + 3], w.g[i + 2]); if (!best || d < best.dist) best = { dist: d, name, hw: t.highway, ref: t.ref || '' }; }
  }
  return best && best.dist <= (maxM || 70) ? best : null;
}
// جستجوی نام خیابان در جاده‌های ذخیره‌شده (آفلاین)
async function searchRoads(text, limit) {
  const q = clean(text); if (q.length < 2) return [];
  const db = await openRoads(); if (!db) return []; const found = new Map();
  await new Promise((res) => {
    try {
      const cur = db.transaction('cells').objectStore('cells').openCursor();
      cur.onsuccess = () => {
        const c = cur.result; if (!c || found.size >= (limit || 12)) return res();
        for (const w of c.value.ways || []) {
          const t = w.t || {}, name = clean(t['name:fa'] || t.name || ''); if (!name || !name.includes(q) || found.has(name)) continue;
          const mid = Math.floor(w.g.length / 4) * 2; found.set(name, { name, lat: w.g[mid], lng: w.g[mid + 1], hw: t.highway });
          if (found.size >= (limit || 12)) break;
        }
        c.continue();
      };
      cur.onerror = () => res();
    } catch (e) { res(); }
  });
  db.close(); return [...found.values()];
}

/* ───── سرویس‌های آنلاین ───── */
async function httpJson(url, headers, timeout) {
  const Http = Lb().Http; if (!Http) throw new Error('بدون شبکه‌ی بومی');
  const r = await Http.get({ url, headers: headers || {}, responseType: 'json', connectTimeout: timeout || 8000, readTimeout: timeout || 8000 });
  if (r.status !== 200) throw new Error('HTTP ' + r.status); return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
}
const memo = new Map();
async function reverse(la, lo) {
  const mk = la.toFixed(5) + ',' + lo.toFixed(5); if (memo.has(mk)) return memo.get(mk);
  const out = { source: [] };
  const road = await nearestRoad(la, lo).catch(() => null);
  if (road) { out.street = road.name; out.source.push('OpenStreetMap'); }
  if (navigator.onLine) {
    const key = store.get('neshanKey', ''); let done = false;
    if (key) {
      try {
        const j = await httpJson(`https://api.neshan.org/v5/reverse?lat=${la}&lng=${lo}`, { 'Api-Key': key });
        if (j && j.status === 'OK') {
          if (j.city) out.city = clean(j.city); if (j.neighbourhood) out.neighbourhood = clean(j.neighbourhood); if (j.route_name) out.street = clean(j.route_name);
          if (j.formatted_address) out.address = clean(j.formatted_address); if (j.municipality_zone) out.zone = j.municipality_zone; if (j.state) out.state = clean(j.state);
          if (j.county) out.county = clean(j.county); if (j.village) out.village = clean(j.village);
          out.source.unshift('نشان'); done = true;
        }
      } catch (e) { /* برو سراغ منبع بعدی */ }
    }
    if (!done) {
      try {
        const j = await httpJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=fa&zoom=18&addressdetails=1&lat=${la}&lon=${lo}`, { 'User-Agent': 'FieldMap/0.5 (Android field survey app)' }, 9000);
        const a = (j && j.address) || {};
        out.city = out.city || clean(a.city || a.town || a.village || a.municipality || ''); out.neighbourhood = out.neighbourhood || clean(a.neighbourhood || a.suburb || a.quarter || '');
        out.street = out.street || clean(a.road || a.pedestrian || ''); out.state = out.state || clean(a.state || ''); if (j && j.display_name && !out.address) out.address = clean(j.display_name);
        out.source.push('Nominatim');
      } catch (e) { /* بدون پاسخ */ }
    }
  }
  memo.set(mk, out); if (memo.size > 200) memo.delete(memo.keys().next().value); return out;
}
function addrLines(r) {
  const L = []; if (!r) return L;
  if (r.city) L.push('شهر: ' + r.city); else if (r.village) L.push('روستا: ' + r.village);
  if (r.neighbourhood) L.push('محله: ' + r.neighbourhood);
  if (r.street) L.push('خیابان/کوچه: ' + r.street);
  return L;
}
const hasAddr = (t) => /(?:^|\n)(شهر|روستا|محله|خیابان\/کوچه): /.test(t || '');

/* ───── افزودن خودکار آدرس به توضیحات نقطه‌های جدید ───── */
async function enrich(f) {
  if (!store.get('autoAddr', true)) return;
  const [lng, lat] = f.geometry.coordinates; let r; try { r = await reverse(lat, lng); } catch (e) { return; }
  const lines = addrLines(r); if (!lines.length) return;
  const cur = f.properties.description || ''; if (hasAddr(cur)) return;
  f.properties.description = cur ? cur + '\n' + lines.join('\n') : lines.join('\n');
  if (FM.project && FM.project.saveSoon) FM.project.saveSoon();
}
function hookAddFeature() {
  if (!FM.project || FM.project.__addrHooked) return; const orig = FM.project.addFeature;
  FM.project.addFeature = function (f) { const r = orig.apply(this, arguments); if (f && f.geometry && f.geometry.type === 'Point' && !(f.properties && f.properties.noAddr)) enrich(f); return r; };
  FM.project.__addrHooked = true;
}
hookAddFeature();

/* ───── دکمه‌ی اطلاعات (ⓘ): استان، شهرستان، ناحیه‌ها، شهر، محله و خیابان ───── */
function showInfo(c, opts) {
  const map = FM.map, f = FM.fmtCoord(c.lat, c.lng), d = FM.geo ? FM.geo.describe(c.lat, c.lng) : { text: '', lines: [] };
  const w = el('div', { class: 'pop' });
  w.appendChild(el('div', { class: 'pop-title', text: (opts && opts.title) || 'اطلاعات این نقطه' }));
  w.appendChild(el('div', { class: 'pop-sub', dir: 'ltr', text: f.text }));
  const adm = el('div', { class: 'pop-desc admin', text: d.text || 'مرز اداری این محل شناخته نشد (داده‌ی مرزی نصب نیست یا نقطه خارج از ایران است).' }); w.appendChild(adm);
  const addr = el('div', { class: 'pop-desc admin addr', text: 'در حال دریافت شهر، محله و خیابان…' }); w.appendChild(addr);
  let rev = null;
  const btns = el('div', { class: 'pop-btns' });
  const add = (label, fn) => btns.appendChild(el('button', { type: 'button', text: label, onclick: fn }));
  add('ثبت نقطه', () => {
    map.closePopup(); const sym = Object.assign({ symbol: 'circle', color: '#e8641b', size: 22 }, store.get('defSymbol', {}));
    const desc = [d.text].concat(addrLines(rev)).filter(Boolean).join('\n');
    const feat = { type: 'Feature', properties: { name: FM.project.nextName('P'), saved: new Date().toISOString(), symbol: sym.symbol, 'marker-color': sym.color, size: sym.size, noAddr: true }, geometry: { type: 'Point', coordinates: [+c.lng.toFixed(8), +c.lat.toFixed(8)] } };
    if (desc) feat.properties.description = desc; FM.project.addFeature(feat); toast('نقطه ثبت شد.');
  });
  add('مبدا', () => { FM.route.setOrigin(c); map.closePopup(); }); add('مقصد', () => { FM.route.setDest(c); map.closePopup(); });
  if (FM.vec && FM.vec.parcelMode()) add('پارسل', () => { map.closePopup(); FM.vec.parcelClick(c); });
  add('کپی', async () => { try { await navigator.clipboard.writeText([f.copy, d.text].concat(addrLines(rev)).filter(Boolean).join('\n')); toast('کپی شد.'); } catch (e) { toast('کپی انجام نشد.'); } });
  w.appendChild(btns);
  L.popup({ maxWidth: 310 }).setLatLng(c).setContent(w).openOn(map);
  reverse(c.lat, c.lng).then((r) => {
    rev = r; const lines = addrLines(r);
    if (lines.length) { addr.textContent = lines.join('\n') + (r.address ? '\n' + r.address : '') + `\n(منبع: ${r.source.join('، ')})`; }
    else { addr.textContent = navigator.onLine ? 'آدرسی برای این نقطه پیدا نشد.' : 'برای آدرس بدون اینترنت، جاده‌های این محدوده را از برگه‌ی «مسیر» ذخیره کنید.'; }
  }).catch(() => { addr.textContent = 'دریافت آدرس ممکن نشد.'; });
}
function rebindInfoButton() {
  const old = $('#f-info'); if (!old || old.dataset.v5) return; const nu = old.cloneNode(true); nu.dataset.v5 = '1'; old.parentNode.replaceChild(nu, old);
  nu.addEventListener('click', () => showInfo(FM.map.getCenter()));
}
rebindInfoButton();

FM.geocode = { reverse, nearestRoad, searchRoads, addrLines, showInfo, enrich, hasAddr, _t: { segDist } };
})(window);
