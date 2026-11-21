/* لایه‌های برداری داخل خود برنامه (بدون اتصال به هیچ سرور):
   فایل‌های GeoJSON را داخل www/data/layers/ بگذارید و در www/data/layers.json معرفی کنید.
   هر لایه: روی نقشه روشن/خاموش می‌شود و (اگر cat داشته باشد) برای تشخیص خودکار استان/شهرستان/ناحیه هم استفاده می‌شود. */
(function (root) {
'use strict';
const FM = root.FM || (root.FM = {});
const { el, esc, store, toast, nf } = FM;
const clean = (s) => String(s == null ? '' : s).replace(/[\u200e\u200f]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
const CAT_LABEL = { province: 'استان', county: 'شهرستان', bakhsh: 'بخش', muni_region: 'منطقه‌ی شهرداری', muni_district: 'ناحیه‌ی شهرداری', reg_zone: 'ناحیه‌ی ثبتی', plaque: 'پلاک ثبتی' };
const PALETTE = ['#e8641b', '#1f77b4', '#2ca02c', '#9467bd', '#d62728', '#17becf', '#8c564b', '#c2185b'];
let defs = [], on = store.get('localOn', {}), map = null, ui = null;
const layers = {}, status = {}, rawCache = {};
let renderer = null;

/* ───── خواندن GeoJSON ───── */
function normalize(j) {
  if (!j) return []; if (Array.isArray(j)) j = { type: 'FeatureCollection', features: j };
  if (j.type === 'FeatureCollection') return j.features || []; if (j.type === 'Feature') return [j];
  if (/^(Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon|GeometryCollection)$/.test(j.type)) return [{ type: 'Feature', properties: {}, geometry: j }];
  return [];
}
function crsOf(j, d) {
  if (d.crs) return d.crs;
  const nm = j && j.crs && j.crs.properties && j.crs.properties.name, m = nm && /EPSG[:]+(\d+)/i.exec(nm); if (!m) return null;
  const c = +m[1]; return c >= 32601 && c <= 32660 ? 'utm:' + (c - 32600) + 'N' : (c >= 32701 && c <= 32760 ? 'utm:' + (c - 32700) + 'S' : null);
}
async function loadFeatures(d) {
  if (rawCache[d.id]) return rawCache[d.id];
  const r = await fetch(d.file); if (!r.ok) throw new Error('فایل پیدا نشد: ' + d.file + ' (HTTP ' + r.status + ')');
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch (e) { throw new Error('فایل GeoJSON معتبر نیست: ' + d.file); }
  let feats = normalize(j).filter((f) => f && f.geometry);
  if (!feats.length) throw new Error('فایل عارضه‌ای ندارد: ' + d.file);
  const crs = crsOf(j, d);
  if (crs && root.DataIO) feats = root.DataIO.reprojectFeatures(feats, root.DataIO.CRS.toWgs(crs));
  else if (root.DataIO && root.DataIO.looksProjected(feats)) throw new Error('مختصات «' + d.name + '» جغرافیایی نیست؛ در layers.json مقدار "crs" (مثل "utm:40N") را بنویسید.');
  if (text.length < 8e6) rawCache[d.id] = feats;   // فایل‌های بزرگ هر بار دوباره خوانده می‌شوند تا حافظه پر نشود
  return feats;
}
const stripRx = (d) => (d.strip ? new RegExp('^(?:' + d.strip + ')\\s*') : null);
const nameOf = (d, p) => { const n = FM.geo ? FM.geo.pickName(p, d.nameProp) : clean((p || {})[d.nameProp || 'name']), rx = stripRx(d); return rx ? n.replace(rx, '').trim() || n : n; };

/* ───── نمایش روی نقشه ───── */
function popupFor(d, f) {
  const p = f.properties || {}, w = el('div', { class: 'pop' });
  w.appendChild(el('div', { class: 'pop-title', text: nameOf(d, p) || '(بدون نام)' })); w.appendChild(el('div', { class: 'pop-sub', text: d.name }));
  const t = el('table', { class: 'pop-tbl' }); let n = 0;
  Object.keys(p).forEach((k) => { if (n >= 16 || p[k] == null || typeof p[k] === 'object' || String(p[k]) === '') return; n++; t.appendChild(el('tr', {}, [el('th', { text: k }), el('td', { text: String(p[k]) })])); });
  if (n) w.appendChild(t);
  const btns = el('div', { class: 'pop-btns' });
  btns.appendChild(el('button', { type: 'button', text: 'افزودن به پروژه', onclick: () => {
    const props = {}; Object.keys(p).forEach((k) => { if (p[k] != null && typeof p[k] !== 'object') props[k] = p[k]; });
    Object.assign(props, { name: nameOf(d, p) || d.name, source: d.name, stroke: d.color, fill: d.color, 'fill-opacity': 0.08 });
    FM.project.addFeature({ type: 'Feature', properties: props, geometry: f.geometry }); toast('به پروژه افزوده شد.'); map.closePopup();
  } }));
  w.appendChild(btns); return w;
}
function build(d, feats) {
  renderer = renderer || L.canvas({ padding: 0.3 });
  const group = L.layerGroup(), labels = L.layerGroup(), col = d.color, wt = d.weight || 2.2, fill = d.fill == null ? 0.04 : d.fill, minZ = d.labelZoom || 11;
  const gj = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
      renderer, interactive: false, style: () => ({ color: col, weight: wt, opacity: 0.95, fillColor: col, fillOpacity: fill }),
   pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5, interactive: false, color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 1 }),
    onEachFeature(f, ly) {
            if (d.labels !== false && feats.length <= 1500) {
        const nm = nameOf(d, f.properties); if (nm && ly.getBounds) { const b = ly.getBounds(); if (b.isValid()) labels.addLayer(L.marker(b.getCenter(), { interactive: false, keyboard: false, icon: L.divIcon({ className: 'ref-label', html: `<span style="color:${esc(col)}">${esc(nm)}</span>`, iconSize: [0, 0] }) })); }
      }
    }
  });
  group.addLayer(gj);
  const sync = () => { const show = map.getZoom() >= minZ; if (show && !group.hasLayer(labels)) group.addLayer(labels); else if (!show && group.hasLayer(labels)) group.removeLayer(labels); };
  group.on('add', () => { map.on('zoomend', sync); sync(); }); group.on('remove', () => map.off('zoomend', sync));
  return group;
}
async function toggle(d, show) {
  if (!show) { if (layers[d.id]) { map.removeLayer(layers[d.id]); delete layers[d.id]; } on[d.id] = false; store.set('localOn', on); status[d.id] = ''; render(); return; }
  status[d.id] = 'در حال خواندن…'; render();
  try {
    const feats = await loadFeatures(d); if (layers[d.id]) map.removeLayer(layers[d.id]);
    layers[d.id] = build(d, feats).addTo(map); on[d.id] = true; store.set('localOn', on); status[d.id] = nf(feats.length) + ' عارضه';
  } catch (e) { on[d.id] = false; store.set('localOn', on); status[d.id] = 'خطا'; toast(e.message, 7000); }
  render();
}

/* ───── ثبت در تشخیص خودکار مرز ───── */
async function registerLookups() {
  for (const d of defs) {
    if (!d.cat || !FM.geo || !FM.geo._t) continue;
    try {
      const feats = await loadFeatures(d), packs = FM.geo._t.packs;
      let lf = feats, np = d.nameProp;
      if (d.strip) { lf = feats.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { __n: nameOf(d, f.properties) } })); np = '__n'; }
      FM.geo._t.addPack('local:' + d.id, d.cat, CAT_LABEL[d.cat] || d.name, 'داخل برنامه (' + d.name + ')', lf, np);
      for (const [id, p] of [...packs]) if (p.cat === d.cat && !id.startsWith('local:') && !id.startsWith('user:')) packs.delete(id);   // داده‌ی خود شما بر استان داخلی و سرور شهرداری اولویت دارد
      status[d.id] = status[d.id] || nf(feats.length) + ' عارضه'; if (FM.geo.onChange) FM.geo.onChange();
    }
    catch (e) { status[d.id] = 'خطا'; console.warn('local layer', d.id, e.message); }
    await new Promise((r) => setTimeout(r, 30));   // اجازه‌ی رندر به رابط
  }
  setTimeout(() => { const packs = FM.geo && FM.geo._t && FM.geo._t.packs; if (!packs) return; const cats = new Set(defs.filter((x) => x.cat).map((x) => x.cat)); for (const [id, p] of [...packs]) if (cats.has(p.cat) && !id.startsWith('local:') && !id.startsWith('user:')) packs.delete(id); if (FM.geo.onChange) FM.geo.onChange(); }, 1500);
  render();
}

/* ───── رابط ───── */
function render() {
  if (!ui) return; ui.textContent = '';
  if (!defs.length) { ui.appendChild(el('p', { class: 'hint', text: 'هنوز لایه‌ای معرفی نشده است. فایل‌های GeoJSON را در پوشه‌ی www/data/layers/ بگذارید و در www/data/layers.json معرفی کنید.' })); return; }
  defs.forEach((d) => {
    const cb = el('input', { type: 'checkbox' }); cb.checked = !!layers[d.id]; cb.addEventListener('change', () => toggle(d, cb.checked));
    const sw = el('i', { class: 'lsw', style: `background:${d.color}` });
    ui.appendChild(el('label', { class: 'chk refrow' }, [cb, sw, el('span', { class: 'rn', text: d.name }), el('small', { text: status[d.id] || (d.cat ? CAT_LABEL[d.cat] : '') })]));
  });
}
async function init() {
  map = FM.map; if (!map) return;
  const old = document.querySelector('#ref-list'), oldSec = old && old.closest('.sec');
  const sec = el('div', { class: 'sec' }, [el('h3', { text: 'لایه‌های برداری داخل برنامه' })]); ui = el('div', { id: 'local-list' }); sec.appendChild(ui);
  if (oldSec) { oldSec.parentNode.insertBefore(sec, oldSec); oldSec.hidden = true; } else document.querySelector('#sheet-layers').appendChild(sec);
  try {
    const r = await fetch('data/layers.json'); const j = r.ok ? await r.json() : { layers: [] };
    defs = (j.layers || []).filter((d) => d && d.file && d.name).map((d, i) => Object.assign({ id: d.id || 'L' + i, color: PALETTE[i % PALETTE.length], nameProp: 'name' }, d));
  } catch (e) { defs = []; }
  render(); await registerLookups();
  for (const d of defs) if (on[d.id]) await toggle(d, true);
}
FM.localdata = { init, toggle, loadFeatures, render, get defs() { return defs; } };
if (document.readyState === 'complete') init(); else window.addEventListener('load', init);
})(window);
