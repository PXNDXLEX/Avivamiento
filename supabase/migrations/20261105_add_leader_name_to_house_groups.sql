-- ============================================================
-- MIGRACIÓN: Soporte de nombre libre para Líder en Casas de Dios
-- Archivo: 20261105_add_leader_name_to_house_groups.sql
-- ============================================================

-- 1. Añadir la columna leader_name si no existe en la tabla house_groups
ALTER TABLE public.house_groups 
ADD COLUMN IF NOT EXISTS leader_name TEXT;

-- 2. Migrar nombres existentes de perfiles vinculados a leader_id (si los hubiera)
UPDATE public.house_groups hg
SET leader_name = p.full_name
FROM public.profiles p
WHERE hg.leader_id::text = p.id::text 
  AND (hg.leader_name IS NULL OR hg.leader_name = '');

