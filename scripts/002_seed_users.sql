-- Seed initial users with employee codes
INSERT INTO public.users (employee_code, role, name) VALUES
  ('ag001', 'agent', 'Agent One'),
  ('ag002', 'agent', 'Agent Two'),
  ('ag003', 'agent', 'Agent Three'),
  ('fw001', 'floorwalker', 'Floorwalker One'),
  ('fw002', 'floorwalker', 'Floorwalker Two'),
  ('tl001', 'teamleader', 'Team Leader One'),
  ('tl002', 'teamleader', 'Team Leader Two'),
  ('ad001', 'admin', 'Admin One')
ON CONFLICT (employee_code) DO NOTHING;
