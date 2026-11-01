-- ==============================================================
-- Migración: Habilitar estado 'Inactivo' en public.members
-- y tipo 'inactivo' en public.member_follow_ups
-- ==============================================================

-- 1. Si existe un tipo ENUM para status en Postgres, agregar el valor 'Inactivo'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
    BEGIN
      ALTER TYPE member_status ADD VALUE IF NOT EXISTS 'Inactivo';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status_enum') THEN
    BEGIN
      ALTER TYPE member_status_enum ADD VALUE IF NOT EXISTS 'Inactivo';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Eliminar cualquier restricción CHECK existente sobre la columna status en members
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.members'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.members DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Crear la nueva restricción CHECK con todos los estados válidos incluyendo 'Inactivo'
ALTER TABLE public.members 
  ADD CONSTRAINT members_status_check 
  CHECK (status IN ('Nuevo', 'Reconciliado', 'Visitante', 'Consolidado', 'Inactivo'));

-- 4. Actualizar restricción CHECK en public.member_follow_ups para incluir 'inactivo'
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
