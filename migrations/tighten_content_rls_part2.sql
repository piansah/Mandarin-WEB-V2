-- ============================================================================
-- Migration: Tighten RLS — bagian 2 (lanjutan 20261011_tighten_content_rls.sql)
--
-- Jalankan SETELAH 20261011_tighten_content_rls.sql (atau berurutan di sesi
-- yang sama). Semua statement idempotent (DROP ... IF EXISTS).
--
-- HASIL AUDIT YANG DIPERBAIKI
-- 1. modul_quizzes: policy "Enable insert/update/delete for auth" (true)
--    => setiap user yang login bisa mengubah/menghapus semua kuis modul.
--    (Sama seperti tabel modul_* lain di bagian 1.)
-- 2. user_card_progress: policy "Admins can delete any progress" memakai
--    auth.jwt()->>'role', yang nilainya selalu 'authenticated', sehingga
--    TIDAK PERNAH cocok => policy mati. Diganti dengan public.is_admin().
-- 3. user_profile: policy admin dari migrasi role dibuat untuk {public},
--    sehingga query anon ke user_profile bisa error "permission denied for
--    function is_superadmin". Dipersempit ke {authenticated}.
-- 4. user_placement: "anon bisa insert placement" (true) => siapa pun tanpa
--    login bisa menyisipkan baris dengan user_id sembarang. Aplikasi hanya
--    menulis placement lewat user yang login (upsert dengan user_id sendiri).
-- 5. word_examples: user biasa boleh INSERT/UPDATE/DELETE contoh kalimat,
--    padahal tabel ini dibaca semua orang. Kode aplikasi hanya MEMBACA
--    word_examples (penulisan hanya dari panel admin).
-- 6. get_user_stats(): SECURITY DEFINER tanpa SET search_path. Ditambahkan
--    tanpa mengubah isi fungsi.
--
-- DIPASTIKAN AMAN dari pemeriksaan kode:
-- - placement.ts: upsert user_placement selalu dengan user_id = user.id.
-- - word_examples: semua pemakaian di luar admin hanyalah .select().
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'public.is_admin() tidak ditemukan. Jalankan 20261009_secure_role_system.sql dulu.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. modul_quizzes: tulis hanya admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for auth" ON public.modul_quizzes;
DROP POLICY IF EXISTS "Enable update for auth" ON public.modul_quizzes;
DROP POLICY IF EXISTS "Enable delete for auth" ON public.modul_quizzes;

DROP POLICY IF EXISTS "Admins can insert modul_quizzes" ON public.modul_quizzes;
DROP POLICY IF EXISTS "Admins can update modul_quizzes" ON public.modul_quizzes;
DROP POLICY IF EXISTS "Admins can delete modul_quizzes" ON public.modul_quizzes;

CREATE POLICY "Admins can insert modul_quizzes"
  ON public.modul_quizzes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update modul_quizzes"
  ON public.modul_quizzes FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete modul_quizzes"
  ON public.modul_quizzes FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. user_card_progress: perbaiki policy admin yang tidak pernah cocok
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can delete any progress" ON public.user_card_progress;

CREATE POLICY "Admins can delete any progress"
  ON public.user_card_progress FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. user_profile: policy admin hanya untuk user yang login
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profile;
CREATE POLICY "Admins can view all profiles"
  ON public.user_profile FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR (public.is_admin() AND role IN ('user', 'admin'))
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profile;
CREATE POLICY "Admins can update any profile"
  ON public.user_profile FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin()
    OR (public.is_admin() AND role IN ('user', 'admin'))
  )
  WITH CHECK (
    public.is_superadmin()
    OR (public.is_admin() AND role IN ('user', 'admin'))
  );

-- ----------------------------------------------------------------------------
-- 4. user_placement: tutup insert anonim
--    (policy untuk user login, "user bisa insert miliknya" dst., tetap ada)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon bisa insert placement" ON public.user_placement;

-- ----------------------------------------------------------------------------
-- 5. word_examples: tulis hanya admin (policy "Admin can ..." tetap ada,
--    baca publik tetap ada)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "owner_write" ON public.word_examples;
DROP POLICY IF EXISTS "Enable delete for users based on added_by" ON public.word_examples;
DROP POLICY IF EXISTS "User can delete own" ON public.word_examples;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.word_examples;
DROP POLICY IF EXISTS "User can insert own" ON public.word_examples;
DROP POLICY IF EXISTS "Enable update for users based on added_by" ON public.word_examples;
DROP POLICY IF EXISTS "User can update own" ON public.word_examples;

-- ----------------------------------------------------------------------------
-- 6. get_user_stats: kunci search_path (isi fungsi tidak diubah)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_stats'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFIKASI (aman, semua di-ROLLBACK). Ganti <UUID_USER_BIASA>.
-- ============================================================================
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--     '{"sub":"<UUID_USER_BIASA>","role":"authenticated"}', true);
--   INSERT INTO public.modul_quizzes DEFAULT VALUES;     -- harus GAGAL (RLS)
--   ROLLBACK;
--
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--     '{"sub":"<UUID_USER_BIASA>","role":"authenticated"}', true);
--   DELETE FROM public.word_examples;                    -- harus 0 rows
--   ROLLBACK;
--
--   BEGIN;
--   SET LOCAL ROLE anon;
--   INSERT INTO public.user_placement DEFAULT VALUES;    -- harus GAGAL (RLS)
--   ROLLBACK;
--
--   BEGIN;
--   SET LOCAL ROLE anon;
--   SELECT count(*) FROM public.user_profile;            -- harus 0, TANPA error
--   ROLLBACK;
--
-- ============================================================================
-- CATATAN YANG PERLU KEPUTUSAN ANDA (tidak diubah oleh migrasi ini)
-- ============================================================================
-- A. XP "lesson" bisa dimanipulasi. get_user_stats() menjumlahkan
--    `score` apa adanya untuk type = 'lesson', dan user boleh menyisipkan
--    baris user_scores miliknya sendiri dengan score berapa pun. Satu baris
--    score = 1000000 membuat XP dan peringkat melonjak.
--    Cek dulu nilai wajarnya:
--      SELECT type, min(score), max(score), count(*)
--      FROM public.user_scores GROUP BY type ORDER BY type;
--    Lalu batasi di fungsi, mis. untuk lesson:
--      v_xp := v_xp + least(coalesce(r.score, 0), <MAKS_WAJAR>);
--    (ubah di bagian user sendiri DAN di loop `other_xp`).
--    Catatan: di sisi klien, calcXPForItem('lesson', 0) bernilai 10, sedangkan
--    di RPC bernilai `score` => dua rumus XP berbeda perlu diseragamkan.
--
-- B. Leaderboard: policy "Enable leaderboard read for authenticated users"
--    membuat SETIAP user login dapat membaca seluruh baris user_scores semua
--    orang. Wajar untuk leaderboard, tapi kalau peringkat sudah dihitung
--    server-side di get_user_stats(), policy ini bisa dipersempit.
--
-- C. user_placement / user_scores / user_search_history / word_examples
--    punya banyak policy duplikat (nama berbeda, isi sama). Bukan celah,
--    tapi sebaiknya dirapikan agar mudah diaudit.
--
-- D. get_user_stats() menghitung peringkat dengan loop bersarang atas semua
--    user setiap dashboard dibuka (O(user x skor)). Aman untuk puluhan user,
--    tapi akan melambat saat user bertambah. Bisa ditulis ulang menjadi
--    satu query SQL berbasis himpunan.
-- ============================================================================