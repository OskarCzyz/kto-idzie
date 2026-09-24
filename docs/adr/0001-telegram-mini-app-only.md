# Telegram Mini App as the only way in

The app runs only as a Telegram Mini App, and a participant's identity is their Telegram account. There is no standalone login. The youth group already lives in Telegram, so this gives zero-friction sign-in, stops people impersonating each other, and opens with one tap from the group chat. The cost: anyone without Telegram can't use the app, and the Bot API can't list group members, so participants onboard themselves on first open instead of being imported.

## Consequences

- The bot exists only to launch the Mini App and verify identity. It sends no notifications and posts nothing in groups (explicit no: the user doesn't want spam).
- The app has no contact features. People talk in Telegram themselves.
