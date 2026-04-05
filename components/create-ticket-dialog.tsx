"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { TicketType } from "@/lib/types"
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

const supportReasons = {
  technical: [
    'Problema con sistema',
    'Error en aplicación',
    'Fallo de conexión',
    'Problema con herramientas',
    'Otro técnico'
  ],
  doubts: [
    'Consulta sobre proceso',
    'Duda sobre política',
    'Información de producto',
    'Aclaración de procedimiento',
    'Otra duda'
  ],
  supervisor: [
    'Escalamiento de caso',
    'Autorización necesaria',
    'Cliente solicita supervisor',
    'Situación compleja',
    'Otro motivo'
  ]
};

const typeLabels: Record<TicketType, string> = {
  technical: "Technical",
  doubts: "Doubts",
  supervisor: "Supervisor",
}

export function CreateTicketDialog({ open, onOpenChange, onSuccess }: CreateTicketDialogProps) {
  const { user } = useAuth()
  const [type, setType] = useState<TicketType | "">("")
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [externalTicketId, setExternalTicketId] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const isValidZendesk = externalTicketId.trim().length >= 5

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

  // Handle dialog open state explicitly to clear form
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
              <Select value={type} onValueChange={(val) => {
                setType(val as TicketType)
                setReason("") // Reset reason when type changes
              }}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select a type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">{typeLabels.technical}</SelectItem>
                  <SelectItem value="doubts">{typeLabels.doubts}</SelectItem>
                  <SelectItem value="supervisor">{typeLabels.supervisor}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Select value={reason} onValueChange={setReason} disabled={!type}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder={type ? "Select a reason..." : "Select type first..."} />
                </SelectTrigger>
                <SelectContent>
                  {type && supportReasons[type as TicketType].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
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
