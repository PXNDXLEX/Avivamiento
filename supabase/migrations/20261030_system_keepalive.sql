-- ==============================================================
-- Tabla de Pulso y Registro de Actividad (Supabase Keep-Alive)
-- Evita la pausa automática por inactividad de la capa gratuita
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.system_keepalive (
  id TEXT PRIMARY KEY DEFAULT 'primary_heartbeat',
  last_ping TIMESTAMPTZ NOT NULL DEFAULT now(),
  ping_count BIGINT NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'active',
  environment TEXT DEFAULT 'production',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertar registro inicial si no existe
INSERT INTO public.system_keepalive (id, last_ping, ping_count, source, status)
VALUES ('primary_heartbeat', now(), 1, 'init', 'active')
ON CONFLICT (id) DO NOTHING;

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.system_keepalive ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir lectura de pulso a todos" ON public.system_keepalive;
CREATE POLICY "Permitir lectura de pulso a todos"
  ON public.system_keepalive FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir actualizacion de pulso" ON public.system_keepalive;
CREATE POLICY "Permitir actualizacion de pulso"
  ON public.system_keepalive FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir insercion de pulso" ON public.system_keepalive;
CREATE POLICY "Permitir insercion de pulso"
  ON public.system_keepalive FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Función RPC para registrar un pulso atómicamente y devolver el nuevo estado
CREATE OR REPLACE FUNCTION public.record_heartbeat(ping_source TEXT DEFAULT 'api')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_row RECORD;
BEGIN
  INSERT INTO public.system_keepalive (id, last_ping, ping_count, source, status, updated_at)
  VALUES ('primary_heartbeat', now(), 1, ping_source, 'active', now())
  ON CONFLICT (id) DO UPDATE
    SET last_ping = now(),
        ping_count = public.system_keepalive.ping_count + 1,
        source = EXCLUDED.source,
        status = 'active',
        updated_at = now()
  RETURNING * INTO result_row;

  RETURN jsonb_build_object(
    'success', true,
    'id', result_row.id,
    'last_ping', result_row.last_ping,
    'ping_count', result_row.ping_count,
    'source', result_row.source,
    'status', result_row.status
  );
END;
$$;
