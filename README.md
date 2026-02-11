# Beliefted — Christian Prayer Wall & Social Journal

Beliefted is a community-first web app for sharing prayer requests and daily words of encouragement. It blends a Threads/X-inspired feed with a gentle spiritual focus, plus profiles, comments, notifications, and theming.

## Features
- Prayer wall feed with anonymous posting
- Pray counts (non-reversible) and comments
- Word of the Day feed with likes and comments
- Profile pages with username, bio, followers, and following
- Theme preferences (Light, Dark, Midnight, Purple Rose)
- Notifications for prayers, comments, and word interactions
- Expiring prayers (7d, 30d) or Never

## Tech Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS (custom design system in `globals.css`)
- MongoDB Atlas + Mongoose
- NextAuth.js (Google OAuth)
- TanStack Query (client data fetching)
- Phosphor Icons

## Local Development

1. Install dependencies
```bash
npm install
```

2. Create `.env.local` and add:
```env
MONGODB_URI=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

3. Run the dev server
```bash
npm run dev
```

Open http://localhost:3000

## Production
When deploying (e.g., Vercel), set `NEXTAUTH_URL` to your live domain:
```env
NEXTAUTH_URL=https://YOUR_DOMAIN
```
Also add this redirect URI in Google OAuth:
```
https://YOUR_DOMAIN/api/auth/callback/google
```

## Scripts
- `npm run dev` — start dev server
- `npm run build` — build for production
- `npm run start` — start production server

## Project Structure (high level)
```
src/
  app/            # App Router pages + API routes
  components/     # UI + feature components
  lib/            # db + auth helpers
  models/         # Mongoose models
```

## Roadmap
- Mood tracker + journaling
- Bible verse discovery
- Enhanced notifications
- Performance & accessibility polish

## License
Copyright (c) 2026 Vondcm (Beliefted). All rights reserved.
This project is proprietary and not licensed for redistribution, modification, or public use.
