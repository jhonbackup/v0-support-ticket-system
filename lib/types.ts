export type Role = 'agent' | 'floorwalker' | 'teamleader' | 'admin'

export type TicketStatus = 'pending' | 'taken' | 'resolved'

export type Priority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  employee_code: string
  role: Role
  name: string
  created_at: string
}

export interface Ticket {
  id: string
  created_by: string
  assigned_to: string | null
  status: TicketStatus
  priority: Priority
  issue: string
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
