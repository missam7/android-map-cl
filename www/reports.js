/* گزارش‌های شهرداری مشهد (پروانه، پایان‌کار، عرصه) — مستقیم داخل برنامه، بدون رفتن به سایت شهرداری.
   منطق از برنامه‌ی دسکتاپ قدیمی (مسیر HTTP) منتقل شده: فرم eservice.mashhad.ir با کد نوسازی ۷ قسمتی ارسال می‌شود. */
(function (root) {
'use strict';
const FM = root.FM || (root.FM = {});
const { el, toast, dialog } = FM;
const Lb = () => root.Lib || {};
const PAGE = 'https://eservice.mashhad.ir/fa/page/100670-%D8%A7%D8%B7%D9%84%D8%A7%D8%B9%D8%A7%D8%AA-%D9%85%D9%84%DA%A9.html';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CLAUSES = {
  "fshParvaneh": {
    "where": "M1U2Ywlw4QvyqkvEnUYboRL3kjrDwbnvmv2QrhMQqhg=077",
    "sub": "XQbw1fC+BJlvISASIJiMyApYKWigXA6AyzrIq5F9OHs=030",
    "order": "C974lLbvhO4VkvDS16wU4SiKlUHGIPEB5aHD9RwuIEU=008"
  },
  "fshPayankar": {
    "where": "M1U2Ywlw4QvyqkvEnUYboRL3kjrDwbnvmv2QrhMQqhg=007",
    "sub": "XQbw1fC+BJlvISASIJiMyApYKWigXA6AyzrIq5F9OHs=093",
    "order": "C974lLbvhO4VkvDS16wU4SiKlUHGIPEB5aHD9RwuIEU=072"
  },
  "fshArseh": {
    "where": "M1U2Ywlw4QvyqkvEnUYboRL3kjrDwbnvmv2QrhMQqhg=062",
    "sub": "XQbw1fC+BJlvISASIJiMyApYKWigXA6AyzrIq5F9OHs=034",
    "order": "C974lLbvhO4VkvDS16wU4SiKlUHGIPEB5aHD9RwuIEU=094"
  }
};
const RADIO = { permit: 'fshParvaneh', completion: 'fshPayankar', land: 'fshArseh' };
const TITLES = { permit: 'پروانه ساختمان', completion: 'پایان‌کار', land: 'عرصه' };

/* ───── ابزار HTML ───── */
const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
function attr(tag, a) {
  const m = new RegExp('\\b' + a + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))', 'i').exec(tag); if (!m) return null;
  return (m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : (m[3] || ''))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function grab(html, name) {
  const want = String(name).replace(/\\/g, ''), re = /<input\b[^>]*>/gi; let tag;
  while ((tag = re.exec(String(html || '')))) { if ((attr(tag[0], 'name') || '').trim() !== want) continue; return attr(tag[0], 'value') || ''; }
  return '';
}
function fragment(html) {
  const h = String(html || ''), cut = /(?=<input[^>]*name=["']sisSearchWhereClause|<\/form>|$)/i.source;
  const pats = [new RegExp('<div id="fshMainDiv"[\\s\\S]*?' + cut, 'i'), new RegExp('<div[^>]*id=["\'][^"\']*(?:MainDiv|ReportDiv|sisReport)[^"\']*["\'][\\s\\S]*?' + cut, 'i')];
  for (const re of pats) { const m = re.exec(h); if (m && /<td\b/i.test(m[0])) return m[0]; }
  return h;
}
function parseRows(html) {
  const rows = [], frag = fragment(html), trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi; let m, headers = null, rec = 0;
  while ((m = trRe.exec(frag))) {
    const inner = m[1], cells = [...inner.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => strip(x[1])); if (!cells.length) continue;
    if (/class\s*=\s*["'][^"']*list-header/i.test(inner) || /<th\b/i.test(inner)) { headers = cells; rec = 0; continue; }
    if (headers && headers.length === cells.length) { rec++; headers.forEach((hd, i) => { if (hd && cells[i]) rows.push({ label: rec > 1 ? `${hd} (${rec})` : hd, value: cells[i], row: rec }); }); }
    else if (cells.length === 2 && cells[0] && cells[1]) rows.push({ label: cells[0], value: cells[1] });
  }
  return rows;
}
function sanitizeTables(html) {
  let s = String(fragment(html)).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|select|textarea|button)\b[\s\S]*?<\/\1>/gi, '').replace(/<input\b[^>]*>/gi, '');
  const OK = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'b', 'strong', 'br']);
  s = s.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (m, slash, tag, attrs) => {
    tag = tag.toLowerCase(); if (!OK.has(tag)) return ''; if (slash) return `</${tag}>`;
    let out = ''; if (tag === 'td' || tag === 'th') { const cs = /\bcolspan\s*=\s*["']?(\d+)/i.exec(attrs); if (cs) out += ` colspan="${cs[1]}"`; const rs = /\browspan\s*=\s*["']?(\d+)/i.exec(attrs); if (rs) out += ` rowspan="${rs[1]}"`; }
    if ((tag === 'tr' || tag === 'td' || tag === 'th') && /list-header/i.test(attrs)) out += ' class="hd"';
    return `<${tag}${out}>`;
  });
  return s.replace(/\s+/g, ' ').trim();
}
const polyOk = (p) => { p = String(p || '').trim(); return p.length > 20 && !/[\u0600-\u06FF]/.test(p); };
const parseCode = (c) => { const p = String(c || '').split('-').map((s) => s.trim()); if (p.length !== 7 || p.some((x) => !/^\d+$/.test(x))) return null; return { c1: p[6], c2: p[5], c3: p[4], c4: p[3], c5: p[2], c6: p[1], c7: p[0], complete: p.join('-') }; };

/* ───── کوکی و درخواست ───── */
function hget(h, name) { if (!h) return undefined; const k = Object.keys(h).find((x) => x.toLowerCase() === name); return k ? h[k] : undefined; }
function splitSetCookie(v) { if (!v) return []; if (Array.isArray(v)) return v; return String(v).split(/,(?=\s*[^;,\s]+=)/); }
function mergeCookies(jar, arr) {
  (arr || []).forEach((c) => {
    const parts = String(c).split(';').map((s) => s.trim()), kv = parts[0], i = kv.indexOf('='); if (i <= 0) return;
    const name = kv.slice(0, i).trim(), value = kv.slice(i + 1).trim(); let dead = false;
    parts.slice(1).forEach((a) => { const j = a.indexOf('='), k = (j < 0 ? a : a.slice(0, j)).trim().toLowerCase(), v = j < 0 ? '' : a.slice(j + 1).trim(); if (k === 'max-age' && Number(v) <= 0) dead = true; else if (k === 'expires' && v && Date.parse(v) < Date.now()) dead = true; });
    if (dead) delete jar[name]; else jar[name] = value;
  });
}
const cookieStr = (jar) => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
function headersFor(cookie, isPost) {
  const h = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7', 'Cache-Control': 'no-cache', Pragma: 'no-cache', 'Upgrade-Insecure-Requests': '1' };
  if (cookie) h.Cookie = cookie;
  if (isPost) { h['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'; h.Origin = 'https://eservice.mashhad.ir'; h.Referer = PAGE; }
  return h;
}
async function request(method, url, jar, data, isPost) {
  const Http = Lb().Http; if (!Http) throw new Error('لایه‌ی شبکه‌ی بومی در دسترس نیست');
  let cur = url, m = method, body = data;
  for (let hop = 0; hop < 6; hop++) {
    const r = await Http.request({ url: cur, method: m.toUpperCase(), headers: headersFor(cookieStr(jar), isPost && m === 'post'), data: body, responseType: 'text', disableRedirects: true, connectTimeout: 30000, readTimeout: 70000 });
    if (new URL(cur).hostname === 'eservice.mashhad.ir') mergeCookies(jar, splitSetCookie(hget(r.headers, 'set-cookie')));
    if (r.status >= 300 && r.status < 400 && hget(r.headers, 'location')) { cur = new URL(hget(r.headers, 'location'), cur).toString(); if (r.status !== 307 && r.status !== 308) { m = 'get'; body = undefined; } continue; }
    return { status: r.status, data: typeof r.data === 'string' ? r.data : JSON.stringify(r.data || '') };
  }
  throw new Error('ریدایرکت بیش از حد');
}

/* ───── فرم و ارسال ───── */
async function fetchFormTokens() {
  const jar = {}; let html = '';
  for (let pass = 0; pass < 2; pass++) { const r = await request('get', PAGE, jar); html = String(r.data || ''); if (grab(html, 'secToken')) break; }
  if (!grab(html, 'secToken')) throw new Error('صفحه‌ی شهرداری پاسخ معتبر نداد (ممکن است سرور شهرداری در دسترس نباشد یا VPN روشن باشد).');
  const vName = (/name\s*=\s*["']([0-9a-f]{32}_validations)["']/i.exec(html) || [])[1] || 'e6a9312f1e9677e662119bfb09ce6330_validations';
  return { pageUrl: PAGE, jar, validationsName: vName, csrf: grab(html, 'formCSRFToken[report_builder_form]'), formGenerateTime: grab(html, 'formGenerateTime'), secToken: grab(html, 'secToken'), validations: grab(html, vName),
    sisSearchWhereClause: grab(html, 'sisSearchWhereClause'), sisSearchSubWhereClause: grab(html, 'sisSearchSubWhereClause'), sisSearchOrderByClause: grab(html, 'sisSearchOrderByClause'), polygon: grab(html, 'polygon'), forRadio: null };
}
function buildParams(tk, codes, radio) {
  const cl = CLAUSES[radio] || { where: '', sub: '', order: '' }, p = new URLSearchParams();
  for (let i = 1; i <= 7; i++) p.append('nosaziCode' + i, String(codes['c' + i] == null ? '' : codes['c' + i]));
  p.append('reportsRadio', radio); p.append('SearchBtn', 'جستجو'); p.append('x_lat', '/'); p.append('y_lon', '/'); p.append('nosaziCodeComplete', '/'); p.append('polygon', tk.polygon || '');
  p.append('__sisReportRowCount', '10'); p.append('__sisReportParamType', 'simple'); p.append('report_builder_forma', '0');
  const same = tk.forRadio === radio;
  p.append('sisSearchWhereClause', (same && tk.sisSearchWhereClause) || cl.where || ''); p.append('sisSearchSubWhereClause', (same && tk.sisSearchSubWhereClause) || cl.sub || ''); p.append('sisSearchOrderByClause', (same && tk.sisSearchOrderByClause) || cl.order || '');
  p.append('formCSRFToken[report_builder_form]', tk.csrf || ''); p.append('formGenerateTime', tk.formGenerateTime || ''); p.append('activeFormName', 'report_builder_form'); p.append('secToken', tk.secToken || ''); p.append(tk.validationsName, tk.validations || '');
  return p.toString();
}
async function submit(tk, codes, radio) {
  const r = await request('post', tk.pageUrl, tk.jar, buildParams(tk, codes, radio), true); tk.forRadio = radio;
  const html = String(r.data || ''), upd = (k, n) => { const v = grab(html, n); if (v) tk[k] = v; };
  upd('csrf', 'formCSRFToken[report_builder_form]'); upd('formGenerateTime', 'formGenerateTime'); upd('secToken', 'secToken'); upd('validations', tk.validationsName);
  upd('sisSearchWhereClause', 'sisSearchWhereClause'); upd('sisSearchSubWhereClause', 'sisSearchSubWhereClause'); upd('sisSearchOrderByClause', 'sisSearchOrderByClause');
  const pv = grab(html, 'polygon'); if (polyOk(pv)) tk.polygon = pv;
  if (r.status !== 200) return { rows: [], tablesHtml: '', error: 'خطای سرور شهرداری (HTTP ' + r.status + ')' };
  const rows = parseRows(html), tablesHtml = sanitizeTables(html), has = /<td\b/i.test(tablesHtml);
  const blank = /کد نوسازی\s*:\s*(?:-\s*){3,}/.test(strip(html));
  return { rows, tablesHtml: has ? tablesHtml : '', blank, error: null };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// کد ۷ قسمتی → سه گزارش (پشت‌سرهم؛ سرور شهرداری پشت‌سرهم‌های سریع را رد می‌کند)
async function fetchReports(codeStr, onResult, opts) {
  const codes = parseCode(codeStr); if (!codes) throw new Error('کد نوسازی باید هفت قسمت داشته باشد (مثل 11-1-16-20-0-0-0).');
  const gap = opts && opts.gap != null ? opts.gap : 3000, tk = await fetchFormTokens(), out = {};
  for (const kind of ['permit', 'completion', 'land']) {
    try {
      tk.sisSearchWhereClause = ''; tk.sisSearchSubWhereClause = ''; tk.sisSearchOrderByClause = ''; tk.forRadio = null;
      if (kind === 'land' && !polyOk(tk.polygon)) { out[kind] = { rows: [], tablesHtml: '', error: 'برای گزارش عرصه، سرور شهرداری باید ابتدا مختصات پلاک را بدهد؛ گزارش پروانه را دوباره امتحان کنید.' }; }
      else { await sleep(gap); out[kind] = await submit(tk, codes, RADIO[kind]); }
    } catch (e) { out[kind] = { rows: [], tablesHtml: '', error: e.message || String(e) }; }
    if (onResult) onResult(kind, out[kind]);
  }
  return out;
}

/* ───── رابط ───── */
async function open(codeStr) {
  const codes = parseCode(codeStr); if (!codes) { toast('این کد نوسازی هفت‌قسمتی نیست؛ گزارش شهرداری ممکن نیست.', 5000); return; }
  const body = el('div', { class: 'rep' }), tabs = el('div', { class: 'seg-switch rep-tabs' }), pane = el('div', { class: 'rep-pane' }), state = {}; let cur = 'permit';
  body.appendChild(el('div', { class: 'nosazi', dir: 'ltr', text: codes.complete })); body.appendChild(tabs); body.appendChild(pane);
  const show = () => {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === cur)); pane.textContent = '';
    const s = state[cur];
    if (!s) { pane.appendChild(el('div', { class: 'rep-wait', text: 'در حال دریافت از سرور شهرداری… (ممکن است تا یک دقیقه طول بکشد)' })); return; }
    if (s.error) { pane.appendChild(el('div', { class: 'rep-err', text: s.error })); return; }
    if (s.tablesHtml) { const d = el('div', { class: 'rep-tbl' }); d.innerHTML = s.tablesHtml; pane.appendChild(d); return; }
    if (s.rows && s.rows.length) { const t = el('table', { class: 'pop-tbl rep-rows' }); s.rows.forEach((r) => t.appendChild(el('tr', {}, [el('th', { text: r.label }), el('td', { text: r.value })]))); pane.appendChild(t); return; }
    pane.appendChild(el('div', { class: 'rep-empty', text: s.blank ? 'برای این کد در این گزارش اطلاعاتی ثبت نشده است.' : 'گزارشی برای این پلاک پیدا نشد.' }));
  };
  Object.keys(TITLES).forEach((k) => { const b = el('button', { type: 'button', 'data-k': k, text: TITLES[k], onclick: () => { cur = k; show(); } }); tabs.appendChild(b); });
  show();
  let dead = false;
  const job = fetchReports(codeStr, (kind, res) => { if (dead) return; state[kind] = res; show(); }).catch((e) => { if (dead) return; Object.keys(TITLES).forEach((k) => { if (!state[k]) state[k] = { rows: [], tablesHtml: '', error: e.message }; }); show(); });
  await dialog({ title: 'گزارش‌های شهرداری مشهد', body, focus: false, buttons: [{ label: 'بستن', primary: true, value: true }] }); dead = true; return job;
}
function hookPopup() {
  if (!FM.map) return;
  FM.map.on('popupopen', (e) => {
    const rootEl = e.popup.getElement(); if (!rootEl) return;
    const btn = [...rootEl.querySelectorAll('.pop-btns button')].find((b) => /گزارش‌های شهرداری/.test(b.textContent)); if (!btn || btn.dataset.v5) return;
    const nu = btn.cloneNode(true); nu.dataset.v5 = '1'; btn.parentNode.replaceChild(nu, btn);
    nu.addEventListener('click', () => { const c = ((rootEl.querySelector('.nosazi') || {}).textContent || '').trim(); open(c); });
  });
}
hookPopup();
FM.reports = { open, fetchReports, parseCode, parseRows, sanitizeTables, buildParams, mergeCookies, splitSetCookie, _t: { fetchFormTokens, submit, grab, polyOk } };
})(window);
