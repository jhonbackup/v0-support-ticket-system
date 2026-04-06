"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Group, User } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Empty } from "@/components/ui/empty"
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronLeft,
  Shield,
  UserPlus,
  UserMinus,
} from "lucide-react"
import { toast } from "sonner"

// ---------- Types ----------
interface GroupWithLeader extends Group {
  team_leader: User | null
  member_count?: number
}

// ---------- Main component ----------
export function GroupsTab() {
  const [groups, setGroups] = useState<GroupWithLeader[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<GroupWithLeader | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [groupToEdit, setGroupToEdit] = useState<GroupWithLeader | null>(null)

  const fetchGroups = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("groups")
      .select("*, team_leader:users!groups_team_leader_id_fkey(*)")
      .order("created_at", { ascending: false })

    if (error) {
      toast.error("Failed to load groups")
    } else {
      // Count members per group
      const groupsWithCount = await Promise.all(
        (data || []).map(async (g: any) => {
          const { count } = await supabase
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("group_id", g.id)
          return { ...g, member_count: count ?? 0 } as GroupWithLeader
        })
      )
      setGroups(groupsWithCount)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this group? Members will be unassigned.")) return
    const supabase = createClient()
    // Unassign members first
    await supabase.from("users").update({ group_id: null, is_mentor: false }).eq("group_id", groupId)
    const { error } = await supabase.from("groups").delete().eq("id", groupId)
    if (error) {
      toast.error("Failed to delete group")
    } else {
      toast.success("Group deleted")
      if (selectedGroup?.id === groupId) setSelectedGroup(null)
      fetchGroups()
    }
  }

  if (selectedGroup) {
    return (
      <GroupDetail
        group={selectedGroup}
        onBack={() => {
          setSelectedGroup(null)
          fetchGroups()
        }}
        onGroupUpdated={(updated) => setSelectedGroup(updated)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Groups</h3>
          <p className="text-sm text-muted-foreground">Manage teams, assign team leaders and members</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-8 w-8" />
        </div>
      ) : groups.length === 0 ? (
        <Empty title="No groups yet" description="Create a group to start organizing teams." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedGroup(group)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {group.team_leader
                        ? `TL: ${group.team_leader.name}`
                        : "No Team Leader assigned"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setGroupToEdit(group)
                        setEditDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{group.member_count ?? 0} member{group.member_count !== 1 ? "s" : ""}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchGroups}
      />

      {groupToEdit && (
        <EditGroupDialog
          group={groupToEdit}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setGroupToEdit(null)
          }}
          onSuccess={fetchGroups}
        />
      )}
    </div>
  )
}

// ---------- Group Detail ----------
function GroupDetail({
  group,
  onBack,
  onGroupUpdated,
}: {
  group: GroupWithLeader
  onBack: () => void
  onGroupUpdated: (g: GroupWithLeader) => void
}) {
  const [members, setMembers] = useState<User[]>([])
  const [available, setAvailable] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    const supabase = createClient()

    const [{ data: inGroup }, { data: notInGroup }] = await Promise.all([
      supabase.from("users").select("*").eq("group_id", group.id).order("name"),
      supabase.from("users").select("*").eq("role", "agent").is("group_id", null).order("name"),
    ])

    setMembers((inGroup as User[]) || [])
    setAvailable((notInGroup as User[]) || [])
    setIsLoading(false)
  }, [group.id])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const mentorCount = members.filter((m) => m.is_mentor).length

  const handleAddMember = async (userId: string) => {
    setActionLoading(userId)
    const supabase = createClient()
    const { error } = await supabase.from("users").update({ group_id: group.id }).eq("id", userId)
    setActionLoading(null)
    if (error) {
      toast.error("Failed to add member")
    } else {
      toast.success("Member added")
      fetchMembers()
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setActionLoading(userId)
    const supabase = createClient()
    const { error } = await supabase
      .from("users")
      .update({ group_id: null, is_mentor: false })
      .eq("id", userId)
    setActionLoading(null)
    if (error) {
      toast.error("Failed to remove member")
    } else {
      toast.success("Member removed")
      fetchMembers()
    }
  }

  const handleToggleMentor = async (userId: string, current: boolean) => {
    if (!current && mentorCount >= 2) {
      toast.warning("Soft limit: this group already has 2 active mentors. You can still add more.")
    }
    setActionLoading(`mentor-${userId}`)
    const supabase = createClient()
    const { error } = await supabase.from("users").update({ is_mentor: !current }).eq("id", userId)
    setActionLoading(null)
    if (error) {
      toast.error("Failed to update mentor status")
    } else {
      toast.success(current ? "Mentor tag removed" : "Mentor tag added")
      fetchMembers()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Groups
        </Button>
        <div>
          <h3 className="text-lg font-semibold">{group.name}</h3>
          <p className="text-xs text-muted-foreground">
            {group.team_leader ? `Team Leader: ${group.team_leader.name}` : "No Team Leader"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Members */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">
                Group Members
                <span className="ml-2 text-muted-foreground font-normal">({members.length})</span>
              </h4>
              {mentorCount >= 2 && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                  2 mentors assigned
                </Badge>
              )}
            </div>

            {members.length === 0 ? (
              <Empty
                title="No members yet"
                description="Add agents from the available list."
              />
            ) : (
              <div className="rounded-md border divide-y bg-card">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                          {member.name}
                          {member.is_mentor && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-200">
                              <Shield className="h-2.5 w-2.5 mr-0.5" />
                              Mentor
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">{member.employee_code}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground hidden sm:block">Mentor</span>
                        <Switch
                          checked={!!member.is_mentor}
                          disabled={actionLoading === `mentor-${member.id}`}
                          onCheckedChange={() => handleToggleMentor(member.id, !!member.is_mentor)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        disabled={actionLoading === member.id}
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        {actionLoading === member.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Agents */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">
              Available Agents
              <span className="ml-2 text-muted-foreground font-normal">({available.length})</span>
            </h4>

            {available.length === 0 ? (
              <Empty
                title="No available agents"
                description="All agents are already in a group."
              />
            ) : (
              <div className="rounded-md border divide-y bg-card max-h-[420px] overflow-y-auto">
                {available.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{agent.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{agent.employee_code}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      disabled={actionLoading === agent.id}
                      onClick={() => handleAddMember(agent.id)}
                    >
                      {actionLoading === agent.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Create Group Dialog ----------
function CreateGroupDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [teamLeaderId, setTeamLeaderId] = useState("")
  const [teamLeaders, setTeamLeaders] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      const supabase = createClient()
      supabase.from("users").select("*").eq("role", "teamleader").order("name").then(({ data }) => {
        setTeamLeaders((data as User[]) || [])
      })
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !teamLeaderId) return
    setIsLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from("groups").insert({
      name: name.trim(),
      team_leader_id: teamLeaderId,
    })

    if (error) {
      toast.error("Failed to create group")
    } else {
      toast.success("Group created")
      setName("")
      setTeamLeaderId("")
      onOpenChange(false)
      onSuccess()
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>Set up a new team with a name and team leader.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="groupName">Group Name</FieldLabel>
              <Input
                id="groupName"
                placeholder="e.g., Team Alpha"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="teamLeader">Team Leader</FieldLabel>
              <Select value={teamLeaderId} onValueChange={setTeamLeaderId}>
                <SelectTrigger id="teamLeader">
                  <SelectValue placeholder="Select a Team Leader..." />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No team leaders found
                    </SelectItem>
                  ) : (
                    teamLeaders.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>
                        {tl.name} ({tl.employee_code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim() || !teamLeaderId}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              Create Group
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Edit Group Dialog ----------
function EditGroupDialog({
  group,
  open,
  onOpenChange,
  onSuccess,
}: {
  group: GroupWithLeader
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(group.name)
  const [teamLeaderId, setTeamLeaderId] = useState(group.team_leader_id ?? "")
  const [teamLeaders, setTeamLeaders] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setName(group.name)
      setTeamLeaderId(group.team_leader_id ?? "")
      const supabase = createClient()
      supabase.from("users").select("*").eq("role", "teamleader").order("name").then(({ data }) => {
        setTeamLeaders((data as User[]) || [])
      })
    }
  }, [open, group])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !teamLeaderId) return
    setIsLoading(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("groups")
      .update({ name: name.trim(), team_leader_id: teamLeaderId })
      .eq("id", group.id)

    if (error) {
      toast.error("Failed to update group")
    } else {
      toast.success("Group updated")
      onOpenChange(false)
      onSuccess()
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
          <DialogDescription>Update the group name or team leader.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="editGroupName">Group Name</FieldLabel>
              <Input
                id="editGroupName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="editTeamLeader">Team Leader</FieldLabel>
              <Select value={teamLeaderId} onValueChange={setTeamLeaderId}>
                <SelectTrigger id="editTeamLeader">
                  <SelectValue placeholder="Select a Team Leader..." />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.map((tl) => (
                    <SelectItem key={tl.id} value={tl.id}>
                      {tl.name} ({tl.employee_code})
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
            <Button type="submit" disabled={isLoading || !name.trim() || !teamLeaderId}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
