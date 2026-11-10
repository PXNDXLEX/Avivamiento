-- Migración para añadir teléfono secundario a la tabla members
-- Ejecutar en el SQL Editor de Supabase si la columna aún no existe

ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS secondary_phone TEXT DEFAULT NULL;

