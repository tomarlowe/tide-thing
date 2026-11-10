# Architecture

A single-page React app running full-screen on the Car Thing (800×480) under bridgething. It has no server. The Car Thing talks to the phone through the bridgething client, and the phone makes every web request.

```
Car Thing screen (React)
   src/App.tsx            header, alert strip, pager, keys, footer
   src/ui/*               four screens and small shared pieces
   src/lib/derive.ts      turns the data snapshot into what the screens show
   src/lib/data.ts        TideData: fetches, caches, refresh loop, spoken warnings
        │  net.fetch, geo.getOnce, store.get/put, audio.tts   (@bridgething/client)
        ▼
   Phone → NOAA CO-OPS, NOAA NDBC, NWS (api.weather.gov)
```

## Modules in `apps/tide-thing/src/lib`

- `geo`, `moon`, `sun`, `tide`: plain calculations (distance and rounding, moon phase, sunrise and sunset, tide curve between predicted highs and lows).
- `noaa`, `ndbc`, `nws`: URL builders and parsers. They do not do network calls.
- `flood`, `risk`, `rain`, `alerts`, `stale`, `fishing`: the rules that decide the wording shown.
- `snapshot`: the single data object the screens read.
- `data`: the only module that does I/O, through injected `fetcher`, `kv`, `locate` and `speak` functions, which is what makes it testable without a device.

## Refresh

On start and every 5 minutes: location, nearest station (cached), predictions, latest water level, wind, water temperature, pressure, and NWS alerts. Rain outlook and buoy data every 25 minutes or more. If a call fails the last good data stays on screen (held in memory) and its age is shown.
