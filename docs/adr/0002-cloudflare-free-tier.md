# Cloudflare Pages/Workers + D1 + R2 on the free tier

Budget is zero and the app is used in short bursts (~3 weeks per camp) with long idle gaps. We host on Cloudflare (Workers/Pages for the app, D1 for data, R2 for activity photos) because its free tier covers ~50 users and does not pause idle projects, unlike Supabase's free tier, which pauses after a week of inactivity. Vercel + a managed Postgres was the main alternative.
