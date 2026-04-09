"use client"

import type { TicketWithDetails } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Clock, User, Calendar, Timer } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { calculateResponseTime, calculateResolutionTime } from "@/lib/metrics"
const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
  taken: { label: "In Progress", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  resolved: { label: "Resolved", className: "bg-green-500/10 text-green-700 border-green-200" },
}

const typeConfig: Record<string, { label: string; className: string }> = {
  technical: { label: "Technical", className: "bg-purple-500/10 text-purple-700 border-purple-200" },
  doubts: { label: "Doubts", className: "bg-cyan-500/10 text-cyan-700 border-cyan-200" },
  supervisor: { label: "Supervisor", className: "bg-orange-500/10 text-orange-700 border-orange-200" },
}

interface TicketCardProps {
  ticket: TicketWithDetails
  showRateButton?: boolean
  onRate?: () => void
  showAssignButton?: boolean
  onAssign?: () => void
  showResolveButton?: boolean
  onResolve?: () => void
  showCreator?: boolean
  showAlreadyRated?: boolean
  isActionLoading?: boolean
}

export function TicketCard({
  ticket,
  showRateButton,
  onRate,
  showAssignButton,
  onAssign,
  showResolveButton,
  onResolve,
  showCreator = false,
  showAlreadyRated = false,
  isActionLoading = false,
}: TicketCardProps) {
  const status = statusConfig[ticket.status]
  const ticketType = typeConfig[ticket.type] || { label: ticket.type, className: "bg-slate-500/10 text-slate-700 border-slate-200" }
  
  const responseTimeDisplay = calculateResponseTime(ticket)
  const resolutionTimeDisplay = calculateResolutionTime(ticket)

  // DEBUG
  console.log("Ticket Time Metrics Debug:", {
    external_id: ticket.external_ticket_id,
    created_at: ticket.created_at,
    taken_at: ticket.taken_at,
    resolved_at: ticket.resolved_at
  })
  const mainLabel = ticket.reason || "Support Ticket"
  const secondaryText = ticket.description || ticket.issue
  const formattedInternalId = `#TCK-${ticket.ticket_number?.toString().padStart(6, '0') || '000000'}`

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground pb-1">
              <span>{formattedInternalId}</span>
              <span>•</span>
              <span className="text-blue-600 dark:text-blue-400">Zendesk: {ticket.external_ticket_id || 'N/A'}</span>
            </div>
            <CardTitle className="text-base font-medium leading-relaxed">
              {mainLabel}
            </CardTitle>
            {secondaryText && (
              <p className="text-sm text-muted-foreground mr-4">
                {secondaryText}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
              <Badge variant="outline" className={ticketType.className}>
                {ticketType.label}
              </Badge>
            </div>
          </div>
          {ticket.rating && (
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < ticket.rating!.rating ? "fill-current" : "text-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
          </div>
          {showCreator && ticket.creator && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {ticket.creator.name} ({ticket.creator.employee_code})
              {ticket.creator.is_mentor && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1 py-0 bg-blue-100 text-blue-800 border-blue-200">
                  Mentor
                </Badge>
              )}
            </div>
          )}
          {ticket.assignee && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Assigned to: {ticket.assignee.name}
              {ticket.assignee.is_mentor && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1 py-0 bg-blue-100 text-blue-800 border-blue-200">
                  Mentor
                </Badge>
              )}
            </div>
          )}
          {ticket.taken_at && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Taken {formatDistanceToNow(new Date(ticket.taken_at), { addSuffix: true })}
            </div>
          )}
          <div className="flex items-center gap-1 text-blue-600">
            <Timer className="h-4 w-4" />
            Response: {responseTimeDisplay}
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <Timer className="h-4 w-4" />
            Resolution: {resolutionTimeDisplay}
          </div>
        </div>
        
        {ticket.rating?.comment && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm italic">&quot;{ticket.rating.comment}&quot;</p>
          </div>
        )}
        
        <div className="flex gap-2 mt-4">
          {showRateButton && (
            <Button size="sm" variant="outline" onClick={onRate}>
              <Star className="h-4 w-4 mr-2" />
              Rate
            </Button>
          )}
          {showAlreadyRated && (
            <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
              You already rated this support
            </div>
          )}
          {showAssignButton && (
            <Button size="sm" onClick={onAssign} disabled={isActionLoading}>
              Take Ticket
            </Button>
          )}
          {showResolveButton && (
            <Button size="sm" variant="secondary" onClick={onResolve} disabled={isActionLoading}>
              Mark Resolved
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
