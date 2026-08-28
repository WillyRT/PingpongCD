-- ==============================================================================
-- Migration 004: Security, RLS Hardening & Data Integrity
-- ==============================================================================

-- 1. Helper function: is_admin (SECURITY DEFINER with fixed search_path to prevent infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND admin_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Helper function: is_super_admin (SECURITY DEFINER with fixed search_path)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND admin_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Ensure profiles RLS is active and non-recursive
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
