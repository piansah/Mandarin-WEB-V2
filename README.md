# 🀄 Mandarin Web V2

Platform belajar Bahasa Mandarin berbasis web — HSK 3.0 — dibangun dengan standar engineering menengah ke atas.

---

## 🚀 Tech Stack

| Layer | Teknologi |
|---|---|
| **Framework** | Next.js (App Router) |
| **Database** | Supabase (PostgreSQL + Auth + RLS) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State & Data Fetching** | TanStack Query (React Query) |
| **Unit Testing** | Vitest |
| **E2E Testing** | Playwright |
| **CI/CD** | GitHub Actions |
| **Error Monitoring** | Built-in Next.js Error Boundaries (`error.tsx`) |
| **Type Safety** | TypeScript strict + Auto-generated Supabase types |

---

## 🏁 Getting Started

### Prerequisites
- Node.js 20+
- Supabase CLI (`npm install -g supabase`)
- File `.env.local` (minta ke project owner)

### Install & Run

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 📜 NPM Scripts

```bash
# Development
npm run dev               # Jalankan dev server

# Quality Checks
npm run lint              # Cek ESLint
npm run test              # Jalankan unit tests (Vitest)
npm run test:coverage     # Unit tests + laporan coverage
npm run test:e2e          # E2E tests (Playwright) — butuh dev server aktif

# Build
npm run build             # Build production
npm run analyze           # Build + analisis bundle size (webpack-bundle-analyzer)

# Database (Supabase CLI)
npm run supabase:types    # Generate ulang file TypeScript dari skema DB
npm run db:pull           # Pull skema DB terbaru dari Supabase ke lokal
npm run db:push           # Push migration lokal ke Supabase production
npm run db:new            # Buat file migration baru
npm run db:diff           # Lihat diff antara DB lokal dan production
```

---

## 🗂️ Arsitektur Proyek

```
src/
├── app/
│   ├── (auth)/           # Login, Register
│   ├── dashboard/
│   │   ├── admin/        # Admin pages (User Management, Database CRUD)
│   │   └── ...           # User-facing dashboard (flashcard, modul, game)
│   └── ...
├── components/
│   ├── ui/               # shadcn/ui base components
│   └── ...               # Feature components
├── hooks/                # Custom React hooks
├── lib/
│   ├── supabase/         # Supabase client (browser + server + middleware)
│   ├── database.types.ts # ⚠️ AUTO-GENERATED — jangan edit manual!
│   ├── auth-roles.ts     # Logika otorisasi (superadmin, admin, user)
│   ├── srs.ts            # Algoritma Spaced Repetition System
│   └── audio-fx.ts       # Web Audio API effects & BGM player
└── ...

e2e/                      # Playwright E2E test specs
supabase/migrations/      # File SQL migration database
.github/workflows/ci.yml  # GitHub Actions CI pipeline
```

---

## 🔑 Environment Variables

Buat file `.env.local` di root project:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Hanya untuk server-side
```

Untuk E2E tests, buat `.env.test.local`:
```env
E2E_ADMIN_EMAIL=your-test-admin@example.com
E2E_ADMIN_PASSWORD=your-test-password
```

---

## 🧪 Testing

### Unit Tests (Vitest)
```bash
npm run test
```
File test ada di `src/**/*.test.ts`. Mencakup: SRS algorithm, dashboard stats, user profile.

### E2E Tests (Playwright)
```bash
# Pastikan dev server berjalan terlebih dahulu
npm run dev

# Di terminal lain:
npm run test:e2e
```
Skenario yang di-cover: smoke test homepage, admin CRUD flow (create/update/delete data).

---

## 🗄️ Database & Migrasi

Project ini menggunakan **Database as Code** — semua perubahan skema disimpan sebagai file migrasi di `supabase/migrations/`.

**Workflow perubahan skema:**
1. Buat migration baru: `npm run db:new nama_perubahan`
2. Edit file SQL yang dibuat di `supabase/migrations/`
3. Push ke production: `npm run db:push`
4. Generate ulang TypeScript types: `npm run supabase:types`

> ⚠️ **Jangan pernah edit `src/lib/database.types.ts` secara manual.** File ini di-generate otomatis dari skema database.

---

## 🤖 CI/CD Pipeline

GitHub Actions akan berjalan **otomatis** setiap `git push` ke branch `main`/`master`:

1. ✅ ESLint check
2. ✅ TypeScript check (`tsc --noEmit`)
3. ✅ Semua unit tests harus lulus
4. ✅ (Jika semua lulus) Deploy migrasi DB ke production

Konfigurasi: `.github/workflows/ci.yml`

**Secrets yang dibutuhkan di GitHub repo:**
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`

---

## 🗺️ Roadmap Pengembangan Selanjutnya

Rating engineering saat ini: **7.5 / 10** (Mid-Senior level).

### 🔴 Prioritas Tinggi (Selesai ✅)

| Item | Detail | Dampak |
|---|---|---|
| **✅ Migrasi `useEffect` → React Query** | Telah dimigrasi 150+ `useEffect` data-fetching ke `useQuery`/`useMutation` | Caching, optimistic updates, dedup request |
| **✅ Error Boundary** | Telah ditambahkan `error.tsx` di setiap route segment kritis | Graceful crash, bukan halaman putih |

### 🟡 Prioritas Menengah

| Item | Detail |
|---|---|
| **React Server Components (RSC)** | Halaman yang tidak butuh interaktivitas bisa di-render penuh di server |
| **Optimistic Updates** | Saat CRUD Admin, UI bisa berubah instan tanpa nunggu respons DB |

### 🟢 Jangka Panjang

| Item | Detail |
|---|---|
| **Web Vitals Monitoring** | Pantau LCP, CLS, INP via Vercel Analytics / Sentry |
| **Preview Environments** | Deploy otomatis per-branch/PR untuk review sebelum merge ke main |
| **Storybook** | Isolasi dan dokumentasi UI components (relevan jika ada tim UI dedicated) |

---

## 📚 Referensi

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Playwright Docs](https://playwright.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
