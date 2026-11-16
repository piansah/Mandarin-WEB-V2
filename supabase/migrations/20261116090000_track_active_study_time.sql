CREATE TABLE IF NOT EXISTS public.user_study_time (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date date NOT NULL,
  active_seconds integer NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, study_date)
);

ALTER TABLE public.user_study_time ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_study_time TO authenticated;

CREATE POLICY "Users can read their own study time"
  ON public.user_study_time
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_study_time(p_seconds integer, p_study_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := COALESCE(p_study_date, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_seconds integer := LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 30);
  v_total integer;
BEGIN
  IF v_user_id IS NULL OR v_seconds = 0 THEN
    RETURN 0;
  END IF;

  -- The client reports small heartbeats. Reject dates outside the user's
  -- current local day to prevent arbitrary historical/future edits.
  IF v_date < (now() AT TIME ZONE 'Asia/Jakarta')::date - 1
    OR v_date > (now() AT TIME ZONE 'Asia/Jakarta')::date + 1 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.user_study_time (user_id, study_date, active_seconds)
  VALUES (v_user_id, v_date, v_seconds)
  ON CONFLICT (user_id, study_date) DO UPDATE
    SET active_seconds = public.user_study_time.active_seconds + EXCLUDED.active_seconds,
        updated_at = now()
  RETURNING active_seconds INTO v_total;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.record_study_time(integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_study_time(integer, date) TO authenticated;
