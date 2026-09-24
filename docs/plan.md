# Plan

Domain language: [CONTEXT.md](../CONTEXT.md). Decisions: [adr/](adr/). Prototype that the UI follows: `prototype/ranking.PROTOTYPE.html` on branch `prototype/ui` (the day-by-day ranking screen, based on prototype variant C).

## Architecture

- **One Cloudflare Worker** ([ADR 0002](adr/0002-cloudflare-free-tier.md)):
  - **Hono** handles the API under `/api/*`.
  - Workers static assets serve the built SPA.
- **D1** stores the data, with plain SQL migrations in `migrations/`.
- **R2** stores activity photos, served through `/api/photos/:key`.
- **The SPA** is React, TypeScript and Vite. It runs as a **Telegram Mini App** ([ADR 0001](adr/0001-telegram-mini-app-only.md)). The UI is Polish only.
- **Auth**:
  - Every API request sends Telegram `initData` in a header.
  - The Worker validates it with an HMAC over the bot token. There are no sessions.
  - Local dev skips this and uses a fake user when `DEV_AUTH=1`.
- **Domain core** is `src/domain/`: pure TypeScript with no I/O, tested with Vitest. It holds:
  - resolving the current choice (conditions, mutual conditions, multi-day conflicts)
  - day status
  - eligibility
  
- **Data flow:**
  - `GET /api/state` returns the whole camp (~17 KB for 50 people), and the SPA runs `resolve` itself.
  - `PUT /api/plan` replaces the caller's plan, which the server first normalizes with the same domain code.
  - Edits are optimistic.
- **Live updates:** the SPA polls `/api/state` every 10 s while visible. There are no notifications.
- **Local dev:**
  - `npm run db:migrate:local && npm run db:seed:local && npm run dev`
  - Open `http://localhost:5173/?as=1`: Kuba, organizer. Use `?as=2` for Tomek, and so on.

## Layout

```
src/domain/      pure model + resolution (shared by worker and SPA)
src/worker/      Hono app, D1 queries, Telegram auth
src/web/         React SPA
migrations/      D1 SQL migrations
```

## Issues (in order)

| # | Issue | Depends on |
|---|-------|-----------|
| 01 ✅ | [Skeleton: Worker + SPA + D1 + tests, deployable](issues/01-skeleton.md) | – |
| 02 ✅ | [Domain core: ranking resolution](issues/02-domain-core.md) | 01 |
| 03 ✅ | [Telegram auth + onboarding](issues/03-auth-onboarding.md) | 01 |
| 04 ✅ | [Organizer admin: camp, activities, offerings, photos](issues/04-admin.md) | 03 |
| 05 ✅ | [Day screen (read): current choice, options, who's going](issues/05-day-screen.md) | 02, 04 |
| 06 ✅ | [Ranking editing: add/remove, drag & drop, conditions, status, conflicts](issues/06-ranking-editing.md) | 05 |
| 07 ✅ | [Offering / person sheets, plan summary, wave countdown](issues/07-sheets-summary.md) | 05 |
| 08 ✅ (no change highlight yet) | [Live refresh + optimistic updates](issues/08-live.md) | 06 |
| 09 ✅ | [Camp lifecycle: close camp, copy activities](issues/09-lifecycle.md) | 04 |
| 10 | [Deploy + BotFather setup (human steps)](issues/10-deploy.md) | 01, 03 |
