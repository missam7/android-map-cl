/* صدا: گوینده‌ی هدایت (فارسی و انگلیسی) و تشخیص گفتار برای جستجوی صوتی */
(function (root) {
'use strict';
const FM = root.FM || (root.FM = {});
const store = FM.store || { get: (k, d) => d, set() {} };
const Lb = () => root.Lib || {};
const LANGS = { fa: { code: 'fa-IR', name: 'فارسی', short: 'فا' }, en: { code: 'en-US', name: 'English', short: 'EN' } };
const lang = () => (store.get('voiceLang', 'fa') === 'en' ? 'en' : 'fa');
const setLang = (l) => { store.set('voiceLang', l === 'en' ? 'en' : 'fa'); document.querySelectorAll('[data-voice-lang]').forEach((b) => { b.textContent = LANGS[lang()].short; }); };
let warned = false;

/* ───── متن دستورها ───── */
const EN_MOD = { left: 'turn left', right: 'turn right', 'slight left': 'bear left', 'slight right': 'bear right', 'sharp left': 'turn sharp left', 'sharp right': 'turn sharp right', straight: 'continue straight', uturn: 'make a U-turn' };
function enInstr(type, mod, name, exit) {
  let t;
  switch (type) {
    case 'depart': t = 'Start driving'; break;
    case 'arrive': t = 'You have arrived at your destination'; break;
    case 'roundabout': case 'rotary': t = 'Enter the roundabout' + (exit ? ' and take exit ' + exit : ''); break;
    case 'exit roundabout': case 'exit rotary': t = 'Exit the roundabout'; break;
    case 'merge': t = 'Merge'; break;
    case 'on ramp': t = 'Take the ramp'; break;
    case 'off ramp': t = 'Take the exit ramp'; break;
    case 'fork': t = /left/.test(mod || '') ? 'Keep left at the fork' : 'Keep right at the fork'; break;
    case 'end of road': t = (EN_MOD[mod] || 'Turn') + ' at the end of the road'; break;
    case 'continue': case 'new name': t = 'Continue'; break;
    default: t = EN_MOD[mod] || 'Continue'; t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return name && /[A-Za-z]/.test(name) && type !== 'arrive' ? t + ' onto ' + name : t;
}
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
function distEn(m) { if (m >= 950) return (Math.round(m / 100) / 10) + ' kilometers'; return Math.max(10, Math.round(m / 10) * 10) + ' meters'; }
function distFa(m) { const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }); if (m >= 950) return nf.format(Math.round(m / 100) / 10) + ' کیلومتر'; return nf.format(Math.max(10, Math.round(m / 10) * 10)) + ' متر'; }

/* ───── گوینده ───── */
async function speak(text, l, enAlt) {
  l = l || lang(); if (!text) return false;
  const code = LANGS[l].code, T = Lb().TTS;
  if (T) {
    try {
      const sup = await T.isLanguageSupported({ lang: code });
      if (sup && sup.supported === false) throw new Error('unsupported');
      await T.stop().catch(() => {});
      await T.speak({ text, lang: code, rate: 1, pitch: 1, volume: 1, category: 'ambient' }); return true;
    } catch (e) {
      if (l === 'fa' && !warned) { warned = true; if (FM.toast) FM.toast('صدای فارسی روی گوشی نصب نیست؛ از تنظیمات گوشی ← Text-to-speech زبان فارسی را اضافه کنید. فعلاً هدایت انگلیسی می‌شود.', 8000); setLang('en'); return enAlt ? speak(enAlt, 'en') : false; }
    }
  }
  try { if (root.speechSynthesis) { root.speechSynthesis.cancel(); const u = new root.SpeechSynthesisUtterance(text); u.lang = code; root.speechSynthesis.speak(u); return true; } } catch (e) { /* ignore */ }
  return false;
}
// جمله‌ی ثابت به هر دو زبان؛ بر اساس زبان انتخاب‌شده خوانده می‌شود
const say2 = (fa, en) => speak(lang() === 'en' ? en : fa, lang(), en);
// گام مسیر: dm فاصله تا گردش (۰ یعنی همین الان)
function step(s, dm) {
  const l = lang();
  const te = s.en || enInstr(s.type, s.mod, s.name, s.exit), en = dm > 40 ? `In ${distEn(dm)}, ${lowerFirst(te)}` : te;
  if (l === 'en') return speak(en, 'en');
  const t = s.text || ''; return speak(dm > 40 ? `${distFa(dm)} دیگر، ${t}` : t, 'fa', en);
}
function stop() { try { if (Lb().TTS) Lb().TTS.stop(); } catch (e) { /* ignore */ } try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }

/* ───── تشخیص گفتار ───── */
async function listen(opts) {
  const l = (opts && opts.lang) || lang(), code = LANGS[l].code, SR = Lb().Speech;
  if (SR) {
    const perm = await SR.requestPermissions(); if (perm.speechRecognition !== 'granted') throw new Error('مجوز میکروفن داده نشد؛ از تنظیمات گوشی برای برنامه فعال کنید.');
    const av = await SR.available(); if (av && av.available === false) throw new Error('سرویس تشخیص گفتار (Google) روی این گوشی نصب یا فعال نیست.');
    const r = await SR.start({ language: code, maxResults: 3, prompt: l === 'fa' ? 'بگویید…' : 'Say something…', partialResults: false, popup: true });
    return (r && r.matches && r.matches[0]) || '';
  }
  const W = root.SpeechRecognition || root.webkitSpeechRecognition;
  if (W) return new Promise((res, rej) => { const r = new W(); r.lang = code; r.interimResults = false; r.maxAlternatives = 1; r.onresult = (e) => res(e.results[0][0].transcript); r.onerror = (e) => rej(new Error(e.error || 'خطا در تشخیص گفتار')); r.start(); });
  throw new Error('تشخیص گفتار در دسترس نیست.');
}

/* ───── استایل‌های افزونه‌ها (یک‌بار) ───── */
if (!document.getElementById('addons-css')) { const l = document.createElement('link'); l.id = 'addons-css'; l.rel = 'stylesheet'; l.href = 'addons.css'; document.head.appendChild(l); }

/* ───── دکمه‌ی زبان گوینده در هدایت ───── */
function addLangButton() {
  const side = document.querySelector('#nav-hud .nav-side'); if (!side || side.querySelector('[data-voice-lang]')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'langbtn'; b.setAttribute('data-voice-lang', '1'); b.setAttribute('aria-label', 'زبان گوینده'); b.textContent = LANGS[lang()].short;
  b.addEventListener('click', () => { setLang(lang() === 'fa' ? 'en' : 'fa'); say2('گوینده فارسی شد', 'Voice is now English'); });
  side.insertBefore(b, side.firstChild);
}
addLangButton();

FM.voice = { lang, setLang, speak, say2, step, stop, listen, enInstr, LANGS, distEn, distFa };
})(window);
