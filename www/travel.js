/* حالت سفر: خودرو / موتورسیکلت / پیاده — انتخاب در برگه‌ی مسیر؛ مقدار در 'travelMode' ذخیره می‌شود و مسیریابی می‌خواند */
(function (root) {
'use strict';
const FM = root.FM || (root.FM = {});
const { el, store } = FM;
const MODES = [['car', 'خودرو'], ['moto', 'موتورسیکلت'], ['foot', 'پیاده']];
function sync() { const m = store.get('travelMode', 'car'); document.querySelectorAll('#r-travel button').forEach((b) => b.classList.toggle('on', b.dataset.k === m)); }
function init() {
  const anchor = document.getElementById('r-engine'); if (!anchor || document.getElementById('r-travel')) return;
  const sw = el('div', { id: 'r-travel', class: 'seg-switch' });
  MODES.forEach(([k, t]) => { const b = el('button', { type: 'button', 'data-k': k, text: t }); b.addEventListener('click', () => { store.set('travelMode', k); sync(); const cards = document.getElementById('r-cards'); if (cards && cards.children.length) { const r = document.getElementById('r-go'); if (r) r.click(); } }); sw.appendChild(b); });
  const row = anchor.closest('.row'); (row || anchor).parentNode.insertBefore(sw, row || anchor); sync();
}
FM.travel = { mode: () => store.get('travelMode', 'car'), init, MODES };
init();
})(window);
