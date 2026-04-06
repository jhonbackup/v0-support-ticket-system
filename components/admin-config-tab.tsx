"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RoleRecord, TicketTypeRecord, TicketReasonRecord, RolePermission } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Empty } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Shield,
  Tag,
  Lock,
} from "lucide-react"
import { toast } from "sonner"

// ==============================
// MAIN COMPONENT
// ==============================
export function AdminConfigTab() {
  return (
    <Tabs defaultValue="roles" className="space-y-4">
      <TabsList>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="types">Support Types & Reasons</TabsTrigger>
        <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
      </TabsList>

      <TabsContent value="roles" className="mt-0">
        <RolesSection />
      </TabsContent>
      <TabsContent value="types" className="mt-0">
        <TicketTypesSection />
      </TabsContent>
      <TabsContent value="permissions" className="mt-0">
        <PermissionsSection />
      </TabsContent>
    </Tabs>
  )
}

// ==============================
// ROLES SECTION
// ==============================
function RolesSection() {
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editRole, setEditRole] = useState<RoleRecord | null>(null)
  const [editName, setEditName] = useState("")
  const [editLevel, setEditLevel] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchRoles = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("roles")
      .select("*")
      .order("hierarchy_level", { ascending: true })
    setRoles((data as RoleRecord[]) || [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const handleSave = async () => {
    if (!editRole || !editName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("roles")
      .update({ name: editName.trim(), hierarchy_level: parseInt(editLevel) || 0 })
      .eq("id", editRole.id)

    if (error) {
      toast.error("Failed to update role")
    } else {
      toast.success("Role updated")
      setEditRole(null)
      fetchRoles()
    }
    setSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Roles</CardTitle>
            <CardDescription>View and edit system roles and hierarchy levels</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <Empty title="No roles" description="Roles haven't been seeded yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Hierarchy Level</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium capitalize">{role.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{role.hierarchy_level}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setEditRole(role)
                        setEditName(role.name)
                        setEditLevel(String(role.hierarchy_level))
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Edit Role Dialog */}
        <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>Update the role name and hierarchy level.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Hierarchy Level</FieldLabel>
                <Input
                  type="number"
                  value={editLevel}
                  onChange={(e) => setEditLevel(e.target.value)}
                />
              </Field>
            </FieldGroup>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editName.trim()}>
                {saving ? <Spinner className="mr-2" /> : null}
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// ==============================
// TICKET TYPES & REASONS SECTION
// ==============================
function TicketTypesSection() {
  const [types, setTypes] = useState<TicketTypeRecord[]>([])
  const [reasons, setReasons] = useState<TicketReasonRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [createTypeOpen, setCreateTypeOpen] = useState(false)
  const [createReasonTypeId, setCreateReasonTypeId] = useState<string | null>(null)
  const [editingReason, setEditingReason] = useState<TicketReasonRecord | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from("ticket_types").select("*").order("created_at"),
      supabase.from("ticket_reasons").select("*").order("created_at"),
    ])
    setTypes((t as TicketTypeRecord[]) || [])
    setReasons((r as TicketReasonRecord[]) || [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const toggleTypeActive = async (typeId: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from("ticket_types").update({ active: !current }).eq("id", typeId)
    fetchAll()
  }

  const deleteType = async (typeId: string) => {
    if (!confirm("Delete this type and all its reasons?")) return
    const supabase = createClient()
    await supabase.from("ticket_types").delete().eq("id", typeId)
    fetchAll()
    toast.success("Type deleted")
  }

  const toggleReasonActive = async (reasonId: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from("ticket_reasons").update({ active: !current }).eq("id", reasonId)
    fetchAll()
  }

  const deleteReason = async (reasonId: string) => {
    const supabase = createClient()
    await supabase.from("ticket_reasons").delete().eq("id", reasonId)
    fetchAll()
    toast.success("Reason deleted")
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">Support Types & Reasons</h3>
            <p className="text-sm text-muted-foreground">Manage ticket categories and their reasons</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateTypeOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Type
        </Button>
      </div>

      {types.length === 0 ? (
        <Empty title="No ticket types" description="Create your first ticket type." />
      ) : (
        <div className="space-y-2">
          {types.map((type) => {
            const typeReasons = reasons.filter((r) => r.ticket_type_id === type.id)
            const isExpanded = expandedType === type.id

            return (
              <Card key={type.id}>
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedType(isExpanded ? null : type.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium capitalize">{type.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {typeReasons.length} reason{typeReasons.length !== 1 ? "s" : ""}
                      </Badge>
                      {!type.active && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Active</span>
                        <Switch
                          checked={type.active}
                          onCheckedChange={() => toggleTypeActive(type.id, type.active)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => deleteType(type.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4">
                    <div className="ml-6 space-y-1 border-l-2 border-muted pl-4">
                      {typeReasons.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No reasons — add one below.</p>
                      ) : (
                        typeReasons.map((reason) => (
                          <div
                            key={reason.id}
                            className="flex items-center justify-between py-1.5 text-sm group"
                          >
                            <span className={!reason.active ? "text-muted-foreground line-through" : ""}>
                              {reason.name}
                            </span>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Switch
                                checked={reason.active}
                                onCheckedChange={() => toggleReasonActive(reason.id, reason.active)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setEditingReason(reason)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => deleteReason(reason.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setCreateReasonTypeId(type.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Reason
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <CreateTypeDialog open={createTypeOpen} onOpenChange={setCreateTypeOpen} onSuccess={fetchAll} />
      <CreateReasonDialog
        typeId={createReasonTypeId}
        open={!!createReasonTypeId}
        onOpenChange={(o) => !o && setCreateReasonTypeId(null)}
        onSuccess={fetchAll}
      />
      <EditReasonDialog
        reason={editingReason}
        open={!!editingReason}
        onOpenChange={(o) => !o && setEditingReason(null)}
        onSuccess={fetchAll}
      />
    </div>
  )
}

// ==============================
// PERMISSIONS SECTION
// ==============================
function PermissionsSection() {
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [types, setTypes] = useState<TicketTypeRecord[]>([])
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const [{ data: r }, { data: t }, { data: p }] = await Promise.all([
      supabase.from("roles").select("*").order("hierarchy_level"),
      supabase.from("ticket_types").select("*").eq("active", true).order("created_at"),
      supabase.from("role_permissions").select("*"),
    ])
    setRoles((r as RoleRecord[]) || [])
    setTypes((t as TicketTypeRecord[]) || [])
    setPermissions((p as RolePermission[]) || [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const getPermission = (roleId: string, typeId: string) => {
    return permissions.find((p) => p.role_id === roleId && p.ticket_type_id === typeId)
  }

  const togglePermission = async (
    roleId: string,
    typeId: string,
    field: "can_take" | "can_approve",
    currentPerm: RolePermission | undefined
  ) => {
    const key = `${roleId}-${typeId}-${field}`
    setSaving(key)
    const supabase = createClient()

    if (currentPerm) {
      await supabase
        .from("role_permissions")
        .update({ [field]: !currentPerm[field] })
        .eq("id", currentPerm.id)
    } else {
      await supabase.from("role_permissions").insert({
        role_id: roleId,
        ticket_type_id: typeId,
        [field]: true,
      })
    }

    await fetchAll()
    setSaving(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>
              Configure which roles can take or approve each ticket type
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {roles.length === 0 || types.length === 0 ? (
          <Empty
            title="No data"
            description="Ensure roles and active ticket types exist first."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Role</TableHead>
                  {types.map((type) => (
                    <TableHead key={type.id} colSpan={2} className="text-center capitalize border-l">
                      {type.name}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead />
                  {types.map((type) => (
                    <React.Fragment key={`sub-${type.id}`}>
                      <TableHead className="text-center text-xs border-l">Can Take</TableHead>
                      <TableHead className="text-center text-xs">Can Approve</TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium capitalize">{role.name}</TableCell>
                    {types.map((type) => {
                      const perm = getPermission(role.id, type.id)
                      const takeKey = `${role.id}-${type.id}-can_take`
                      const approveKey = `${role.id}-${type.id}-can_approve`
                      return (
                        <React.Fragment key={`${role.id}-${type.id}`}>
                          <TableCell className="text-center border-l">
                            {saving === takeKey ? (
                              <Spinner className="h-4 w-4 mx-auto" />
                            ) : (
                              <Checkbox
                                checked={perm?.can_take ?? false}
                                onCheckedChange={() =>
                                  togglePermission(role.id, type.id, "can_take", perm)
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {saving === approveKey ? (
                              <Spinner className="h-4 w-4 mx-auto" />
                            ) : (
                              <Checkbox
                                checked={perm?.can_approve ?? false}
                                onCheckedChange={() =>
                                  togglePermission(role.id, type.id, "can_approve", perm)
                                }
                              />
                            )}
                          </TableCell>
                        </React.Fragment>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==============================
// DIALOG: Create Type
// ==============================
function CreateTypeDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("ticket_types").insert({ name: name.trim().toLowerCase() })
    if (error) {
      toast.error(error.code === "23505" ? "Type already exists" : "Failed to create type")
    } else {
      toast.success("Type created")
      setName("")
      onOpenChange(false)
      onSuccess()
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Ticket Type</DialogTitle>
          <DialogDescription>Add a new support ticket category.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel>Type Name</FieldLabel>
            <Input
              placeholder="e.g., billing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Spinner className="mr-2" /> : null}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ==============================
// DIALOG: Create Reason
// ==============================
function CreateReasonDialog({
  typeId,
  open,
  onOpenChange,
  onSuccess,
}: {
  typeId: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !typeId) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("ticket_reasons")
      .insert({ ticket_type_id: typeId, name: name.trim() })
    if (error) {
      toast.error("Failed to create reason")
    } else {
      toast.success("Reason added")
      setName("")
      onOpenChange(false)
      onSuccess()
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Reason</DialogTitle>
          <DialogDescription>Add a new reason to this support type.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel>Reason Name</FieldLabel>
            <Input
              placeholder="e.g., Problema con facturación"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Spinner className="mr-2" /> : null}
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ==============================
// DIALOG: Edit Reason
// ==============================
function EditReasonDialog({
  reason,
  open,
  onOpenChange,
  onSuccess,
}: {
  reason: TicketReasonRecord | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (reason) setName(reason.name)
  }, [reason])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !reason) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("ticket_reasons")
      .update({ name: name.trim() })
      .eq("id", reason.id)
    if (error) {
      toast.error("Failed to update reason")
    } else {
      toast.success("Reason updated")
      onOpenChange(false)
      onSuccess()
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Reason</DialogTitle>
          <DialogDescription>Update the reason name.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel>Reason Name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Spinner className="mr-2" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Need React import for Fragment usage in PermissionsSection
import React from "react"
