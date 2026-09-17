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

## Refreshing

Neither number moves during the day:

- **Treasury yields** are a single daily figure derived from the ~3:30pm ET
  close. Treasury publishes them late afternoon and they reach FRED by early
  evening ET. One new value per business day.
- **SOFR** is one figure per business day, published by the New York Fed around
  8:00am ET for the *previous* business day.

So there is nothing to stream — checking every minute would return the same
number all day. Instead the widget aims its checks at the two windows when a new
figure actually posts:

| New York time | Wake-up asked for |
| --- | --- |
| Weekday 8:00am–8:00pm | every 20 min |
| Weekday 8:00pm–8:00am | every 90 min |
| Weekend | every 3 hours |

That is about 44 wake-ups on a weekday, inside the 40-70 iOS allows before it
throttles. Both publication windows fall inside the working day, so a new figure
shows up within about twenty minutes of posting.

That is the schedule the widget *asks* for. iOS decides when a widget actually
wakes, and it often spends a wake-up earlier than requested — so the widget
fetches on any wake-up it is given, holding back only a second fetch inside
`MIN_FETCH_GAP_MINUTES` (10 by default). The next wake-up is always measured
from the last fetch, never from the current draw, so an early wake-up cannot
push the following one further out.

Set `REFRESH` to a number of minutes to replace the schedule with a fixed one.

### If the Updated time is stuck

A widget cannot be watched while it runs, so it keeps a log. Open the script in
Scriptable, tap **▶**, close the preview, and read the console underneath:

```
--- recent runs (newest last) ---
Sep 17, 10:45 AM  widget fetched 4/4 from FRED
Sep 17, 11:05 AM  widget NO DATA — FRED CSV: The request timed out.
Sep 17, 11:26 AM  app    fetched 4/4 from FRED

iOS has woken the widget 3 time(s) in this log.
```

- Lines marked **widget** are iOS waking it on its own. If there are none, the
  script is never being run in the background — check **Settings → General →
  Background App Refresh** (on, and on for Scriptable) and that **Low Power
  Mode** is off. A widget on a Home Screen page you rarely open is also woken
  less often.
- **widget** lines reading **NO DATA** mean it is being woken but the request is
  not getting through in the time a widget is allowed. Raise
  `WIDGET_TIMEOUT_SECONDS`.
- **widget** lines reading **fetched** mean it is working. Treasury yields and
  SOFR only change once a business day, so the rates themselves staying put is
  normal — the Updated clock is the thing that should move.

`refreshAfterDate` is only a hint; iOS decides when a widget actually redraws.
The clock on the top row is there to make that visible — if it is moving, the
schedule is working.

iOS does not give Scriptable widgets real controls, so there is no refresh
button to add — the whole tile is a single tap target. With **When Interacting**
set to **Run Script**, a tap anywhere opens Scriptable, fetches current rates
and shows them, and updates the saved copy so the tile catches up on its next
redraw. With **Open App** — Scriptable's default — a tap only opens the app and
nothing refreshes.

If you would rather the tap open the FRED chart page, set `TAP_ACTION` to
`"fred"` at the top of the script.

## Where the numbers come from

| Order | Source | Covers |
| --- | --- | --- |
| 1 | FRED public CSV download (`DGS5`, `DGS7`, `DGS10`, `SOFR`) | all four |
| 2 | U.S. Treasury daily yield curve CSV | 5Y / 7Y / 10Y |
| 3 | New York Fed SOFR API | SOFR |
| 4 | On-device cache of the last good values | all four |

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
