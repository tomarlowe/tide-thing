# How this was built

## Who did what

- **Thomas Marlowe** decided what the app is for, which screens it has, what each screen shows, the colours and look, what is dropped, how alerts are shown (red and amber, on every screen), what is said and not said about flooding, and how stale data is handled. He does not write code and chose to direct the work instead.
- **Claude (Anthropic's AI model)** wrote the code, tests, icon and documents in a sandbox, and researched the data services. Claude is a tool here, not an author.

## What was tested

- 50 automated unit tests cover the calculations and parsers (moon, sun, tide curve, flood levels, rain, alerts, stale-data wording, buoy parsing, distance). Some tests use real values taken from the live NOAA services on 2026-11-10 (Charleston datums and flood levels; the NDBC buoy text format).
- Type checks and `bun run check` (build, bundle, catalog validation) pass.
- Thomas installed the 0.1.0 test build on his Car Thing and reported it working. No detailed checklist of what he checked was recorded.
- Speech through the phone was confirmed on his real device with a separate throwaway test app.

## What was not tested

- Speech over the car speakers.
- The live NWS alert lookup (`alerts/active?point=`). The build environment could not reach the service, so the alert parsing is based on the documented format only.
- Flood-level conversion at any station except Charleston, SC.
- Behaviour at other coasts, in other seasons, during a real flood event, or with a real warning.
- Running for hours or days in a car.

## What no human has reviewed

All source code, the tests, and the calculation rules in [design-decisions.md](design-decisions.md) marked as the AI's choices. Nobody other than the AI has read the code line by line.

## Simulated results

Any screenshot labelled "simulated" was rendered from made-up data. It shows layout only.
