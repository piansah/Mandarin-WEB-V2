-- RLS Policy untuk user_card_progress
-- Izinkan user, admin, dan superadmin untuk DELETE progress mereka sendiri

-- 1. Tambah kolom session_id untuk tracking sesi
ALTER TABLE public.user_card_progress 
ADD COLUMN IF NOT EXISTS session_id uuid;

-- 2. Enable RLS pada tabel user_card_progress (jika belum)
ALTER TABLE public.user_card_progress ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada
DROP POLICY IF EXISTS "Users can delete their own progress" ON public.user_card_progress;
DROP POLICY IF EXISTS "Admins can delete any progress" ON public.user_card_progress;
DROP POLICY IF EXISTS "Superadmins can delete any progress" ON public.user_card_progress;

-- 4. Policy untuk USER: Hanya bisa DELETE progress milik sendiri
CREATE POLICY "Users can delete their own progress"
ON public.user_card_progress
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Policy untuk ADMIN: Bisa DELETE progress user lain
-- Check user role dari auth.users.raw_user_meta_data atau table khusus
-- Jika ada table public.profiles atau sejenisnya, gunakan itu
CREATE POLICY "Admins can delete any progress"
ON public.user_card_progress
FOR DELETE
TO authenticated
USING (
  -- Cek jika user memiliki role admin di metadata
  auth.jwt() ->> 'role' IN ('admin', 'superadmin')
  -- ATAU jika ada table profiles, uncomment dan sesuaikan:
  -- OR EXISTS (
  --   SELECT 1 FROM public.profiles
  --   WHERE id = auth.uid()
  --   AND role IN ('admin', 'superadmin')
  -- )
);

-- Note: Sesuaikan condition di atas sesuai struktur database Anda
-- Jika role disimpan di tempat lain, beri tahu saya nama tabel dan kolomnya
