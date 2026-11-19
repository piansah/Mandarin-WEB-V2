-- Allow the six quiz formats used by the module lesson flow.
ALTER TABLE public.modul_quiz_questions
  DROP CONSTRAINT IF EXISTS modul_quiz_questions_question_type_check;

ALTER TABLE public.modul_quiz_questions
  ADD CONSTRAINT modul_quiz_questions_question_type_check
  CHECK (
    question_type = ANY (
      ARRAY[
        'mcq'::text,
        'audio'::text,
        'speaking'::text,
        'fill_blank'::text,
        'word_order'::text,
        'sentence_choice'::text,
        'matching'::text
      ]
    )
  );
