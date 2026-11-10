# Design decisions

Each decision says who made it. **Thomas** = chosen by the author. **AI** = chosen by the AI tool and not reviewed by Thomas; change it if you disagree.

## Product

| Decision | Who |
|---|---|
| US coasts only, NOAA and NWS data, no keys or accounts | Thomas |
| Four screens: Tide now, Moon & tide, Flood risk, On the water | Thomas |
| Moon screen uses the "Range" bar graphic | Thomas |
| Dropped: weather-radio playback and a street-level flooded-road tracker | Thomas |
| Alert strip on every screen, all severe NWS alerts; red for warnings, amber for watches and advisories | Thomas |
| Text first; a spoken line only for warnings | Thomas |
| Without official flood levels, say only "Higher than usual" or "Normal", never "flood" | Thomas |
| One-line rain outlook for the next 6 hours (none, light, heavy) | Thomas |
| Keep the last data, show "Updated N min ago", amber after 30 min, gray the flood wording after 1 hour | Thomas |
| On the water shows wind, water temperature, tides, sun times, waves and marine forecast when a buoy exists, fishing window labelled "rule of thumb, not NOAA data"; hide anything not reported | Thomas |
| Blue-water look | Thomas |

## Rules and numbers

| Decision | Who |
|---|---|
| Forecast peak = predicted high tide + the current surge (observed minus predicted), if positive | AI |
| Heavy rain raises the flood wording one step | AI |
| "Higher than usual" means 0.5 ft above the gauge's mean higher high water | AI |
| Rain: none below 0.05 in, heavy at 0.5 in or more over 6 hours | AI |
| Fishing windows are 1 hour either side of each tide turn; turns within 1.5 hours of sunrise or sunset rank first | AI |
| Moon phase from an average 29.53-day cycle | AI |
| Each warning is spoken once (remembered for 12 hours), one at a time; wheel click toggles speech | AI |
| Refresh: every 5 minutes; rain and buoy at most every 25 minutes; station and buoy lists cached 30 days | AI |
| Station within 150 miles, buoy within 120 miles | AI |
| Combined wave height = square root of (swell² + wind-wave²) | AI |
| Outfit font (bundled, no network font calls) | AI |
| Location rounded to 0.01° (about 1 km) before sending | Rule from Thomas's project rules; implementation AI |
| Icon: moon over tide waves in the app palette | AI |
