/* نوار جستجو (مثل Google Maps): مکان و آدرس، کد نوسازی، مختصات (جغرافیایی/UTM)، نقاط پروژه،
   نام خیابان‌های ذخیره‌شده (آفلاین) و جستجوی صوتی با فرمان «مسیر تا …» */
(function (root) {
'use strict';
const FM = root.FM || (root.FM = {});
const { el, esc, store, toast } = FM;
const Lb = () => root.Lib || {};
const UA = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const SVG = {
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  mic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  hash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/></svg>',
  road: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 3 5 21M16 3l3 18M12 4v3M12 11v3M12 18v3"/></svg>',
  clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  folder: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/></svg>'
};

/* ───── ساخت رابط ───── */
const bar = el('div', { id: 'searchbar', role: 'search' });
bar.innerHTML = `<span class="sb-ic">${SVG.search}</span><input id="sb-input" type="search" dir="auto" autocomplete="off" autocapitalize="off" enterkeyhint="search" placeholder="جستجوی مکان، آدرس، کد نوسازی یا مختصات…" aria-label="جستجو"><button type="button" id="sb-clear" hidden aria-label="پاک کردن">${SVG.x}</button><button type="button" id="sb-lang" data-voice-lang="1" aria-label="زبان صدا"></button><button type="button" id="sb-mic" aria-label="جستجوی صوتی">${SVG.mic}</button>`;
const box = el('div', { id: 'sb-results', hidden: true });
document.body.appendChild(bar); document.body.appendChild(box);
const input = bar.querySelector('#sb-input'), btnClear = bar.querySelector('#sb-clear'), btnMic = bar.querySelector('#sb-mic'), btnLang = bar.querySelector('#sb-lang');
btnLang.textContent = FM.voice ? FM.voice.LANGS[FM.voice.lang()].short : 'فا';
btnLang.addEventListener('click', () => { if (FM.voice) { FM.voice.setLang(FM.voice.lang() === 'fa' ? 'en' : 'fa'); toast(FM.voice.lang() === 'fa' ? 'جستجوی صوتی و گوینده: فارسی' : 'Voice search & guidance: English'); } });

/* ───── تجزیه‌ی ورودی ───── */
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const norm = (s) => String(s || '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => AR.indexOf(d)).replace(/٫/g, '.').replace(/[،؛]/g, ',').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
function parseCoord(q) {
  const t = norm(q), m = /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)(?:\s*[,\s]\s*(\d{1,2})\s*([NSns])?)?$/.exec(t); if (!m) return null;
  const a = +m[1], b = +m[2];
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180 && !m[3]) { const swap = a >= 43 && a <= 64 && b >= 24 && b <= 40; const lat = swap ? b : a, lng = swap ? a : b; return { lat, lng, label: 'مختصات جغرافیایی' }; }
  const zone = m[3] ? +m[3] : root.DataIO.CRS.utmZone(FM.map.getCenter().lng), hemi = (m[4] || 'N').toUpperCase(), id = `utm:${zone}${hemi}`;
  let E = a, N = b; if (a > 1e6 && b >= 1e5 && b <= 9e5) { E = b; N = a; }
  if (!(E >= 1e5 && E <= 9e5 && N > 0 && N < 1e7)) return null;
  try { const p = root.DataIO.CRS.toWgs(id)([E, N]); return { lat: p[1], lng: p[0], label: `UTM زون ${zone}${hemi}` }; } catch (e) { return null; }
}
function parseParcelCode(q) {
  const raw = norm(q); if (/\d[.,]\d/.test(raw) || /[A-Za-z\u0600-\u06FF]/.test(raw)) return null;
  const t = raw.replace(/[\s_/\\.–—−]+/g, '-').replace(/^-+|-+$/g, '');
  if (/^\d+(-\d+){6}$/.test(t)) return { full: t };
  if (/^\d+(-\d+){3,5}$/.test(t) && /[-/_\s]/.test(raw)) return { prefix: t };
  return null;
}
const ROUTE_RE = /^(?:مسیر(?:یابی)?(?:\s+(?:به|تا))?|برو(?:\s+(?:به|تا))?|navigate\s+to|directions?\s+to|route\s+to|go\s+to)\s+(.+)$/i;

/* ───── منابع جستجو ───── */
async function httpJson(url, headers, timeout) {
  const Http = Lb().Http; if (!Http) throw new Error('بدون شبکه‌ی بومی');
  const r = await Http.get({ url, headers: headers || {}, responseType: 'json', connectTimeout: timeout || 9000, readTimeout: timeout || 12000 });
  if (r.status !== 200) throw new Error('HTTP ' + r.status); return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
}
function insidePoint(geom) { // نقطه‌ای که حتماً داخل چندضلعی است
  const poly = geom.type === 'Polygon' ? geom.coordinates : (geom.type === 'MultiPolygon' ? geom.coordinates[0] : null); if (!poly) return null;
  const ring = poly[0]; let cx = 0, cy = 0, A = 0;
  for (let i = 0; i < ring.length - 1; i++) { const [x0, y0] = ring[i], [x1, y1] = ring[i + 1], f = x0 * y1 - x1 * y0; A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; }
  A /= 2; const c = A ? [cx / (6 * A), cy / (6 * A)] : ring[0];
  const inside = (x, y) => { let r = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r; } return r; };
  if (inside(c[0], c[1])) return { lat: c[1], lng: c[0] };
  const xs = []; for (let i = 0; i < ring.length - 1; i++) { const [x0, y0] = ring[i], [x1, y1] = ring[i + 1]; if ((y0 > c[1]) !== (y1 > c[1])) xs.push(x0 + (c[1] - y0) * (x1 - x0) / (y1 - y0)); }
  xs.sort((a, b) => a - b); let best = null; for (let i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  return best ? { lat: c[1], lng: (best[0] + best[1]) / 2 } : { lat: ring[0][1], lng: ring[0][0] };
}
async function parcelSearch(pc) {
  const token = store.get('mashhadToken', ''); if (!token) throw new Error('توکن پارسل تنظیم نشده است.');
  const cql = pc.full ? `Code='${pc.full}'` : `Code LIKE '${pc.prefix}-%'`;
  const url = 'https://websdi.mashhad.ir/api/proxy/geotajak/wfs?service=wfs&request=GetFeature&outputFormat=application/json&typeName=geotajak:features&srsname=EPSG:4326&count=10&startIndex=0&CQL_FILTER=' + encodeURIComponent(cql);
  const j = await httpJson(url, { Accept: 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': UA }, 20000);
  return (j.features || []).filter((f) => f.geometry).map((f) => {
    const p = f.properties || {}, pt = insidePoint(f.geometry);
    return { type: 'parcel', title: 'کد نوسازی ' + (p.Code || pc.full || pc.prefix), sub: 'پارسل مشهد' + (p.Area ? ' · مساحت ' + p.Area : ''), lat: pt.lat, lng: pt.lng, geometry: f.geometry };
  });
}
async function neshanSearch(q) {
  const key = store.get('neshanKey', ''); if (!key || !navigator.onLine) return [];
  const c = FM.map.getCenter(), j = await httpJson(`https://api.neshan.org/v1/search?term=${encodeURIComponent(q)}&lat=${c.lat}&lng=${c.lng}`, { 'Api-Key': key });
  return ((j && j.items) || []).filter((it) => it.location).slice(0, 8).map((it) => ({ type: 'place', title: it.title, sub: [it.neighbourhood, it.region, it.address].filter(Boolean).join('، '), lat: it.location.y, lng: it.location.x, tag: it.category || it.type || '' }));
}
async function nominatimSearch(q) {
  if (!navigator.onLine) return [];
  const j = await httpJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=fa&countrycodes=ir&limit=6&q=${encodeURIComponent(q)}`, { 'User-Agent': 'FieldMap/0.5 (Android field survey app)' }, 12000);
  return (j || []).map((it) => ({ type: 'place', title: (it.display_name || '').split(',')[0], sub: it.display_name, lat: +it.lat, lng: +it.lon, tag: it.type }));
}
function localFeatures(q) {
  const out = [], needle = norm(q).toLowerCase(); if (needle.length < 1 || !FM.project || !FM.project.current()) return out;
  for (const layer of FM.project.current().layers) for (const f of layer.features) {
    const nm = String((f.properties && f.properties.name) || ''); if (nm && norm(nm).toLowerCase().includes(needle)) { out.push({ type: 'feature', title: nm, sub: layer.name, layer, feature: f }); if (out.length >= 6) return out; }
  }
  return out;
}

/* ───── نمایش نتایج ───── */
let seq = 0, timer = null, marker = null;
const history = () => store.get('searchHistory', []);
function pushHistory(it) { const h = history().filter((x) => !(x.title === it.title && Math.abs(x.lat - it.lat) < 1e-5)); h.unshift({ title: it.title, sub: it.sub || '', lat: it.lat, lng: it.lng, type: it.type === 'feature' ? 'place' : it.type }); store.set('searchHistory', h.slice(0, 8)); }
const ICONS = { coord: SVG.pin, place: SVG.pin, parcel: SVG.hash, feature: SVG.folder, road: SVG.road, history: SVG.clock };
function render(items, note) {
  box.textContent = ''; if (!items.length && !note) { box.hidden = true; return; }
  items.forEach((it) => {
    const b = el('button', { type: 'button', class: 'sr-item' }); b.innerHTML = `<span class="sr-i">${ICONS[it.hist ? 'history' : it.type] || SVG.pin}</span><span class="sr-t"><b>${esc(it.title)}</b><small>${esc(it.sub || '')}</small></span>${it.tag ? `<em>${esc(it.tag)}</em>` : ''}`;
    b.addEventListener('click', () => choose(it)); box.appendChild(b);
  });
  if (note) box.appendChild(el('div', { class: 'sr-note', text: note }));
  box.hidden = false;
}
const closeResults = () => { box.hidden = true; input.blur(); };
function putMarker(ll) {
  if (marker) FM.map.removeLayer(marker);
  marker = L.marker(ll, { icon: FM.symbolIcon('pin', '#d62728', 36), keyboard: false, zIndexOffset: 900 }).addTo(FM.map);
}
function choose(it) {
  closeResults(); const map = FM.map;
  if (it.type === 'feature') { FM.project.focusFeature(it.layer, it.feature); return; }
  const ll = L.latLng(it.lat, it.lng); if (!it.hist) pushHistory(it);
  if (it.type === 'parcel' && it.geometry) {
    const b = L.geoJSON(it.geometry).getBounds(); map.fitBounds(b, { padding: [60, 60], maxZoom: 19 });
    setTimeout(() => FM.vec.parcelClick(ll), 450); return;
  }
  map.setView(ll, Math.max(map.getZoom(), 17)); putMarker(ll);
  setTimeout(() => (FM.geocode ? FM.geocode.showInfo(ll, { title: it.title }) : null), 350);
}

/* ───── اجرای جستجو ───── */
async function run(q) {
  const my = ++seq; q = (q || '').trim();
  if (!q) { const h = history().map((x) => Object.assign({}, x, { hist: true })); render(h, null); return []; }
  const items = [];
  const c = parseCoord(q); if (c) items.push({ type: 'coord', title: `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`, sub: c.label, lat: c.lat, lng: c.lng });
  const pc = parseParcelCode(q);
  localFeatures(q).forEach((x) => items.push(x));
  render(items, (pc || q.length >= 2) ? 'در حال جستجو…' : null);
  const jobs = []; let msg = '';
  if (pc) jobs.push(parcelSearch(pc).catch((e) => { msg = 'جستجوی کد نوسازی: ' + e.message; return []; }));
  if (!pc && !c && q.length >= 2) jobs.push(neshanSearch(q).catch(() => null));
  const res = await Promise.all(jobs); if (my !== seq) return items;
  let online = [].concat(...res.filter(Boolean));
  if (!pc && !c && q.length >= 2 && (res[0] === null || !online.length)) { try { online = await nominatimSearch(q); } catch (e) { /* ادامه */ } if (my !== seq) return items; }
  online.forEach((x) => items.push(x));
  if (!pc && !c && q.length >= 2 && items.filter((x) => x.type !== 'feature').length < 3 && FM.geocode) {
    const roads = await FM.geocode.searchRoads(q, 8).catch(() => []); if (my !== seq) return items;
    roads.forEach((r) => items.push({ type: 'road', title: r.name, sub: 'خیابان (از جاده‌های ذخیره‌شده)', lat: r.lat, lng: r.lng }));
  }
  if (pc && !online.length && !msg) msg = 'کد نوسازی پیدا نشد؛ ممکن است سرور شهرداری در دسترس نباشد یا کد را درست ننوشته باشید (مثال: 11-1-16-20-0-0-0).';
  render(items, items.length ? null : (msg || 'نتیجه‌ای پیدا نشد.'));
  if (msg && items.length) box.appendChild(el('div', { class: 'sr-note', text: msg }));
  return items;
}
input.addEventListener('input', () => { btnClear.hidden = !input.value; clearTimeout(timer); timer = setTimeout(() => run(input.value), 420); });
input.addEventListener('focus', () => { if (!input.value) run(''); else if (box.children.length) box.hidden = false; });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(input.value).then((items) => { if (items && items.length === 1) choose(items[0]); }); } if (e.key === 'Escape') closeResults(); });
btnClear.addEventListener('click', () => { input.value = ''; btnClear.hidden = true; box.hidden = true; if (marker) { FM.map.removeLayer(marker); marker = null; } input.focus(); });
FM.map.on('click', () => { if (!box.hidden) closeResults(); });

/* ───── صدا ───── */
async function routeTo(text) {
  const items = await run(text), first = (items && items.find((x) => x.type !== 'feature')) || (items && items[0]);
  if (!first) { toast('مقصد «' + text + '» پیدا نشد.', 5000); if (FM.voice) FM.voice.say2('مقصد پیدا نشد', 'Destination not found'); return; }
  closeResults(); const ll = first.type === 'feature' ? (() => { const g = first.feature.geometry; return g.type === 'Point' ? L.latLng(g.coordinates[1], g.coordinates[0]) : FM.map.getCenter(); })() : L.latLng(first.lat, first.lng);
  FM.map.setView(ll, Math.max(FM.map.getZoom(), 15)); putMarker(ll); FM.route.setDest(ll);
  if (FM.voice) FM.voice.say2('مسیر تا ' + first.title + ' محاسبه می‌شود', 'Routing to ' + (/[A-Za-z]/.test(first.title) ? first.title : 'your destination'));
  if (!(await ensureFix())) { toast('موقعیت GPS هنوز پیدا نشد؛ مبدا را در برگه‌ی مسیر انتخاب کنید.', 6000); return; }
  setTimeout(() => { const go = document.getElementById('r-go'); if (go) go.click(); }, 300);
}
// برای مسیریابی صوتی: تا ۹ ثانیه منتظر اولین موقعیت GPS می‌ماند
async function ensureFix() {
  if (!FM.gps) return false; if (FM.gps.last()) return true; FM.gps.start();
  for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 300)); if (FM.gps.last()) return true; }
  return false;
}
async function voiceSearch() {
  if (!FM.voice) return; btnMic.classList.add('rec');
  try {
    const text = ((await FM.voice.listen()) || '').trim(); if (!text) { toast('چیزی شنیده نشد.'); return; }
    input.value = text; btnClear.hidden = false; const m = ROUTE_RE.exec(text);
    if (m) await routeTo(m[1].trim()); else { input.focus(); await run(text); }
  } catch (e) { toast(e.message || 'جستجوی صوتی ممکن نشد.', 6000); } finally { btnMic.classList.remove('rec'); }
}
btnMic.addEventListener('click', voiceSearch);

FM.search = { run, parseCoord, parseParcelCode, insidePoint, parcelSearch, routeTo, voiceSearch, choose, ROUTE_RE, _t: { norm } };
})(window);
