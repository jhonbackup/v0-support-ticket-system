"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { TicketTypeRecord, TicketReasonRecord } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface CreateTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateTicketDialog({ open, onOpenChange, onSuccess }: CreateTicketDialogProps) {
  const { user } = useAuth()
  const [type, setType] = useState("")
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [externalTicketId, setExternalTicketId] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Dynamic data from DB
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRecord[]>([])
  const [ticketReasons, setTicketReasons] = useState<TicketReasonRecord[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // Fetch active types and reasons when dialog opens
  useEffect(() => {
    if (open) {
      setDataLoading(true)
      const supabase = createClient()
      Promise.all([
        supabase.from("ticket_types").select("*").eq("active", true).order("created_at"),
        supabase.from("ticket_reasons").select("*").eq("active", true).order("created_at"),
      ]).then(([{ data: t }, { data: r }]) => {
        setTicketTypes((t as TicketTypeRecord[]) || [])
        setTicketReasons((r as TicketReasonRecord[]) || [])
        setDataLoading(false)
      })
    }
  }, [open])

  const isValidZendesk = externalTicketId.trim().length >= 5

  // Get the selected type record to find its ID for filtering reasons
  const selectedTypeRecord = ticketTypes.find((t) => t.name === type)
  const filteredReasons = selectedTypeRecord
    ? ticketReasons.filter((r) => r.ticket_type_id === selectedTypeRecord.id)
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !type || !reason || !isValidZendesk) return

    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from("tickets").insert({
      created_by: user.id,
      type,
      reason,
      description: description.trim() || null,
      external_ticket_id: externalTicketId.trim(),
      status: "pending",
    })

    if (error) {
      toast.error("Failed to create ticket")
      setIsLoading(false)
      return
    }

    toast.success("Ticket created successfully")
    setType("")
    setReason("")
    setDescription("")
    setExternalTicketId("")
    setIsLoading(false)
    onOpenChange(false)
    onSuccess()
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setType("")
      setReason("")
      setDescription("")
      setExternalTicketId("")
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Select the type of issue and provide details for a floorwalker to assist you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="type">Type</FieldLabel>
              {dataLoading ? (
                <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" /> Loading types...
                </div>
              ) : (
                <Select value={type} onValueChange={(val) => {
                  setType(val)
                  setReason("") // Reset reason when type changes
                }}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select a type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketTypes.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Select value={reason} onValueChange={setReason} disabled={!type}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder={type ? "Select a reason..." : "Select type first..."} />
                </SelectTrigger>
                <SelectContent>
                  {filteredReasons.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="externalTicketId">Zendesk Ticket ID</FieldLabel>
              <Input
                id="externalTicketId"
                placeholder="e.g. 9453845"
                value={externalTicketId}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "")
                  setExternalTicketId(val)
                }}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description (Optional)</FieldLabel>
              <Textarea
                id="description"
                placeholder="Agrega más detalles si es necesario..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !type || !reason || !isValidZendesk}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              Create Ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
