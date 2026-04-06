-- ============================================================
-- Migration 006: Mentor Activation System
-- Creates mentor_activations table, adds current_mode to users
-- ============================================================

-- 1. ADD current_mode TO USERS
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS current_mode TEXT NOT NULL DEFAULT 'taking_calls'
CHECK (current_mode IN ('taking_calls', 'supporting'));

-- 2. MENTOR ACTIVATIONS TABLE
CREATE TABLE IF NOT EXISTS public.mentor_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  activated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activated_role TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mentor_activations_mentor ON public.mentor_activations(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_activations_active ON public.mentor_activations(active);

-- 3. RLS
ALTER TABLE public.mentor_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read mentor_activations" ON public.mentor_activations FOR SELECT USING (true);
CREATE POLICY "Allow insert mentor_activations" ON public.mentor_activations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update mentor_activations" ON public.mentor_activations FOR UPDATE USING (true);
CREATE POLICY "Allow delete mentor_activations" ON public.mentor_activations FOR DELETE USING (true);

-- 4. Enable realtime for users and mentor_activations
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentor_activations;
