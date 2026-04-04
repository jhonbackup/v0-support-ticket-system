"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { TicketWithDetails } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TicketCard } from "@/components/ticket-card"
import { Empty } from "@/components/ui/empty"
import { Clock, Ticket, CheckCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

export function FloorwalkerView() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTickets = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        creator:users!tickets_created_by_fkey(*),
        assignee:users!tickets_assigned_to_fkey(*),
        rating:ratings(*)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      toast.error("Failed to fetch tickets")
      return
    }

    const formattedData = data.map((ticket) => ({
      ...ticket,
      rating: ticket.rating?.[0] || undefined,
    }))

    setTickets(formattedData)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchTickets()

    const supabase = createClient()
    const channel = supabase
      .channel("floorwalker-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        () => {
          fetchTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleTakeTicket = async (ticketId: string) => {
    if (!user) return

    const supabase = createClient()
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "taken",
        assigned_to: user.id,
        taken_at: new Date().toISOString(),
      })
      .eq("id", ticketId)

    if (error) {
      toast.error("Failed to take ticket")
      return
    }

    toast.success("Ticket assigned to you")
    fetchTickets()
  }

  const handleResolveTicket = async (ticketId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", ticketId)

    if (error) {
      toast.error("Failed to resolve ticket")
      return
    }

    toast.success("Ticket resolved")
    fetchTickets()
  }

  const pendingTickets = tickets.filter((t) => t.status === "pending")
  const myTakenTickets = tickets.filter((t) => t.status === "taken" && t.assigned_to === user?.id)
  const allTakenTickets = tickets.filter((t) => t.status === "taken")
  const resolvedTickets = tickets.filter((t) => t.status === "resolved")
  const highPriorityPending = pendingTickets.filter((t) => t.priority === "high")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Support Queue</h2>
        <p className="text-muted-foreground">Manage and respond to agent support tickets</p>
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
        <Card className={highPriorityPending.length > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className={highPriorityPending.length > 0 ? "text-red-700" : ""}>
              High Priority
            </CardDescription>
            <CardTitle className={`text-3xl ${highPriorityPending.length > 0 ? "text-red-700" : ""}`}>
              {highPriorityPending.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-2 text-sm ${highPriorityPending.length > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              <AlertTriangle className="h-4 w-4" />
              Urgent attention
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
            showAssignButton
            onAssign={handleTakeTicket}
          />
        </TabsContent>
        <TabsContent value="my-active" className="mt-4">
          <TicketList
            tickets={myTakenTickets}
            isLoading={isLoading}
            showResolveButton
            onResolve={handleResolveTicket}
          />
        </TabsContent>
        <TabsContent value="all-active" className="mt-4">
          <TicketList
            tickets={allTakenTickets}
            isLoading={isLoading}
          />
        </TabsContent>
        <TabsContent value="resolved" className="mt-4">
          <TicketList tickets={resolvedTickets} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TicketList({
  tickets,
  isLoading,
  showAssignButton = false,
  onAssign,
  showResolveButton = false,
  onResolve,
}: {
  tickets: TicketWithDetails[]
  isLoading: boolean
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
        />
      ))}
    </div>
  )
}
