# 🀄 Mandarin Web V2 - HSK 3.0 Learning Platform

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![React Query](https://img.shields.io/badge/TanStack_Query-V5-FF4154?logo=react-query)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright)
![Vitest](https://img.shields.io/badge/Vitest-Unit_Tests-FCC72B?logo=vitest)

Mandarin Web V2 is a comprehensive web-based E-Learning platform for learning Mandarin Chinese, following the latest **HSK 3.0 curriculum standards**.

This project was built from scratch by a solo developer using modern, mid-to-senior level software engineering principles, heavily focusing on scalability, type-safety, performance (UX), and maintainability.

---

## ✨ Key Features

- **Structured HSK Curriculum**: Learning modules, quizzes, and grammar exercises structured from HSK 1 to HSK 6.
- **Spaced Repetition System (SRS)**: Smart flashcard system utilizing memory algorithms to optimize vocabulary retention.
- **Admin Dashboard**: A highly reactive content management panel (14+ CRUD pages) featuring *Optimistic Updates*—rendering data changes instantly without waiting for database responses.
- **Gamification**: Story relays, speedrun modes, and scoring systems designed to keep users motivated.
- **Secure Authentication & RLS**: User data is securely protected utilizing Supabase authentication and Row Level Security (RLS) policies at the PostgreSQL level.

---

## 🚀 Architecture & Tech Stack

The tech stack was meticulously chosen to enforce a clear separation of concerns between the UI, state management, and the database.

### 1. Frontend & Framework: Next.js (App Router) + React Server Components
- Leverages **React Server Components (RSC)** to statically render pages on the server (ensuring SEO friendliness and zero client-side JS overhead for reading materials).
- **Tailwind CSS & shadcn/ui**: Provides a consistent, modern, responsive, and accessible UI without being tied to heavy third-party component libraries.

### 2. State Management & Caching: TanStack Query (React Query)
- All backend data fetching is automatically cached.
- **Optimistic Updates Implementation**: For CRUD operations in the Admin Dashboard, the interface updates instantly (eliminating loading spinners) and rolls back in the background if the server responds with an error. This delivers lightning-fast UX comparable to Native applications.

### 3. Backend & Database: Supabase (PostgreSQL)
- **Database as Code**: The entire database schema is managed using SQL migration files (`supabase/migrations`), ensuring schema changes are easily trackable and replicable.
- **Strict Typing**: TypeScript types are auto-generated directly from the Supabase PostgreSQL schema, guaranteeing end-to-end type safety (0 `any` types during data fetching).

### 4. Quality Assurance & Testing
- **E2E Testing (Playwright)**: Simulates real users for navigation, login flows, and CRUD operations (Smoke tests & Integration tests).
- **Unit Testing (Vitest)**: Tests core business logic in isolation (e.g., the Spaced Repetition System interval calculation algorithms).
- **CI/CD (GitHub Actions)**: Automated pipelines that enforce type checking (`tsc --noEmit`), linting, and testing before allowing code to be pushed or integrated.

---

## 🗂️ Directory Structure

```
src/
├── app/
│   ├── (auth)/           # Authentication flows (Login, Register)
│   ├── dashboard/
│   │   ├── admin/        # Admin Panel (User Management, Optimistic Database CRUD)
│   │   └── ...           # User Area (Flashcards, Grammar, Modules, Games)
├── components/
│   ├── ui/               # Reusable base components (shadcn/ui)
│   └── ...               # Feature-specific components
├── hooks/                # Custom React hooks (e.g., useSupabase)
├── lib/
│   ├── supabase/         # Supabase Client & Server (SSR) Configurations
│   ├── database.types.ts # ⚠️ Auto-generated types (SSoT for database typing)
│   ├── auth-roles.ts     # RBAC (Role-Based Access Control) Logic
│   ├── srs.ts            # Spaced Repetition core algorithms
└── ...

e2e/                      # Playwright Specs for End-to-End Testing
supabase/migrations/      # SQL versioning files for Database Schema
.github/workflows/ci.yml  # CI/CD Automation Pipeline
```

---

## 🏁 Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- Supabase CLI (`npm install -g supabase`)
- `.env.local` environment file

### Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available NPM Scripts

```bash
npm run dev               # Run the local development server
npm run lint              # Run ESLint for code standard checks
npm run test              # Run unit tests with Vitest
npm run test:e2e          # Run end-to-end tests with Playwright
npm run build             # Build the application for production
npm run supabase:types    # Sync TypeScript types with the latest Database schema
npm run db:push           # Push local SQL migrations to the Remote Supabase
```

---

## 🎯 Project Status & Engineering Assessment

This application demonstrates high-level engineering standards for a solo project. 
Key technical achievements include:
- **Zero TypeScript Errors** (a perfectly clean `tsc --noEmit`).
- **Clean Architecture**: Strong separation between fetching, mutating, and rendering logic.
- **Graceful Error Handling**: Implemented *Error Boundaries* (`error.tsx`) ensuring that if a component fails to render, the rest of the application will not crash.
- **High Performance**: Gradual transition to *React Server Components* to eliminate unnecessary JavaScript payloads on user devices.

*(Last updated: September 2026)*
