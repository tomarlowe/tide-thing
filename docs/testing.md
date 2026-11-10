# Testing

## Automated (run in CI and by hand)

- `bun run --cwd apps/tide-thing typecheck` – type checks.
- `bun test apps/tide-thing/src/lib` – 50 unit tests of calculations and parsers.
- `bun run check` – builds, bundles, and validates the store catalog.

Some test data are real values copied from live NOAA responses on 2026-11-10; the rest are made up.

## Device

- Thomas installed 0.1.0 on his Car Thing and reported it as working. No written checklist.
- Speech through the phone: confirmed on his device using a separate throwaway app.

## Not tested

- Speech over car speakers.
- Live NWS alerts query and its response shape (the build environment could not reach the service).
- Flood-level conversion except at Charleston, SC.
- Real flood events, real warnings, other coasts, long runs.
- The wave-height combination formula against NDBC's own values.
- 0.1.1 (the icon-only change from 0.1.0) has not been run on a device.

## Simulated

Screenshots marked "simulated" use made-up data and show layout only.
