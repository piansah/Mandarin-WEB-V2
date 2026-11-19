-- Add the true/false format used by the agreed 20-question module quiz.
-- Keep audio and sentence_choice accepted for compatibility with existing rows.
ALTER TABLE public.modul_quiz_questions
  DROP CONSTRAINT IF EXISTS modul_quiz_questions_question_type_check;

ALTER TABLE public.modul_quiz_questions
  ADD CONSTRAINT modul_quiz_questions_question_type_check
  CHECK (
    question_type = ANY (
      ARRAY[
        'mcq'::text,
        'true_false'::text,
        'fill_blank'::text,
        'word_order'::text,
        'matching'::text,
        'speaking'::text,
        'audio'::text,
        'sentence_choice'::text
      ]
    )
  );
