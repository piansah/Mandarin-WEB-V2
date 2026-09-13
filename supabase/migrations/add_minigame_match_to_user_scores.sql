alter table public.user_scores
  drop constraint if exists user_scores_type_check;

alter table public.user_scores
  add constraint user_scores_type_check check (
    (
      type = any (
        array[
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
          'modul'::text,
          'minigame_snake'::text,
          'minigame_match'::text
        ]
      )
    )
  );
