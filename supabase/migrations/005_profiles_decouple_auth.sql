-- ==============================================================================
-- Migration 005: Decouple profiles from auth.users (allow public registration)
-- ==============================================================================

-- 1. Drop the strict foreign key constraint on profiles(id) if it exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Ensure id column has DEFAULT gen_random_uuid()
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Add optional user_id referencing auth.users(id)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Backfill user_id for existing auth accounts where id was the auth.users id
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL AND id IN (SELECT id FROM auth.users);

-- 5. Add unique index on user_id (when present)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id) WHERE user_id IS NOT NULL;

-- 6. Add unique index on normalized email (when present and not empty)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles(LOWER(email)) WHERE email IS NOT NULL AND email <> '';

-- 7. Update handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If a profile already exists with this email (e.g. from public registration), link user_id
  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(NEW.email)) THEN
    UPDATE public.profiles
    SET
      user_id = NEW.id,
      email = LOWER(NEW.email),
      role = CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
      admin_status = CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE public.profiles.admin_status END,
      updated_at = now()
    WHERE LOWER(email) = LOWER(NEW.email);
  ELSE
    INSERT INTO public.profiles (id, user_id, name, email, role, admin_status)
    VALUES (
      NEW.id,
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      LOWER(NEW.email),
      CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE 'player' END,
      CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE 'none' END
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      email = EXCLUDED.email,
      role = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
      admin_status = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE public.profiles.admin_status END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 8. Update is_admin() and is_super_admin() to support both user_id and id
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (user_id = auth.uid() OR id = auth.uid())
      AND role IN ('admin', 'super_admin')
      AND admin_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (user_id = auth.uid() OR id = auth.uid())
      AND role = 'super_admin'
      AND admin_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9. Update profiles RLS policy to allow users to update their own profile by user_id or id
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = id);
