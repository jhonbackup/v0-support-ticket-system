-- Create ticket_metrics_view for standardized reporting 
CREATE OR REPLACE VIEW ticket_metrics_view AS
SELECT 
  id,
  ticket_number,
  created_by,
  assigned_to,
  status,
  type,
  external_ticket_id,
  reason,
  description,
  issue,
  created_at,
  taken_at,
  resolved_at,
  -- Compute response time in seconds: difference between taken_at and created_at
  CASE 
    WHEN taken_at IS NOT NULL THEN EXTRACT(EPOCH FROM (taken_at - created_at))
    ELSE NULL
  END AS response_time_seconds,
  -- Compute resolution time in seconds: difference between resolved_at and taken_at
  CASE 
    WHEN taken_at IS NOT NULL AND resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - taken_at))
    ELSE NULL
  END AS resolution_time_seconds
FROM tickets;
