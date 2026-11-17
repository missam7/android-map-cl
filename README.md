# نقشه میدانی — نسخه ۰٫۵ (کامل)

اپ اندروید مستقل (بدون سرور) با Capacitor. رابط داخل `www/` است و کتابخانه‌ها با `esbuild` از `src/` به `www/vendor.js` بسته‌بندی می‌شوند (در `npm install` خودکار).

## ساختار
- `www/` — رابط و منطق برنامه (`index.html`، `app.js`، `search.js`، `voice.js`، `geocode.js`، `localdata.js`، `reports.js`، `route.js`، `engine.js`، `traffic.js`، `lookup.js`، …)
- `www/data/layers.json` — فهرست لایه‌های GeoJSON داخل برنامه؛ فایل‌ها در `www/data/layers/`
- `www/defaults.js` — کلید نشان و توکن پارسل مشهد (**مخزن را حتماً Private نگه دارید**)
- `.github/workflows/build-apk.yml` — ساخت APK روی GitHub
- `tools/mvt2pack.mjs` — تبدیل تایل‌های ذخیره‌شده‌ی سحاک به GeoJSON

## امکانات
نوار جستجو (مکان، آدرس، کد نوسازی، مختصات، صدا)، دکمه‌ی اطلاعات ⓘ (استان، شهرستان، بخش، منطقه‌ی شهرداری، شهر، محله، خیابان)، ثبت نقطه با نگه‌داشتن انگشت، آدرس خودکار در توضیحات نقطه، پارسل مشهد و گزارش‌های شهرداری داخل برنامه، مسیریابی (نشان ← موتور داخلی ← OSRM) با حالت خودرو/موتور/پیاده، ترافیک گوگل، هدایت صوتی فارسی و انگلیسی، لایه‌های GeoJSON داخل برنامه بدون سرور، پروژه و خروجی KML/DXF/Shapefile/GPX/CSV/Excel.

## لایه‌های GeoJSON خودتان
فایل را در `www/data/layers/` بگذارید و در `www/data/layers.json` معرفی کنید (`file`، `name`، `cat`، `nameProp`، اختیاری: `strip`، `color`، `weight`، `fill`، `labelZoom`، `crs`). مقدار `cat`: `province`، `county`، `bakhsh`، `muni_region`، `muni_district`، `reg_zone`، `plaque`.

## ساخت APK
Actions ← Build APK ← Run workflow؛ فایل `fieldmap-debug-apk` را از Artifacts بگیرید.

## منابع
مرز استان‌ها (فایل پشتیبان `www/data/provinces.json`): © OpenStreetMap contributors، ODbL 1.0. جاده‌ها برای موتور داخلی: OpenStreetMap از طریق Overpass API.
