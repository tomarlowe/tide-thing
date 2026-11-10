# Data sources

Terms read on **2026-11-10**. Nothing here needs an account or a key. Requests go from the phone.

| Source | Used for | What it receives | Limits and terms |
|---|---|---|---|
| NOAA CO-OPS data API (`api.tidesandcurrents.noaa.gov/api/prod/datagetter`) | tide predictions, water level, wind, water temperature, pressure | station id, time range, `application=TideThing` | No terms page or numeric rate limit found. App asks at most every 5 minutes. |
| NOAA CO-OPS metadata API (`.../mdapi/prod/webapi`) | station list, official flood levels, datums | station id | Station list fetched once and cached 30 days. |
| NOAA NDBC (`www.ndbc.noaa.gov`) | buoy list (`activestations.xml`), latest buoy readings (`data/latest_obs/<id>.txt`) | buoy id | Its guide asks for limited request frequency; app asks at most every 25 minutes. The NDBC disclaimer page could not be opened when checked, so **its terms are unread**. |
| NWS API (`api.weather.gov`) | active alerts for your point, 6-hour rain outlook | rounded latitude and longitude, a User-Agent naming this app | Requires a User-Agent. No key today, but NWS has said a key will be required in the future, which would conflict with the no-keys rule. A 401 or 403 is shown as "NWS access changed", never as "no alerts". |

## Notes

- Thomas's rule is to skip any service whose terms forbid this use. None of the above was found to forbid it, but for NDBC the terms page could not be read, and CO-OPS publishes none.
- The alert and forecast lookups could not be tested live from the build environment (see [testing.md](testing.md)).
- Flood thresholds from CO-OPS are in the station's own datum. The app converts them by subtracting the station's MLLW value. That was checked at Charleston only (9.77 − 2.76 = 7.01 ft MLLW). A plausibility check refuses implausible results.
- Nothing is sent to any service other than these. No fonts, analytics or tiles are fetched.
