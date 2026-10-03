-- Step 1: Remove duplicates in user_card_progress
-- This deletes rows keeping only the most recently reviewed one for each (user_id, card_id) pair.
-- Tie break falls to highest id.
DELETE FROM public.user_card_progress
WHERE id NOT IN (
  SELECT (array_agg(id ORDER BY last_reviewed DESC NULLS LAST, id DESC))[1]
  FROM public.user_card_progress
  GROUP BY user_id, card_id
);

-- Step 2: Add unique constraint
ALTER TABLE public.user_card_progress
  ADD CONSTRAINT user_card_progress_user_card_unique UNIQUE (user_id, card_id);

-- Step 3: Backfill interval_days based on existing SRS levels or dates
-- Calculate new interval_days. If next_review & last_reviewed exist, use their difference.
-- Otherwise, fall back to the old INTERVALS array.
WITH old_intervals AS (
  SELECT * FROM (
    VALUES 
      (0, 1), (1, 1), (2, 2), (3, 4), (4, 7),
      (5, 15), (6, 30), (7, 60), (8, 90), (9, 180)
  ) AS t (lvl, interval)
)
UPDATE public.user_card_progress ucp
SET interval_days = GREATEST(
  1,
  COALESCE(
    (next_review - last_reviewed),
    (SELECT interval FROM old_intervals WHERE lvl = LEAST(ucp.srs_level, 9))
  )
);

-- Step 4: Add check constraints
ALTER TABLE public.user_card_progress
  ADD CONSTRAINT user_card_progress_ease_factor_check CHECK (ease_factor >= 1.3) NOT VALID;
ALTER TABLE public.user_card_progress
  VALIDATE CONSTRAINT user_card_progress_ease_factor_check;

ALTER TABLE public.user_card_progress
  ADD CONSTRAINT user_card_progress_interval_days_check CHECK (interval_days >= 1) NOT VALID;
ALTER TABLE public.user_card_progress
  VALIDATE CONSTRAINT user_card_progress_interval_days_check;

-- Rollback (commented out)
/*
ALTER TABLE public.user_card_progress
  DROP CONSTRAINT user_card_progress_interval_days_check;
ALTER TABLE public.user_card_progress
  DROP CONSTRAINT user_card_progress_ease_factor_check;
ALTER TABLE public.user_card_progress
  DROP CONSTRAINT user_card_progress_user_card_unique;
UPDATE public.user_card_progress SET interval_days = 1, ease_factor = 2.5;
*/
