# 10 · Deploy + BotFather

These are human steps (could be a wizard script):

1. Cloudflare account → `wrangler login` → create D1 and R2 → put their IDs into `wrangler.jsonc`.
2. BotFather: `/newbot`, then `/newapp` or set the menu button URL to the Worker URL.
3. `wrangler secret put BOT_TOKEN` and set `ORGANIZER_TELEGRAM_IDS`.
4. Apply migrations remotely → `npm run deploy`.
5. Pin the Mini App link in the group chat.
