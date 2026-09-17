// ===========================================================================
//  MARKET RATES — Scriptable Home Screen widget
//  5Y / 7Y / 10Y Treasury + SOFR, for commercial real estate.
//  Built for the small (2x2) size; medium and large also work.
//
//  SETUP: none required. No API key needed — it reads FRED's public CSV
//  download endpoint. If you ever want to use the official keyed FRED API
//  instead, paste your key into FRED_API_KEY below (free key from
//  https://fredaccount.stlouisfed.org/apikey). Leaving it blank is fine.
// ===========================================================================

const CONFIG = {
  // Optional. Leave "" to use the no-key FRED CSV endpoint.
  FRED_API_KEY: "",

  // Show the day-over-day move in basis points next to each rate.
  SHOW_CHANGE: true,

  // true  = rising rates shown in red (a borrower's view)
  // false = rising rates shown in green (a trader's view)
  UP_IS_BAD: true,

  // What tapping the widget does:
  //   "refresh" — re-runs the script and shows the newest numbers. Needs the
  //               widget's own "When Interacting" setting to be "Run Script"
  //               (step 6 of the README).
  //   "fred"    — opens the FRED chart page in Safari instead.
  //   "none"    — nothing.
  TAP_ACTION: "refresh",
  FRED_URL: "https://fred.stlouisfed.org/graph/?id=DGS5,DGS7,DGS10,SOFR",

  // How often iOS is asked to refresh, as a hint it is free to ignore.
  // "auto" aims the checks at the windows when new numbers actually post;
  // a number forces that many minutes instead.
  REFRESH: "auto",

  CACHE_FILE: "market-rates-cache.json",
  TIMEOUT_SECONDS: 15,
  // A widget is killed long before 15s, so it gets a tighter budget and falls
  // back to the saved copy instead of being cut off mid-request.
  WIDGET_TIMEOUT_SECONDS: 6,
};

const SERIES = [
  { id: "DGS5", label: "Treasury 5-Year", short: "5-Year" },
  { id: "DGS7", label: "Treasury 7-Year", short: "7-Year" },
  { id: "DGS10", label: "Treasury 10-Year", short: "10-Year" },
  { id: "SOFR", label: "SOFR", short: "SOFR" },
];

const TREASURY_IDS = ["DGS5", "DGS7", "DGS10"];

const COLORS = {
  text: Color.dynamic(new Color("#0B0B0F"), new Color("#F2F2F5")),
  dim: Color.dynamic(new Color("#6B7280"), new Color("#8A8F9A")),
  faint: Color.dynamic(new Color("#9AA0AA"), new Color("#6E727B")),
  good: Color.dynamic(new Color("#1B8A4B"), new Color("#4ADE80")),
  bad: Color.dynamic(new Color("#C0392B"), new Color("#F87171")),
  warn: Color.dynamic(new Color("#B45309"), new Color("#FBBF24")),
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function timeoutSeconds() {
  return config.runsInWidget ? CONFIG.WIDGET_TIMEOUT_SECONDS : CONFIG.TIMEOUT_SECONDS;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Parses a numeric cell. FRED writes "." for holidays/missing days.
function num(raw) {
  if (raw === null || raw === undefined) return null;
  const t = String(raw).trim().replace(/^"|"$/g, "");
  if (t === "" || t === "." || t === "ND" || t === "N/A" || t === "NA") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

// Builds a local-time Date. Never use new Date("2026-09-15") directly — that
// is parsed as UTC midnight and displays as the previous day in US timezones.
function parseDateLoose(raw) {
  if (!raw) return null;
  const t = String(raw).trim().replace(/^"|"$/g, "");
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvRows(text) {
  const lines = String(text)
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("CSV had no data rows");
  return { header: parseCsvLine(lines[0]), rows: lines.slice(1).map(parseCsvLine) };
}

// Takes observations in any order, returns the latest valid one plus the one
// before it — that pairing is what gives us "latest available" behaviour over
// weekends and holidays, and the basis-point change.
function toRate(points) {
  const pts = points
    .filter((p) => p && p.date && p.value !== null && p.value !== undefined)
    .sort((a, b) => a.date - b.date);
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : null;
  return { value: last.value, date: last.date.getTime(), prev: prev ? prev.value : null };
}

async function getString(url) {
  const req = new Request(url);
  req.timeoutInterval = timeoutSeconds();
  req.headers = { "User-Agent": "Scriptable Market Rates Widget" };
  return await req.loadString();
}

async function getJson(url) {
  const req = new Request(url);
  req.timeoutInterval = timeoutSeconds();
  req.headers = { Accept: "application/json", "User-Agent": "Scriptable Market Rates Widget" };
  return await req.loadJSON();
}

// ---------------------------------------------------------------------------
// Data sources, in order of preference
// ---------------------------------------------------------------------------

// 1a. Official FRED API. Only used when a key is pasted above.
async function fetchFredApi(key) {
  const entries = await Promise.all(
    SERIES.map(async (s) => {
      const url =
        "https://api.stlouisfed.org/fred/series/observations" +
        `?series_id=${s.id}&api_key=${encodeURIComponent(key)}` +
        "&file_type=json&sort_order=desc&limit=20";
      try {
        const json = await getJson(url);
        const pts = (json.observations || []).map((o) => ({
          value: num(o.value),
          date: parseDateLoose(o.date),
        }));
        return [s.id, toRate(pts)];
      } catch (e) {
        return [s.id, null];
      }
    })
  );
  return Object.fromEntries(entries.filter(([, r]) => r));
}

// 1b. FRED's public CSV download — all four series, one request, no key.
async function fetchFredCsv() {
  const start = new Date();
  start.setDate(start.getDate() - 20);
  const cosd = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
  const url =
    "https://fred.stlouisfed.org/graph/fredgraph.csv" +
    `?id=${SERIES.map((s) => s.id).join(",")}&cosd=${cosd}`;

  const lines = (await getString(url)).trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV had no data rows");

  const header = parseCsvLine(lines[0]).map((h) => h.toUpperCase());
  const cols = {};
  for (const s of SERIES) {
    const col = header.indexOf(s.id);
    if (col >= 0) cols[s.id] = col;
  }
  const ids = Object.keys(cols);

  // Read newest-first and stop as soon as every series has the two
  // observations it needs. If FRED ignores the start date it answers with
  // decades of history, which a widget does not have the memory to walk.
  const found = {};
  for (const id of ids) found[id] = [];
  for (let i = lines.length - 1; i > 0; i--) {
    if (ids.every((id) => found[id].length >= 2)) break;
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i]);
    const date = parseDateLoose(cells[0]);
    if (!date) continue;
    for (const id of ids) {
      if (found[id].length >= 2) continue;
      const value = num(cells[cols[id]]);
      if (value !== null) found[id].push({ value, date });
    }
  }

  const out = {};
  for (const id of ids) {
    const rate = toRate(found[id]);
    if (rate) out[id] = rate;
  }
  return out;
}

// 2. Treasury's own daily yield curve, as a backstop for 5Y/7Y/10Y.
async function fetchTreasury() {
  const wanted = { "5 YR": "DGS5", "7 YR": "DGS7", "10 YR": "DGS10" };
  const thisYear = new Date().getFullYear();
  // Early in January the current year's file can still be empty.
  for (const year of [thisYear, thisYear - 1]) {
    try {
      const url =
        "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/" +
        `daily-treasury-rates.csv/${year}/all` +
        `?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
      const { header, rows } = csvRows(await getString(url));
      const upper = header.map((h) => h.toUpperCase().replace(/\s+/g, " ").trim());
      const out = {};
      for (const [colName, id] of Object.entries(wanted)) {
        const col = upper.indexOf(colName);
        if (col < 0) continue;
        const rate = toRate(
          rows.map((r) => ({ value: num(r[col]), date: parseDateLoose(r[0]) }))
        );
        if (rate) out[id] = rate;
      }
      if (Object.keys(out).length) return out;
    } catch (e) {
      // try the previous year, then give up on this source
    }
  }
  return {};
}

// 3. The New York Fed publishes SOFR itself — backstop for the SOFR tile.
async function fetchSofrNyFed() {
  const json = await getJson("https://markets.newyorkfed.org/api/rates/secured/sofr/last/5.json");
  const pts = (json.refRates || [])
    .filter((r) => String(r.type || "").toUpperCase() === "SOFR")
    .map((r) => ({ value: num(r.percentRate), date: parseDateLoose(r.effectiveDate) }));
  return toRate(pts);
}

async function loadRates(fredOnly) {
  const rates = {};
  const sources = [];
  const errors = [];

  const merge = (obj, source) => {
    let used = false;
    for (const [id, rate] of Object.entries(obj || {})) {
      if (rate && !rates[id]) {
        rates[id] = rate;
        used = true;
      }
    }
    if (used && !sources.includes(source)) sources.push(source);
  };
  const missing = () => SERIES.some((s) => !rates[s.id]);

  const key = String(CONFIG.FRED_API_KEY || "").trim();
  if (key) {
    try {
      merge(await fetchFredApi(key), "FRED");
    } catch (e) {
      errors.push(`FRED API: ${e.message}`);
    }
  }
  if (missing()) {
    try {
      merge(await fetchFredCsv(), "FRED");
    } catch (e) {
      errors.push(`FRED CSV: ${e.message}`);
    }
  }
  // Each extra source is another sequential request. A widget that already
  // has a saved copy to fall back on is better off stopping here.
  if (fredOnly) return { rates, sources, errors };

  if (TREASURY_IDS.some((id) => !rates[id])) {
    try {
      merge(await fetchTreasury(), "U.S. Treasury");
    } catch (e) {
      errors.push(`Treasury: ${e.message}`);
    }
  }
  if (!rates.SOFR) {
    try {
      const sofr = await fetchSofrNyFed();
      if (sofr) merge({ SOFR: sofr }, "NY Fed");
    } catch (e) {
      errors.push(`NY Fed: ${e.message}`);
    }
  }

  return { rates, sources, errors };
}

// ---------------------------------------------------------------------------
// Refresh cadence
// ---------------------------------------------------------------------------

// Neither source moves intraday. Treasury yields are a single daily figure off
// the afternoon close, on FRED by early evening New York time; SOFR is one
// figure per business day, published around 8am New York time for the previous
// business day. So the checks cluster in those two windows and back off in
// between, rather than burning the refresh budget iOS allows on numbers that
// cannot have changed.
function refreshMinutesFor(weekday, hour) {
  if (weekday === "Sat" || weekday === "Sun") return 240;
  if (hour < 8) return 120;
  if (hour < 10) return 15; // SOFR posts ~8am ET
  if (hour < 16) return 90;
  if (hour < 20) return 15; // the Treasury curve reaches FRED late afternoon
  return 120;
}

function easternNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => {
    const found = parts.find((x) => x.type === type);
    return found ? found.value : null;
  };
  const hour = Number(get("hour"));
  if (!Number.isFinite(hour)) throw new Error("no hour in formatted date");
  return { weekday: get("weekday"), hour: hour % 24 };
}

function minutesUntilNextCheck() {
  if (typeof CONFIG.REFRESH === "number") return CONFIG.REFRESH;
  try {
    const { weekday, hour } = easternNow();
    return refreshMinutesFor(weekday, hour);
  } catch (e) {
    // No time-zone database on this device — fall back to a flat hour.
    return 60;
  }
}

// ---------------------------------------------------------------------------
// Cache — so the widget still shows real numbers with no signal
// ---------------------------------------------------------------------------

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), CONFIG.CACHE_FILE);
}

function readCache() {
  try {
    const fm = FileManager.local();
    const path = cachePath();
    if (!fm.fileExists(path)) return null;
    const parsed = JSON.parse(fm.readString(path));
    return parsed && parsed.rates ? parsed : null;
  } catch (e) {
    return null;
  }
}

function writeCache(payload) {
  try {
    FileManager.local().writeString(cachePath(), JSON.stringify(payload));
  } catch (e) {
    // a cache write failure is never worth failing the widget over
  }
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

function metrics(family) {
  if (family === "small") {
    // No room for a header, full names, or the bp change at this size.
    return { padT: 12, padX: 13, padB: 12, header: 0, label: 12, value: 17, delta: 0, meta: 8.5, compact: true };
  }
  if (family === "large") {
    return { padT: 18, padX: 20, padB: 18, header: 12, label: 17, value: 24, delta: 12, meta: 11 };
  }
  return { padT: 12, padX: 14, padB: 12, header: 10.5, label: 13, value: 17.5, delta: 9.5, meta: 9 };
}

function formatDay(ts) {
  const df = new DateFormatter();
  df.dateFormat = "MMM d";
  return df.string(new Date(ts));
}

function formatClock(date) {
  const df = new DateFormatter();
  df.useNoDateStyle();
  df.useShortTimeStyle();
  return df.string(date);
}

function changeColor(bp) {
  if (bp === 0) return COLORS.faint;
  const rising = bp > 0;
  const isBad = CONFIG.UP_IS_BAD ? rising : !rising;
  return isBad ? COLORS.bad : COLORS.good;
}

// The newest observation date across the four rates — the widget's "as of".
function headlineDate(rates) {
  const days = SERIES.map((x) => rates[x.id]).filter(Boolean).map((r) => r.date);
  return days.length ? Math.max(...days) : null;
}

// One rate per line: name on the left, percentage on the right. The change sits
// left of the percentage so every percentage lands on the same right edge.
// A rate older than the headline date carries its own date, right beside it —
// SOFR is an overnight rate, so it is often a business day behind the curve.
function addRow(widget, series, rate, M, headline) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const label = row.addText(M.compact ? series.short : series.label);
  label.font = Font.regularSystemFont(M.label);
  label.textColor = COLORS.dim;
  label.lineLimit = 1;
  label.minimumScaleFactor = 0.7;

  if (rate && headline && formatDay(rate.date) !== formatDay(headline)) {
    row.addSpacer(4);
    const own = row.addText(formatDay(rate.date));
    own.font = Font.regularSystemFont(M.meta);
    own.textColor = COLORS.faint;
    own.lineLimit = 1;
  }

  row.addSpacer();

  if (CONFIG.SHOW_CHANGE && !M.compact && rate && rate.prev !== null && rate.prev !== undefined) {
    const bp = Math.round((rate.value - rate.prev) * 100);
    const delta = row.addText(bp === 0 ? "flat" : `${bp > 0 ? "+" : "−"}${Math.abs(bp)} bp`);
    delta.font = Font.regularSystemFont(M.delta);
    delta.textColor = changeColor(bp);
    delta.lineLimit = 1;
    row.addSpacer(M.value * 0.35);
  }

  const value = row.addText(rate ? `${rate.value.toFixed(2)}%` : "—");
  value.font = Font.semiboldRoundedSystemFont(M.value);
  value.textColor = COLORS.text;
  value.lineLimit = 1;
}

function buildWidget(rates, meta) {
  const family = config.widgetFamily || "medium";
  const M = metrics(family);
  const headline = headlineDate(rates);

  const widget = new ListWidget();
  // With "refresh" the tap is handled by the widget's "When Interacting"
  // setting, so no URL is attached — setting one would override it.
  if (CONFIG.TAP_ACTION === "fred") widget.url = CONFIG.FRED_URL;
  widget.setPadding(M.padT, M.padX, M.padB, M.padX);
  widget.backgroundGradient = (() => {
    const g = new LinearGradient();
    g.locations = [0, 1];
    g.colors = [
      Color.dynamic(new Color("#FFFFFF"), new Color("#15161A")),
      Color.dynamic(new Color("#F1F3F7"), new Color("#0C0D10")),
    ];
    g.startPoint = new Point(0, 0);
    g.endPoint = new Point(0, 1);
    return g;
  })();

  // Top row: the data date on the left, the refresh hint on the right.
  const head = widget.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  if (M.header) {
    const title = head.addText("MARKET RATES");
    title.font = Font.semiboldSystemFont(M.header);
    title.textColor = COLORS.dim;
    title.lineLimit = 1;
    // Pushes the date and glyph together against the right edge.
    head.addSpacer();
  }
  const asOf = head.addText(
    (headline ? formatDay(headline) : "No data") + (meta.stale ? " · cached" : "")
  );
  asOf.font = Font.regularSystemFont(M.meta);
  asOf.textColor = meta.stale ? COLORS.warn : COLORS.faint;
  asOf.lineLimit = 1;
  asOf.minimumScaleFactor = 0.7;
  // Without a title the date holds the left edge, so the glyph needs the push.
  if (M.header) head.addSpacer(5);
  else head.addSpacer();
  const refresh = head.addText("↻");
  refresh.font = Font.regularSystemFont(M.meta + 1.5);
  refresh.textColor = COLORS.faint;

  // Flexible spacers between the rows spread them evenly over whatever height
  // the chosen widget size gives us.
  for (const series of SERIES) {
    widget.addSpacer();
    addRow(widget, series, rates[series.id], M, headline);
  }

  widget.refreshAfterDate = new Date(Date.now() + minutesUntilNextCheck() * 60 * 1000);
  return widget;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

// Last resort if even buildWidget fails: a widget with a line of text beats
// the empty black square iOS shows when a widget script throws.
function fallbackWidget(message) {
  const widget = new ListWidget();
  widget.setPadding(12, 13, 12, 13);
  const text = widget.addText(message);
  text.font = Font.regularSystemFont(11);
  text.textColor = COLORS.dim;
  return widget;
}

function safeWidget(rates, meta) {
  try {
    return buildWidget(rates, meta);
  } catch (e) {
    return fallbackWidget(`Market Rates\ncould not draw:\n${e}`);
  }
}

function metaFromCache(cached, stale) {
  return {
    sources: (cached && cached.sources) || [],
    stale: stale,
    refreshedAt: cached ? new Date(cached.savedAt) : new Date(),
  };
}

async function resolve() {
  const cached = readCache();
  const dueAt = cached ? cached.savedAt + minutesUntilNextCheck() * 60 * 1000 : 0;
  const cacheIsCurrent = Boolean(cached) && Date.now() < dueAt;

  // A widget holding a copy that is not due yet renders straight from it. No
  // network work at all is the only way to be sure of drawing something inside
  // the budget iOS allows widget code, and the numbers cannot have changed.
  if (config.runsInWidget && cacheIsCurrent) {
    return { rates: cached.rates, meta: metaFromCache(cached, false), errors: [] };
  }

  const { rates, sources, errors } = await loadRates(config.runsInWidget && Boolean(cached));
  const freshCount = Object.keys(rates).length;
  const meta = { sources, stale: false, refreshedAt: new Date() };

  // Anything a source could not supply falls back to the last good value, so a
  // weak signal degrades to slightly old numbers instead of blank rows.
  if (cached && freshCount < SERIES.length) {
    for (const s of SERIES) {
      if (!rates[s.id] && cached.rates[s.id]) {
        rates[s.id] = cached.rates[s.id];
        meta.stale = true;
      }
    }
  }
  if (freshCount > 0) writeCache({ savedAt: Date.now(), rates, sources });
  // With nothing fetched at all, the honest timestamp is the cache's.
  if (freshCount === 0 && cached) meta.refreshedAt = new Date(cached.savedAt);

  return { rates, meta, errors };
}

let rates = {};
let meta = metaFromCache(null, false);
let errors = [];

try {
  const resolved = await resolve();
  rates = resolved.rates;
  meta = resolved.meta;
  errors = resolved.errors;
} catch (e) {
  // Whatever went wrong, draw something. An uncaught error here is what leaves
  // a Scriptable widget as an empty black square.
  errors = [String(e)];
  try {
    const cached = readCache();
    if (cached) {
      rates = cached.rates;
      meta = metaFromCache(cached, true);
    }
  } catch (inner) {
    // fall through to empty rows
  }
}

if (config.runsInWidget) {
  Script.setWidget(safeWidget(rates, meta));
} else {
  if (errors.length) console.log(`Sources that failed:\n${errors.join("\n")}`);
  console.log(
    SERIES.map((s) => {
      const r = rates[s.id];
      return r ? `${s.label}: ${r.value.toFixed(2)}%  (${formatDay(r.date)})` : `${s.label}: no data`;
    }).join("\n")
  );
  // Tapping the widget lands here, so present the square layout it matches.
  config.widgetFamily = "small";
  await safeWidget(rates, meta).presentSmall();
}

Script.complete();
