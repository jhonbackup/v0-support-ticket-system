"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { TicketWithDetails, User } from "@/lib/types"
import { useRealtimeTickets } from "@/hooks/use-realtime-tickets"
import { useMentorActivation } from "@/hooks/use-mentor-activation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TicketCard } from "@/components/ticket-card"
import { Empty } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { OnlineSupportsPanel } from "@/components/online-supports-panel"
import { Clock, Ticket, CheckCircle, AlertTriangle, Search, Shield, Users, Zap, ZapOff } from "lucide-react"
import { toast } from "sonner"
import { fetchMentors as fetchMentorsFromDb } from "@/lib/mentors"

export function FloorwalkerView() {
  const { user } = useAuth()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mentors, setMentors] = useState<User[]>([])
  const [mentorsLoading, setMentorsLoading] = useState(true)

  // Mentor activation hook
  const { activateMentor, deactivateMentor } = useMentorActivation(user)
  const [mentorActionLoading, setMentorActionLoading] = useState<string | null>(null)

  const fetchMentors = useCallback(async () => {
    const data = await fetchMentorsFromDb()
    setMentors(data)
    setMentorsLoading(false)
  }, [])

  // Fetch all mentors
  useEffect(() => {
    fetchMentors()
  }, [fetchMentors])

  // Realtime refresh for mentor mode changes
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`fw-mentor-mode-${Math.random().toString(36).substring(7)}`)

    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "users" }, () => fetchMentors())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [fetchMentors])

  const handleToggleSelfSupport = async () => {
    if (!user) return
    const isActive = user.current_mode === "supporting"
    setMentorActionLoading(user.id)
    const success = isActive
      ? await deactivateMentor(user.id)
      : await activateMentor(user.id, user.group_id ?? null)
    setMentorActionLoading(null)
    if (success) {
      toast.success(isActive ? "Support mode deactivated" : "Support mode activated")
    } else {
      toast.error("Failed to change support mode")
    }
  }

  const handleToggleMentorSupport = async (mentor: User) => {
    setMentorActionLoading(mentor.id)
    const isActive = mentor.current_mode === "supporting"
    const success = isActive
      ? await deactivateMentor(mentor.id)
      : await activateMentor(mentor.id, mentor.group_id ?? null)
    setMentorActionLoading(null)
    if (success) {
      toast.success(isActive ? "Mentor deactivated" : "Mentor activated for support")
      fetchMentors()
    } else {
      toast.error("Failed to update mentor status")
    }
  }

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
    <Tabs defaultValue="queue" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="queue">Support Queue</TabsTrigger>
          <TabsTrigger value="mentors">
            Mentors
            {mentors.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 w-5 h-5 text-xs font-semibold text-blue-800">
                {mentors.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border">
          <span className="text-sm font-medium text-muted-foreground ml-2">My Status:</span>
          {user?.current_mode === "supporting" ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 border border-green-200">
              <Zap className="h-3 w-3 mr-1" /> Activo en soporte
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200">
              <ZapOff className="h-3 w-3 mr-1" /> Disponible
            </span>
          )}
          <Button
            size="sm"
            variant={user?.current_mode === "supporting" ? "destructive" : "default"}
            disabled={mentorActionLoading === user?.id}
            onClick={handleToggleSelfSupport}
            className="h-8 text-xs ml-1"
          >
            {mentorActionLoading === user?.id ? (
              <Spinner className="h-3 w-3" />
            ) : user?.current_mode === "supporting" ? (
              "Desactivar soporte"
            ) : (
              "Activar soporte"
            )}
          </Button>
        </div>
      </div>

      <TabsContent value="queue" className="space-y-6 mt-0">
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
      </TabsContent>

      <TabsContent value="mentors" className="mt-0 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Mentors Directory</h2>
          <p className="text-muted-foreground">Manage mentor support activation</p>
        </div>

        <OnlineSupportsPanel />

        {mentorsLoading ? (
          <div className="grid gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse flex h-20 bg-muted/50" />
            ))}
          </div>
        ) : mentors.length === 0 ? (
          <Empty
            title="No mentors assigned"
            description="Team Leaders haven't assigned any mentors yet."
          />
        ) : (
          <div className="bg-card rounded-md border shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee Code</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mentors.map((mentor) => {
                  const isSupporting = mentor.current_mode === "supporting"
                  return (
                    <tr key={mentor.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono">{mentor.employee_code}</td>
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {mentor.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isSupporting ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                            <Zap className="h-3 w-3 mr-1" />
                            Activo en soporte
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                            <Shield className="h-3 w-3 mr-1" />
                            Disponible
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          size="sm"
                          variant={isSupporting ? "destructive" : "default"}
                          className="text-xs"
                          disabled={mentorActionLoading === mentor.id}
                          onClick={() => handleToggleMentorSupport(mentor)}
                        >
                          {mentorActionLoading === mentor.id ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : isSupporting ? (
                            <><ZapOff className="h-3.5 w-3.5 mr-1" /> Desactivar</>
                          ) : (
                            <><Zap className="h-3.5 w-3.5 mr-1" /> Activar soporte</>
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
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
