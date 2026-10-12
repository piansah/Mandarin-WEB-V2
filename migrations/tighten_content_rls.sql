-- ============================================================================
-- Migration: Tighten RLS on content tables (hasil audit pg_policies)
--
-- TEMUAN YANG DIPERBAIKI
-- 1. modul_levels, modul_module_parts, modul_module_tags, modul_modules,
--    modul_quiz_questions: policy "Enable insert/update/delete for auth"
--    memakai USING/CHECK `true` => SETIAP user yang login bisa menambah,
--    mengubah, dan MENGHAPUS seluruh materi modul lewat Supabase client.
-- 2. modul_modules: policy "Enable read access for all users" (true)
--    membuat policy `is_published = true` tidak berguna => modul DRAFT
--    (belum dipublikasikan) bisa dibaca siapa saja, termasuk anon.
-- 3. modul_bookmarks: policy "Enable read/insert/update/delete for auth"
--    (true) => user bisa membaca, mengubah, dan menghapus bookmark user lain.
-- 4. flashcard_sets: "Allow insert/update/delete for authenticated users"
--    (auth.uid() IS NOT NULL) => user mana pun bisa menghapus/mengubah SET
--    milik siapa pun. "user own sets" juga membolehkan user membuat set
--    dengan is_default = true sehingga tampil sebagai set resmi.
-- 5. flashcard_cards: policy "own cards" hanya mengecek added_by, bukan
--    kepemilikan set => user bisa menyisipkan kartu ke set resmi.
-- 6. bug_reports: INSERT dengan CHECK `true` => bisa mengisi user_id milik
--    orang lain (impersonasi).
-- 7. Fungsi trigger & get_user_stats bisa dieksekusi oleh anon.
--
-- DIPASTIKAN AMAN (dari pemeriksaan kode):
-- - Aplikasi tidak memakai service-role key; API admin memakai sesi user,
--   jadi policy admin lewat public.is_admin() akan bekerja.
-- - Tidak ada kode non-admin yang menulis ke tabel modul_* maupun
--   flashcard_sets / flashcard_cards (kartu pribadi memakai tabel personal_*).
--
-- PRASYARAT: migrasi 20261009_secure_role_system.sql sudah dijalankan
-- (fungsi public.is_admin() harus ada).
--
-- ROLLBACK: simpan hasil query pg_policies sebelum menjalankan ini
-- (Anda sudah punya). Policy lama bisa dibuat ulang dari sana bila perlu.
-- ============================================================================

BEGIN;

-- Pastikan prasyarat ada, kalau tidak batalkan seluruh migrasi.
DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'public.is_admin() tidak ditemukan. Jalankan 20261009_secure_role_system.sql dulu.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Tabel konten modul: tulis hanya untuk admin / superadmin
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'modul_levels',
    'modul_module_parts',
    'modul_module_tags',
    'modul_modules',
    'modul_quiz_questions'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert for auth" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update for auth" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete for auth" ON public.%I', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins can insert ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins can update ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins can delete ' || t, t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())',
      'Admins can insert ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      'Admins can update ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())',
      'Admins can delete ' || t, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. modul_modules: modul draft hanya terlihat oleh admin
--    (publik hanya melihat is_published = true lewat policy yang sudah ada)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for all users" ON public.modul_modules;
DROP POLICY IF EXISTS "Admins can read all modul_modules" ON public.modul_modules;

CREATE POLICY "Admins can read all modul_modules"
  ON public.modul_modules FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. modul_bookmarks: hanya milik sendiri
--    (policy "Users select/insert/delete own modul bookmarks" sudah ada)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for auth users" ON public.modul_bookmarks;
DROP POLICY IF EXISTS "Enable insert for auth" ON public.modul_bookmarks;
DROP POLICY IF EXISTS "Enable update for auth" ON public.modul_bookmarks;
DROP POLICY IF EXISTS "Enable delete for auth" ON public.modul_bookmarks;

DROP POLICY IF EXISTS "Users update own modul bookmarks" ON public.modul_bookmarks;
CREATE POLICY "Users update own modul bookmarks"
  ON public.modul_bookmarks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. flashcard_sets: tulis hanya admin (policy "Admin can ..." sudah ada)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.flashcard_sets;
DROP POLICY IF EXISTS "user own sets" ON public.flashcard_sets;

-- ----------------------------------------------------------------------------
-- 5. flashcard_cards: tulis hanya admin (policy "Admin can ..." sudah ada)
--    Kartu pribadi user memakai tabel personal_cards, bukan tabel ini.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user own cards" ON public.flashcard_cards;
DROP POLICY IF EXISTS "insert_own_cards" ON public.flashcard_cards;
DROP POLICY IF EXISTS "update_own_cards" ON public.flashcard_cards;
DROP POLICY IF EXISTS "delete_own_cards" ON public.flashcard_cards;

-- ----------------------------------------------------------------------------
-- 6. bug_reports: jangan boleh memalsukan user_id orang lain
--    (anon tetap boleh melapor dengan user_id NULL)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Insert own or anonymous bug reports" ON public.bug_reports;

CREATE POLICY "Insert own or anonymous bug reports"
  ON public.bug_reports FOR INSERT
  TO public
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. Hak eksekusi fungsi
-- ----------------------------------------------------------------------------
-- Fungsi trigger tidak perlu bisa dipanggil siapa pun.
REVOKE ALL ON FUNCTION public.guard_user_profile_role_change() FROM PUBLIC, anon, authenticated;

-- get_user_stats: hanya user yang login (cari signature secara dinamis agar
-- aman terhadap perbedaan argumen).
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
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFIKASI (jalankan manual, semuanya aman karena di-ROLLBACK)
-- ============================================================================
-- Ambil id satu user biasa:
--   SELECT user_id FROM public.user_profile WHERE role = 'user' LIMIT 1;
--
-- Tes: user biasa TIDAK boleh menulis ke tabel konten. Setiap blok harus
-- berakhir dengan error "new row violates row-level security policy" atau
-- "0 rows affected". Ganti <UUID_USER_BIASA>.
--
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--     '{"sub":"<UUID_USER_BIASA>","role":"authenticated"}', true);
--   INSERT INTO public.modul_levels DEFAULT VALUES;      -- harus GAGAL
--   ROLLBACK;
--
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--     '{"sub":"<UUID_USER_BIASA>","role":"authenticated"}', true);
--   DELETE FROM public.flashcard_sets;                   -- harus 0 rows
--   ROLLBACK;
--
-- Tes: modul draft tidak terlihat oleh anon:
--   BEGIN;
--   SET LOCAL ROLE anon;
--   SELECT count(*) FROM public.modul_modules WHERE is_published = false;  -- harus 0
--   ROLLBACK;
--
-- ============================================================================
-- OPSIONAL — storage avatars (jalankan terpisah, hapus tanda komentar)
-- ============================================================================
-- Policy duplikat bawaan dashboard yang TIDAK mengecek bucket_id
-- (membolehkan upload ke bucket mana pun di folder sendiri):
--   DROP POLICY IF EXISTS "Users can upload own avatar 1oj01fe_0" ON storage.objects;
--   DROP POLICY IF EXISTS "Users can read own avatar 1oj01fe_0"   ON storage.objects;
--   DROP POLICY IF EXISTS "Users can update own avatar 1oj01fe_1" ON storage.objects;
--
-- Batasi ukuran dan tipe file avatar (sesuaikan dengan format yang dipakai app):
--   UPDATE storage.buckets
--   SET file_size_limit = 2097152,  -- 2 MB
--       allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif']
--   WHERE id = 'avatars';
-- ============================================================================