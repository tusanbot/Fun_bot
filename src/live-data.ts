interface LiveDataEnv {
  DB: D1Database;
  API_FOOTBALL_KEY?: string;
}

type MarketItem = {
  symbol?: string;
  name_fa?: string;
  price?: number;
  timestamp?: string;
  timestamp_jalali?: string;
  stale?: boolean;
  change_pct?: number | null;
  quality?: string[];
};
type MarketPayload = { data?: { generated_at_jalali?: string; categories?: Record<string, MarketItem[]> } };
type FootballFixture = {
  fixture?: { date?: string; status?: { short?: string; elapsed?: number | null } };
  league?: { name?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  goals?: { home?: number | null; away?: number | null };
};

const MARKET_URL = "https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json";
const FOOTBALL_URL = "https://v3.football.api-sports.io/fixtures?live=all";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value);
}
function isMarketQuestion(prompt: string): boolean {
  return /طلا|طلای|سکه|نیم.?سکه|ربع.?سکه|آبشده|گرم.?۱۸|۱۸.?عیار|قیمت.?بازار/i.test(prompt);
}
function isFootballQuestion(prompt: string): boolean {
  return /فوتبال|نتیجه.?بازی|بازی.?چند.?چنده|چند.?چند|اسکور|لایو.?اسکور|مسابقه|لیگ.?قهرمانان|پریمیر.?لیگ|رئال|بارسلونا|منچستر|استقلال|پرسپولیس|آرسنال|لیورپول/i.test(prompt);
}

async function getFootballCache<T>(env: LiveDataEnv): Promise<T | null> {
  try {
    const row = await env.DB.prepare(
      "SELECT setting_value, updated_at FROM bot_settings WHERE setting_key = ?",
    ).bind("live_data:football_fixtures").first<{ setting_value: string; updated_at: string }>();
    if (!row) return null;
    const age = Date.now() - new Date(row.updated_at.replace(" ", "T") + "Z").getTime();
    if (!Number.isFinite(age) || age < 0 || age > 15 * 60 * 1000) return null;
    return JSON.parse(row.setting_value) as T;
  } catch {
    return null;
  }
}
async function setFootballCache(env: LiveDataEnv, value: unknown): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO bot_settings(setting_key, setting_value, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at",
    ).bind("live_data:football_fixtures", JSON.stringify(value)).run();
  } catch {
    // Cache is an optimization; live answers still work if the settings table is unavailable.
  }
}

async function marketContext(): Promise<string> {
  const response = await fetch(MARKET_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Market feed HTTP " + response.status);
  const payload = await response.json() as MarketPayload;
  const items = Object.values(payload.data?.categories ?? {}).flat();
  const wanted: Array<[string, string]> = [
    ["GOLD_18K_IRR", "طلای ۱۸ عیار (هر گرم)"],
    ["COIN_EMAMI_IRR", "سکه امامی"],
    ["COIN_BAHAR_IRR", "سکه بهار آزادی"],
    ["COIN_HALF_IRR", "نیم‌سکه"],
    ["COIN_QUARTER_IRR", "ربع‌سکه"],
    ["COIN_GRAMI_IRR", "سکه گرمی"],
  ];
  const lines: string[] = [];
  for (const [symbol, label] of wanted) {
    const item = items.find((candidate) => candidate.symbol === symbol);
    const priceAge = item.timestamp ? Date.now() - Date.parse(item.timestamp) : Number.POSITIVE_INFINITY;
    if (!item || typeof item.price !== "number" || item.price <= 0 || item.stale === true ||
        (item.quality ?? []).includes("stale") || !Number.isFinite(priceAge) || priceAge < 0 || priceAge > 48 * 60 * 60 * 1000) continue;
    const timestamp = item.timestamp_jalali || item.timestamp || "زمان نامشخص";
    const change = typeof item.change_pct === "number"
      ? "؛ تغییر: " + (item.change_pct > 0 ? "+" : "") + formatNumber(item.change_pct) + "٪"
      : "";
    lines.push("- " + label + ": " + formatNumber(item.price) + " تومان" + change + " (ثبت قیمت: " + timestamp + ")");
  }
  if (!lines.length) {
    return "داده قیمت بازار ایران دریافت شد، اما هیچ نرخ معتبر و تازه‌ای برای نمایش پیدا نشد. عددی حدس نزن و صادقانه اعلام کن که قیمت قابل‌تأیید در دسترس نیست.";
  }
  return [
    "داده ساختاریافته قیمت بازار ایران (منبع: Iran Market Data؛ منبع داده بازار TGJU):",
    ...lines,
    "زمان تولید داده منبع: " + (payload.data?.generated_at_jalali ?? "نامشخص"),
    "قیمت‌ها به تومان هستند. زمان ثبت هر نرخ را جداگانه بررسی کن؛ داده را لحظه‌ای ننام. اگر کاربر درباره خرید زیورآلات پرسید، توضیح بده که اجرت، سود و مالیات در این نرخ پایه لحاظ نشده‌اند.",
    "منبع: https://iran-market.github.io/",
  ].join("\n");
}

async function footballContext(env: LiveDataEnv): Promise<string> {
  if (!env.API_FOOTBALL_KEY) {
    return "کاربر درباره نتیجه فوتبال یا مسابقه زنده پرسیده، اما API_FOOTBALL_KEY هنوز در تنظیمات Worker ثبت نشده است. نتیجه یا امتیاز را حدس نزن؛ کوتاه بگو برای دریافت نتیجه زنده باید کلید API-Football تنظیم شود.";
  }
  let fixtures = await getFootballCache<FootballFixture[]>(env);
  if (!fixtures) {
    const response = await fetch(FOOTBALL_URL, {
      headers: { "x-apisports-key": env.API_FOOTBALL_KEY, accept: "application/json" },
    });
    if (!response.ok) throw new Error("Football feed HTTP " + response.status);
    const payload = await response.json() as { response?: FootballFixture[]; errors?: unknown };
    fixtures = payload.response ?? [];
    await setFootballCache(env, fixtures);
  }
  if (!fixtures.length) {
    return "API-Football گزارش کرده که در داده فعلی مسابقه زنده‌ای وجود ندارد. اگر کاربر درباره مسابقه مشخصی پرسیده، از او نام تیم یا لیگ را بپرس یا بگو مسابقه زنده‌ای در فهرست فعلی نیست.";
  }
  const lines = fixtures.slice(0, 30).map((item) => {
    const home = item.teams?.home?.name ?? "تیم میزبان";
    const away = item.teams?.away?.name ?? "تیم میهمان";
    const homeGoals = item.goals?.home;
    const awayGoals = item.goals?.away;
    const score = homeGoals == null || awayGoals == null ? "بدون نتیجه ثبت‌شده" : formatNumber(homeGoals) + " - " + formatNumber(awayGoals);
    const minute = item.fixture?.status?.elapsed;
    const status = minute == null ? (item.fixture?.status?.short ?? "وضعیت نامشخص") : "دقیقه " + formatNumber(minute);
    return "- " + home + " " + score + " " + away + " | " + (item.league?.name ?? "لیگ نامشخص") + " | " + status;
  });
  return [
    "نتایج مسابقات زنده از API-Football (داده ممکن است به‌علت سهمیه رایگان و کش ۱۵ دقیقه‌ای با تأخیر باشد):",
    ...lines,
    "اگر کاربر نام تیم خاصی را گفته، فقط مسابقه‌های مرتبط را انتخاب کن. اگر تیم در فهرست نیست، ادعا نکن که بازی ندارد؛ بگو در فهرست فعلی پیدا نشد.",
    "منبع: https://www.api-football.com/",
  ].join("\n");
}

export async function fetchLiveDataContext(prompt: string, env: LiveDataEnv): Promise<string> {
  const sections: string[] = [];
  if (isMarketQuestion(prompt)) {
    try {
      sections.push(await marketContext());
    } catch {
      sections.push("دریافت قیمت بازار ایران ناموفق بود. قیمت را حدس نزن؛ بگو سرویس قیمت فعلاً در دسترس نیست.");
    }
  }
  if (isFootballQuestion(prompt)) {
    try {
      sections.push(await footballContext(env));
    } catch {
      sections.push("دریافت نتیجه فوتبال از API ناموفق بود. نتیجه یا وضعیت زنده را حدس نزن و بگو سرویس نتیجه فعلاً در دسترس نیست.");
    }
  }
  return sections.join("\n\n");
}
