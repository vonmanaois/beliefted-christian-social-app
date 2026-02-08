# Developer Onboarding — Beliefted

Welcome! This guide explains how the project is structured, how data flows, and how to safely extend features without breaking existing behavior.

## 1) Quick Start

```bash
npm install
npm run dev
```

Create `.env.local` with:
```env
MONGODB_URI=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## 2) Architecture Overview

**Next.js App Router**
- `src/app`: routes, pages, and API endpoints
- `src/components`: UI and feature components
- `src/models`: Mongoose schemas
- `src/lib`: DB connection + auth helpers

**Data Flow**
1. UI component calls an API route (`/api/...`)
2. API route uses Mongoose to read/write MongoDB
3. TanStack Query caches the response
4. UI renders the cached data and revalidates on changes

## 3) Core Models

**User**
```
name, email, image, username, bio, followers, following
```

**Prayer**
```
content, userId, isAnonymous, prayedBy[], expiresAt (optional)
```

**Comment**
```
content, userId, prayerId
```

**Word / WordComment**
Similar to Prayer/Comment but for Word of the Day.

## 4) Authentication

**NextAuth + Google OAuth**
- Client: `useSession()` to access user info.
- Server: `getServerSession(authOptions)` for protected API routes.

**Rule of thumb**
- If it writes data, it must validate the session on the server.

## 5) Themes

Themes are CSS variables in `src/app/globals.css`.

**How to use them**
```
color: var(--ink);
background: var(--panel);
border-color: var(--panel-border);
```

**Theme changes**
`next-themes` toggles `data-theme` on `<html>`.

## 6) UI State Best Practices

Use **derived state** instead of setting state in `useEffect`.

Example (good):
```
const activeTab = useMemo(() => (pathname === "/word" ? "Word" : "Prayer"), [pathname]);
```

Avoid:
```
useEffect(() => setActiveTab(...), [pathname]);
```

## 7) Adding a New Feature

**Checklist**
1. Add a Mongoose model (if needed)
2. Create API routes in `src/app/api/...`
3. Add UI + hooks using TanStack Query
4. Add profile link or ownership checks if needed
5. Validate session for POST/PATCH/DELETE routes

## 8) Common Patterns Used

**Comments**
- `GET /api/prayers/[id]/comments`
- `POST /api/comments`
- `PATCH/DELETE /api/comments/[id]`

**Prayers**
- `GET /api/prayers`
- `POST /api/prayers`
- `POST /api/prayers/[id]/pray`
- `PUT /api/prayers/[id]`
- `DELETE /api/prayers/[id]`

**Words**
- `GET /api/words`
- `POST /api/words`
- `POST /api/words/[id]/like`
- `PUT /api/words/[id]`
- `DELETE /api/words/[id]`

## 9) Best Practices for this Codebase

- Keep UI logic in components, data logic in API routes.
- Prefer theme variables over hard-coded colors.
- Keep anonymous prayers visible in feed, but hide from user profile.
- “Prayers lifted” is a **historical count** (do not decrement on delete/expire).

## 10) Where to Look

**Feeds**
- `src/components/prayer/PrayerFeed.tsx`
- `src/components/word/WordFeed.tsx`

**Cards**
- `src/components/prayer/PrayerCard.tsx`
- `src/components/word/WordCard.tsx`

**Profile**
- `src/components/profile/*`

---

If you’re unsure about a change, add it behind a feature flag or ask for review before merging.
