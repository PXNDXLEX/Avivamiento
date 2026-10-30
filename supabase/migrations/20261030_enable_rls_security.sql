-- ==============================================================
-- Migración de Seguridad: Habilitación de RLS y Políticas Seguras
-- Corrige los avisos de "RLS Disabled in Public" y "Policy Exists RLS Disabled"
-- sin alterar el funcionamiento actual de la aplicación.
-- ==============================================================

-- 1. TABLA: PROFILES
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas para evitar colisiones
DROP POLICY IF EXISTS "Permitir lectura de perfiles a usuarios autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir actualizacion de perfiles a usuarios autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir insercion de perfiles a usuarios autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Permitir lectura de perfiles a autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir actualizacion de perfiles a autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir insercion de perfiles a autenticados" ON public.profiles;

-- Políticas para usuarios autenticados
CREATE POLICY "Permitir lectura de perfiles a autenticados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir actualizacion de perfiles a autenticados"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir insercion de perfiles a autenticados"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- 2. TABLA: MEMBERS
ALTER TABLE IF EXISTS public.members ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas
DROP POLICY IF EXISTS "Permitir lectura de miembros a autenticados" ON public.members;
DROP POLICY IF EXISTS "Permitir insercion de miembros a autenticados" ON public.members;
DROP POLICY IF EXISTS "Permitir actualizacion de miembros a autenticados" ON public.members;
DROP POLICY IF EXISTS "Permitir eliminacion de miembros a autenticados" ON public.members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.members;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.members;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.members;

-- Políticas para usuarios autenticados
CREATE POLICY "Permitir lectura de miembros a autenticados"
  ON public.members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insercion de miembros a autenticados"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de miembros a autenticados"
  ON public.members FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir eliminacion de miembros a autenticados"
  ON public.members FOR DELETE
  TO authenticated
  USING (true);


-- 3. TABLA: HOUSE_GROUPS
ALTER TABLE IF EXISTS public.house_groups ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas
DROP POLICY IF EXISTS "Permitir lectura de house_groups a autenticados" ON public.house_groups;
DROP POLICY IF EXISTS "Permitir actualizacion de house_groups a autenticados" ON public.house_groups;
DROP POLICY IF EXISTS "Permitir insercion de house_groups a autenticados" ON public.house_groups;
DROP POLICY IF EXISTS "Permitir eliminacion de house_groups a autenticados" ON public.house_groups;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.house_groups;

-- Políticas para usuarios autenticados
CREATE POLICY "Permitir lectura de house_groups a autenticados"
  ON public.house_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir actualizacion de house_groups a autenticados"
  ON public.house_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir insercion de house_groups a autenticados"
  ON public.house_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir eliminacion de house_groups a autenticados"
  ON public.house_groups FOR DELETE
  TO authenticated
  USING (true);


-- 4. TABLAS ADICIONALES / HISTÓRICAS: ATTENDANCES Y HOUSE_GROUP_MEETINGS
-- Se habilita RLS para eliminar las alertas de seguridad
ALTER TABLE IF EXISTS public.attendances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acceso a autenticados en attendances" ON public.attendances;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.attendances;

CREATE POLICY "Permitir acceso a autenticados en attendances"
  ON public.attendances FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE IF EXISTS public.house_group_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acceso a autenticados en house_group_meetings" ON public.house_group_meetings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.house_group_meetings;

CREATE POLICY "Permitir acceso a autenticados en house_group_meetings"
  ON public.house_group_meetings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
