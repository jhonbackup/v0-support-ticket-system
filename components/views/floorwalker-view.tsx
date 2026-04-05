"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { TicketWithDetails } from "@/lib/types"
import { useRealtimeTickets } from "@/hooks/use-realtime-tickets"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TicketCard } from "@/components/ticket-card"
import { Empty } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Clock, Ticket, CheckCircle, AlertTriangle, Search } from "lucide-react"
import { toast } from "sonner"

export function FloorwalkerView() {
  const { user } = useAuth()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const { tickets, isLoading } = useRealtimeTickets({
    channelName: "floorwalker-tickets-queue",
  })

  const handleTakeTicket = async (ticketId: string) => {
    if (!user) return
    setActionLoading(ticketId)

    const supabase = createClient()
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "taken",
        assigned_to: user.id,
        taken_at: new Date().toISOString(),
      })
      .eq("id", ticketId)

    setActionLoading(null)

    if (error) {
      toast.error("Failed to take ticket")
      return
    }

    toast.success("Ticket assigned to you")
  }

  const handleResolveTicket = async (ticketId: string) => {
    setActionLoading(ticketId)

    const supabase = createClient()
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", ticketId)

    setActionLoading(null)

    if (error) {
      toast.error("Failed to resolve ticket")
      return
    }

    toast.success("Ticket resolved")
  }

  const filteredTickets = tickets.filter(t => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.trim().toLowerCase()
    
    const formattedId = `TCK-${t.ticket_number?.toString().padStart(6, '0')}`.toLowerCase()
    const internalMatch = formattedId.includes(query) || t.ticket_number?.toString().includes(query)
    
    const externalMatch = t.external_ticket_id?.toLowerCase().includes(query)
    
    return internalMatch || externalMatch
  })

  const pendingTickets = filteredTickets.filter((t) => t.status === "pending")
  const myTakenTickets = filteredTickets.filter((t) => t.status === "taken" && t.assigned_to === user?.id)
  const allTakenTickets = filteredTickets.filter((t) => t.status === "taken")
  const resolvedTickets = filteredTickets.filter((t) => t.status === "resolved")
  const supervisorRequests = pendingTickets.filter((t) => t.type === "supervisor")

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Support Queue</h2>
          <p className="text-muted-foreground">Manage and respond to agent support tickets</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by ID or Zendesk..."
            className="pl-9 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl">{pendingTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Waiting for help
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>My Active</CardDescription>
            <CardTitle className="text-3xl">{myTakenTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              Assigned to you
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved Today</CardDescription>
            <CardTitle className="text-3xl">
              {resolvedTickets.filter((t) => 
                new Date(t.resolved_at!).toDateString() === new Date().toDateString()
              ).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Completed
            </div>
          </CardContent>
        </Card>
        <Card className={supervisorRequests.length > 0 ? "border-orange-200 bg-orange-50" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className={supervisorRequests.length > 0 ? "text-orange-700" : ""}>
              Supervisor
            </CardDescription>
            <CardTitle className={`text-3xl ${supervisorRequests.length > 0 ? "text-orange-700" : ""}`}>
              {supervisorRequests.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-2 text-sm ${supervisorRequests.length > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
              <AlertTriangle className="h-4 w-4" />
              Requires approval
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingTickets.length})</TabsTrigger>
          <TabsTrigger value="my-active">My Active ({myTakenTickets.length})</TabsTrigger>
          <TabsTrigger value="all-active">All Active ({allTakenTickets.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedTickets.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4">
          <TicketList
            tickets={pendingTickets}
            isLoading={isLoading}
            actionLoading={actionLoading}
            showAssignButton
            onAssign={handleTakeTicket}
          />
        </TabsContent>
        <TabsContent value="my-active" className="mt-4">
          <TicketList
            tickets={myTakenTickets}
            isLoading={isLoading}
            actionLoading={actionLoading}
            showResolveButton
            onResolve={handleResolveTicket}
          />
        </TabsContent>
        <TabsContent value="all-active" className="mt-4">
          <TicketList
            tickets={allTakenTickets}
            isLoading={isLoading}
            actionLoading={actionLoading}
          />
        </TabsContent>
        <TabsContent value="resolved" className="mt-4">
          <TicketList 
            tickets={resolvedTickets} 
            isLoading={isLoading}
            actionLoading={actionLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TicketList({
  tickets,
  isLoading,
  actionLoading,
  showAssignButton = false,
  onAssign,
  showResolveButton = false,
  onResolve,
}: {
  tickets: TicketWithDetails[]
  isLoading: boolean
  actionLoading?: string | null
  showAssignButton?: boolean
  onAssign?: (ticketId: string) => void
  showResolveButton?: boolean
  onResolve?: (ticketId: string) => void
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <Empty
        title="No tickets found"
        description="All caught up! No tickets in this category."
      />
    )
  }

  return (
    <div className="grid gap-4">
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          showCreator
          showAssignButton={showAssignButton}
          onAssign={onAssign ? () => onAssign(ticket.id) : undefined}
          showResolveButton={showResolveButton}
          onResolve={onResolve ? () => onResolve(ticket.id) : undefined}
          isActionLoading={actionLoading === ticket.id}
        />
      ))}
    </div>
  )
}
