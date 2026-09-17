# Market Rates — iPhone Home Screen widget

The latest 5Y, 7Y and 10Y Treasury yields and SOFR (the overnight rate), one
rate per line, in a small (2x2) Home Screen widget. The data date and the
refresh hint sit on the top row. Tap it to refresh.

```
Sep 15               ↻
5-Year           4.82%
7-Year           4.88%
10-Year          4.72%
SOFR Sep 12      3.64%
```

A rate only carries its own date when it is older than the one on the top row.
SOFR is an overnight rate published the following business morning, so it is
often a day behind the Treasury curve — when they match, the SOFR row is just
`SOFR`.

Medium and large sizes add the full labels and the day-over-day move in basis
points:

```
MARKET RATES                        Sep 15 ↻
Treasury 5-Year                  +1 bp 4.82%
Treasury 7-Year                  +1 bp 4.88%
Treasury 10-Year                 +1 bp 4.72%
SOFR Sep 12                       flat 3.64%
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

| New York time | Check every | Why |
| --- | --- | --- |
| 8:00–10:00am | 15 min | SOFR posts |
| 10:00am–4:00pm | 90 min | nothing new expected |
| 4:00–8:00pm | 15 min | Treasury curve reaches FRED |
| 8:00pm–8:00am | 120 min | nothing new expected |
| Weekends | 240 min | no publication |

That is roughly 34 checks on a weekday and 6 on a weekend day, which stays
inside the refresh budget iOS allows a widget — around 40 to 70 a day, and it
throttles anything greedier. Set `REFRESH` to a number of minutes to override
the schedule.

`refreshAfterDate` is only a hint; iOS decides when a widget actually redraws,
and there is no way for a Scriptable widget to force it. So the `↻` in the
corner is a hint, not a button: tapping the widget runs the script, which
fetches current rates and shows them immediately inside Scriptable. That also
updates the saved copy the widget reads, so the Home Screen tile picks up the
new numbers on its next redraw.

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
  colours them green. Only visible on the medium and large sizes.
- `SHOW_CHANGE` — set to `false` to hide the basis-point move.
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

- Check **When Interacting** is **Run Script**, not **Open App**.
- Tap **▶** in the app once. That populates the saved copy the widget reads.
- Remove the widget and add it again — iOS will keep showing a crashed widget's
  blank state for a while.

## Notes

This folder is standalone — it is not part of the Next.js app and is excluded
from its lint config.
