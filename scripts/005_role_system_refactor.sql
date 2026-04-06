-- ============================================================
-- Migration 005: Role System Refactor
-- Creates roles, ticket_types, ticket_reasons, role_permissions
-- ============================================================

-- 1. ROLES TABLE
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default roles
INSERT INTO public.roles (name, hierarchy_level) VALUES
  ('agent', 1),
  ('floorwalker', 2),
  ('teamleader', 3),
  ('admin', 4)
ON CONFLICT (name) DO NOTHING;

-- 2. ADD role_id TO USERS
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- Backfill role_id from existing text role column
UPDATE public.users
SET role_id = (SELECT id FROM public.roles WHERE name = public.users.role)
WHERE role_id IS NULL;

-- 3. TICKET TYPES TABLE
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default ticket types
INSERT INTO public.ticket_types (name) VALUES
  ('technical'),
  ('doubts'),
  ('supervisor')
ON CONFLICT (name) DO NOTHING;

-- 4. TICKET REASONS TABLE
CREATE TABLE IF NOT EXISTS public.ticket_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default reasons for 'technical'
INSERT INTO public.ticket_reasons (ticket_type_id, name) VALUES
  ((SELECT id FROM public.ticket_types WHERE name = 'technical'), 'Problema con sistema'),
  ((SELECT id FROM public.ticket_types WHERE name = 'technical'), 'Error en aplicación'),
  ((SELECT id FROM public.ticket_types WHERE name = 'technical'), 'Fallo de conexión'),
  ((SELECT id FROM public.ticket_types WHERE name = 'technical'), 'Problema con herramientas'),
  ((SELECT id FROM public.ticket_types WHERE name = 'technical'), 'Otro técnico');

-- Seed default reasons for 'doubts'
INSERT INTO public.ticket_reasons (ticket_type_id, name) VALUES
  ((SELECT id FROM public.ticket_types WHERE name = 'doubts'), 'Consulta sobre proceso'),
  ((SELECT id FROM public.ticket_types WHERE name = 'doubts'), 'Duda sobre política'),
  ((SELECT id FROM public.ticket_types WHERE name = 'doubts'), 'Información de producto'),
  ((SELECT id FROM public.ticket_types WHERE name = 'doubts'), 'Aclaración de procedimiento'),
  ((SELECT id FROM public.ticket_types WHERE name = 'doubts'), 'Otra duda');

-- Seed default reasons for 'supervisor'
INSERT INTO public.ticket_reasons (ticket_type_id, name) VALUES
  ((SELECT id FROM public.ticket_types WHERE name = 'supervisor'), 'Escalamiento de caso'),
  ((SELECT id FROM public.ticket_types WHERE name = 'supervisor'), 'Autorización necesaria'),
  ((SELECT id FROM public.ticket_types WHERE name = 'supervisor'), 'Cliente solicita supervisor'),
  ((SELECT id FROM public.ticket_types WHERE name = 'supervisor'), 'Situación compleja'),
  ((SELECT id FROM public.ticket_types WHERE name = 'supervisor'), 'Otro motivo');

-- 5. ROLE PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  can_take BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, ticket_type_id)
);

-- 6. Remove CHECK constraint on tickets.type to allow admin-defined types
-- (The constraint name may vary — this is the safest approach)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_type_check;

-- 7. RLS FOR NEW TABLES
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Allow all roles admin" ON public.roles FOR ALL USING (true);

CREATE POLICY "Allow read ticket_types" ON public.ticket_types FOR SELECT USING (true);
CREATE POLICY "Allow all ticket_types admin" ON public.ticket_types FOR ALL USING (true);

CREATE POLICY "Allow read ticket_reasons" ON public.ticket_reasons FOR SELECT USING (true);
CREATE POLICY "Allow all ticket_reasons admin" ON public.ticket_reasons FOR ALL USING (true);

CREATE POLICY "Allow read role_permissions" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Allow all role_permissions admin" ON public.role_permissions FOR ALL USING (true);
