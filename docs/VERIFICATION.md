# Verification — 2026-10-10

- `npm install`: successful; audit reported zero vulnerabilities.
- `npm run build`: successful. Static allowlist generated in `dist/`; native-resolution PNGs reduced from 23.13 MB to 16.20 MB with original color metadata retained.
- `npm test`: all 9 tests passed on the installed Node 25 runtime; all 9 also passed under Node 22.
- `npm run test:browser`: passed on local Chromium. Desktop/mobile source-board comparisons and full PNG export comparisons each reported 0.0000% detected visual difference against the original markup, CSS and unmodified source artwork.
- Browser workflows verified: valid and incomplete source responses, failed update recovery, duplicate clicks, timestamps, refresh persistence, manual edits, logo uploads following team identity after reordering, settings, custom-row exports, missing-image export rejection, and 390px viewport control separation. No unhandled browser exceptions.
- HTTP checks verified desktop/mobile refresh routes, fonts/logos, HEAD requests, API seed response and private-file 404s.
- Mocked integration checks verified Redis locking/persistence failures, worker permission/auth gates, and confirmed/failed Drive responses.

Generated artifacts: `output/export-desktop.png`, `output/export-mobile.png`, `output/reference-*.png`, `output/current-*.png`, `output/ui-*-390.png`, and custom-row exports. These are local QA artifacts, ignored by Git. CI repeats the checks and uploads screenshots.

Follow-up: direct local Flashscore extraction was tested against the supplied competition URL and returned 16 validated teams (Club Africain first, 3 played, 9 points). The parser now recognizes the live `table__cell--value` and `table__cell--points` selectors. Local `npm start` uses this shared scraper without Redis or a separate worker, with atomic `.local-data/` snapshots. Additional tests cover persistence across local server restarts, partial/failed update recovery and concurrent requests.

Follow-up checks: all 10 unit/API tests and the desktop/mobile browser regression suite passed. The actual UPDATE button on the local server fetched the live source, displayed success and its timestamp, and persisted the snapshot. Both desktop and mobile restored the result. Screenshots: `output/live-update-desktop.png` and `output/live-update-mobile.png`.

Still not verified against real external services: Vercel deployment, hosted worker/container execution, Redis credentials, or Drive writes. No linked Vercel project or integration credentials were present. Browser/manual edits remain local to the browser; source snapshots are persisted by the local server or configured Redis.
