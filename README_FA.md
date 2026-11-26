# Emotion AI Mini App — Cloudflare
## وضعیت
HTML به Mini App متصل شده، Worker برای API و تاریخچه D1 اضافه شده است. **اتصال نهایی مدل هوش مصنوعی نیازمند انتخاب Provider و تنظیم endpoint/key است.**

## قرارداد API مدل
Worker صوت را به صورت multipart با فیلد `file` و Bearer API key ارسال می‌کند. پاسخ مدل باید چنین باشد:
`{"emotions":[{"name":"شادی","score":0.82,"emoji":"😊"},{"name":"غم","score":0.18,"emoji":"😢"}]}`
scoreها عدد مثبت هستند؛ درصدهای UI سهم نسبی خروجی‌اند، نه accuracy.

## Deploy
1. `npm install`
2. `npx wrangler login`
3. `npx wrangler d1 create emotion-ai-history` و مقدار database_id را در wrangler.toml جایگزین کنید.
4. `npx wrangler d1 migrations apply emotion-ai-history --remote`
5. `npx wrangler secret put BOT_TOKEN` و `npx wrangler secret put AI_API_KEY`
6. در Cloudflare Worker Variables مقدار `AI_API_URL` را تنظیم کنید.
7. `npm run deploy`
8. آدرس HTTPS را در BotFather به عنوان Mini App / Menu Button ثبت کنید و از داخل تلگرام تست کنید.

فایل صوتی در D1 ذخیره نمی‌شود؛ فقط برای درخواست مدل ارسال می‌شود. تاریخچه‌ی نتیجه، شناسه کاربر، نام فایل و زمان در D1 ثبت می‌شود. `/api/history` تاریخچه‌ی کاربر احراز هویت‌شده را برمی‌گرداند.
