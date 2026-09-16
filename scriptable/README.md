# Market Rates — iPhone Home Screen widget

A medium Scriptable widget showing the latest 5Y, 7Y and 10Y Treasury yields and
SOFR, with the day-over-day move in basis points.

```
MARKET RATES                       FRED
5Y UST                     7Y UST
4.82% +1 bp                4.88% +1 bp
10Y UST                    SOFR
4.72% +1 bp                3.64% flat
UST Sep 15 · SOFR Sep 12          ↻ 7:46 AM
```

## Install

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) from
   the App Store (free).
2. Copy the entire contents of [`MarketRates.js`](./MarketRates.js).
3. Open Scriptable, tap **+**, paste, then rename the script to `Market Rates`
   (tap the settings icon at the bottom of the editor).
4. Tap **▶** once to confirm it pulls live numbers.
5. On the Home Screen, long-press → **Edit** → **Add Widget** → **Scriptable** →
   **medium** size. Add it, then tap the new widget and set **Script** to
   `Market Rates` and **When Interacting** to **Run Script**.

No API key is required.

## Where the numbers come from

| Order | Source | Covers |
| --- | --- | --- |
| 1 | FRED public CSV download (`DGS5`, `DGS7`, `DGS10`, `SOFR`) | all four |
| 2 | U.S. Treasury daily yield curve CSV | 5Y / 7Y / 10Y |
| 3 | New York Fed SOFR API | SOFR |
| 4 | On-device cache of the last good values | all four |

Each source is only asked for what the one before it could not supply, so a
single endpoint changing or going down does not blank the widget. When any tile
falls back to the cache, the header shows `CACHED` instead of the source name.

Treasury yields are not published on weekends or federal holidays, and SOFR is
published a business day behind. The widget always shows the most recent
*available* observation rather than a gap, and the footer names both dates
whenever they differ.

## Settings

All at the top of `MarketRates.js`:

- `FRED_API_KEY` — optional. With a free key from
  [fredaccount.stlouisfed.org/apikey](https://fredaccount.stlouisfed.org/apikey)
  the widget uses the official FRED API first and falls back to the sources
  above. Leaving it blank is fine.
- `UP_IS_BAD` — `true` colours rising rates red (a borrower's view); `false`
  colours them green.
- `SHOW_CHANGE` — set to `false` to hide the basis-point move.
- `TAP_URL` — where tapping the widget goes.
- `REFRESH_MINUTES` — how often iOS is asked to refresh. iOS treats this as a
  hint and budgets widget refreshes itself, so expect roughly a few updates an
  hour, not one exactly every 30 minutes.

## Notes

This folder is standalone — it is not part of the Next.js app and is excluded
from its lint config.
