-- ==============================================================
-- Vincular Asistencia de Servicios a las Casas de Dios
-- ==============================================================

-- 1. Agregar columna house_group_id a church_services si no existe
ALTER TABLE public.church_services 
  ADD COLUMN IF NOT EXISTS house_group_id UUID REFERENCES public.house_groups(id) ON DELETE CASCADE;

-- 2. Índice para acelerar consultas de servicios por Casa de Dios
CREATE INDEX IF NOT EXISTS idx_church_services_house_group_id 
  ON public.church_services(house_group_id);

-- 3. Actualizar la restricción UNIQUE para que sea por (house_group_id, name, date)
ALTER TABLE public.church_services 
  DROP CONSTRAINT IF EXISTS uq_church_service_name_date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_church_service_casa_name_date'
  ) THEN
    ALTER TABLE public.church_services 
      ADD CONSTRAINT uq_church_service_casa_name_date UNIQUE (house_group_id, name, date);
  END IF;
END $$;

-- 4. Si existen registros previos sin casa, vincularlos a la primera Casa de Dios disponible
DO $$
DECLARE
  first_casa_id UUID;
BEGIN
  SELECT id INTO first_casa_id FROM public.house_groups ORDER BY created_at ASC LIMIT 1;
  IF first_casa_id IS NOT NULL THEN
    UPDATE public.church_services 
    SET house_group_id = first_casa_id 
    WHERE house_group_id IS NULL;
  END IF;
END $$;

