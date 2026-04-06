"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { TicketWithDetails, User } from "@/lib/types"
import { useRealtimeTickets } from "@/hooks/use-realtime-tickets"
import { useTeamMembers } from "@/hooks/use-team-members"
import { useMentorActivation } from "@/hooks/use-mentor-activation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TicketCard } from "@/components/ticket-card"
import { Empty } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { OnlineSupportsPanel } from "@/components/online-supports-panel"
import { Clock, Ticket, CheckCircle, AlertTriangle, Search, Users, Shield, Zap, ZapOff } from "lucide-react"
import { toast } from "sonner"

export function TeamLeaderView() {
  const { user } = useAuth()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const { tickets, isLoading } = useRealtimeTickets({
    channelName: "teamleader-tickets-queue",
  })

  // Team members logic
  const { members, group, isLoading: membersLoading, toggleMentorStatus } = useTeamMembers()

  // Mentor activation logic
  const { activateMentor, deactivateMentor } = useMentorActivation(user)
  const [mentorActionLoading, setMentorActionLoading] = useState<string | null>(null)

  const handleToggleMentorSupport = async (member: User) => {
    setMentorActionLoading(member.id)
    const isActive = member.current_mode === "supporting"
    const success = isActive
      ? await deactivateMentor(member.id)
      : await activateMentor(member.id, member.group_id ?? null)
    setMentorActionLoading(null)
    if (success) {
      toast.success(isActive ? "Mentor deactivated" : "Mentor activated for support")
    } else {
      toast.error("Failed to update mentor status")
    }
  }

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

  const handleToggleMentor = async (memberId: string, currentStatus: boolean) => {
    const success = await toggleMentorStatus(memberId, currentStatus)
    if (!success && !currentStatus) {
      toast.error("You can only flag up to 2 active mentors per group.")
    } else if (success) {
      toast.success(currentStatus ? "Removed mentor tag" : "Added mentor tag")
    }
  }

  return (
    <Tabs defaultValue="queue" className="space-y-6">
      <div className="flex justify-between items-center">
        <TabsList>
          <TabsTrigger value="queue">Support Queue</TabsTrigger>
          <TabsTrigger value="team">Team Management</TabsTrigger>
        </TabsList>
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

      <TabsContent value="team" className="mt-0 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage your group members, mentor roles, and support activation</p>
        </div>

        <OnlineSupportsPanel />

        {membersLoading ? (
          <div className="grid gap-4 mt-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse flex h-20 bg-muted/50" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <Empty 
            title="No team members found" 
            description={group ? `No assignees linked to group ${group.name}` : "You don't have a team assigned yet."} 
          />
        ) : (
          <div className="bg-card rounded-md border shadow-sm mt-4">
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-4 font-medium">Employee Code</th>
                  <th className="px-4 py-4 font-medium">Name</th>
                  <th className="px-4 py-4 font-medium text-center">Mentor</th>
                  <th className="px-4 py-4 font-medium text-center">Support Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 font-mono">{member.employee_code}</td>
                    <td className="px-4 py-4 font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {member.name}
                      {member.is_mentor && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Mentor
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Shield className={`h-4 w-4 ${member.is_mentor ? "text-blue-500" : "text-muted-foreground opacity-50"}`} />
                        <Switch 
                          checked={member.is_mentor || false} 
                          onCheckedChange={() => handleToggleMentor(member.id, !!member.is_mentor)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {member.is_mentor ? (
                        <Button
                          size="sm"
                          variant={member.current_mode === "supporting" ? "destructive" : "default"}
                          className="text-xs"
                          disabled={mentorActionLoading === member.id}
                          onClick={() => handleToggleMentorSupport(member)}
                        >
                          {mentorActionLoading === member.id ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : member.current_mode === "supporting" ? (
                            <><ZapOff className="h-3.5 w-3.5 mr-1" /> Desactivar</>
                          ) : (
                            <><Zap className="h-3.5 w-3.5 mr-1" /> Activar</>
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
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
