export type Role = 'agent' | 'floorwalker' | 'teamleader' | 'admin'

export type TicketStatus = 'pending' | 'taken' | 'resolved'

export type TicketType = 'technical' | 'doubts' | 'supervisor'

// --- Relational role system ---

export interface RoleRecord {
  id: string
  name: string
  hierarchy_level: number
  created_at: string
}

export interface TicketTypeRecord {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface TicketReasonRecord {
  id: string
  ticket_type_id: string
  name: string
  active: boolean
  created_at: string
}

export interface RolePermission {
  id: string
  role_id: string
  ticket_type_id: string
  can_take: boolean
  can_approve: boolean
  created_at: string
  // joined
  role?: RoleRecord
  ticket_type?: TicketTypeRecord
}

// --- Core models ---

export type UserMode = 'taking_calls' | 'supporting'

export interface User {
  id: string
  employee_code: string
  role: Role
  role_id?: string | null
  name: string
  group_id?: string | null
  is_mentor?: boolean
  current_mode?: UserMode
  status?: string
  created_at: string
}

export interface MentorActivation {
  id: string
  mentor_id: string
  group_id: string | null
  activated_by: string
  activated_role: string
  start_time: string
  end_time: string | null
  active: boolean
  created_at: string
  // joined
  mentor?: User
  activator?: User
  group?: Group
}

export interface Group {
  id: string
  name: string
  team_leader_id: string | null
  created_at: string
}

export interface Ticket {
  id: string
  ticket_number: number
  created_by: string
  assigned_to: string | null
  status: TicketStatus
  type: string // kept as text for backward compat — may be admin-defined
  external_ticket_id: string
  reason: string
  description: string | null
  issue?: string
  created_at: string
  taken_at: string | null
  resolved_at: string | null
  creator?: User
  assignee?: User | null
}

export interface Rating {
  id: string
  ticket_id: string
  rated_by: string
  rated_user_id: string
  rating: number
  comment: string | null
  created_at: string
}

export interface TicketWithDetails extends Ticket {
  creator: User
  assignee: User | null
  rating?: Rating
  hasRated?: boolean
}
