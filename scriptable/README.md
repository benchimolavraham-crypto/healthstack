# Market Rates — iPhone Home Screen widget

The latest 5Y, 7Y and 10Y Treasury yields and SOFR (the overnight rate) in a
small (2x2) Home Screen widget — each rate in white, with the day's move
stacked underneath it in red when it rose and green when it fell.

```
Sep 15  Updated 7:46 AM
5-Year           4.83%
           ▼ 12 bp · 1D
7-Year           4.91%
            ▲ 3 bp · 1D
10-Year          4.72%
           ▲ 12 bp · 1D
SOFR Sep 12      3.64%
             flat · 1D
```

Rising rates are the red ones: the default is a borrower's view, where a higher
rate costs money. Flip `UP_IS_BAD` to `false` for the opposite. The arrow
carries the direction too, so the move still reads without the colour.

The top row is the date the figures are from, and the time of the last
successful check. Every move is tagged with the period it covers, so a number
on its own can never be read against the wrong window. A rate shows its own date next to its name only when it is
older than that — SOFR is published the following business morning, so it is
often a day behind the Treasury curve.

Medium and large sizes use the same layout with the full labels:

```
MARKET RATES          Sep 15 Updated 7:46 AM
Treasury 5-Year                        4.83%
                                ▼ 12 bp · 1D
Treasury 7-Year                        4.91%
                                 ▲ 3 bp · 1D
```

The script detects which size you added and lays itself out accordingly.

## Install

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) from
   the App Store (free).
2. Copy the entire contents of [`MarketRates.js`](./MarketRates.js).
3. Open Scriptable, tap **+**, paste, then rename the script to `Market Rates`
   (tap the settings icon at the bottom of the editor).
4. Tap **▶** once to confirm it pulls live numbers.
5. On the Home Screen, long-press → **Edit** → **Add Widget** → **Scriptable** →
   **small**. Add it.
6. Tap the new widget and set **Script** to `Market Rates` and **When
   Interacting** to **Run Script**. That second setting is what makes the tap
   refresh the rates.

No API key is required.

## Which comparison period

`CHANGE_PERIOD` decides what each move is measured against:

| Setting | Measures against | What it answers |
| --- | --- | --- |
| `"1d"` | the previous business day | what moved since you last looked |
| `"1w"` | seven days back | the direction of the week, past the daily noise |
| `"1m"` | thirty days back | whether a quote issued a month ago still holds |

`"1d"` is the default because it is the only one that changes between glances,
and it is how a rate move is quoted out loud. Treasury yields move a couple of
basis points on an ordinary day, so a single day is mostly noise; `"1m"` is the
one that carries a decision, since thirty days is about the life of a term
sheet and 25-50bp over that window is what forces a re-quote.

Whichever you pick, the widget keeps enough history to measure it and labels
every row with the period it used. If it is ever working from a saved copy that
predates that history, it reports the period it actually had rather than the one
you asked for.

## Keeping it updated

Apple's own guidance is the thing to understand here: a widget whose script
times out or crashes has its refresh priority cut, and iOS can stop reloading
it altogether. A widget that fetches over the network in the background is
therefore betting its refresh budget on every draw.

So the work is split:

- **The widget never touches the network.** It draws the saved copy and
  finishes in milliseconds, which is the behaviour iOS keeps rewarding with
  wake-ups. (`WIDGET_FETCH: true` restores fetching from inside the widget;
  either way it fetches anyway if the saved copy is older than
  `WIDGET_STALE_HOURS`, so it can never be stuck forever.)
- **A Shortcuts automation refreshes the data**, by running this same script a
  few times a day. It runs with the app's full time budget and none of a
  widget's constraints, so it is the part that reliably works.

### Setting up the automation

For each time below: **Shortcuts** → **Automation** tab → **+** → **Time of
Day** → set the time → **Daily** → **Next** → search **Scriptable** → **Run
Script** → tap **Script** and pick this one → **Run Immediately** (older iOS:
turn *off* **Ask Before Running**) → **Done**.

The script detects it is being run this way and shows nothing on screen, so
each automation completes silently.

**Recommended, five automations (New York time):**

| Time | Why |
| --- | --- |
| 8:45am | SOFR posts around 8:00am |
| 10:30am | mid-morning |
| 12:30pm | midday |
| 2:30pm | mid-afternoon |
| 5:15pm | the Treasury curve is published mid-afternoon |

### How often is worth automating

Treasuries trade continuously, so the 5Y, 7Y and 10Y yields move all day and a
run an hour apart returns a genuinely different figure. More automations do buy
something here. SOFR does not move: it is computed from a completed day of repo
transactions and published the following morning, so it changes once per
business day whatever the schedule.

The limit is Shortcuts, not cost. A run is one small request and a few
milliseconds of parsing, but a **Time of Day** automation fires at one specific
time with no repeat interval — hourly across a working day is twelve
automations to create by hand, and every fifteen minutes would be ninety-six.
Beyond that, the widget only redraws when iOS decides to, at best every 15-60
minutes, so refreshing faster than that is invisible on the Home Screen.

Hourly through the trading day is the sensible ceiling. Back-to-back scheduled
runs inside `MIN_FETCH_GAP_MINUTES` (10) reuse the saved copy rather than
re-fetching, so a dense schedule cannot hammer anything. Tapping the script
always fetches — that is a person asking for the current yield.

### Refresh schedule the widget asks for

| New York time | Wake-up asked for |
| --- | --- |
| Weekday 8:00am–8:00pm | every 20 min |
| Weekday 8:00pm–8:00am | every 90 min |
| Weekend | every 3 hours |

That is about 44 wake-ups on a weekday, inside the 40-70 iOS allows before it
throttles. It is a request, not a promise: iOS decides when a widget actually
redraws, and there is no API for a Scriptable widget to force it.

Set `REFRESH` to a number of minutes to replace the schedule with a fixed one.

### If it still will not update on its own

iOS may already have deprioritised the widget from earlier failures. A fresh
widget gets a fresh budget:

1. Remove the widget from the Home Screen.
2. Restart the phone.
3. Add the widget again and set **When Interacting** to **Run Script**.
4. Check **Settings → General → Background App Refresh** is on, and on for
   Scriptable, and that **Low Power Mode** is off.

With the automation in place the rates stay current regardless, since every
redraw the widget does get shows data the automation already refreshed.

### Reading the run log

Every run leaves a line behind. Open the script, tap **▶**, close the preview,
and read the console underneath:

```
--- recent runs (newest last) ---
Sep 21, 8:45 AM  auto   fetched 4/4 from FRED
Sep 21, 9:14 AM  widget drew saved copy, 29m old (no network in widget)
Sep 21, 12:30 PM auto   fetched 4/4 from FRED

In this log: 2 automation run(s), 1 widget wake-up(s).
```

- `auto` lines at your automation times mean the automations are working.
- `app` lines are your own taps.
- `widget` lines mean iOS is waking the widget. None at all means it is not,
  and the steps above apply.
- With live quotes on, the Treasury yields move through the day. SOFR changes
  once a business day, so that row sitting still is normal.

## Where the numbers come from

| Order | Source | Covers |
| --- | --- | --- |
| 1 | FRED public CSV download (`DGS5`, `DGS7`, `DGS10`, `SOFR`) | all four |
| 2 | U.S. Treasury daily yield curve CSV | 5Y / 7Y / 10Y |
| 3 | New York Fed SOFR API | SOFR |
| 4 | CNBC quote service — **live intraday yields** | 5Y / 7Y / 10Y |
| 5 | On-device cache of the last good values | all four |

Sources 1-3 give the official daily closes. Source 4 then lays the live
intraday yield on top of them: the Treasury market trades continuously, so the
official figure is a close, not a current price. It is the quote service
cnbc.com itself calls, which is undocumented and could change without notice —
so it is a layer, never a replacement. If it fails, the closes stand and the
widget carries on.

Because the live yield is appended to that rate's daily history, a `1D` move is
the live yield against *yesterday's close*, exactly as a quote screen shows it.
A live rate is displayed to three decimals, since at two it would barely appear
to move, and a sub-basis-point move is shown as such (`▲ 0.5 bp`) rather than
rounded up to a whole one. The top row reads `LIVE` while the quote is recent
and falls back to the date once it is not — after hours, a "live" quote is just
the last print.

SOFR has no live quote to have, so it stays on the official daily figure.

Each source is only asked for what the one before it could not supply, so a
single endpoint changing or going down does not blank the widget. When any rate
falls back to the cache, the top row says `cached` next to the date.

Treasury yields are not published on weekends or federal holidays, and SOFR is
published a business day behind. The widget always shows the most recent
*available* observation rather than a gap, and shows that rate's own date
beside it.

## Settings

All at the top of `MarketRates.js`:

- `FRED_API_KEY` — optional. With a free key from
  [fredaccount.stlouisfed.org/apikey](https://fredaccount.stlouisfed.org/apikey)
  the widget uses the official FRED API first and falls back to the sources
  above. Leaving it blank is fine.
- `TAP_ACTION` — `"refresh"`, `"fred"` or `"none"` (see **Refreshing**).
- `UP_IS_BAD` — `true` colours rising rates red (a borrower's view); `false`
  colours them green.
- `SHOW_CHANGE` — set to `false` to hide the move entirely.
- `CHANGE_UNIT` — `"bp"` shows `▲ 12 bp`, the usual way a rate move is quoted;
  `"pct"` shows the same move as `▲ 0.12%`.
- `CHANGE_PERIOD` — `"1d"`, `"1w"` or `"1m"` (see above).
- `REFRESH` — `"auto"` for the schedule above, or a number of minutes.
- `LIVE_QUOTES` — `false` shows only the official daily closes, no intraday
  layer.
- `WIDGET_FETCH` — `false` keeps all network work out of the widget (see
  **Keeping it updated**); `WIDGET_STALE_HOURS` is the safety net that lets it
  fetch anyway once the saved copy is that old.

## If the widget is blank

A Scriptable widget draws as an empty black square when its script throws, runs
out of memory, or is cut off — a widget gets far less of both than the app, so a
script can work under **▶** and still fail on the Home Screen. Three things keep
this one inside that budget:

- When the saved copy is not yet due for a refresh, the widget renders from it
  and makes **no network request at all**.
- The CSV is read newest-first and stops at the two observations each rate
  needs, so it costs the same whether FRED returns three weeks or, ignoring the
  start date, sixty years of history.
- Requests time out in 6 seconds inside a widget, falling back to the saved copy
  rather than being killed mid-request.

If it still comes up blank, the script now draws the error text instead of
nothing, so the widget itself will say what failed. Other things worth trying:

- Tap **▶** in the app once. That populates the saved copy the widget reads.
- Remove the widget and add it again — iOS will keep showing a crashed widget's
  blank state for a while.

## Notes

This folder is standalone — it is not part of the Next.js app and is excluded
from its lint config.
