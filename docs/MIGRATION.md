# Migration and verification notes

## Original architecture

The original desktop document is a 1920×1080 absolute-positioned board. The mobile document has a separate 1080×1350 composition. `script.js` and an inline mobile script handled controls, IndexedDB assets and html2canvas export. Both called a hardcoded localhost update API. The Python CLI scraped, rewrote both HTML files and optionally ran an HTTP server/watch loop. The newer Node server scraped with Playwright and returned HTML fragments, but did not persist updates. Its renderer omitted the `leftforlogo` / `rightforlogo` positioning classes present in the Python renderer and checked asset paths on disk. Drive used a hardcoded Apps Script URL and opaque no-CORS responses, which could not confirm uploads. Dependencies and Python bytecode were committed to Git.

## Resulting architecture

- Original board markup and board-specific CSS retained. Shared `script.js` updates existing rank-slot templates, retaining all original coordinates and ranking colors.
- `shared/standings.js` provides identical browser/server normalization, identity matching, URL checks and complete-table validation. No fuzzy substring matches; ambiguous/new teams require an explicit alias in `teams.json`.
- `api/update.js` calls an authenticated JavaScript worker, validates its result, and commits the entire snapshot to Redis before reporting success. Redis `SET NX EX` prevents simultaneous requests across Vercel instances and imposes a one-minute cooldown even after failure. No settings or standings are written to the server filesystem.
- `api/standings.js` reads the last validated snapshot. The supplied HTML and `data/standings.json` are an explicitly undated fallback. Browser snapshots survive refresh and navigation; newer shared snapshots replace older non-manual local snapshots. Manual drafts are intentionally kept until UPDATE.
- `worker/` contains the opt-in authorized Playwright implementation and Dockerfile. It is a separate long-running Node service; Vercel does not launch Chromium. Its source selectors require verification against the permitted competition before production use.
- `api/drive.js` authenticates editor uploads and reads a real Apps Script result. Uploaded images are stored locally as Blobs so export does not depend on Drive thumbnail CORS. Same-name Drive files can be reused or uploaded again.
- `scripts/build.js` publishes an explicit static file allowlist, self-hosts html2canvas, and losslessly recompresses PNGs without changing dimensions. Source assets remain untouched. Fonts are self-hosted with the Alexandria OFL license. html2canvas is loaded only when exporting.

## Removed code

Python source, requirements and bytecode; duplicate backup frontend; obsolete scraper/HTML-string renderer; committed dependency files (untracked, still installed locally); old inline mobile controller; duplicate Drive script loading, JSONP and opaque upload success; zoom-blocking listeners and stale Python-server notifications. Export options, hashtag edits, local asset uploads, Drive upload, both view layouts and all source artwork/fonts remain. The old watch use case is supported by an optional scheduled API caller described in the README.

## Visual reference

`tests/fixtures/` contains the board markup and styles captured from the original Git HEAD before editing, with controls/scripts excluded and the same Alexandria font loaded locally. `assets/preview.png` is retained as the historical reference artwork. It has different standings, text sizing and placement from the supplied running HTML; the migration deliberately preserves the running board geometry instead of redesigning it to match that older image.

The browser suite compares original and migrated boards at native dimensions, then compares actual downloadable PNGs against html2canvas exports of the original markup. It also exercises mobile viewport placement, failure recovery, live-update fixtures, browser persistence and manual editing. Screenshot checks allow only a tiny rasterization tolerance; see the test output for measured differences. Export checks include all artwork and exclude the application controls by construction.

## External verification still required

No Vercel project/account, Redis credentials, or replacement Apps Script credentials were supplied. No live deployment, worker container deployment, or real Drive write was performed. API success/failure paths are tested with deterministic mocked external services. In the follow-up, the supplied live Flashscore URL successfully returned 16 validated teams; its current column selectors were added to the parser. No anti-bot bypass is implemented.

## Direct local update follow-up

`npm start` now routes standings requests to `lib/local-standings.js` by default. UPDATE calls `worker/scrape.js` directly, with no external worker or Redis setup. Successful validated snapshots are written atomically to ignored `.local-data/`; the previous snapshot is retained on failure. This module is used only by `server.js`, not the Vercel `api/` entrypoints. The hosted worker shares the same scraper/parser. Configuring `STANDINGS_PROVIDER_URL` selects the remote integration instead.
