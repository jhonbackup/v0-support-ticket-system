import { calculateTimeDiffSeconds, formatDuration } from "@/lib/utils"

export interface TicketLike {
  created_at: string
  taken_at?: string | null
  resolved_at?: string | null
  external_ticket_id?: string
  ticket_number?: number
}

/**
 * Returns response time in seconds, or null if the ticket is not taken.
 */
export function calculateResponseTimeSeconds(ticket: TicketLike): number | null {
  if (!ticket.taken_at) return null
  return calculateTimeDiffSeconds(ticket.created_at, ticket.taken_at)
}

/**
 * Returns formatted response time (e.g. "2 min 30 sec") or "Pending".
 */
export function calculateResponseTime(ticket: TicketLike): string {
  if (!ticket.taken_at) return "Pending"
  const sec = calculateResponseTimeSeconds(ticket)
  return sec !== null ? formatDuration(sec) : "Pending"
}

/**
 * Returns resolution time in seconds, or null if the ticket isn't fully taken and resolved.
 */
export function calculateResolutionTimeSeconds(ticket: TicketLike): number | null {
  if (!ticket.taken_at || !ticket.resolved_at) return null
  return calculateTimeDiffSeconds(ticket.taken_at, ticket.resolved_at)
}

/**
 * Returns formatted resolution time, "-", or "In progress".
 */
export function calculateResolutionTime(ticket: TicketLike): string {
  if (!ticket.taken_at) return "-"
  if (!ticket.resolved_at) return "In progress"
  
  const sec = calculateResolutionTimeSeconds(ticket)
  return sec !== null ? formatDuration(sec) : "-"
}
