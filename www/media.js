(function (root) {
'use strict';
const FM = root.FM, { el, toast, dialog } = FM;
/* ذخیره‌ی فایل‌ها */
let dbp = null;
const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('fieldmap-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('m', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const rq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const put = async (m) => rq((await open()).transaction('m', 'readwrite').objectStore('m').put(m));
const get = async (id) => rq((await open()).transaction('m').objectStore('m').get(id));
/* موقعیت */
function pos() {
  return new Promise((res) => {
    const g = FM.gps && FM.gps.last && FM.gps.last(), la = g && (g.lat != null ? g.lat : g.latitude), ln = g && (g.lng != null ? g.lng : (g.lon != null ? g.lon : g.longitude));
    const fb = () => { const c = FM.map.getCenter(); res({ lat: c.lat, lng: c.lng, src: 'map' }); };
    if (isFinite(la) && isFinite(ln)) return res({ lat: +la, lng: +ln, src: 'gps' });
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, src: 'gps' }), fb, { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }); else fb();
  });
}
const toB64 = (blob) => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1]); f.onerror = () => rej(f.error); f.readAsDataURL(blob); });
async function share(m) {
  const ext = /mp4/.test(m.type) ? 'mp4' : /webm/.test(m.type) ? 'webm' : /png/.test(m.type) ? 'png' : 'jpg';
  const name = (m.kind === 'photo' ? 'IMG_' : 'VID_') + new Date(m.time).toISOString().replace(/[:.]/g, '-') + '.' + ext, Lb = root.Lib;
  try {
    if (!Lb || !Lb.Filesystem || !Lb.Share) throw new Error('web');
    const r = await Lb.Filesystem.writeFile({ path: 'exports/' + name, data: await toB64(m.blob), directory: Lb.Directory.Cache, recursive: true });
    await Lb.Share.share({ title: name, url: r.uri, dialogTitle: 'ذخیره یا ارسال' });
  } catch (e) {
    if (e && /cancel/i.test(String(e.message))) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(m.blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
}
/* نمایش داخل پاپ‌آپ نقطه (از project.js صدا زده می‌شود) */
function thumb(id) {
  const w = el('div', { class: 'media-box' });
  get(id).then((m) => {
    if (!m) { w.textContent = 'فایل رسانه روی این گوشی پیدا نشد.'; return; }
    const u = URL.createObjectURL(m.blob), st = 'width:100%;max-height:34vh;object-fit:contain;border-radius:10px;background:#000';
    const n = m.kind === 'photo' ? el('img', { src: u, style: st }) : el('video', { src: u, controls: '', playsinline: '', style: st });
    n.addEventListener(m.kind === 'photo' ? 'load' : 'loadedmetadata', () => { if (FM.map._popup) FM.map._popup.update(); });
    w.appendChild(n);
    const b = el('button', { type: 'button', class: 'mini2', text: 'ارسال / ذخیره‌ی فایل' }); b.addEventListener('click', () => share(m)); w.appendChild(b);
  }).catch(() => { w.textContent = 'خواندن فایل ممکن نشد.'; });
  return w;
}
/* پس از ثبت: مرور + توضیحات + ذخیره */
async function review(blob, kind, p) {
  const u = URL.createObjectURL(blob), st = 'width:100%;max-height:40vh;object-fit:contain;border-radius:12px;background:#000';
  const prev = kind === 'photo' ? el('img', { src: u, style: st }) : el('video', { src: u, controls: '', playsinline: '', style: st });
  const nm = el('input', { type: 'text', class: 'field', placeholder: 'نام (اختیاری)' });
  const ds = el('textarea', { class: 'field', rows: 3, placeholder: 'توضیحات…' });
  const info = el('div', { class: 'hint', dir: 'ltr', text: p.lat.toFixed(6) + ', ' + p.lng.toFixed(6) + (p.src === 'map' ? '  (GPS در دسترس نبود؛ مرکز نقشه)' : '') });
  const r = await dialog({ title: kind === 'photo' ? 'ثبت عکس' : 'ثبت فیلم', body: el('div', {}, [prev, info, nm, ds]), focus: false, buttons: [{ label: 'دور انداختن', value: false }, { label: 'ذخیره', primary: true, value: true }] });
  URL.revokeObjectURL(u); if (!r) return;
  const id = FM.uid(), time = Date.now();
  try { await put({ id, kind, type: blob.type, blob, time, lat: p.lat, lng: p.lng, caption: ds.value.trim() }); } catch (e) { toast('ذخیره‌ی فایل روی گوشی ممکن نشد: ' + e.message, 6000); return; }
  const props = { name: nm.value.trim() || FM.project.nextName(kind === 'photo' ? 'IMG' : 'VID'), mediaId: id, mediaType: kind, symbol: 'pin', 'marker-color': kind === 'photo' ? '#1f77b4' : '#d62728', time: new Date(time).toLocaleString('fa-IR') };
  if (ds.value.trim()) props.description = ds.value.trim();
  FM.project.addFeature({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } });
  FM.map.setView([p.lat, p.lng], Math.max(FM.map.getZoom(), 18)); toast('ثبت شد و روی نقشه علامت خورد.');
}
/* راه جایگزین: دوربین سیستم */
function fileCapture(kind) {
  const i = el('input', { type: 'file', accept: kind === 'photo' ? 'image/*' : 'video/*', capture: 'environment' });
  i.addEventListener('change', async () => { const f = i.files && i.files[0]; if (!f) return; const p = await pos(); review(f, kind, p); });
  i.click();
}
/* دوربین داخل برنامه */
async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !root.MediaRecorder) {
    const r = await dialog({ title: 'دوربین', body: '<p>دوربین داخلی در این گوشی در دسترس نیست. با دوربین سیستم ثبت شود؟</p>', buttons: [{ label: 'عکس', value: 'photo' }, { label: 'فیلم', value: 'video' }, { label: 'بستن', value: null }] });
    if (r) fileCapture(r); return;
  }
  let stream = null, facing = 'environment', rec = null, chunks = [], t0 = 0, tick = null;
  const ov = el('div', { class: 'overlay' }), box = el('div', { class: 'modal' });
  const vid = el('video', { autoplay: '', playsinline: '', style: 'width:100%;max-height:55vh;background:#000;border-radius:14px' }); vid.muted = true;
  const info = el('div', { class: 'hint', text: 'در حال باز کردن دوربین…' });
  const bShot = el('button', { type: 'button', class: 'primary', text: '📷 عکس' }), bRec = el('button', { type: 'button', text: '⏺ شروع فیلم' }), bFlip = el('button', { type: 'button', text: '🔄' }), bX = el('button', { type: 'button', text: 'بستن' });
  const row = el('div', { class: 'row modal-btns' }, [bX, bFlip, bRec, bShot]);
  box.appendChild(el('h2', { text: 'دوربین میدانی' })); box.appendChild(vid); box.appendChild(info); box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
  const stop = () => { clearInterval(tick); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
  const close = () => { stop(); ov.remove(); };
  async function start() {
    stop();
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true }); }
    catch (e1) { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } }); info.textContent = 'میکروفن در دسترس نیست؛ فیلم بدون صدا ضبط می‌شود.'; } catch (e2) { close(); toast('اجازه‌ی دوربین داده نشد یا دوربین در دسترس نیست: ' + e2.message, 6000); return false; } }
    vid.srcObject = stream; try { await vid.play(); } catch (e) { /* ignore */ }
    if (!info.textContent.startsWith('میکروفن')) info.textContent = 'آماده'; return true;
  }
  bX.addEventListener('click', () => { if (rec && rec.state === 'recording') { rec.onstop = null; rec.stop(); } close(); });
  bFlip.addEventListener('click', async () => { if (rec) return; facing = facing === 'environment' ? 'user' : 'environment'; await start(); });
  bShot.addEventListener('click', async () => {
    if (rec || !stream || !vid.videoWidth) return;
    const cv = document.createElement('canvas'); cv.width = vid.videoWidth; cv.height = vid.videoHeight; cv.getContext('2d').drawImage(vid, 0, 0);
    const p = await pos(); cv.toBlob((b) => { close(); if (b) review(b, 'photo', p); }, 'image/jpeg', 0.9);
  });
  bRec.addEventListener('click', async () => {
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    if (!stream) return;
    const mt = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) => root.MediaRecorder.isTypeSupported(t)) || '';
    const p = await pos(); chunks = [];
    try { rec = new root.MediaRecorder(stream, mt ? { mimeType: mt } : undefined); } catch (e) { toast('ضبط فیلم در این گوشی پشتیبانی نمی‌شود: ' + e.message, 6000); return; }
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => { const b = new Blob(chunks, { type: rec.mimeType || mt || 'video/webm' }); close(); review(b, 'video', p); };
    rec.start(1000); t0 = Date.now(); bRec.textContent = '⏹ پایان فیلم'; bShot.disabled = true; bFlip.disabled = true;
    tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); info.textContent = '🔴 در حال ضبط ' + FM.nf(Math.floor(s / 60)) + ':' + String(s % 60).padStart(2, '0'); }, 500);
  });
  await start();
}
function mount() {
  const sh = document.getElementById('sheet-draw'); if (!sh || document.getElementById('d-camera')) return;
  const b = el('button', { type: 'button', id: 'd-camera', class: 'link', text: '📷 دوربین: عکس / فیلم در موقعیت فعلی' });
  b.addEventListener('click', openCamera);
  sh.appendChild(el('div', { class: 'sec' }, [el('h3', { text: 'عکس و فیلم میدانی' }), b, el('p', { class: 'hint', text: 'عکس یا فیلم با موقعیت لحظه‌ی ثبت، روی نقشه نقطه می‌شود و توضیحات شما همراهش ذخیره می‌شود.' })]));
}
mount(); window.addEventListener('load', mount);
FM.media = { open: openCamera, thumb, get };
})(window);
