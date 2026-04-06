"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User, MentorActivation } from "@/lib/types"

interface OnlineSupport {
  user: User
  activation: MentorActivation | null
  activeTickets: number
}

interface UseMentorActivationReturn {
  /** Activate a mentor for support */
  activateMentor: (mentorId: string, groupId: string | null) => Promise<boolean>
  /** Deactivate a mentor */
  deactivateMentor: (mentorId: string) => Promise<boolean>
  /** Current activation for a specific mentor (or null) */
  getActivation: (mentorId: string) => MentorActivation | undefined
  /** All currently active supports (mentors, FW, TL) */
  onlineSupports: OnlineSupport[]
  /** Loading state */
  isLoading: boolean
}

export function useMentorActivation(currentUser: User | null): UseMentorActivationReturn {
  const [activations, setActivations] = useState<MentorActivation[]>([])
  const [onlineSupports, setOnlineSupports] = useState<OnlineSupport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchActivations = useCallback(async () => {
    const { data } = await supabase
      .from("mentor_activations")
      .select(`
        *,
        mentor:users!mentor_activations_mentor_id_fkey(*),
        activator:users!mentor_activations_activated_by_fkey(*)
      `)
      .eq("active", true)

    setActivations((data as MentorActivation[]) || [])
  }, [supabase])

  const fetchOnlineSupports = useCallback(async () => {
    // Fetch all users in supporting mode
    const { data: supporters } = await supabase
      .from("users")
      .select("*")
      .eq("current_mode", "supporting")

    if (!supporters || supporters.length === 0) {
      setOnlineSupports([])
      return
    }

    // For each supporter, get their active activation and ticket count
    const supports: OnlineSupport[] = await Promise.all(
      (supporters as User[]).map(async (u) => {
        const [{ data: act }, { count }] = await Promise.all([
          supabase
            .from("mentor_activations")
            .select("*")
            .eq("mentor_id", u.id)
            .eq("active", true)
            .maybeSingle(),
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", u.id)
            .eq("status", "taken"),
        ])
        return {
          user: u,
          activation: act as MentorActivation | null,
          activeTickets: count ?? 0,
        }
      })
    )

    setOnlineSupports(supports)
  }, [supabase])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchActivations(), fetchOnlineSupports()])
    setIsLoading(false)
  }, [fetchActivations, fetchOnlineSupports])

  // Initial fetch + realtime subscriptions
  useEffect(() => {
    refreshAll()

    const channel = supabase
      .channel("mentor-activation-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentor_activations" },
        () => refreshAll()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        () => refreshAll()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refreshAll])

  const activateMentor = async (mentorId: string, groupId: string | null): Promise<boolean> => {
    if (!currentUser) return false

    // Prevent duplicate — deactivate any existing first
    await supabase
      .from("mentor_activations")
      .update({ active: false, end_time: new Date().toISOString() })
      .eq("mentor_id", mentorId)
      .eq("active", true)

    // Insert new activation
    const { error: insertError } = await supabase.from("mentor_activations").insert({
      mentor_id: mentorId,
      group_id: groupId,
      activated_by: currentUser.id,
      activated_role: currentUser.role,
      start_time: new Date().toISOString(),
      active: true,
    })

    if (insertError) {
      console.error("Failed to insert activation:", insertError)
      return false
    }

    // Update user mode
    const { error: updateError } = await supabase
      .from("users")
      .update({ current_mode: "supporting" })
      .eq("id", mentorId)

    if (updateError) {
      console.error("Failed to update user mode:", updateError)
      return false
    }

    await refreshAll()
    return true
  }

  const deactivateMentor = async (mentorId: string): Promise<boolean> => {
    // Close active activation
    const { error: updateActError } = await supabase
      .from("mentor_activations")
      .update({ active: false, end_time: new Date().toISOString() })
      .eq("mentor_id", mentorId)
      .eq("active", true)

    if (updateActError) {
      console.error("Failed to deactivate:", updateActError)
      return false
    }

    // Reset user mode
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ current_mode: "taking_calls" })
      .eq("id", mentorId)

    if (updateUserError) {
      console.error("Failed to reset user mode:", updateUserError)
      return false
    }

    await refreshAll()
    return true
  }

  const getActivation = (mentorId: string) => {
    return activations.find((a) => a.mentor_id === mentorId)
  }

  return {
    activateMentor,
    deactivateMentor,
    getActivation,
    onlineSupports,
    isLoading,
  }
}
