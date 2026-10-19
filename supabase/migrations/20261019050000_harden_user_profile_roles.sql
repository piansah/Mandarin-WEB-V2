-- Enforce profile role authorization in Postgres, not only in the browser.
CREATE OR REPLACE FUNCTION public.current_user_profile_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.role
  FROM public.user_profile AS profile
  WHERE profile.user_id = (SELECT auth.uid())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_profile_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_profile_role() TO authenticated;

-- Stop clients from changing role through a direct table update.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR public.current_user_profile_role() = 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'user' THEN
    RAISE EXCEPTION 'Only a superadmin can assign elevated user roles'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only a superadmin can change user roles'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unauthorized_profile_role_change ON public.user_profile;
CREATE TRIGGER prevent_unauthorized_profile_role_change
  BEFORE INSERT OR UPDATE ON public.user_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_profile_role_change();

-- Replace self-referential policies with a SECURITY DEFINER role lookup to
-- avoid recursive RLS evaluation on user_profile.
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profile;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profile;

CREATE POLICY "Users and admins can view profiles"
  ON public.user_profile FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.current_user_profile_role() IN ('admin', 'superadmin')
  );

CREATE POLICY "Users and admins can update profiles"
  ON public.user_profile FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.current_user_profile_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.current_user_profile_role() IN ('admin', 'superadmin')
  );

-- Recreate each SECURITY DEFINER RPC with authorization inside the function.
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
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
BEGIN
  IF public.current_user_profile_role() IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Superadmin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT profile.user_id, profile.display_name, profile.role,
         profile.created_at, profile.updated_at
  FROM public.user_profile AS profile
  ORDER BY profile.created_at DESC;
END;
$$;

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
BEGIN
  IF public.current_user_profile_role() NOT IN ('admin', 'superadmin') THEN
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

CREATE OR REPLACE FUNCTION public.update_user_role_admin(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_profile_role() IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Superadmin access required' USING ERRCODE = '42501';
  END IF;
  IF new_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_profile
  SET role = new_role, updated_at = now()
  WHERE user_id = target_user_id;
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
BEGIN
  IF public.current_user_profile_role() NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.user_profile),
    (SELECT count(*) FROM public.user_profile WHERE date(updated_at) = current_date),
    (SELECT count(*) FROM public.user_profile WHERE role IN ('admin', 'superadmin'));
END;
$$;

REVOKE ALL ON FUNCTION public.get_all_users_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_users_for_regular_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_user_role_admin(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_users_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_for_regular_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
