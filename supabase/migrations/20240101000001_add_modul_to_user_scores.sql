-- Tambahkan tipe 'modul' ke constraint check tabel user_scores
ALTER TABLE public.user_scores DROP CONSTRAINT IF EXISTS user_scores_type_check;

ALTER TABLE public.user_scores ADD CONSTRAINT user_scores_type_check CHECK (
  type = ANY (ARRAY[
    'quiz'::text,
    'kal'::text,
    'hanzi'::text,
    'grammar'::text,
    'cerita'::text,
    'fc_session'::text,
    'nada_session'::text,
    'speaking_session'::text,
    'cerita_quiz'::text,
    'lesson'::text,
    'tulis_session'::text,
    'nada_word'::text,
    'modul'::text
  ])
);
