-- Close the NULL-role authorization gap in SECURITY DEFINER admin RPCs.
-- When a user has no user_profile row, the role lookup returns NULL; an IF
-- condition using `NULL NOT IN (...)` does not enter the rejection branch.
CREATE OR REPLACE FUNCTION public.get_users_for_regular_admin()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT := public.current_user_profile_role();
BEGIN
  IF caller_role IS DISTINCT FROM 'admin'
     AND caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT profile.user_id, profile.display_name, profile.role,
         profile.created_at, profile.updated_at
  FROM public.user_profile AS profile
  WHERE profile.role IN ('user', 'admin')
  ORDER BY profile.created_at DESC;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_today BIGINT,
  admin_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT := public.current_user_profile_role();
BEGIN
  IF caller_role IS DISTINCT FROM 'admin'
     AND caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.user_profile),
    (SELECT count(*) FROM public.user_profile WHERE date(updated_at) = current_date),
    (SELECT count(*) FROM public.user_profile WHERE role IN ('admin', 'superadmin'));
END;
$$;
REVOKE ALL ON FUNCTION public.get_users_for_regular_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_for_regular_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
