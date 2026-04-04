"use client"

import type { TicketWithDetails } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Clock, User, Calendar, Timer } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { calculateTimeDiffSeconds, formatDuration } from "@/lib/utils"

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
  taken: { label: "In Progress", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  resolved: { label: "Resolved", className: "bg-green-500/10 text-green-700 border-green-200" },
}

const priorityConfig = {
  low: { label: "Low", className: "bg-slate-500/10 text-slate-700 border-slate-200" },
  medium: { label: "Medium", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  high: { label: "High", className: "bg-red-500/10 text-red-700 border-red-200" },
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
}: TicketCardProps) {
  const status = statusConfig[ticket.status]
  const priority = priorityConfig[ticket.priority]
  
  const responseTime = calculateTimeDiffSeconds(ticket.created_at, ticket.taken_at)
  const resolutionTime = calculateTimeDiffSeconds(ticket.created_at, ticket.resolved_at)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base font-medium leading-relaxed">
              {ticket.issue}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
              <Badge variant="outline" className={priority.className}>
                {priority.label}
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
            </div>
          )}
          {ticket.assignee && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Assigned to: {ticket.assignee.name}
            </div>
          )}
          {ticket.taken_at && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Taken {formatDistanceToNow(new Date(ticket.taken_at), { addSuffix: true })}
            </div>
          )}
          {responseTime !== null && (
            <div className="flex items-center gap-1 text-blue-600">
              <Timer className="h-4 w-4" />
              Response: {formatDuration(responseTime)}
            </div>
          )}
          {resolutionTime !== null && (
            <div className="flex items-center gap-1 text-green-600">
              <Timer className="h-4 w-4" />
              Resolution: {formatDuration(resolutionTime)}
            </div>
          )}
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
            <Button size="sm" onClick={onAssign}>
              Take Ticket
            </Button>
          )}
          {showResolveButton && (
            <Button size="sm" variant="secondary" onClick={onResolve}>
              Mark Resolved
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
