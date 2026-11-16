ALTER TABLE public.daily_streaks
  ADD COLUMN IF NOT EXISTS celebrated_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_daily_streak_celebration(p_study_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_streak integer := 0;
  v_cursor date := p_study_date;
  v_claimed date;
BEGIN
  IF v_user_id IS NULL OR p_study_date IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.daily_streaks (user_id, date)
  VALUES (v_user_id, p_study_date)
  ON CONFLICT (user_id, date) DO NOTHING;

  UPDATE public.daily_streaks
  SET celebrated_at = now()
  WHERE user_id = v_user_id
    AND date = p_study_date
    AND celebrated_at IS NULL
  RETURNING date INTO v_claimed;

  -- A non-null timestamp means this date was already celebrated on another
  -- tab or device, so only the transaction that claimed it gets a result.
  IF v_claimed IS NULL THEN
    RETURN NULL;
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.daily_streaks
    WHERE user_id = v_user_id AND date = v_cursor
  ) LOOP
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  END LOOP;

  RETURN v_streak;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_streak_celebration(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak_celebration(date) TO authenticated;
