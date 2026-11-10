# Contributing

Issues and pull requests are welcome. This is a hobby project and replies may be slow.

- Run `bun run --cwd apps/tide-thing typecheck`, `bun test apps/tide-thing/src/lib` and `bun run check` before opening a pull request.
- Do not change the app id in `apps/tide-thing/public/manifest.json`.
- A published version is never edited. Fixes ship as a new version (`bun run bump tide-thing patch`).
- Keep the screen glanceable. Nothing should demand attention while driving.
- No accounts, API keys or tracking.
- Say "tested" only for what was tested. Real-device results should come from someone who ran the device.
- If you used an AI tool, say so in the pull request.
