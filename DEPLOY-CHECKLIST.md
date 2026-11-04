# ReelMatch deployment checklist

This replacement aligns the React frontend with Express API routes.

## Install
1. Replace the contents of your existing GitHub working copy with this project's source (keep your `.git` folder).
2. Do NOT commit `.env`, `.env.local`, `node_modules`, or `dist`.
3. Run `npm ci --include=dev && npm run build` locally using Node.js 24.12+.
4. Run `node server/index.js` locally (with a private `.env` file).
5. Push changes to your existing GitHub repository. Render will deploy the new commit.

## Render
- Build command: `npm ci --include=dev && npm run build`
- Start command: `node server/index.js`
- Health check: `/api/health`
- Required environment variable: `TMDB_READ_ACCESS_TOKEN` (or legacy `TMDB_TOKEN`).
- OpenAI requires `OPENAI_API_KEY` and `OPENAI_MODEL` (choose a currently supported model).
- `ENABLE_PUBLIC_AI=false` keeps paid AI features disabled on the public website. Do not enable this without stronger persistent quotas and abuse protections; the included in-memory limits are only a development safeguard.

## Production smoke tests
1. GET `/api/health` -> JSON with `ok: true`.
2. GET `/api/search?query=Interstellar` -> JSON array with movies.
3. GET `/api/trending` -> JSON object with `results` array.
4. GET `/` -> React HTML.
5. AI endpoints return 503 when `ENABLE_PUBLIC_AI=false`.

## Known limitations
- No verified live TMDB or OpenAI requests were made in the packaging environment.
- Favorites and reactions use browser localStorage, not cloud synchronization.
- AI endpoints are gated off by default for public visitors; per-IP in-memory counters alone are not production-grade abuse protection.
- Dependency audit warnings from the original lockfile need review before full launch.
- TMDB commercial licensing needs review before monetization.
