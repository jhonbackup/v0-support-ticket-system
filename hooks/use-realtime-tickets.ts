"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TicketWithDetails, Ticket } from "@/lib/types"
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

interface UseRealtimeTicketsOptions {
  /** Filter tickets by creator ID (for agent view) */
  createdBy?: string
  /** Filter tickets by assignee ID */
  assignedTo?: string
  /** Channel name for subscription (must be unique per component) */
  channelName: string
}

interface UseRealtimeTicketsReturn {
  tickets: TicketWithDetails[]
  isLoading: boolean
  refetch: () => Promise<void>
}

export function useRealtimeTickets(options: UseRealtimeTicketsOptions): UseRealtimeTicketsReturn {
  const { createdBy, channelName } = options
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null)

  const fetchTickets = useCallback(async () => {
    const supabase = supabaseRef.current
    let query = supabase
      .from("tickets")
      .select(`
        *,
        creator:users!tickets_created_by_fkey(*),
        assignee:users!tickets_assigned_to_fkey(*),
        rating:ratings(*)
      `)
      .order("created_at", { ascending: false })

    if (createdBy) {
      query = query.eq("created_by", createdBy)
    }

    const { data, error } = await query

    if (error) {
      console.error("[useRealtimeTickets] Failed to fetch tickets:", error)
      return
    }

    const formattedData = (data || []).map((ticket) => ({
      ...ticket,
      rating: ticket.rating?.[0] || undefined,
    }))

    setTickets(formattedData)
    setIsLoading(false)
  }, [createdBy])

  // Fetch single ticket with details for updates
  const fetchSingleTicket = useCallback(async (ticketId: string): Promise<TicketWithDetails | null> => {
    const supabase = supabaseRef.current
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        creator:users!tickets_created_by_fkey(*),
        assignee:users!tickets_assigned_to_fkey(*),
        rating:ratings(*)
      `)
      .eq("id", ticketId)
      .single()

    if (error) {
      console.error("[useRealtimeTickets] Failed to fetch single ticket:", error)
      return null
    }

    return {
      ...data,
      rating: data.rating?.[0] || undefined,
    }
  }, [])

  // Handle realtime events
  const handleRealtimeEvent = useCallback(
    async (payload: RealtimePostgresChangesPayload<Ticket>) => {
      const eventType = payload.eventType

      if (eventType === "INSERT") {
        const newTicket = payload.new as Ticket
        
        // Check if this ticket should be included based on filters
        if (createdBy && newTicket.created_by !== createdBy) {
          return
        }

        // Fetch full ticket details
        const ticketWithDetails = await fetchSingleTicket(newTicket.id)
        if (ticketWithDetails) {
          setTickets((prev) => [ticketWithDetails, ...prev])
        }
      } else if (eventType === "UPDATE") {
        const updatedTicket = payload.new as Ticket
        
        // If filtering by creator and ticket doesn't belong to us, remove it if present
        if (createdBy && updatedTicket.created_by !== createdBy) {
          setTickets((prev) => prev.filter((t) => t.id !== updatedTicket.id))
          return
        }

        // Fetch full ticket details and update
        const ticketWithDetails = await fetchSingleTicket(updatedTicket.id)
        if (ticketWithDetails) {
          setTickets((prev) => {
            const existingIndex = prev.findIndex((t) => t.id === updatedTicket.id)
            if (existingIndex >= 0) {
              // Update existing ticket
              const newTickets = [...prev]
              newTickets[existingIndex] = ticketWithDetails
              return newTickets
            } else {
              // Add new ticket (might be newly matching our filter)
              return [ticketWithDetails, ...prev]
            }
          })
        }
      } else if (eventType === "DELETE") {
        const deletedTicket = payload.old as Ticket
        setTickets((prev) => prev.filter((t) => t.id !== deletedTicket.id))
      }
    },
    [createdBy, fetchSingleTicket]
  )

  useEffect(() => {
    // Initial fetch
    fetchTickets()

    // Setup realtime subscription
    const supabase = supabaseRef.current
    
    // Clean up previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tickets",
        },
        (payload) => handleRealtimeEvent(payload as RealtimePostgresChangesPayload<Ticket>)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
        },
        (payload) => handleRealtimeEvent(payload as RealtimePostgresChangesPayload<Ticket>)
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tickets",
        },
        (payload) => handleRealtimeEvent(payload as RealtimePostgresChangesPayload<Ticket>)
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName, fetchTickets, handleRealtimeEvent])

  return {
    tickets,
    isLoading,
    refetch: fetchTickets,
  }
}
