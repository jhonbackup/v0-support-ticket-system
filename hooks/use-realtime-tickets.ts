"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
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
  updateTicketRating: (ticketId: string, rating: NonNullable<TicketWithDetails["rating"]>) => void
}

export function useRealtimeTickets(options: UseRealtimeTicketsOptions): UseRealtimeTicketsReturn {
  const { createdBy, assignedTo, channelName } = options
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [supabase] = useState(() => createClient())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchTickets = useCallback(async () => {
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
    
    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo)
    }

    const { data, error } = await query

    if (error) {
      console.error("[useRealtimeTickets] Failed to fetch tickets:", error)
      return
    }

    const formattedData = (data || []).map((ticket) => {
      let ratingsArray: any[] = []
      if (Array.isArray(ticket.rating)) {
        ratingsArray = ticket.rating
      } else if (ticket.rating) {
        ratingsArray = [ticket.rating]
      }
      
      const hasRated = ratingsArray.some((r) => r.rated_by === user?.id)
      const userRating = ratingsArray.find((r) => r.rated_by === user?.id) || ratingsArray[0]
      return {
        ...ticket,
        hasRated,
        rating: userRating || undefined,
      }
    })

    setTickets(formattedData)
    setIsLoading(false)
  }, [createdBy, assignedTo, supabase, user?.id])

  // Fetch single ticket with details for updates
  const fetchSingleTicket = useCallback(async (ticketId: string): Promise<TicketWithDetails | null> => {
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

    let ratingsArray: any[] = []
    if (Array.isArray(data.rating)) {
      ratingsArray = data.rating
    } else if (data.rating) {
      ratingsArray = [data.rating]
    }
    
    const hasRated = ratingsArray.some((r) => r.rated_by === user?.id)
    const userRating = ratingsArray.find((r) => r.rated_by === user?.id) || ratingsArray[0]

    return {
      ...data,
      hasRated,
      rating: userRating || undefined,
    }
  }, [supabase, user?.id])

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
        
        if (assignedTo && newTicket.assigned_to !== assignedTo) {
          return
        }

        console.log("INSERT EVENT", newTicket.id)
        
        // Fetch full ticket details
        const ticketWithDetails = await fetchSingleTicket(newTicket.id)
        if (ticketWithDetails) {
          setTickets((prev) => {
            const exists = prev.some((t) => t.id === ticketWithDetails.id)
            if (exists) return prev
            
            const next = [ticketWithDetails, ...prev]
            return Array.from(new Map(next.map(t => [t.id, t])).values())
          })
        }
      } else if (eventType === "UPDATE") {
        const updatedTicket = payload.new as Ticket
        
        // If filtering by creator/assignee and ticket doesn't belong to us, remove it if present
        if (createdBy && updatedTicket.created_by !== createdBy) {
          setTickets((prev) => prev.filter((t) => t.id !== updatedTicket.id))
          return
        }
        
        if (assignedTo && updatedTicket.assigned_to !== assignedTo) {
          setTickets((prev) => prev.filter((t) => t.id !== updatedTicket.id))
          return
        }

        // Fetch full ticket details and update
        const ticketWithDetails = await fetchSingleTicket(updatedTicket.id)
        if (ticketWithDetails) {
          setTickets((prev) =>
            Array.from(new Map(
              prev.map((t) => (t.id === updatedTicket.id ? ticketWithDetails : t))
                .map(t => [t.id, t])
            ).values())
          )
        }
      } else if (eventType === "DELETE") {
        const deletedTicket = payload.old as Ticket
        setTickets((prev) => prev.filter((t) => t.id !== deletedTicket.id))
      }
    },
    [createdBy, assignedTo, fetchSingleTicket]
  )

  const updateTicketRating = useCallback((ticketId: string, rating: NonNullable<TicketWithDetails["rating"]>) => {
    setTickets((prev) => 
      prev.map((t) => (t.id === ticketId ? { ...t, rating, hasRated: true } : t))
    )
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchTickets()

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
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [channelName, fetchTickets, handleRealtimeEvent, supabase])

  return {
    tickets,
    isLoading,
    refetch: fetchTickets,
    updateTicketRating,
  }
}
