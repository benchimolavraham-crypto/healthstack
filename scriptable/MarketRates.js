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

  // Show the day-over-day move under each rate.
  SHOW_CHANGE: true,

  // "bp"  — the move in basis points, how rate moves are normally quoted
  // "pct" — the same move as percentage points, e.g. 0.01%
  CHANGE_UNIT: "bp",

  // What the move is measured against. The widget labels whichever you pick,
  // so the number is never ambiguous.
  //   "1d" — the previous business day. What moved since you last looked.
  //   "1w" — seven days back.
  //   "1m" — thirty days back. Whether a quote you issued still holds.
  CHANGE_PERIOD: "1d",

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

  // How often iOS is asked to wake the widget, as a hint it is free to ignore.
  // "auto" aims the wake-ups at the windows when new numbers actually post;
  // a number forces that many minutes instead.
  REFRESH: "auto",

  // iOS grants a widget a limited number of wake-ups and often spends some of
  // them earlier than asked. Every one of those is a chance to fetch, so the
  // only thing held back is a second fetch inside this many minutes.
  MIN_FETCH_GAP_MINUTES: 10,

  CACHE_FILE: "market-rates-cache.json",
  TIMEOUT_SECONDS: 15,
  // A widget is killed before the app would be, so it gets a tighter budget and
  // falls back to the saved copy rather than being cut off mid-request. Too
  // tight and every widget fetch times out while tapping still works, which
  // looks exactly like the widget not refreshing at all.
  WIDGET_TIMEOUT_SECONDS: 10,
};

const SERIES = [
  { id: "DGS5", label: "Treasury 5-Year", short: "5-Year" },
  { id: "DGS7", label: "Treasury 7-Year", short: "7-Year" },
  { id: "DGS10", label: "Treasury 10-Year", short: "10-Year" },
  { id: "SOFR", label: "SOFR", short: "SOFR" },
];

const TREASURY_IDS = ["DGS5", "DGS7", "DGS10"];

const COLORS = {
  text: Color.dynamic(new Color("#000000"), new Color("#FFFFFF")),
  dim: Color.dynamic(new Color("#6B7280"), new Color("#8A8F9A")),
  faint: Color.dynamic(new Color("#9AA0AA"), new Color("#6E727B")),
  good: Color.dynamic(new Color("#1B8A4B"), new Color("#4ADE80")),
  bad: Color.dynamic(new Color("#C0392B"), new Color("#F87171")),
  warn: Color.dynamic(new Color("#B45309"), new Color("#FBBF24")),
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// How far back the chosen comparison reaches.
function periodDays() {
  const p = String(CONFIG.CHANGE_PERIOD || "1d").toLowerCase();
  if (p === "1m") return 30;
  if (p === "1w") return 7;
  return 1;
}

function periodLabel() {
  const p = String(CONFIG.CHANGE_PERIOD || "1d").toLowerCase();
  return p === "1m" ? "1M" : p === "1w" ? "1W" : "1D";
}

// Observations to keep per series: enough business days to reach back over the
// period, plus room for holidays. Small enough that the whole history still
// costs a widget nothing.
function pointsWanted() {
  const days = periodDays();
  if (days >= 30) return 26;
  if (days >= 7) return 9;
  return 3;
}

// Calendar days of history to ask a source for.
function historyDays() {
  const days = periodDays();
  return days >= 30 ? 55 : days >= 7 ? 25 : 20;
}

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

// Takes observations in any order and keeps the newest run of them. Using the
// latest valid one is what gives "latest available" behaviour over weekends and
// holidays; the trailing history is what the comparison period is measured
// against. Points are stored as [timestamp, value] to keep the cache small.
function toRate(points) {
  const pts = points
    .filter((p) => p && p.date && p.value !== null && p.value !== undefined)
    .sort((a, b) => a.date - b.date)
    .slice(-pointsWanted());
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : null;
  return {
    value: last.value,
    date: last.date.getTime(),
    prev: prev ? prev.value : null,
    points: pts.map((p) => [p.date.getTime(), p.value]),
  };
}

// What this rate is compared against, and the period that comparison actually
// covers. For a single day that is the previous observation; for longer periods
// it is the last observation on or before the target date.
function changeBasis(rate) {
  const requested = periodLabel();
  if (!rate) return { ref: null, label: requested };
  const prev = rate.prev === undefined ? null : rate.prev;
  const points = Array.isArray(rate.points) ? rate.points : null;

  if (periodDays() <= 1) return { ref: prev, label: requested };
  if (!points) {
    // A cache written before histories were kept holds only the previous day.
    // Label it for the period it covers, not the one that was asked for.
    return { ref: prev, label: "1D" };
  }

  const older = points.filter((pt) => pt[0] < rate.date);
  if (!older.length) return { ref: null, label: requested };
  const target = rate.date - periodDays() * 24 * 60 * 60 * 1000;
  const reached = older.filter((pt) => pt[0] <= target);
  return {
    ref: reached.length ? reached[reached.length - 1][1] : older[0][1],
    label: requested,
  };
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
        `&file_type=json&sort_order=desc&limit=${pointsWanted() + 10}`;
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
  start.setDate(start.getDate() - historyDays());
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

  // Read newest-first and stop as soon as every series has the handful of
  // observations it needs. If FRED ignores the start date it answers with
  // decades of history, which a widget does not have the memory to walk.
  const found = {};
  for (const id of ids) found[id] = [];
  for (let i = lines.length - 1; i > 0; i--) {
    if (ids.every((id) => found[id].length >= pointsWanted())) break;
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i]);
    const date = parseDateLoose(cells[0]);
    if (!date) continue;
    for (const id of ids) {
      if (found[id].length >= pointsWanted()) continue;
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
  const json = await getJson(`https://markets.newyorkfed.org/api/rates/secured/sofr/last/${pointsWanted() + 5}.json`);
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

// Neither source moves intraday: the Treasury curve is one daily figure that
// reaches FRED in the early evening New York time, and SOFR is one figure a
// business day, published around 8am. Both windows fall inside the working day,
// so rather than chase them the widget just asks to be woken every twenty
// minutes while the market is awake and backs off when it is not. That is about
// 44 wake-ups on a weekday, inside the 40-70 iOS allows before it throttles,
// and it keeps the clock on the widget visibly moving.
function refreshMinutesFor(weekday, hour) {
  if (weekday === "Sat" || weekday === "Sun") return 180;
  if (hour >= 8 && hour < 20) return 20;
  return 90;
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

function readCacheRaw() {
  try {
    const fm = FileManager.local();
    const path = cachePath();
    if (!fm.fileExists(path)) return null;
    return JSON.parse(fm.readString(path));
  } catch (e) {
    return null;
  }
}

function readCache() {
  const parsed = readCacheRaw();
  return parsed && parsed.rates ? parsed : null;
}

function writeCache(payload) {
  try {
    const existing = readCacheRaw();
    const runs = existing && Array.isArray(existing.runs) ? existing.runs : [];
    FileManager.local().writeString(cachePath(), JSON.stringify({ ...payload, runs }));
  } catch (e) {
    // a cache write failure is never worth failing the widget over
  }
}

// A widget cannot be watched while it runs, and a silent fall back to the saved
// copy looks identical to never having been woken at all. Each run leaves a
// line behind so the next run in the app can say which it was.
function recordRun(outcome) {
  try {
    const payload = readCacheRaw() || {};
    const runs = Array.isArray(payload.runs) ? payload.runs : [];
    runs.push({
      t: Date.now(),
      ctx: config.runsInWidget ? "widget" : "app",
      outcome: String(outcome).slice(0, 90),
    });
    payload.runs = runs.slice(-12);
    FileManager.local().writeString(cachePath(), JSON.stringify(payload));
  } catch (e) {
    // diagnostics must never be the thing that breaks the widget
  }
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

function metrics(family) {
  // Every size has the same height to work with — only the width changes — so
  // the type scales stay close and the flexible spacers absorb the difference.
  if (family === "small") {
    return { padT: 8, padX: 11, padB: 8, header: 0, date: 11.5, label: 11, value: 16, change: 8.5, compact: true };
  }
  if (family === "large") {
    return { padT: 16, padX: 18, padB: 16, header: 12, date: 12, label: 15, value: 22, change: 11 };
  }
  return { padT: 8, padX: 14, padB: 8, header: 10.5, date: 10.5, label: 13, value: 18, change: 9 };
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

// Rising rates cost a borrower money, so up is the red one by default.
function changeColor(bp) {
  if (bp === null || bp === 0) return COLORS.faint;
  const isBad = CONFIG.UP_IS_BAD ? bp > 0 : bp < 0;
  return isBad ? COLORS.bad : COLORS.good;
}

// The arrow carries the direction as well as the colour, so the move still
// reads on a black-and-white screen or to a red-green colourblind eye. The
// period is spelled out on every row: the move means nothing without it.
function moveText(rate, bp, label) {
  if (bp === null) return " "; // keeps every row the same height
  if (bp === 0) return `flat · ${label}`;
  const arrow = bp > 0 ? "▲" : "▼";
  if (CONFIG.CHANGE_UNIT === "pct") {
    const basis = changeBasis(rate);
    return `${arrow} ${Math.abs(rate.value - basis.ref).toFixed(2)}% · ${label}`;
  }
  return `${arrow} ${Math.abs(bp)} bp · ${label}`;
}

// The newest observation date across the four rates — the widget's "as of".
function headlineDate(rates) {
  const days = SERIES.map((x) => rates[x.id]).filter(Boolean).map((r) => r.date);
  return days.length ? Math.max(...days) : null;
}

// One rate per line: the name on the left, and on the right the rate with the
// day's move stacked underneath it. A rate older than the headline date carries
// its own date next to the name — SOFR is an overnight rate, so it is often a
// business day behind the curve.
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
    own.font = Font.regularSystemFont(M.change);
    own.textColor = COLORS.faint;
    own.lineLimit = 1;
  }

  row.addSpacer();

  const figures = row.addStack();
  figures.layoutVertically();
  figures.spacing = 0;

  const value = figures.addText(rate ? `${rate.value.toFixed(2)}%` : "—");
  value.font = Font.boldRoundedSystemFont(M.value);
  value.textColor = COLORS.text;
  value.lineLimit = 1;
  value.rightAlignText();

  if (CONFIG.SHOW_CHANGE) {
    const basis = changeBasis(rate);
    const bp = rate && basis.ref !== null ? Math.round((rate.value - basis.ref) * 100) : null;
    const move = figures.addText(moveText(rate, bp, basis.label));
    move.font = Font.mediumSystemFont(M.change);
    move.textColor = changeColor(bp);
    move.lineLimit = 1;
    move.rightAlignText();
  }
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

  // Top row: the date the figures are from, and the time of the last check.
  const head = widget.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  if (M.header) {
    const title = head.addText("MARKET RATES");
    title.font = Font.semiboldSystemFont(M.header);
    title.textColor = COLORS.dim;
    title.lineLimit = 1;
    head.addSpacer();
  }
  const asOf = head.addText(
    (headline ? formatDay(headline) : "No data") + (meta.stale ? " · cached" : "")
  );
  asOf.font = Font.mediumSystemFont(M.date);
  asOf.textColor = meta.stale ? COLORS.warn : COLORS.dim;
  asOf.lineLimit = 1;
  asOf.minimumScaleFactor = 0.7;
  head.addSpacer();
  // Labelled, so it cannot be mistaken for the clock in the status bar.
  const checked = head.addText(`Updated ${formatClock(meta.refreshedAt)}`);
  checked.font = Font.regularSystemFont(M.change);
  checked.textColor = COLORS.faint;
  checked.lineLimit = 1;
  checked.minimumScaleFactor = 0.7;

  // Flexible spacers spread the rows over whatever height is left, and
  // collapse to nothing on the shortest devices rather than clipping a row.
  for (const series of SERIES) {
    widget.addSpacer();
    addRow(widget, series, rates[series.id], M, headline);
  }

  widget.refreshAfterDate = new Date(
    meta.nextCheckAt || Date.now() + minutesUntilNextCheck() * 60 * 1000
  );
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
  const now = Date.now();
  const interval = minutesUntilNextCheck() * 60 * 1000;
  // When the widget would like to be woken next. Measured from the last fetch,
  // never from this render: an early wake-up must not push the next one out.
  const dueAt = cached ? cached.savedAt + interval : now;

  // iOS often redraws a widget far more often than asked, so a fetch is only
  // skipped when one has just happened. Waiting out the whole interval meant
  // throwing away wake-ups that could have carried a fresh figure.
  const justFetched =
    Boolean(cached) && now - cached.savedAt < CONFIG.MIN_FETCH_GAP_MINUTES * 60 * 1000;

  if (config.runsInWidget && justFetched) {
    const meta = metaFromCache(cached, false);
    meta.nextCheckAt = Math.max(dueAt, now + 60 * 1000);
    const age = Math.round((now - cached.savedAt) / 60000);
    return { rates: cached.rates, meta, errors: [], outcome: `skipped, fetched ${age}m ago` };
  }

  const { rates, sources, errors } = await loadRates(config.runsInWidget && Boolean(cached));
  const freshCount = Object.keys(rates).length;
  const meta = { sources, stale: false, refreshedAt: new Date(), nextCheckAt: now + interval };

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
  let outcome = `fetched ${freshCount}/${SERIES.length} from ${sources.join(", ") || "nowhere"}`;
  if (freshCount > 0) writeCache({ savedAt: now, rates, sources });
  if (freshCount === 0) {
    outcome = `NO DATA — ${errors[0] || "every source failed"}`;
    // Nothing came back: keep the cache's timestamp honest and try again soon
    // rather than sitting out a whole quiet-hours interval.
    if (cached) meta.refreshedAt = new Date(cached.savedAt);
    meta.nextCheckAt = now + 15 * 60 * 1000;
  }

  return { rates, meta, errors, outcome };
}

let rates = {};
let meta = metaFromCache(null, false);
let errors = [];
let outcome = "unknown";

try {
  const resolved = await resolve();
  rates = resolved.rates;
  meta = resolved.meta;
  errors = resolved.errors;
  outcome = resolved.outcome;
} catch (e) {
  outcome = `CRASHED — ${e}`;
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

recordRun(outcome);

if (config.runsInWidget) {
  Script.setWidget(safeWidget(rates, meta));
} else {
  console.log(
    SERIES.map((s) => {
      const r = rates[s.id];
      return r ? `${s.label}: ${r.value.toFixed(2)}%  (${formatDay(r.date)})` : `${s.label}: no data`;
    }).join("\n")
  );
  if (errors.length) console.log(`\nSources that failed:\n${errors.join("\n")}`);

  // The point of the log: lines marked "widget" prove iOS is waking it, and
  // their outcome says whether the fetch got through.
  const runs = (readCacheRaw() || {}).runs || [];
  const stamp = new DateFormatter();
  stamp.dateFormat = "MMM d h:mm a";
  console.log("\n--- recent runs (newest last) ---");
  console.log(
    runs.length
      ? runs.map((r) => `${stamp.string(new Date(r.t))}  ${r.ctx.padEnd(6)} ${r.outcome}`).join("\n")
      : "(none recorded yet)"
  );
  const wakes = runs.filter((r) => r.ctx === "widget");
  console.log(
    wakes.length
      ? `\niOS has woken the widget ${wakes.length} time(s) in this log.`
      : "\niOS has NOT woken the widget yet — every run here was a tap."
  );
  // Tapping the widget lands here, so present the square layout it matches.
  config.widgetFamily = "small";
  await safeWidget(rates, meta).presentSmall();
}

Script.complete();
