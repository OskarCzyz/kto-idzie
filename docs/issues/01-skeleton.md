# 01 · Skeleton

A deployable empty app that serves the SPA and one API route.

- Vite + React + TS SPA in `src/web`, Hono Worker in `src/worker`, `wrangler.jsonc` with D1 + R2 bindings and static assets.
- First D1 migration with the full schema: camp, camp_day, wave, activity, activity_photo, offering, offering_day, participant, pick, pick_rank, day_status.
- `GET /api/health` hits D1.
- Vitest configured. `npm run dev` runs the SPA and the Worker locally, `npm test` runs the tests, `npm run deploy` deploys.

**Done when:** `npm run dev` shows the SPA calling `/api/health` successfully against local D1.
