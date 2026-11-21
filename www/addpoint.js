(function (root) {
'use strict';
const FM = root.FM, { el, toast, dialog } = FM;
const num = (s) => parseFloat(FM.search._t.norm(s).replace(/,/g, '.'));
async function addManual() {
  const zone = root.DataIO.CRS.utmZone(FM.map.getCenter().lng);
  const crs = FM.project.selectCrs('utm:' + zone + 'N', false);
  const mk = (ph) => el('input', { type: 'text', class: 'field', dir: 'ltr', inputmode: 'decimal', placeholder: ph });
  const x = mk('X (شرقی E، یا طول در حالت جغرافیایی)'), y = mk('Y (شمالی N، یا عرض در حالت جغرافیایی)');
  const nm = el('input', { type: 'text', class: 'field', placeholder: 'نام (اختیاری)' });
  const row = (t, n) => el('div', { class: 'frow col' }, [el('label', { text: t }), n]);
  const body = el('div', {}, [row('سیستم مختصات', crs), row('X', x), row('Y', y), row('نام', nm)]);
  let pt = null;
  const r = await dialog({ title: 'افزودن نقطه (دستی)', body, focus: false, buttons: [{ label: 'انصراف', value: false }, {
    label: 'افزودن', primary: true, value: true,
    validate: () => {
      const X = num(x.value), Y = num(y.value);
      if (!isFinite(X) || !isFinite(Y)) { toast('مقادیر X و Y را درست وارد کنید.', 4000); return false; }
      const id = crs.value(); let lng = X, lat = Y;
      if (id !== 'wgs84') { try { const p = root.DataIO.CRS.toWgs(id)([X, Y]); lng = p[0]; lat = p[1]; } catch (e) { toast('تبدیل UTM ناموفق بود.', 4000); return false; } }
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) { toast('مختصات خارج از محدوده است.', 4000); return false; }
      pt = { lat, lng }; return true;
    } }] });
  if (!r || !pt) return;
  const props = { name: nm.value.trim() || FM.project.nextName('P') };
  if (FM.geo && FM.geo.withAdminText) { const t = FM.geo.withAdminText(pt.lat, pt.lng, ''); if (t) props.description = t; }
  FM.project.addFeature({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] } });
  FM.map.setView([pt.lat, pt.lng], Math.max(FM.map.getZoom(), 17)); toast('نقطه افزوده شد.');
}
function mount() {
  const sh = document.getElementById('sheet-draw'); if (!sh || document.getElementById('d-manual')) return;
  const b = el('button', { type: 'button', id: 'd-manual', class: 'link', text: '＋ افزودن نقطه (ورود مختصات UTM یا جغرافیایی)' });
  b.addEventListener('click', addManual);
  sh.appendChild(el('div', { class: 'sec' }, [el('h3', { text: 'افزودن نقطه' }), b]));
}
mount(); window.addEventListener('load', mount);
})(window);
