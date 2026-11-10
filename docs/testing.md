# Testing

## Automated (run in CI and by hand)

- `bun run --cwd apps/tide-thing typecheck` – type checks.
- `bun test apps/tide-thing/src/lib` – 51 unit tests of calculations and parsers.
- `bun run check` – builds, bundles, and validates the store catalog.

Some test data are real values copied from live NOAA responses on 2026-11-10; the rest are made up.

## Device

- Thomas installed 0.1.0 on his Car Thing and reported it as working. No written checklist.
- Thomas installed 0.1.2 on his Car Thing on 2026-11-10 and took the four screenshots in the README with `bun run shot`. They show all four screens drawing live Charleston, SC data with no errors. Nothing else was checked on the device and no checklist was written.
- Speech through the phone: confirmed on his device using a separate throwaway app.

## Not tested

- Speech over car speakers.
- Live NWS alerts query and its response shape (the build environment could not reach the service).
- Flood-level conversion except at Charleston, SC.
- Real flood events, real warnings, other coasts, long runs.
- The wave-height combination formula against NDBC's own values.
- Anything on the device beyond what the four screenshots show: wheel and button behavior in 0.1.2, the alert strip with a live alert, and stale-data labels.

## Simulated

Screenshots marked "simulated" use made-up data and show layout only.
