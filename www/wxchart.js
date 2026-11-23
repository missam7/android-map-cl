(function (root) {
'use strict';
const FM = root.FM, { el, nf } = FM;
const WMO = { 0: 'صاف', 1: 'عمدتاً صاف', 2: 'کمی ابری', 3: 'ابری', 45: 'مه', 48: 'مه یخ‌زده', 51: 'نم‌نم باران', 53: 'نم‌نم باران', 55: 'نم‌نم شدید', 61: 'باران ضعیف', 63: 'باران', 65: 'باران شدید', 71: 'برف ضعیف', 73: 'برف', 75: 'برف سنگین', 80: 'رگبار ضعیف', 81: 'رگبار', 82: 'رگبار شدید', 95: 'رعد و برق', 96: 'رعد و تگرگ', 99: 'رعد و تگرگ شدید' };
const ico = (c) => c === 0 ? '☀️' : c <= 2 ? '⛅' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌧️' : c <= 86 ? '🌨️' : '⛈️';
const W = 288, H = 112, L = 30, R = 8, T = 16, B = 20;
const f0 = (v) => (v == null || !isFinite(v) ? '—' : nf(Math.round(v)));
const hh = (t) => nf(+t.slice(11, 13));
const svg = (inner, h) => `<svg viewBox="0 0 ${W} ${h || H}" width="100%" style="direction:ltr;display:block;font-family:inherit">${inner}</svg>`;

function grid(mn, mx, Y) {
  let g = '';
  [mn, (mn + mx) / 2, mx].forEach((v) => { const y = Y(v).toFixed(1); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#d6ded9"/><text x="${L - 4}" y="${(+y + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#5d7079">${f0(v)}</text>`; });
  return g;
}
function line(times, vals, color, unit, title) {
  const n = vals.length; if (n < 2 || vals.some((v) => v == null)) return '';
  let mn = Math.min(...vals), mx = Math.max(...vals); if (mx - mn < 2) { mx += 1; mn -= 1; }
  const X = (i) => L + i * (W - L - R) / (n - 1), Y = (v) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  const pts = vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1));
  let g = grid(mn, mx, Y);
  g += `<path d="M${pts.join('L')}L${X(n - 1).toFixed(1)},${H - B}L${L},${H - B}Z" fill="${color}" opacity=".15"/><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`;
  for (let i = 0; i < n; i += 6) g += `<text x="${X(i).toFixed(1)}" y="${H - 5}" font-size="9" text-anchor="middle" fill="#5d7079">${hh(times[i])}</text>`;
  const im = vals.indexOf(mx); g += `<circle cx="${X(im).toFixed(1)}" cy="${Y(mx).toFixed(1)}" r="3" fill="${color}"/><text x="${X(im).toFixed(1)}" y="${(Y(mx) - 5).toFixed(1)}" font-size="10" font-weight="700" text-anchor="middle" fill="${color}">${f0(mx)}${unit}</text>`;
  return `<div class="wx-t">${title}</div>` + svg(g);
}
function bars(times, vals, color, title) {
  const n = vals.length; if (n < 2 || vals.every((v) => v == null)) return '';
  const cw = (W - L - R) / n, Y = (v) => T + (1 - v / 100) * (H - T - B); let g = grid(0, 100, Y);
  vals.forEach((v, i) => { v = v || 0; const x = L + i * cw + cw * 0.15; g += `<rect x="${x.toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(cw * 0.7).toFixed(1)}" height="${(H - B - Y(v)).toFixed(1)}" rx="2" fill="${color}" opacity=".85"/>`; });
  for (let i = 0; i < n; i += 6) g += `<text x="${(L + i * cw + cw / 2).toFixed(1)}" y="${H - 5}" font-size="9" text-anchor="middle" fill="#5d7079">${hh(times[i])}</text>`;
  return `<div class="wx-t">${title}</div>` + svg(g);
}
function daily(d) {
  const n = d.time.length; if (!n) return '';
  const mn = Math.min(...d.temperature_2m_min), mx = Math.max(...d.temperature_2m_max), rng = Math.max(1, mx - mn), HH = 150, top = 38, bot = 24, cw = (W - 8) / n;
  const Y = (v) => top + (1 - (v - mn) / rng) * (HH - top - bot); let g = '';
  d.time.forEach((day, i) => {
    const x = 4 + i * cw + cw / 2, y1 = Y(d.temperature_2m_max[i]), y2 = Y(d.temperature_2m_min[i]);
    g += `<text x="${x.toFixed(1)}" y="15" font-size="14" text-anchor="middle">${ico(d.weather_code[i])}</text>`;
    g += `<rect x="${(x - 6).toFixed(1)}" y="${y1.toFixed(1)}" width="12" height="${Math.max(4, y2 - y1).toFixed(1)}" rx="6" fill="#f26a1b" opacity=".85"/>`;
    g += `<text x="${x.toFixed(1)}" y="${(y1 - 4).toFixed(1)}" font-size="10" font-weight="700" text-anchor="middle" fill="#a84408">${f0(d.temperature_2m_max[i])}°</text>`;
    g += `<text x="${x.toFixed(1)}" y="${(Math.max(y2, y1 + 4) + 11).toFixed(1)}" font-size="10" text-anchor="middle" fill="#1f77b4">${f0(d.temperature_2m_min[i])}°</text>`;
    g += `<text x="${x.toFixed(1)}" y="${HH - 6}" font-size="9" text-anchor="middle" fill="#5d7079">${new Date(day).toLocaleDateString('fa-IR', { weekday: 'short' })}</text>`;
  });
  return '<div class="wx-t">پیش‌بینی ۷ روز (حداقل / حداکثر)</div>' + svg(g, HH);
}
function build(j, ll) {
  const c = j.current, h = j.hourly, d = j.daily, w = el('div', { class: 'wx' });
  const arrow = c.wind_direction_10m != null ? ` <span style="display:inline-block;transform:rotate(${(c.wind_direction_10m + 180) % 360}deg)">↑</span>` : '';
  w.appendChild(el('div', { class: 'wx-head', html: `<span class="wx-big">${ico(c.weather_code)}</span><div><b class="wx-temp">${f0(c.temperature_2m)}°C</b><div>${WMO[c.weather_code] || ''}</div></div>` }));
  w.appendChild(el('div', { class: 'wx-chips', html: `<span>رطوبت ${f0(c.relative_humidity_2m)}٪</span><span>باد ${f0(c.wind_speed_10m)} km/h${arrow}</span><span>فشار ${f0(c.pressure_msl)} hPa</span><span>ابر ${f0(c.cloud_cover)}٪</span>` }));
  const i0 = Math.max(0, h.time.findIndex((x) => x.slice(0, 13) >= c.time.slice(0, 13))), sl = (a) => a.slice(i0, i0 + 24), tm = sl(h.time);
  const box = el('div', { html: line(tm, sl(h.temperature_2m), '#f26a1b', '°', 'دما — ۲۴ ساعت آینده (°C)') + bars(tm, sl(h.precipitation_probability), '#1f77b4', 'احتمال بارش (٪)') + line(tm, sl(h.wind_speed_10m), '#0e7c7b', '', 'سرعت باد (km/h)') + daily(d) });
  w.appendChild(box);
  w.appendChild(el('div', { class: 'pop-sub', dir: 'ltr', text: ll.lat.toFixed(4) + ', ' + ll.lng.toFixed(4) }));
  return w;
}
const st = document.createElement('style');
st.textContent = '.wx-head{display:flex;align-items:center;gap:10px}.wx-big{font-size:38px;line-height:1}.wx-temp{font-size:24px}.wx-chips{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}.wx-chips span{background:#e1f1f0;color:#0a5f5e;border-radius:999px;padding:1px 9px;font-size:12px}.wx-t{font-size:12px;color:#5d7079;margin:8px 0 2px;font-weight:700}.leaflet-popup-content{max-height:58vh;overflow-y:auto}';
document.head.appendChild(st);
FM.wxchart = { build };
})(window);
