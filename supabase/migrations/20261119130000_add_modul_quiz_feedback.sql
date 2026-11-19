ALTER TABLE public.modul_quiz_questions
  ADD COLUMN IF NOT EXISTS feedback jsonb NOT NULL DEFAULT '{}'::jsonb;
