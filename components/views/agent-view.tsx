"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { TicketWithDetails } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateTicketDialog } from "@/components/create-ticket-dialog"
import { RatingDialog } from "@/components/rating-dialog"
import { TicketCard } from "@/components/ticket-card"
import { Empty } from "@/components/ui/empty"
import { Plus, Ticket, Clock, CheckCircle } from "lucide-react"
import { toast } from "sonner"

export function AgentView() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [ratingTicket, setRatingTicket] = useState<TicketWithDetails | null>(null)

  const fetchTickets = async () => {
    if (!user) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        creator:users!tickets_created_by_fkey(*),
        assignee:users!tickets_assigned_to_fkey(*),
        rating:ratings(*)
      `)
      .eq("created_by", user.id)
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
      .channel("agent-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `created_by=eq.${user?.id}`,
        },
        () => {
          fetchTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const pendingTickets = tickets.filter((t) => t.status === "pending")
  const takenTickets = tickets.filter((t) => t.status === "taken")
  const resolvedTickets = tickets.filter((t) => t.status === "resolved")
  const unreatedResolvedTickets = resolvedTickets.filter((t) => !t.rating)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Tickets</h2>
          <p className="text-muted-foreground">Create and track your support requests</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl">{pendingTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Waiting for support
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-3xl">{takenTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              Being handled
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved</CardDescription>
            <CardTitle className="text-3xl">{resolvedTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Completed
            </div>
          </CardContent>
        </Card>
      </div>

      {unreatedResolvedTickets.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-amber-800">Rate Your Experience</CardTitle>
            <CardDescription className="text-amber-700">
              You have {unreatedResolvedTickets.length} resolved ticket(s) waiting for your feedback
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {unreatedResolvedTickets.map((ticket) => (
              <Button
                key={ticket.id}
                variant="outline"
                size="sm"
                className="border-amber-300 hover:bg-amber-100"
                onClick={() => setRatingTicket(ticket)}
              >
                Rate: {ticket.issue.slice(0, 30)}...
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingTickets.length})</TabsTrigger>
          <TabsTrigger value="taken">In Progress ({takenTickets.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedTickets.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-4">
          <TicketList tickets={tickets} isLoading={isLoading} onRate={setRatingTicket} />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <TicketList tickets={pendingTickets} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="taken" className="mt-4">
          <TicketList tickets={takenTickets} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="resolved" className="mt-4">
          <TicketList tickets={resolvedTickets} isLoading={isLoading} onRate={setRatingTicket} />
        </TabsContent>
      </Tabs>

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchTickets}
      />

      {ratingTicket && (
        <RatingDialog
          ticket={ratingTicket}
          open={!!ratingTicket}
          onOpenChange={(open) => !open && setRatingTicket(null)}
          onSuccess={fetchTickets}
        />
      )}
    </div>
  )
}

function TicketList({
  tickets,
  isLoading,
  onRate,
}: {
  tickets: TicketWithDetails[]
  isLoading: boolean
  onRate?: (ticket: TicketWithDetails) => void
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
        description="Create a new ticket to get help from your support team"
      />
    )
  }

  return (
    <div className="grid gap-4">
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          showRateButton={ticket.status === "resolved" && !ticket.rating}
          onRate={onRate ? () => onRate(ticket) : undefined}
        />
      ))}
    </div>
  )
}
