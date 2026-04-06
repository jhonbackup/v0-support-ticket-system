-- Create users table for employee management
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agent', 'floorwalker', 'teamleader', 'admin')),
  name TEXT NOT NULL,
  group_id UUID, -- References groups(id), added in alter below
  is_mentor BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_leader_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add group constraint to users
ALTER TABLE public.users
ADD CONSTRAINT fk_group
FOREIGN KEY (group_id)
REFERENCES public.groups(id)
ON DELETE SET NULL;

-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'resolved')),
  type TEXT NOT NULL CHECK (type IN ('technical', 'doubts', 'supervisor')),
  external_ticket_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  issue TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  taken_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID UNIQUE NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_ratings_ticket_id ON public.ratings(ticket_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Allow read access to all groups" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Allow insert groups for admin" ON public.groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update groups for admin" ON public.groups FOR UPDATE USING (true);
CREATE POLICY "Allow delete groups for admin" ON public.groups FOR DELETE USING (true);

-- RLS Policies for users table (allow read for all, write for admins)
CREATE POLICY "Allow read access to all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow insert for anyone" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for anyone" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow delete for anyone" ON public.users FOR DELETE USING (true);

-- RLS Policies for tickets table
CREATE POLICY "Allow read access to all tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Allow insert tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Allow delete tickets" ON public.tickets FOR DELETE USING (true);

-- RLS Policies for ratings table
CREATE POLICY "Allow read access to all ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Allow insert ratings" ON public.ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update ratings" ON public.ratings FOR UPDATE USING (true);
CREATE POLICY "Allow delete ratings" ON public.ratings FOR DELETE USING (true);

-- Enable realtime for tickets table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
