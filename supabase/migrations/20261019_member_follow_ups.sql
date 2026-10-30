-- ==============================================================
-- Tabla de Histórico de Seguimiento e Interacciones de Miembros
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.member_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('llamada', 'visita', 'mensaje', 'otro')),
  title TEXT,
  detail TEXT NOT NULL,
  result_status TEXT,
  duration_mins INTEGER,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para optimizar las consultas por miembro y fecha
CREATE INDEX IF NOT EXISTS idx_member_follow_ups_member_id ON public.member_follow_ups(member_id);
CREATE INDEX IF NOT EXISTS idx_member_follow_ups_date ON public.member_follow_ups(date DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.member_follow_ups ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
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
  USING (true);

CREATE POLICY "Permitir eliminacion para usuarios autenticados"
  ON public.member_follow_ups FOR DELETE
  TO authenticated
  USING (true);
