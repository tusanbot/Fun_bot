interface LiveDataEnv {
  DB: D1Database;
  MAJID_API_TOKEN?: string;
}

type Intent = { key: string; label: string; path: string; cacheSeconds: number };

const API_BASE = "https://api.majidapi.ir";

function getIntent(prompt: string): Intent | null {
  const text = prompt.toLowerCase();
  const mobile = text.match(/(?:قیمت|نرخ)\s*(?:گوشی|موبایل)\s+(.+)/i);
  if (mobile) return { key: "mobile:" + mobile[1].trim().slice(0, 60), label: "قیمت موبایل", path: "/price/mobile?model=" + encodeURIComponent(mobile[1].trim().slice(0, 60)), cacheSeconds: 600 };

  const titleMatch = text.match(/(?:جستجوی?\s*)?(?:فیلم|سریال)\s+(?:به نام\s+)?(.{2,80})/i);
  if (titleMatch && !/چی پیشنهاد|چه فیلم|چه سریال|قیمت|و سریال/i.test(titleMatch[1])) return { key: "movie:" + titleMatch[1].trim(), label: "جست‌وجوی فیلم و سریال", path: "/movie/movie4?action=search&s=" + encodeURIComponent(titleMatch[1].trim()) + "&page=1", cacheSeconds: 1800 };
  const musicSearch = text.match(/(?:جستجوی?\s*)?(?:آهنگ|موزیک|موسیقی)\s+(?:از|به نام|برای)?\s*(.{2,80})/i);
  if (musicSearch && !/یاب|تشخیص|اسم این|چی پیشنهاد/i.test(musicSearch[1])) return { key: "music:search:" + musicSearch[1].trim(), label: "جست‌وجوی موسیقی", path: "/soundcloud/search?s=" + encodeURIComponent(musicSearch[1].trim()), cacheSeconds: 1800 };
  const imageLink = text.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.]+$/, "");
  if (/جیبلی|ghibli/i.test(text) && imageLink) return { key: "image:ghibli:" + imageLink, label: "تبدیل عکس به جیبلی", path: "/ai/ghibli?url=" + encodeURIComponent(imageLink), cacheSeconds: 3600 };
  if (/استخراج متن از عکس|متن داخل عکس|ocr/i.test(text) && imageLink) return { key: "image:ocr:" + imageLink, label: "استخراج متن از عکس", path: "/tools/extract-image-text?image=" + encodeURIComponent(imageLink), cacheSeconds: 3600 };
  if (/اخبار.?فوتبالی|خبر.?فوتبال|اخبار.?ورزشی/i.test(text)) return { key: "footballi:news", label: "اخبار فوتبالی", path: "/footballi?action=news", cacheSeconds: 600 };
  if (/ورزش\s*3|ورزش سه|varzesh3/i.test(text)) return { key: "varzesh3:live", label: "نتایج زنده ورزش سه", path: "/varzesh3?action=liveScore", cacheSeconds: 90 };
  if (/فوتبال\s*360|football\s*360/i.test(text)) return { key: "football360:live", label: "فوتبال ۳۶۰", path: "/football360?action=live", cacheSeconds: 90 };
  if (/فوتبال|نتیجه.?بازی|بازی.?چند.?چنده|چند.?چند|اسکور|مسابقه زنده|لیگ قهرمانان|پریمیر لیگ|رئال|بارسلونا|منچستر|استقلال|پرسپولیس|آرسنال|لیورپول/i.test(text)) return { key: "football360:live", label: "نتایج زنده فوتبال ۳۶۰", path: "/football360?action=live", cacheSeconds: 90 };


  if (/اخبار|خبرهای|آخرین خبر/i.test(text)) return { key: "news:latest", label: "آخرین اخبار", path: "/news/akharinkhabar?action=latest&page=1", cacheSeconds: 600 };
  if (/مناسبت.?های ماه|مناسبت.?های این ماه|مناسبت.?ماه/i.test(text)) return { key: "occasions:month", label: "مناسبت‌های ماه", path: "/tools/occasions", cacheSeconds: 3600 };
  if (/قیمت.?طلا|طلای ۱۸|طلای 18|سکه|قیمت.?بازار طلا/i.test(text)) return { key: "prices:gold", label: "قیمت طلا و سکه", path: "/prices?action=gold", cacheSeconds: 300 };
  if (/قیمت.?ارز|نرخ.?ارز|دلار|یورو|پوند|درهم/i.test(text)) return { key: "prices:currency", label: "نرخ ارز", path: "/prices?action=currency", cacheSeconds: 300 };
  if (/قیمت.?رمزارز|قیمت.?ارز.?دیجیتال|بیت.?کوین|اتریوم|قیمت.?کریپتو/i.test(text)) return { key: "prices:crypto", label: "قیمت رمزارزها", path: "/prices?action=crypto", cacheSeconds: 300 };
  if (/قیمت.?خودرو|قیمت.?ماشین|قیمت.?خودروها/i.test(text)) return { key: "prices:car", label: "قیمت خودرو", path: "/prices?action=car", cacheSeconds: 600 };
  if (/آب.?و.?هوا|هواشناسی|هوای\s+/i.test(text)) {
    const cities: Record<string, string> = { تهران: "tehran", تبریز: "tabriz", مراغه: "maragheh", ارومیه: "urmia", باکو: "baku", مشهد: "mashhad", اصفهان: "isfahan", شیراز: "shiraz", کرج: "karaj", قم: "qom", رشت: "rasht", اردبیل: "ardabil", زنجان: "zanjan", اهواز: "ahvaz", استانبول: "istanbul", برلین: "berlin" };
    const city = Object.keys(cities).find((name) => text.includes(name)) ?? "تهران";
    return { key: "weather:" + cities[city], label: "آب‌وهوای " + city, path: "/tools/weather?city=" + cities[city], cacheSeconds: 900 };
  }
  if (/فال قهوه|قهوه سه نشان/i.test(text)) return { key: "fun:coffee", label: "فال قهوه سه نشان", path: "/fun/fal/coffee", cacheSeconds: 3600 };

  if (/تاروت|فال تاروت/i.test(text)) return { key: "fun:tarot", label: "فال تاروت", path: "/fun/taroot", cacheSeconds: 3600 };
  if (/معما|چیستان|معمایی/i.test(text)) return { key: "fun:riddle", label: "معما و چیستان", path: "/fun/moama", cacheSeconds: 3600 };
  if (/شعر|شعر رندوم|یک شعر/i.test(text)) return { key: "fun:poem", label: "شعر", path: "/fun/poem", cacheSeconds: 3600 };
  if (/فال حافظ|دیوان حافظ|غزل حافظ/i.test(text)) return { key: "fun:hafez", label: "دیوان حافظ", path: "/fun/divan-hafez?no=1", cacheSeconds: 3600 };
  if (/فال ابجد/i.test(text)) return { key: "fun:abjad", label: "فال ابجد", path: "/fun/fal/abjad", cacheSeconds: 3600 };
  if (/پروکسی سالم|لیست پروکسی|پروکسی تلگرام/i.test(text)) return { key: "tools:proxies", label: "فهرست پروکسی تلگرام", path: "/tools/proxies", cacheSeconds: 900 };
  if (/کانفیگ.?vless|کانفیگ.?vmess/i.test(text)) return { key: "tools:configs", label: "فهرست کانفیگ‌ها", path: "/tools/configs", cacheSeconds: 900 };
  const musicUrl = text.match(/https?:\/\/\S+/i)?.[0];
  if (/تشخیص موزیک|شازم|آهنگ.?یاب|اسم این آهنگ/i.test(text) && musicUrl) return { key: "music:recognition:" + musicUrl, label: "تشخیص موزیک", path: "/music/recognition?url=" + encodeURIComponent(musicUrl), cacheSeconds: 3600 };
  return null;
}

function ageSeconds(updatedAt: string): number {
  const timestamp = Date.parse(updatedAt.replace(" ", "T") + "Z");
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 1000) : Number.POSITIVE_INFINITY;
}

async function readCache(env: LiveDataEnv, key: string, ttl: number): Promise<unknown | null> {
  try {
    const row = await env.DB.prepare("SELECT setting_value, updated_at FROM bot_settings WHERE setting_key = ?")
      .bind("majidapi:cache:" + key).first<{ setting_value: string; updated_at: string }>();
    if (!row || ageSeconds(row.updated_at) > ttl) return null;
    return JSON.parse(row.setting_value) as unknown;
  } catch {
    return null;
  }
}

async function writeCache(env: LiveDataEnv, key: string, value: unknown): Promise<void> {
  try {
    await env.DB.prepare("INSERT INTO bot_settings(setting_key, setting_value, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=datetime('now')")
      .bind("majidapi:cache:" + key, JSON.stringify(value)).run();
  } catch {
    // The API response remains usable even if caching is unavailable.
  }
}

async function acquireGlobalSlot(env: LiveDataEnv): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      "INSERT INTO bot_settings(setting_key, setting_value, updated_at) VALUES('majidapi:last_request', ?, datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=datetime('now') WHERE datetime(bot_settings.updated_at, '+60 seconds') <= datetime('now')",
    ).bind(String(Date.now())).run();
    return (result.meta?.changes ?? 0) > 0;
  } catch {
    // Fail closed to avoid exhausting the provider's published free-tier quota.
    return false;
  }
}

function compactPayload(value: unknown): string {
  let serialized: string;
  try { serialized = JSON.stringify(value, null, 2); } catch { serialized = String(value); }
  return serialized.length > 6500 ? serialized.slice(0, 6500) + "\n[ادامه پاسخ منبع به‌دلیل محدودیت طول حذف شد]" : serialized;
}

async function requestMajid(env: LiveDataEnv, intent: Intent): Promise<string> {
  const cached = await readCache(env, intent.key, intent.cacheSeconds);
  if (cached !== null) {
    return "منبع: Majid API | سرویس: " + intent.label + " | داده کش‌شده\n" + compactPayload(cached);
  }
  if (!env.MAJID_API_TOKEN) {
    return "برای دریافت " + intent.label + "، توکن Majid API هنوز در Cloudflare Worker با نام MAJID_API_TOKEN تنظیم نشده است. قیمت یا نتیجه را حدس نزن؛ از کاربر بخواه بعد از تنظیم توکن دوباره تلاش کند.";
  }
  if (!await acquireGlobalSlot(env)) {
    return "درخواست جدید به Majid API فعلاً به‌دلیل محدودیت پلن رایگان (یک درخواست در دقیقه) ارسال نشد. داده کش‌شده موجود نبود؛ به کاربر بگو حدود یک دقیقه دیگر دوباره تلاش کند.";
  }
  const url = new URL(intent.path, API_BASE);
  url.searchParams.set("token", env.MAJID_API_TOKEN);
  const response = await fetch(url.toString(), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("Majid API HTTP " + response.status);
  const payload: unknown = await response.json();
  await writeCache(env, intent.key, payload);
  return "منبع: Majid API | سرویس: " + intent.label + "\nداده خام JSON زیر را خلاصه کن و فقط واقعیت‌های موجود را گزارش بده؛ زمان و واحد را اگر در خروجی آمده ذکر کن.\n" + compactPayload(payload);
}

export async function fetchLiveDataContext(prompt: string, env: LiveDataEnv): Promise<string> {
  const intent = getIntent(prompt);
  if (!intent) return "";
  try {
    return await requestMajid(env, intent);
  } catch (error) {
    console.warn("Majid API request failed", error instanceof Error ? error.message : "unknown error");
    return "دریافت اطلاعات از Majid API برای «" + intent.label + "» ناموفق بود. داده زنده یا قیمت را حدس نزن؛ صادقانه اعلام کن سرویس فعلاً در دسترس نیست.";
  }
}
