-- ==============================================================
-- Módulo de Asistencia a Servicios de la Iglesia
-- Identificación por: Servicio (nombre) + Fecha
-- ==============================================================

-- 1. TABLA DE SERVICIOS
CREATE TABLE IF NOT EXISTS public.church_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_church_service_name_date UNIQUE (name, date)
);

-- Índices para optimizar búsquedas por fecha y nombre
CREATE INDEX IF NOT EXISTS idx_church_services_date ON public.church_services(date DESC);
CREATE INDEX IF NOT EXISTS idx_church_services_name ON public.church_services(name);

-- 2. TABLA DE ASISTENCIAS AL SERVICIO
CREATE TABLE IF NOT EXISTS public.service_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.church_services(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_service_member_attendance UNIQUE (service_id, member_id)
);

-- Índices para optimizar conteos y consultas de miembros
CREATE INDEX IF NOT EXISTS idx_service_attendances_service_id ON public.service_attendances(service_id);
CREATE INDEX IF NOT EXISTS idx_service_attendances_member_id ON public.service_attendances(member_id);

-- 3. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.church_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_attendances ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURIDAD PARA CHURCH_SERVICES
DROP POLICY IF EXISTS "Permitir lectura de church_services a autenticados" ON public.church_services;
CREATE POLICY "Permitir lectura de church_services a autenticados"
  ON public.church_services FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir insercion de church_services a autenticados" ON public.church_services;
CREATE POLICY "Permitir insercion de church_services a autenticados"
  ON public.church_services FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de church_services a autenticados" ON public.church_services;
CREATE POLICY "Permitir actualizacion de church_services a autenticados"
  ON public.church_services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion de church_services a autenticados" ON public.church_services;
CREATE POLICY "Permitir eliminacion de church_services a autenticados"
  ON public.church_services FOR DELETE
  TO authenticated
  USING (true);

-- 5. POLÍTICAS DE SEGURIDAD PARA SERVICE_ATTENDANCES
DROP POLICY IF EXISTS "Permitir lectura de service_attendances a autenticados" ON public.service_attendances;
CREATE POLICY "Permitir lectura de service_attendances a autenticados"
  ON public.service_attendances FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir insercion de service_attendances a autenticados" ON public.service_attendances;
CREATE POLICY "Permitir insercion de service_attendances a autenticados"
  ON public.service_attendances FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de service_attendances a autenticados" ON public.service_attendances;
CREATE POLICY "Permitir actualizacion de service_attendances a autenticados"
  ON public.service_attendances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion de service_attendances a autenticados" ON public.service_attendances;
CREATE POLICY "Permitir eliminacion de service_attendances a autenticados"
  ON public.service_attendances FOR DELETE
  TO authenticated
  USING (true);
