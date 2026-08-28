-- Migration 003: Definitive Evolution
-- 1. RBAC (super_admin, admin, player)
-- 2. Age categorization (sub14, plus14)
-- 3. Declared level (0.0 - 10.0)
-- 4. Predictive analytics (win expectancy, upset tracking)

-- Profiles table updates
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'admin', 'player'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'none' CHECK (admin_status IN ('none', 'pending', 'approved', 'rejected'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS declared_level NUMERIC(3,1) CHECK (declared_level IS NULL OR (declared_level >= 0 AND declared_level <= 10));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IS NULL OR category IN ('sub14', 'plus14'));

-- Update trigger for new users to assign super_admin to guillermoriveraterriza@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, admin_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE 'player' END,
    CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE 'none' END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
    admin_status = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE public.profiles.admin_status END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Promote existing profile if already created
UPDATE public.profiles
SET role = 'super_admin', admin_status = 'approved'
WHERE LOWER(email) = 'guillermoriveraterriza@gmail.com';

-- Update is_admin function to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tournament Groups category support
ALTER TABLE public.tournament_groups ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'plus14' CHECK (category IN ('sub14', 'plus14'));
ALTER TABLE public.tournament_groups DROP CONSTRAINT IF EXISTS tournament_groups_tournament_id_group_code_key;
ALTER TABLE public.tournament_groups ADD CONSTRAINT tournament_groups_tournament_category_group_key UNIQUE (tournament_id, category, group_code);

-- Tournament Participants category & level
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'plus14' CHECK (category IN ('sub14', 'plus14'));
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS declared_level NUMERIC(3,1) CHECK (declared_level IS NULL OR (declared_level >= 0 AND declared_level <= 10));

-- Matches category & predictive analytics
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'plus14' CHECK (category IN ('sub14', 'plus14'));
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS win_expectancy_p1 NUMERIC(4,3);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS win_expectancy_p2 NUMERIC(4,3);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_upset BOOLEAN DEFAULT false;
