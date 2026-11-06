-- ==============================================================
-- Migración Definitiva: Crear y Configurar Tabla member_follow_ups y RLS
-- Archivo: 20261106_fix_member_follow_ups_table_and_rls.sql
-- ==============================================================

-- 1. Crear la tabla public.member_follow_ups si no existe
CREATE TABLE IF NOT EXISTS public.member_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT 'Usuario',
  type TEXT NOT NULL DEFAULT 'otro',
  title TEXT,
  detail TEXT NOT NULL DEFAULT '',
  result_status TEXT,
  duration_mins INTEGER,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Asegurar columnas en caso de que la tabla haya sido creada previamente
ALTER TABLE public.member_follow_ups ADD COLUMN IF NOT EXISTS user_name TEXT NOT NULL DEFAULT 'Usuario';
ALTER TABLE public.member_follow_ups ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.member_follow_ups ADD COLUMN IF NOT EXISTS result_status TEXT;
ALTER TABLE public.member_follow_ups ADD COLUMN IF NOT EXISTS duration_mins INTEGER;
ALTER TABLE public.member_follow_ups ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.member_follow_ups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Actualizar la restricción CHECK de 'type' para incluir todos los tipos válidos
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.member_follow_ups'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) ILIKE '%type%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.member_follow_ups DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.member_follow_ups 
  ADD CONSTRAINT member_follow_ups_type_check 
  CHECK (type IN ('llamada', 'visita', 'mensaje', 'otro', 'inactivo'));

-- 4. Crear índices para optimizar las consultas por miembro y fecha
CREATE INDEX IF NOT EXISTS idx_member_follow_ups_member_id ON public.member_follow_ups(member_id);
CREATE INDEX IF NOT EXISTS idx_member_follow_ups_date ON public.member_follow_ups(date DESC);

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE public.member_follow_ups ENABLE ROW LEVEL SECURITY;

-- 6. Limpieza y creación de políticas de RLS para usuarios autenticados
DROP POLICY IF EXISTS "Permitir lectura para usuarios autenticados" ON public.member_follow_ups;
DROP POLICY IF EXISTS "Permitir insercion para usuarios autenticados" ON public.member_follow_ups;
DROP POLICY IF EXISTS "Permitir actualizacion para usuarios autenticados" ON public.member_follow_ups;
DROP POLICY IF EXISTS "Permitir eliminacion para usuarios autenticados" ON public.member_follow_ups;
DROP POLICY IF EXISTS "Permitir acceso a autenticados en member_follow_ups" ON public.member_follow_ups;

CREATE POLICY "Permitir lectura para usuarios autenticados"
  ON public.member_follow_ups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insercion para usuarios autenticados"
  ON public.member_follow_ups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion para usuarios autenticados"
  ON public.member_follow_ups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir eliminacion para usuarios autenticados"
  ON public.member_follow_ups FOR DELETE
  TO authenticated
  USING (true);

-- 7. Otorgar permisos a authenticated y service_role
GRANT ALL ON public.member_follow_ups TO authenticated;
GRANT ALL ON public.member_follow_ups TO service_role;

