# LA ANT MATCH

A JavaScript-only standings studio preserving the supplied desktop (1920×1080) and mobile (1080×1350) graphics. No Python installation or runtime is needed. Plain HTML/CSS/JavaScript frontend, static Vercel hosting and three Node API functions.

## Run locally

Use Node.js 22.9+ (Node 22 LTS recommended) and npm:

```sh
npm install
npm run setup:browser
npm run build
npm start
```

Open http://localhost:8000. `npm run dev` rebuilds and starts the preview; `npm run preview` starts the existing build. Set `PORT` to use another port. Copy `.env.example` to `.env` for integrations; start/worker scripts load it automatically. Rebuild after frontend changes. Never commit `.env`.

Locally, UPDATE now opens the configured Flashscore URL with JavaScript/Playwright, extracts the 16 teams, and immediately updates the board. No Redis or separate worker is needed for `npm start`. Chromium is installed once with `npm run setup:browser`. Successful source snapshots are saved atomically under ignored `.local-data/` and survive server restarts. Failed/incomplete updates keep the last valid snapshot. The default URL is the supplied Flashscore competition link in `config.js`.

Vercel still uses the separate worker/Redis integration below; it never launches the local browser or writes persistent data to its filesystem. If `STANDINGS_PROVIDER_URL` is set locally, the server uses that remote integration instead of direct local scraping.

## Controls and persistence

- UPDATE validates all 16 teams. Names/logos come from `teams.json`; source images cannot replace them. Ranks come from the source, not sorting points. Add explicit aliases when names change. Incomplete, duplicate, ambiguous or invalid tables are rejected as a whole.
- EXPORT provides full-board/custom row PNG downloads at native resolution. Fonts and all images must load first. Controls, dialogs and notices are outside the exported element.
- FLASHSCORE opens the configured competition page directly in a new tab. Settings configures its URL. Only HTTPS URLs on the listed Flashscore hosts are accepted. The current board stays visible until a valid update succeeds.
- EDIT changes ranks, played matches, points, hashtags and images. Team-logo overrides follow team identity when ranks change.
- MOBILE / DESKTOP switches views and restores the shared browser snapshot.

| Data | Storage | Scope |
| --- | --- | --- |
| Last valid source standings and timestamp | Local `.local-data/` for `npm start`; Upstash Redis on Vercel | Shared across browsers using the same server, keyed by competition URL |
| Manual standings and settings | localStorage | This browser and origin |
| Uploaded images and hashtags | IndexedDB | This browser and origin; team images shared across views |
| Editor access token | sessionStorage | This tab only |
| Optional asset/PNG copies | Google Drive | Your configured folder |

Clearing browser data removes local edits/assets. Different browsers do not see manual edits or image overrides. Drive stores copies; it is not a shared settings database. To publish shared custom defaults, change the seed/HTML/assets in the repository and redeploy. Manual drafts survive newer server snapshots until UPDATE. Newer shared snapshots replace older non-manual local snapshots on page load. Browser data from localhost cannot automatically transfer to a Vercel domain.

## Deploy to Vercel

1. Push the repository to your Git host and import it in Vercel.
2. Select **Other**, Node.js **22.x**, install command `npm ci`, build command `npm run build`, output directory `dist`. Install development dependencies during the build: `sharp` runs at build time. No Playwright browser is installed or used by Vercel.
3. `vercel.json` configures durations, caching and `/mobile`. `/`, `/index.html`, `/mobile-index.html`, `/mobile` and `/api/*` are real routes and support refresh. No SPA fallback is needed.
4. Add integration variables in Project Settings → Environment Variables, then redeploy. Set a strong `EDITOR_TOKEN` before publicly enabling integrations. Worker/storage/Drive secrets are never included in the static build.
5. Open both views, enter the editor token in Settings, and verify a permitted UPDATE, failed-update recovery and both PNG exports.

Vercel supports Node functions in the root [`api` directory](https://vercel.com/docs/functions/runtimes/node-js) and a configured [output directory](https://vercel.com/docs/project-configuration/vercel-json). Local builds/tests have run; an actual Vercel account/project was not available for deployment.

## Provision live standings

Flashscore's [published terms](https://livesport.eu/terms-of-use/en) restrict automated requests and scraping without consent. No suitable documented public Flashscore API was identified. Obtain permission or use a licensed provider implementing the contract below. Set `FLASHSCORE_AUTHORIZED=true` only after source permission is established. Bot protection, changed markup and competition changes can prevent extraction; success is not guaranteed.

The supplied worker runs Chromium on a separate container host, **not in Vercel Functions**:

```sh
# Build from the repository root
docker build -f worker/Dockerfile -t la-ant-worker .
# Use a dedicated worker env file (see below)
docker run --env-file .env.worker -p 8080:8080 la-ant-worker
```

Worker environment: `PORT=8080`, `STANDINGS_PROVIDER_TOKEN` with a strong random value, and `FLASHSCORE_AUTHORIZED=true` only with permission. Deploy with HTTPS and enough memory for Chromium. The endpoint is `POST /standings`. Set the same provider token on worker and Vercel. The worker rejects unauthenticated requests, has a 35-second browser deadline, allows one scrape at a time, and never downloads logos or bypasses access challenges. Locally, run `npx playwright install chromium` then `npm run worker` on a different port from the frontend.

Create an Upstash Redis database and obtain its HTTPS REST URL/token using the [REST API setup](https://upstash.com/docs/redis/features/restapi). Configure these Vercel variables (see `.env.example`):

- `STANDINGS_PROVIDER_URL`: your HTTPS worker endpoint ending in `/standings`.
- `STANDINGS_PROVIDER_TOKEN`: the worker's secret token.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: database access.
- `EDITOR_TOKEN`: your private editor token, entered by the operator in app Settings.

Worker request: POST JSON `{"url":"https://www.flashscore.fr/classement/your-competition/"}` with `Authorization: Bearer <STANDINGS_PROVIDER_TOKEN>`. Response contract:

```json
{"standings":[{"rank":1,"team":"Espérance Tunis","played":4,"points":9}]}
```

Return **all 16** unique teams/ranks, not just the illustrative row. Names must match `teams.json` aliases (Arabic/French supported), or return canonical `key` values. Vercel validates again, stores the complete snapshot, and only then reports success. Redis failures, upstream errors, partial tables and timeouts leave the previous snapshot intact. A distributed 60-second lock/cooldown limits repeated requests, including failures. Source access is not attempted without configured storage.

For scheduled updates, configure a scheduler to POST `/api/update` with `Authorization: Bearer <EDITOR_TOKEN>` and JSON `{"url":"<competition URL>"}`. Store tokens as scheduler secrets and choose a frequency allowed by your source agreement. The same JavaScript pipeline serves scheduled/manual requests. No permanent server filesystem state is required.

## Optional Google Drive uploads

1. Create an Apps Script project using `google-apps-script.gs`.
2. Set Script properties `ROOT_FOLDER_ID` and a strong random `DRIVE_SHARED_SECRET` in Apps Script Project Settings.
3. Deploy as a Web app executing as you and accepting requests from the server. Every POST requires the shared secret, which is never sent to frontend code.
4. Set Vercel `DRIVE_API_URL` to the `/exec` URL, `DRIVE_SHARED_SECRET` to the matching value, and `EDITOR_TOKEN`.
5. In app Settings, enter the editor token and enable Drive uploads.

The authenticated same-origin proxy waits for a confirmed Apps Script result. Same-name files can be kept or uploaded again. No public sharing permissions change. Local images remain Blobs, avoiding Drive thumbnail/CORS dependencies in export. A failed Drive copy is reported separately from a successful local save/download.

The proxy supports files up to 2.8 MB to stay within request limits after base64 encoding. Larger native PNGs still download at full quality; the app explicitly reports that the Drive copy was not uploaded. Exports are never silently reduced.

## Tests and visual QA

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Run `npm run build` before browser tests. Unit/API tests cover matching, URL restrictions, partial/duplicate tables, local logo preservation, source success/failure, missing configuration, auth, cooldown and failed persistence. Browser tests start their own production server and check parser fixtures, both boards, real PNG downloads, update recovery, edits, refresh persistence, narrow-screen toolbar placement and unhandled browser errors.

`tests/fixtures/` preserves the original board markup/styles for visual regression. Generated reference/current screenshots, exports and responsive previews are in ignored `output/`. `assets/preview.png` and `assets/template.png` remain historical references, excluded from the public build because the app does not use them. The older preview differs from the supplied HTML; this migration preserves the running HTML's geometry.

The build self-hosts fonts and the lazily loaded export library, and losslessly recompresses PNGs without changing their dimensions. Original artwork is untouched.

See [migration notes](docs/MIGRATION.md) for the component map and removals. Direct local UPDATE was tested successfully against the supplied live Flashscore URL, including all 16 teams and both views. Vercel deployment, the worker container on a real host, Redis and Drive still require external provisioning and real-service verification. Local success does not imply those services have been deployed.
