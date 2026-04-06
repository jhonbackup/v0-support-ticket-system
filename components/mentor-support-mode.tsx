"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { MentorActivation, TicketWithDetails, User } from "@/lib/types"
import { useRealtimeTickets } from "@/hooks/use-realtime-tickets"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TicketCard } from "@/components/ticket-card"
import { Empty } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Zap, Clock, Ticket, CheckCircle, Star, Timer, Search } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

export function MentorSupportMode() {
  const { user } = useAuth()
  const [activation, setActivation] = useState<MentorActivation | null>(null)
  const [activator, setActivator] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [elapsed, setElapsed] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [allowedTypes, setAllowedTypes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Tickets assigned to this mentor (active + resolved)
  const { tickets: myTickets, isLoading: myTicketsLoading } = useRealtimeTickets({
    assignedTo: user?.id,
    channelName: `mentor-assigned-${user?.id}`,
  })

  // ALL pending tickets in the queue (mentor will browse these)
  const { tickets: allTickets, isLoading: queueLoading } = useRealtimeTickets({
    channelName: `mentor-queue-${user?.id}`,
  })

  // Fetch current activation
  const fetchActivation = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from("mentor_activations")
      .select("*")
      .eq("mentor_id", user.id)
      .eq("active", true)
      .maybeSingle()

    if (data) {
      setActivation(data as MentorActivation)
      // Fetch activator user
      const { data: activatorData } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.activated_by)
        .single()
      setActivator(activatorData as User | null)
    } else {
      setActivation(null)
      setActivator(null)
    }
    setIsLoading(false)
  }, [user, supabase])

  // Fetch which ticket types this user's role can take (via role_permissions)
  const fetchAllowedTypes = useCallback(async () => {
    if (!user?.role_id) {
      // Fallback: if no role_id, try to find it via role name
      const { data: roleData } = await supabase
        .from("roles")
        .select("id")
        .eq("name", user?.role ?? "agent")
        .maybeSingle()
      
      if (roleData) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("ticket_type_id, ticket_types(name)")
          .eq("role_id", roleData.id)
          .eq("can_take", true)

        if (perms && perms.length > 0) {
          const names = perms.map((p: any) => p.ticket_types?.name).filter(Boolean)
          setAllowedTypes(names)
          console.log("[MentorSupport] Allowed ticket types (from role):", names)
        } else {
          // No permissions configured yet — allow all
          setAllowedTypes([])
          console.log("[MentorSupport] No role_permissions configured, allowing all types")
        }
      }
      return
    }

    const { data: perms } = await supabase
      .from("role_permissions")
      .select("ticket_type_id, ticket_types(name)")
      .eq("role_id", user.role_id)
      .eq("can_take", true)

    if (perms && perms.length > 0) {
      const names = perms.map((p: any) => p.ticket_types?.name).filter(Boolean)
      setAllowedTypes(names)
      console.log("[MentorSupport] Allowed ticket types:", names)
    } else {
      // No permissions configured — allow all types
      setAllowedTypes([])
      console.log("[MentorSupport] No role_permissions configured, allowing all types")
    }
  }, [user, supabase])

  useEffect(() => {
    fetchActivation()
    fetchAllowedTypes()
  }, [fetchActivation, fetchAllowedTypes])

  // Live elapsed timer
  useEffect(() => {
    if (!activation) return
    const update = () => {
      setElapsed(formatDistanceToNow(new Date(activation.start_time), { includeSeconds: true }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [activation])

  // Take ticket
  const handleTakeTicket = async (ticketId: string) => {
    if (!user) return
    setActionLoading(ticketId)
    const { error } = await supabase
      .from("tickets")
      .update({ status: "taken", assigned_to: user.id, taken_at: new Date().toISOString() })
      .eq("id", ticketId)
    setActionLoading(null)
    if (error) toast.error("Failed to take ticket")
    else toast.success("Ticket assigned to you")
  }

  // Resolve ticket
  const handleResolveTicket = async (ticketId: string) => {
    setActionLoading(ticketId)
    const { error } = await supabase
      .from("tickets")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", ticketId)
    setActionLoading(null)
    if (error) toast.error("Failed to resolve ticket")
    else toast.success("Ticket resolved")
  }

  // --- Derived data ---

  // Filter pending tickets from the global queue
  // Apply role permission filter (if permissions are configured, only show allowed types)
  const pendingTickets = allTickets
    .filter((t) => t.status === "pending")
    .filter((t) => {
      if (allowedTypes.length === 0) return true // No permissions configured => show all
      return allowedTypes.includes(t.type)
    })
    .filter((t) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.trim().toLowerCase()
      const fmtId = `TCK-${t.ticket_number?.toString().padStart(6, '0')}`.toLowerCase()
      return fmtId.includes(q) || t.ticket_number?.toString().includes(q) || t.external_ticket_id?.toLowerCase().includes(q)
    })

  // My active & resolved
  const myActiveTickets = myTickets.filter((t) => t.status === "taken")
  const myResolvedTickets = myTickets.filter((t) => t.status === "resolved")
  
  // Metrics
  const ratingsWithScore = myTickets.filter((t) => t.rating)
  const avgRating =
    ratingsWithScore.length > 0
      ? (ratingsWithScore.reduce((sum, t) => sum + (t.rating?.rating || 0), 0) / ratingsWithScore.length).toFixed(1)
      : "—"

  // Debug logging
  useEffect(() => {
    console.log("[MentorSupport] User:", user?.name, "| Mode:", user?.current_mode, "| is_mentor:", user?.is_mentor)
    console.log("[MentorSupport] Pending queue:", pendingTickets.length, "| My active:", myActiveTickets.length)
  }, [user, pendingTickets.length, myActiveTickets.length])

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Support Mode Header */}
      <Card className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-800">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-green-800 dark:text-green-200">
                  Modo Soporte Activo
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-400">
                  You are currently in support mode — take tickets from the queue below
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-green-500 text-white border-green-600 text-sm px-3 py-1">
              <Timer className="h-3.5 w-3.5 mr-1.5" />
              {elapsed}
            </Badge>
          </div>
        </CardHeader>
        {activation && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-green-800 dark:text-green-300">
              <span>
                <strong>Activated by:</strong> {activator?.name ?? "Unknown"}
              </span>
              <span>
                <strong>Role:</strong>{" "}
                <span className="capitalize">{activation.activated_role}</span>
              </span>
              <span>
                <strong>Since:</strong>{" "}
                {new Date(activation.start_time).toLocaleTimeString()}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Queue</CardDescription>
            <CardTitle className="text-3xl">{pendingTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Pending tickets
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>My Active</CardDescription>
            <CardTitle className="text-3xl">{myActiveTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              Currently handling
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved</CardDescription>
            <CardTitle className="text-3xl">{myResolvedTickets.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Completed
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Rating</CardDescription>
            <CardTitle className="text-3xl">{avgRating}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-amber-500" />
              {ratingsWithScore.length} rating{ratingsWithScore.length !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by ID or Zendesk..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs: Queue / My Active / History */}
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Pending Queue ({pendingTickets.length})</TabsTrigger>
          <TabsTrigger value="active">My Active ({myActiveTickets.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({myResolvedTickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          {queueLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
          ) : pendingTickets.length === 0 ? (
            <Empty title="No pending tickets" description="All caught up! No tickets in the queue." />
          ) : (
            <div className="grid gap-3">
              {pendingTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  showCreator
                  showAssignButton
                  onAssign={() => handleTakeTicket(ticket.id)}
                  isActionLoading={actionLoading === ticket.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          {myTicketsLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
          ) : myActiveTickets.length === 0 ? (
            <Empty title="No active tickets" description="Take a ticket from the queue to get started." />
          ) : (
            <div className="grid gap-3">
              {myActiveTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  showCreator
                  showResolveButton
                  onResolve={() => handleResolveTicket(ticket.id)}
                  isActionLoading={actionLoading === ticket.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          {myTicketsLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
          ) : myResolvedTickets.length === 0 ? (
            <Empty title="No resolved tickets yet" description="Resolved tickets will appear here." />
          ) : (
            <div className="grid gap-3">
              {myResolvedTickets.slice(0, 20).map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} showCreator />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
