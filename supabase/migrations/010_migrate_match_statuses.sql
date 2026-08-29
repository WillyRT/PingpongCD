-- ==============================================================================
-- Migration 010: Idempotent Migration of Match Statuses to 6 Canonical States
-- Canonical States: 'scheduled', 'in_progress', 'pending_verification', 'completed', 'disputed', 'walkover'
-- ==============================================================================

-- 1. Diagnóstico previo (informativo para ejecución en SQL Editor)
-- SELECT DISTINCT status, count(*) FROM public.matches GROUP BY status;

-- 2. Normalización de filas existentes
UPDATE public.matches 
SET status = 'completed' 
WHERE status IN ('complete', 'confirmed', 'finished');

UPDATE public.matches 
SET status = 'scheduled' 
WHERE status IN ('pending', 'draft');

UPDATE public.matches 
SET status = 'pending_verification' 
WHERE status IN ('submitted', 'reported');

-- 3. Verificación de seguridad: limpiar cualquier fila con estado fuera de vocabulario
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.matches
  WHERE status NOT IN ('scheduled', 'in_progress', 'pending_verification', 'completed', 'disputed', 'walkover');

  IF orphan_count > 0 THEN
    UPDATE public.matches
    SET status = 'scheduled'
    WHERE status NOT IN ('scheduled', 'in_progress', 'pending_verification', 'completed', 'disputed', 'walkover');
  END IF;
END $$;

-- 4. Aplicar restricción CHECK asegurando el nuevo conjunto canónico de 6 estados
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check 
  CHECK (status IN (
    'scheduled',
    'in_progress',
    'pending_verification',
    'completed',
    'disputed',
    'walkover'
  ));

-- 5. Actualizar el valor por defecto de matches.status a 'scheduled'
ALTER TABLE public.matches ALTER COLUMN status SET DEFAULT 'scheduled';
