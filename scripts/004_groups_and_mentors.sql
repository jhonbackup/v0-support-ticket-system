-- Migration to introduce groups and mentor tagging

-- 1. Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_leader_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add group_id and is_mentor to users table
ALTER TABLE public.users
ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
ADD COLUMN is_mentor BOOLEAN DEFAULT FALSE;

-- 3. Enable RLS on groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for groups table
CREATE POLICY "Allow read access to all groups" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Allow insert groups for admin" ON public.groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update groups for admin" ON public.groups FOR UPDATE USING (true);
CREATE POLICY "Allow delete groups for admin" ON public.groups FOR DELETE USING (true);
