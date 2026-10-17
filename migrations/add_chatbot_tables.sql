-- ============================================================================
-- Migration: Tambahkan tabel chatbot (chat_sessions & chat_messages)
--
-- chat_sessions : satu baris per "percakapan" milik user
-- chat_messages : riwayat pesan di dalam sebuah sesi (user ↔ AI)
--
-- RLS: setiap user hanya bisa melihat/mengubah data miliknya sendiri.
-- ============================================================================

BEGIN;

-- ─── chat_sessions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'Percakapan Baru',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query "semua sesi milik user X, urutkan terbaru dulu"
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
  ON public.chat_sessions (user_id, updated_at DESC);

-- Trigger: perbarui updated_at otomatis
CREATE OR REPLACE FUNCTION public.update_chat_session_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_session_timestamp();

-- RLS chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_sessions: own rows select"  ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions: own rows insert"  ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions: own rows update"  ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions: own rows delete"  ON public.chat_sessions;

CREATE POLICY "chat_sessions: own rows select"
  ON public.chat_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "chat_sessions: own rows insert"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_sessions: own rows update"
  ON public.chat_sessions FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_sessions: own rows delete"
  ON public.chat_sessions FOR DELETE
  USING (user_id = auth.uid());

-- ─── chat_messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.chat_sessions (id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query "semua pesan dalam sesi X, urutkan kronologis"
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON public.chat_messages (session_id, created_at ASC);

-- RLS chat_messages (lewat join ke chat_sessions agar tidak bocor)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages: own session select"  ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages: own session insert"  ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages: own session delete"  ON public.chat_messages;

CREATE POLICY "chat_messages: own session select"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages: own session insert"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages: own session delete"
  ON public.chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- ─── GRANT privileges ─────────────────────────────────────────────────────────
-- Tanpa ini PostgreSQL menolak akses sebelum RLS sempat dicek.
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;

COMMIT;
