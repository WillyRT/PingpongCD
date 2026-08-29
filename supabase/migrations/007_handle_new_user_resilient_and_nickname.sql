-- ==============================================================================
-- Migration 007: Resilient handle_new_user trigger & Nickname Support
-- ==============================================================================

-- 1. Ensure nickname column exists on profiles and synchronize with name
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
UPDATE public.profiles SET nickname = name WHERE nickname IS NULL AND name IS NOT NULL;
UPDATE public.profiles SET name = nickname WHERE name IS NULL AND nickname IS NOT NULL;

-- 2. Resilient handle_new_user trigger (100% tolerant to missing metadata / Magic Links)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role text := 'player';
  v_status text := 'none';
  v_nickname text;
BEGIN
  IF LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN
    v_role := 'super_admin';
    v_status := 'approved';
  END IF;

  v_nickname := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1),
    'Jugador'
  );

  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(NEW.email)) THEN
    UPDATE public.profiles
    SET
      user_id = NEW.id,
      email = LOWER(NEW.email),
      nickname = COALESCE(public.profiles.nickname, v_nickname),
      name = COALESCE(public.profiles.name, v_nickname),
      role = CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
      admin_status = CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE public.profiles.admin_status END,
      updated_at = NOW()
    WHERE LOWER(email) = LOWER(NEW.email);
  ELSE
    INSERT INTO public.profiles (id, user_id, email, nickname, name, role, admin_status, created_at, updated_at)
    VALUES (NEW.id, NEW.id, LOWER(NEW.email), v_nickname, v_nickname, v_role, v_status, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      user_id = EXCLUDED.user_id,
      nickname = COALESCE(public.profiles.nickname, EXCLUDED.nickname),
      name = COALESCE(public.profiles.name, EXCLUDED.name),
      role = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
      admin_status = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE public.profiles.admin_status END,
      updated_at = NOW();
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error en handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
