# Market Rates — iPhone Home Screen widget

The latest 5Y, 7Y and 10Y Treasury yields and SOFR, one rate per line, in a
small (2x2) Home Screen widget. Tap it to refresh.

```
5-Year           4.82%
7-Year           4.88%
10-Year          4.72%
SOFR             3.64%
Sep 15 · SOFR Sep 12  ↻
```

Medium and large sizes work too, and add the full labels plus the
day-over-day move in basis points:

```
MARKET RATES                            FRED
Treasury 5-Year                  +1 bp 4.82%
Treasury 7-Year                  +1 bp 4.88%
Treasury 10-Year                 +1 bp 4.72%
SOFR                              flat 3.64%
Treasuries Sep 15 · SOFR Sep 12    ↻ 7:46 AM
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

iOS decides when a widget redraws itself — typically a few times an hour, and it
throttles apps that ask for more. There is no way for a Scriptable widget to
refresh itself on demand.

So the `↻` in the corner is a hint, not a button: tapping the widget runs the
script, which fetches current rates and shows them immediately inside
Scriptable. That also updates the saved copy the widget reads, so the Home
Screen tile picks up the new numbers on its next redraw.

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
falls back to the cache, the footer says `cached` (the wider sizes show `CACHED`
in the header).

Treasury yields are not published on weekends or federal holidays, and SOFR is
published a business day behind. The widget always shows the most recent
*available* observation rather than a gap, and names both dates when they
differ.

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
- `REFRESH_MINUTES` — how often iOS is *asked* to refresh; it treats this as a
  hint.

## Notes

This folder is standalone — it is not part of the Next.js app and is excluded
from its lint config.
