-- Add last_quality column to user_card_progress
-- Values: 0=Lupa, 3=Sulit, 4=Ingat, 5=Mudah
-- NULL means never reviewed / legacy data

ALTER TABLE public.user_card_progress
  ADD COLUMN IF NOT EXISTS last_quality smallint DEFAULT NULL;

-- Backfill: cards already reviewed with srs_level >= 1 assume "Ingat" (4)
-- Cards with srs_level = 0 that have been reviewed assume "Lupa" (0)
UPDATE public.user_card_progress
  SET last_quality = CASE
    WHEN srs_level = 0 THEN 0
    ELSE 4
  END
  WHERE last_reviewed IS NOT NULL AND last_quality IS NULL;

COMMENT ON COLUMN public.user_card_progress.last_quality IS
  'Rating terakhir yang diberikan user: 0=Lupa, 3=Sulit, 4=Ingat, 5=Mudah';
