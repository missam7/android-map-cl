(function (root) {
'use strict';
const FM = root.FM, { el, toast, nf, store } = FM;
let on = store.get('weatherOn', false);
const WMO = { 0: 'صاف', 1: 'عمدتاً صاف', 2: 'کمی ابری', 3: 'ابری', 45: 'مه', 48: 'مه یخ‌زده', 51: 'نم‌نم باران', 53: 'نم‌نم باران', 55: 'نم‌نم شدید', 61: 'باران ضعیف', 63: 'باران', 65: 'باران شدید', 71: 'برف ضعیف', 73: 'برف', 75: 'برف سنگین', 80: 'رگبار ضعیف', 81: 'رگبار', 82: 'رگبار شدید', 95: 'رعد و برق', 96: 'رعد و تگرگ', 99: 'رعد و تگرگ شدید' };
async function getJson(url, headers) {
  const Http = root.Lib && root.Lib.Http;
  if (Http) { const r = await Http.get({ url, headers: headers || {}, responseType: 'json', connectTimeout: 12000, readTimeout: 25000 }); if (r.status >= 400) throw new Error('HTTP ' + r.status); return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; }
  const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
}
const URL_ = (la, ln) => 'https://api.open-meteo.com/v1/forecast?latitude=' + la.toFixed(4) + '&longitude=' + ln.toFixed(4) + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=7&wind_speed_unit=kmh';
const fa = (x, u) => (x == null ? '—' : nf(Math.round(x)) + (u || ''));
function render(j, ll) {
  const c = j.current, d = j.daily, h = j.hourly, w = el('div', { class: 'pop' });
  w.appendChild(el('div', { class: 'pop-title', text: fa(c.temperature_2m, '°C') + ' — ' + (WMO[c.weather_code] || '—') }));
  w.appendChild(el('div', { class: 'pop-sub', dir: 'ltr', text: ll.lat.toFixed(4) + ', ' + ll.lng.toFixed(4) }));
  const t = el('table', { class: 'pop-tbl' }), row = (k, v) => t.appendChild(el('tr', {}, [el('th', { text: k }), el('td', { text: v })]));
  row('دمای حس‌شده', fa(c.apparent_temperature, '°C')); row('رطوبت', fa(c.relative_humidity_2m, '٪')); row('ابرناکی', fa(c.cloud_cover, '٪'));
  row('باد', fa(c.wind_speed_10m, ' km/h') + ' از ' + fa(c.wind_direction_10m, '°') + ' (وزش تا ' + fa(c.wind_gusts_10m, ' km/h') + ')');
  row('فشار', fa(c.pressure_msl, ' hPa')); row('بارش فعلی', (c.precipitation || 0) + ' mm');
  w.appendChild(t);
  const i0 = Math.max(0, h.time.findIndex((x) => x.slice(0, 13) >= c.time.slice(0, 13))), th = el('table', { class: 'pop-tbl' });
  w.appendChild(el('div', { class: 'pop-sub', text: 'ساعت‌های آینده' }));
  for (let i = i0; i < Math.min(h.time.length, i0 + 15); i += 3) th.appendChild(el('tr', {}, [el('th', { text: h.time[i].slice(11, 16) }), el('td', { text: fa(h.temperature_2m[i], '°') + ' · ' + (WMO[h.weather_code[i]] || '') + ' · بارش ' + fa(h.precipitation_probability[i], '٪') + ' · باد ' + fa(h.wind_speed_10m[i]) })]));
  w.appendChild(th);
  w.appendChild(el('div', { class: 'pop-sub', text: 'پیش‌بینی ۷ روز' }));
  const td = el('table', { class: 'pop-tbl' });
  d.time.forEach((day, i) => td.appendChild(el('tr', {}, [el('th', { text: new Date(day).toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric', month: 'numeric' }) }), el('td', { text: fa(d.temperature_2m_min[i]) + ' تا ' + fa(d.temperature_2m_max[i], '°') + ' · ' + (WMO[d.weather_code[i]] || '') + ' · بارش ' + fa(d.precipitation_probability_max[i], '٪') + ' · باد تا ' + fa(d.wind_speed_10m_max[i]) })])));
  w.appendChild(td); return w;
}
const loc = (t) => { const d = new Date(t); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const wmoOf = (s) => { s = String(s || ''); if (/thunder/.test(s)) return 95; if (/snow|sleet/.test(s)) return 73; if (/heavyrain/.test(s)) return 65; if (/rainshowers/.test(s)) return 80; if (/lightrain/.test(s)) return 61; if (/rain/.test(s)) return 63; if (/fog/.test(s)) return 45; if (/partlycloudy/.test(s)) return 2; if (/fair/.test(s)) return 1; if (/cloudy/.test(s)) return 3; return 0; };
function fromMet(m) {
  const ts = m.properties.timeseries, n0 = ts[0], d0 = n0.data.instant.details, kmh = (v) => (v == null ? null : v * 3.6);
  const code = (t) => wmoOf(((t.data.next_1_hours || t.data.next_6_hours || {}).summary || {}).symbol_code);
  const cur = { time: loc(n0.time), temperature_2m: d0.air_temperature, apparent_temperature: null, relative_humidity_2m: d0.relative_humidity, precipitation: ((n0.data.next_1_hours || {}).details || {}).precipitation_amount || 0, weather_code: code(n0), cloud_cover: d0.cloud_area_fraction, pressure_msl: d0.air_pressure_at_sea_level, wind_speed_10m: kmh(d0.wind_speed), wind_direction_10m: d0.wind_from_direction, wind_gusts_10m: null };
  const h = { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [], wind_speed_10m: [] }, days = {};
  ts.forEach((t) => {
    const d = t.data.instant.details, lt = loc(t.time), day = lt.slice(0, 10);
    if (t.data.next_1_hours) { h.time.push(lt); h.temperature_2m.push(d.air_temperature); h.precipitation_probability.push(null); h.weather_code.push(code(t)); h.wind_speed_10m.push(kmh(d.wind_speed)); }
    const D = days[day] = days[day] || { mn: 99, mx: -99, p: 0, w: 0, c: null };
    D.mn = Math.min(D.mn, d.air_temperature); D.mx = Math.max(D.mx, d.air_temperature); D.w = Math.max(D.w, kmh(d.wind_speed) || 0);
    D.p += ((t.data.next_1_hours || {}).details || {}).precipitation_amount || 0; if (D.c == null || lt.slice(11, 13) === '12') D.c = code(t);
  });
  const ks = Object.keys(days).slice(0, 7);
  return { current: cur, hourly: h, daily: { time: ks, weather_code: ks.map((k) => days[k].c), temperature_2m_max: ks.map((k) => days[k].mx), temperature_2m_min: ks.map((k) => days[k].mn), precipitation_probability_max: ks.map(() => null), wind_speed_10m_max: ks.map((k) => days[k].w) } };
}
async function fetchWeather(ll) {
  try { return await getJson(URL_(ll.lat, ll.lng)); }
  catch (e1) {
    try { return fromMet(await getJson('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + ll.lat.toFixed(4) + '&lon=' + ll.lng.toFixed(4), { 'User-Agent': 'FieldMap/0.5 github.com/missam7/android-map-cl' })); }
    catch (e2) { throw new Error('Open-Meteo: ' + e1.message + ' | MET: ' + e2.message); }
  }
}
async function show(ll) {
  const pop = L.popup({ maxWidth: 340 }).setLatLng(ll).setContent('در حال دریافت هواشناسی…').openOn(FM.map);
  try { pop.setContent(render(await fetchWeather(ll), ll)); } catch (e) { pop.setContent('دریافت هواشناسی ممکن نشد: ' + e.message); }
}
function set(v) { on = !!v; store.set('weatherOn', on); const cb = document.getElementById('opt-weather'); if (cb) cb.checked = on; if (on) toast('هواشناسی فعال شد؛ روی هر نقطه بزنید.', 3000); }
const cb = document.getElementById('opt-weather'); if (cb) { cb.checked = on; cb.addEventListener('change', () => set(cb.checked)); }
function mountToggle() {
  if (document.getElementById('opt-weather')) return;
  const sh = document.getElementById('sheet-layers'); if (!sh) return;
  const lab = el('label', { class: 'chk' }, [el('input', { type: 'checkbox', id: 'opt-weather' }), ' لایه‌ی هواشناسی (با لمس نقشه، وضعیت و پیش‌بینی)']);
  sh.appendChild(lab);
  const cb = lab.querySelector('input'); cb.checked = on; cb.addEventListener('change', () => set(cb.checked));
}
mountToggle();
FM.map.on('click', (e) => { if (on && !(FM.isDrawingShape && FM.isDrawingShape())) show(e.latlng); });
FM.weather = { on: () => on, set, show };
})(window);
