# 🀄 Journey Learning (Mandarin Web V2)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-v5-FF4154?logo=react-query)
![Vitest](https://img.shields.io/badge/Vitest-Unit_Tests-FCC72B?logo=vitest)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright)

A web-based e-learning platform for **learning Mandarin Chinese, one character a day**, aligned with the **HSK 3.0** curriculum. It combines spaced-repetition flashcards, structured lessons, quizzes, writing and tone practice, mini-games, and progress tracking. The interface is in Indonesian.

🔗 **Live demo:** https://mandarin-journey.vercel.app

> Built and maintained by a solo developer.

---

## ✨ Features

### Learning
- **Flashcards with Spaced Repetition (SM-2)** — four ratings (Forgot / Hard / Good / Easy) schedule each card; due cards are surfaced daily.
- **Structured modules** — levels, lesson parts, tags, videos, bookmarks, and per-module quizzes and progress.
- **Grammar** — grammar patterns with practice questions.
- **Stories (Cerita)** — reading practice in paragraph-based story sets.
- **HSK exam simulation** and a **placement test** that unlocks the right starting tier.
- **Personal decks** — create your own cards, decks, and themes; mark favorites.

### Practice
- **Hanzi writing** and a **Hanzi map** for exploring characters.
- **Tone (nada) practice** and **speaking practice** using the browser's speech recognition and text-to-speech (`zh-CN`).
- **OCR scanner** — scan Chinese text from images using Tesseract.js (`chi_sim`).
- **Mini-games** — Match, Snake, and Speedrun, each with scores.

### Motivation & Tracking
- Daily **streaks**, **XP**, statistics dashboard, and achievement badges.
- Social features (follow other learners) and leaderboards.
- Customizable hanzi display font.

### Platform
- **Installable PWA** with a service worker (navigation is intentionally not cached, to avoid stale auth redirects).
- **Admin panel** — 14+ CRUD pages for all content tables, with *optimistic updates*, user management, role management, and in-app bug reports.
- **Error boundaries** (`error.tsx`) per section, so one failing page does not take down the rest of the app.

---

## 🧠 How the SRS Works

The scheduler is a customized **SM-2**. Ratings map to quality `0` (Forgot), `3` (Hard), `4` (Good), `5` (Easy). The ease factor starts at `2.5`, never drops below `1.3`, and intervals are capped at `365` days.

| Review # (consecutive correct) | Hard (3) | Good (4) | Easy (5) |
|---|---|---|---|
| 1st | 1 day | 1 day | 1 day |
| 2nd | 3 days | 6 days | 8 days |
| 3rd and later | interval × 1.2 | interval × EF | interval × EF × 1.3 |

- **Forgot** resets the card to 1 day and zero repetitions; the ease factor is left unchanged.
- The ease factor is updated from the rating *before* the interval is computed.
- The last rating is stored in `user_card_progress.last_quality`. A word counts as *mastered* only if its latest rating is Good or Easy (legacy cards fall back to `srs_level >= 1`).
- Dates use the user's local timezone, so a review at 23:30 is not scheduled a day early.

The core logic lives in `src/lib/srs.ts` and is covered by unit tests in `src/test/srs.test.ts`.

---

## 🚀 Architecture & Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + React Server Components |
| Language | TypeScript |
| Styling / UI | Tailwind CSS 4, shadcn/ui |
| Data fetching & cache | TanStack Query v5 (optimistic updates in the admin panel) |
| Backend / DB | Supabase (PostgreSQL, Auth with Google OAuth, Row Level Security, Edge Functions) |
| OCR / Speech | Tesseract.js, Web Speech API |
| Testing | Vitest (unit), Playwright (E2E) |
| CI / Hosting | GitHub Actions, Vercel |

Highlights:
- **Server-first rendering** — Server Components for read-heavy pages; client components only where interaction is needed.
- **End-to-end types** — `src/lib/database.types.ts` is generated from the Supabase schema (`npm run supabase:types`) and used for typed queries.
- **Request proxy** (`src/proxy.ts`) — refreshes the session, verifies the user with `getUser()`, redirects unauthenticated visitors, and sends new users through the placement test before the dashboard.
- **Edge Function** `get-user-stats` aggregates per-user statistics server-side.

---

## 🔐 Security Model

- **Authentication:** Supabase Auth (Google OAuth). The OAuth callback only redirects to same-origin paths, which prevents open-redirect attacks via the `next` parameter.
- **Roles:** `superadmin` > `admin` > `user`, stored in `user_profile.role`. The database is the single source of truth; there are no hardcoded admin emails in the client.
- **Admin RPCs:** `SECURITY DEFINER` functions (`get_all_users_admin`, `get_users_for_regular_admin`, `update_user_role_admin`, `get_admin_stats`) check the caller's role *inside* the function, and `EXECUTE` is revoked from `anon`/`PUBLIC`.
- **Role-change guard:** a database trigger on `user_profile` rejects changes to the `role` column unless the caller is a superadmin, regardless of which code path performs the update.
- **Row Level Security:** policies on `user_profile` use helper functions (`is_admin()`, `is_superadmin()`) instead of self-referencing subqueries; profile inserts are restricted to the `user` role.
- **Admin area:** the admin layout hides `/dashboard/admin` from non-admins in the browser, but the real enforcement lives in the database: write policies on content tables require `is_admin()`, and the admin RPCs verify the caller's role.

> Client-side role helpers in `src/lib/auth-roles.ts` exist only to show or hide UI. Real enforcement happens in the database (RLS policies, RPC role checks, and triggers).

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── auth/callback/         # OAuth callback (sanitized redirect)
│   ├── login/  privacy/  terms/
│   └── dashboard/
│       ├── admin/             # Admin panel: users, analytics, database CRUD
│       ├── flashcard/  review/  practice/   # SRS flashcards, quizzes, tone & writing practice
│       ├── modul/  grammar/  cerita/        # Lessons, grammar, stories
│       ├── games/                           # match, snake, speedrun
│       ├── peta-hanzi/  tulis-hanzi/        # Hanzi map and writing
│       ├── placement/  simulasi-hsk/        # Placement test and HSK simulation
│       ├── personal-cards/  favorit/        # Personal decks and favorites
│       └── statistik/  profile/  settings/
├── components/
│   ├── ui/                    # shadcn/ui base components
│   └── ...                    # Feature components (flashcard session, OCR scanner, ...)
├── hooks/                     # use-supabase, use-pwa-install, use-service-worker, use-mobile
├── lib/
│   ├── supabase/              # Browser & server clients
│   ├── database.types.ts      # Generated DB types
│   ├── auth-roles.ts          # Client-side role helpers (UI only)
│   ├── admin-middleware.ts    # requireAdmin() / checkAdminStatus()
│   └── srs.ts                 # Spaced-repetition algorithm
├── proxy.ts                   # Session refresh and route protection
└── test/                      # Vitest unit tests

e2e/                           # Playwright specs
supabase/
├── migrations/                # SQL migrations (incremental changes)
└── functions/get-user-stats/  # Edge Function
public/                        # PWA manifest, icons, service worker
```

---

## 🏁 Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project (free tier works)
- Supabase CLI (optional, for generating types and pushing migrations)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local (see below)

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Optional: enables the test login route used by E2E tests. Never enable in production.
# NEXT_PUBLIC_TEST_MODE=true
```

Never commit `.env*` files. If a key was ever committed, rotate it in the Supabase dashboard.

### Scripts

```bash
npm run dev               # Local development server
npm run build             # Production build
npm run lint              # ESLint
npm run test              # Unit tests (Vitest)
npm run test:ui           # Vitest UI
npm run test:coverage     # Coverage report
npm run test:e2e          # End-to-end tests (Playwright)
npm run analyze           # Bundle analysis
npm run supabase:types    # Regenerate database.types.ts from the schema
npm run db:pull           # Pull remote schema changes into a migration
npm run db:new            # Create a new migration file
npm run db:diff           # Diff local vs remote schema
npm run db:push           # Push local SQL migrations to the remote Supabase project
```

---

## 🗄️ Database Notes

- Incremental schema changes live in `supabase/migrations/` (SM-2 columns, role system, `last_quality`, word compounds, and more).
- **The base tables were originally created through the Supabase dashboard**, so the migration folder alone does not rebuild the full schema. To reproduce the database in a new project, export the current schema first:

  ```bash
  supabase link --project-ref <project-ref>
  supabase db dump -f schema.sql
  ```

  Then run `schema.sql` in the new project, followed by any newer migrations.
- **Migration source of truth:** `supabase db push` only applies files in `supabase/migrations/`. SQL files in the repository-root `migrations/` directory are legacy/manual scripts and are not deployed by that command. Before recreating a project or applying these legacy scripts, reconcile them with the live database schema and migration history; do not assume they have run just because they are present in the repository.
- Current role hardening is in `supabase/migrations/20261019050000_harden_user_profile_roles.sql`; the follow-up `20261030000000_fix_admin_rpc_null_role_guard.sql` closes the missing-profile authorization case.

---

## ✅ Testing & CI

- **Unit tests (Vitest)** — SRS interval calculation, session accuracy and mastery counting, dashboard statistics, profile badges, and hanzi map logic. Run with `npm run test`.
- **E2E tests (Playwright)** — home page smoke test and admin CRUD flow. Run with `npm run test:e2e`.
- **CI (GitHub Actions)** — on every push and pull request: lint, type-check, and tests. Database migrations are **not** deployed automatically; a manual `workflow_dispatch` job (dry run by default) exists for that, because the base schema was created outside the migration folder.

---

## 🛣️ Roadmap

- [ ] Gate `/dashboard/admin` on the server (`requireAdmin()` in a server layout) instead of only in the browser
- [ ] Form validation (Zod) and `CHECK` constraints for admin-edited content
- [ ] Broader test coverage (SRS edge cases, study-session flows)
- [ ] Cap per-session XP in `get_user_stats()` and make the ranking query set-based
- [ ] Guest/demo mode for first-time visitors
- [ ] Export the full base schema into `supabase/migrations/` so the database can be rebuilt from the repo

---

*Last updated: October 2026*
