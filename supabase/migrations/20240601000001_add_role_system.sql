-- Migration: Add Role System
-- Purpose: Add role-based access control for admin and user roles
-- 
-- SOLUTION: Menggunakan hardcoded admin emails di application layer
-- untuk menghindari circular logic di RLS policies.
-- Database role column tetap ada untuk future use dan redundancy.

-- Add role column to user_profile table
ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD CONSTRAINT user_profile_role_check CHECK (role IN ('superadmin', 'admin', 'user'));

-- Add daily_goal_minutes column untuk target harian user
ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS daily_goal_minutes INTEGER DEFAULT 10;

-- Create index for faster role queries
CREATE INDEX IF NOT EXISTS idx_user_profile_role ON user_profile(role);

-- Add created_at and updated_at if not exists
ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_profile_updated_at ON user_profile;
CREATE TRIGGER update_user_profile_updated_at
    BEFORE UPDATE ON user_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE user_profile TO authenticated;
GRANT SELECT ON TABLE user_profile TO anon;

-- Enable RLS
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profile
-- Note: Admin check dilakukan di application layer (hardcoded emails)
-- untuk menghindari circular logic di RLS policies.

-- Users can read their own profile (termasuk role)
CREATE POLICY "Users can view own profile"
    ON user_profile FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own profile (kecuali role)
CREATE POLICY "Users can update own profile"
    ON user_profile FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND 
        (role IS NULL OR role = (SELECT role FROM user_profile WHERE user_id = auth.uid() LIMIT 1))
    );

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON user_profile FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Simple admin policies (fallback, tapi admin check utama di application layer)
CREATE POLICY "Admins can view all profiles"
    ON user_profile FOR SELECT
    USING (
      auth.uid() IN (
        SELECT user_id FROM user_profile WHERE role IN ('admin', 'superadmin')
      )
    );

CREATE POLICY "Admins can update any profile"
    ON user_profile FOR UPDATE
    USING (
      auth.uid() IN (
        SELECT user_id FROM user_profile WHERE role IN ('admin', 'superadmin')
      )
    );

-- Set default role for existing users
UPDATE user_profile 
SET role = 'user' 
WHERE role IS NULL;

-- Note: 
-- 1. Admin check dilakukan di application layer menggunakan hardcoded emails
--    di src/lib/auth-roles.ts untuk menghindari circular logic RLS.
-- 2. Database role column tetap ada untuk future use dan redundancy.
-- 3. Hierarki role: superadmin > admin > user
-- 4. Superadmin bisa menambah/hapus admin, admin biasa tidak bisa ubah role lain
-- 5. Untuk menambah superadmin baru, tambahkan email ke SUPERADMIN_EMAILS di auth-roles.ts.
-- 6. RPC function get_all_users_admin dibuat untuk bypass RLS untuk superadmin

-- Create RPC function untuk superadmin bypass RLS
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.display_name,
    up.role,
    up.created_at,
    up.updated_at
  FROM user_profile up
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute pada function untuk authenticated users
GRANT EXECUTE ON FUNCTION get_all_users_admin() TO authenticated;

-- Create RPC function untuk update user role (bypass RLS untuk superadmin)
CREATE OR REPLACE FUNCTION update_user_role_admin(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profile 
  SET role = new_role, updated_at = NOW()
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute pada function untuk authenticated users
GRANT EXECUTE ON FUNCTION update_user_role_admin(UUID, TEXT) TO authenticated;

-- Create RPC function untuk admin biasa (bisa lihat user dan admin biasa)
CREATE OR REPLACE FUNCTION get_users_for_regular_admin()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.display_name,
    up.role,
    up.created_at,
    up.updated_at
  FROM user_profile up
  WHERE up.role IN ('user', 'admin')
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute pada function untuk authenticated users
GRANT EXECUTE ON FUNCTION get_users_for_regular_admin() TO authenticated;

-- Create RPC function untuk admin stats (bypass RLS)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_today BIGINT,
  admin_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM user_profile) as total_users,
    (SELECT COUNT(*) FROM user_profile WHERE DATE(updated_at) = CURRENT_DATE) as active_today,
    (SELECT COUNT(*) FROM user_profile WHERE role IN ('admin', 'superadmin')) as admin_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute pada function untuk authenticated users
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;
