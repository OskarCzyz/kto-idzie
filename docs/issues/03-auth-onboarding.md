# 03 · Telegram auth + onboarding

- Middleware validates `X-Telegram-Init-Data` (HMAC-SHA256 with `WebAppData`, max age 24 h), and bypasses it when `DEV_AUTH=1`.
- On first request the participant is created from Telegram id, name and photo URL.
- Onboarding screen: pick gender + age bracket (2 taps), stored on the participant.
- Organizers: the `ORGANIZER_TELEGRAM_IDS` env seeds the first ones, and the `is_organizer` flag in D1 holds the rest.
- In the SPA: `Telegram.WebApp.ready()`, `expand()`, `disableVerticalSwipes()` (needed for drag & drop), theme colours from `themeParams`.
