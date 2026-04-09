"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User, TicketWithDetails, Role } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRealtimeTickets } from "@/hooks/use-realtime-tickets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Empty } from "@/components/ui/empty"
import { TicketCard } from "@/components/ticket-card"
import { GroupsTab } from "@/components/admin-groups-tab"
import { AdminConfigTab } from "@/components/admin-config-tab"
import { 
  Users, 
  Ticket, 
  Star, 
  TrendingUp, 
  Plus, 
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { formatDuration } from "@/lib/utils"
import { calculateResponseTimeSeconds, calculateResolutionTimeSeconds } from "@/lib/metrics"

const roleLabels: Record<string, string> = {
  agent: "Agent",
  floorwalker: "Floorwalker",
  teamleader: "Team Leader",
  admin: "Admin",
}

const roleColors: Record<string, string> = {
  agent: "bg-blue-500/10 text-blue-700 border-blue-200",
  floorwalker: "bg-green-500/10 text-green-700 border-green-200",
  teamleader: "bg-amber-500/10 text-amber-700 border-amber-200",
  admin: "bg-red-500/10 text-red-700 border-red-200",
}

export function AdminView() {
  const [users, setUsers] = useState<User[]>([])
  const [isUsersLoading, setIsUsersLoading] = useState(true)
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false)

  const { tickets, isLoading: isTicketsLoading, refetch } = useRealtimeTickets({
    channelName: "admin-tickets-queue",
  })

  const fetchUsers = async () => {
    const supabase = createClient()
    
    const { data: usersData, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      toast.error("Failed to fetch users")
    } else {
      setUsers(usersData || [])
    }
    setIsUsersLoading(false)
  }

  useEffect(() => {
    fetchUsers()

    const supabase = createClient()

    const userChannel = supabase
      .channel("admin-users")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => fetchUsers())
      .subscribe()

    return () => {
      supabase.removeChannel(userChannel)
    }
  }, [])

  const isLoading = isUsersLoading || isTicketsLoading

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return

    const supabase = createClient()
    const { error } = await supabase.from("users").delete().eq("id", userId)

    if (error) {
      toast.error("Failed to delete user")
      return
    }

    toast.success("User deleted")
    fetchUsers()
  }

  // Analytics calculations
  const totalTickets = tickets.length
  const resolvedTickets = tickets.filter((t) => t.status === "resolved")
  const pendingTickets = tickets.filter((t) => t.status === "pending")
  const takenTickets = tickets.filter((t) => t.status === "taken")
  
  const ratingsWithScore = tickets.filter((t) => t.rating)
  const avgRating = ratingsWithScore.length > 0
    ? (ratingsWithScore.reduce((sum, t) => sum + (t.rating?.rating || 0), 0) / ratingsWithScore.length).toFixed(1)
    : "N/A"

  const takenWithTime = tickets.filter(t => t.taken_at)
  const avgResponseTimeSeconds = takenWithTime.length > 0 
    ? takenWithTime.reduce((sum, t) => sum + (calculateResponseTimeSeconds(t) || 0), 0) / takenWithTime.length
    : null

  const resolvedWithTime = resolvedTickets.filter((t) => t.taken_at && t.resolved_at)
  const avgResolutionTimeSeconds = resolvedWithTime.length > 0
    ? resolvedWithTime.reduce((sum, t) => sum + (calculateResolutionTimeSeconds(t) || 0), 0) / resolvedWithTime.length
    : null

  // Support staff performance
  const supportStaff = users.filter((u) => u.role === "floorwalker" || u.role === "teamleader")
  const staffStats = supportStaff.map((staff) => {
    const staffTickets = tickets.filter((t) => t.assigned_to === staff.id)
    const staffResolved = staffTickets.filter((t) => t.status === "resolved")
    const staffRatings = staffResolved.filter((t) => t.rating)
    const staffAvgRating = staffRatings.length > 0
      ? (staffRatings.reduce((sum, t) => sum + (t.rating?.rating || 0), 0) / staffRatings.length).toFixed(1)
      : "N/A"
    
    return {
      ...staff,
      totalHandled: staffTickets.length,
      resolved: staffResolved.length,
      avgRating: staffAvgRating,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground">Manage users and view system analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {users.filter((u) => u.role === "agent").length} agents
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tickets</CardDescription>
            <CardTitle className="text-3xl">{totalTickets}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              {resolvedTickets.length} resolved
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
            <CardTitle className="text-3xl">{avgRating}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4" />
              {ratingsWithScore.length} ratings
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Response Time</CardDescription>
            <CardTitle className="text-3xl">{formatDuration(avgResponseTimeSeconds)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Created to Taken
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Resolution Time</CardDescription>
            <CardTitle className="text-3xl">{formatDuration(avgResolutionTimeSeconds)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Taken to Resolved
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="performance">Staff Performance</TabsTrigger>
          <TabsTrigger value="tickets">All Tickets</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage system users and their roles</CardDescription>
              </div>
              <Button onClick={() => setAddUserDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : users.length === 0 ? (
                <Empty title="No users" description="Add users to get started" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono">{user.employee_code}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleColors[user.role]}>
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Support Staff Performance</CardTitle>
              <CardDescription>Track floorwalker and team leader metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {staffStats.length === 0 ? (
                <Empty title="No support staff" description="Add floorwalkers or team leaders to see performance metrics" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Tickets Handled</TableHead>
                      <TableHead>Resolved</TableHead>
                      <TableHead>Avg Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffStats.map((staff) => (
                      <TableRow key={staff.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{staff.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {staff.employee_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleColors[staff.role]}>
                            {roleLabels[staff.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>{staff.totalHandled}</TableCell>
                        <TableCell>{staff.resolved}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            {staff.avgRating}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <CardDescription className="text-yellow-700">Pending</CardDescription>
                </div>
                <CardTitle className="text-2xl text-yellow-800">{pendingTickets.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                  <CardDescription className="text-blue-700">In Progress</CardDescription>
                </div>
                <CardTitle className="text-2xl text-blue-800">{takenTickets.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <CardDescription className="text-green-700">Resolved</CardDescription>
                </div>
                <CardTitle className="text-2xl text-green-800">{resolvedTickets.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                </Card>
              ))
            ) : tickets.length === 0 ? (
              <Empty title="No tickets" description="No tickets have been created yet" />
            ) : (
              tickets.slice(0, 20).map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} showCreator />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          <GroupsTab />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <AdminConfigTab />
        </TabsContent>
      </Tabs>

      <AddUserDialog
        open={addUserDialogOpen}
        onOpenChange={setAddUserDialogOpen}
        onSuccess={fetchUsers}
      />
    </div>
  )
}

function AddUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [employeeCode, setEmployeeCode] = useState("")
  const [name, setName] = useState("")
  const [roleId, setRoleId] = useState<string>("")
  const [dbRoles, setDbRoles] = useState<{id: string, name: string}[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function fetchRoles() {
      const supabase = createClient()
      const { data } = await supabase.from("roles").select("id, name").order("hierarchy_level", { ascending: false })
      if (data) {
        setDbRoles(data)
        if (data.length > 0) setRoleId(data[0].id)
      }
    }
    if (open) fetchRoles()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()
    const selectedRoleName = dbRoles.find(r => r.id === roleId)?.name || "agent"
    
    console.log("Creating user with role_id:", roleId)

    const { error } = await supabase.from("users").insert({
      employee_code: employeeCode.toUpperCase(),
      name,
      role: selectedRoleName as Role,
      role_id: roleId,
    })

    if (error) {
      if (error.code === "23505") {
        toast.error("Employee code already exists")
      } else {
        toast.error("Failed to create user")
      }
      setIsLoading(false)
      return
    }

    toast.success("User created successfully")
    setEmployeeCode("")
    setName("")
    if (dbRoles.length > 0) setRoleId(dbRoles[0].id)
    setIsLoading(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>Create a new user account for the support system.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="employeeCode">Employee Code</FieldLabel>
              <Input
                id="employeeCode"
                placeholder="e.g., AGT002"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="uppercase"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="role">Role</FieldLabel>
              <Select value={roleId} onValueChange={(value) => setRoleId(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {dbRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {roleLabels[role.name] || role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !roleId}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
