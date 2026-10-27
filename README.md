# DBZ Rush Fighter 2.0 – analytics platform

Status: **API and Next.js dashboard are both built and tested end to end. The game does not upload yet** (needs the game developer's libcurl work, see `docs/GAME_INTEGRATION.md`). Not deployed anywhere yet.

```
platform/
  contracts/   match.v1.schema.json, replay.v1.schema.json (derived from stats_io.cpp / replay_io.cpp),
               fixtures/real_game_output.sample_stats.json (copied unchanged from the game)
  api/         Express + TypeScript API, Postgres schema (src/schema.sql), tests, seed script
  web/         Next.js 16 dashboard (server-rendered, Tailwind, Framer Motion, SVG charts)
  docs/        API.md, GAME_INTEGRATION.md
```

## Run it
```bash
cd api && npm install
npm run typecheck && npm test        # 38 tests; uses in-process Postgres (PGlite), no setup needed
npm start                             # http://localhost:4000, data in ./.data/pglite
npm run simulate -- 6 40              # OPTIONAL dev seed: sim_* accounts, flagged seed=true
```

## Run the dashboard
```bash
# terminal 1
cd api && npm start                                  # API on :4000
# terminal 2
cd web && npm install && cp .env.example .env.local   # API_URL=http://localhost:4000
npm run build && npm start                           # http://localhost:3000
npm run typecheck
npm run e2e        # starts a real API + the built web app on :4011/:3011 and drives the full journey (35 checks)
```
The browser never talks to the API directly. Next.js route handlers call it server-side, keep the session in an HttpOnly cookie, and `API_URL` stays server-side (no `NEXT_PUBLIC_` variables).

## Where the keys go
Two files, both already created with blank values. They start with a dot, so Windows Explorer / macOS Finder may hide them; open them from your editor.

| File | What to fill in |
|---|---|
| `api/.env` | `DATABASE_URL` (Supabase), `AI_PROVIDER=gemini`, `GEMINI_API_KEY` + `GEMINI_MODEL` (AI coach) |
| `web/.env.local` | `API_URL` (where the API runs; already `http://localhost:4000`) |

* **Supabase**: dashboard → your project → **Connect** (top of the page) → **Session pooler** → copy the URI into `DATABASE_URL` and replace `[YOUR-PASSWORD]` (URL-encode special characters). The Session pooler works on IPv4-only hosts; the "Direct connection" string is IPv6-only.
* **AI coach**: set `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL` (for example, `gemini-3.8-flash`). If the Gemini credentials are missing, the rule-based coach runs, labelled "Rule-based coach (not AI)". OpenAI remains available by setting `AI_PROVIDER=openai` with `OPENAI_API_KEY` and `OPENAI_MODEL`.
* Leave `DATABASE_URL` blank to use a local file database (fine for development).
* **Check the database connection**: `cd api && npm run db:check` (connects, creates the tables, reports `5 of 5`). Restart `npm start` after editing `.env`.
* On Render/Vercel, put the same names in the host's environment-variable settings instead of files. `.env` files are git-ignored; never commit real keys. Never put keys in `web/` files that start with `NEXT_PUBLIC_`.

Other API variables: `PORT` (4000), `WEB_ORIGIN` (only if a browser calls the API directly; the dashboard does not), `PGLITE_DIR`.
The schema is applied automatically at start (`CREATE TABLE IF NOT EXISTS`). The API is the only database client; do not expose the tables through Supabase's public Data API.

## Deploying (not done, not verified)
Suggested from the project plan: API on Render with `DATABASE_URL` (Supabase Postgres connection string), `GEMINI_*` optional; dashboard on Vercel with `API_URL` pointing at the API. Because the browser only calls the Next.js server, the API needs no CORS setup for this dashboard. Run `npm run e2e` against the deployed pair's local equivalent before relying on it. Free-tier hosts sleep when idle, so the first request after a pause can be slow, and the game's uploader should retry.
