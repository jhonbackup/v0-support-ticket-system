"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import type { User, Group } from "@/lib/types"

interface UseTeamMembersReturn {
  members: User[]
  group: Group | null
  isLoading: boolean
  toggleMentorStatus: (userId: string, currentStatus: boolean) => Promise<boolean>
}

export function useTeamMembers(): UseTeamMembersReturn {
  const { user } = useAuth()
  const [members, setMembers] = useState<User[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  const fetchTeamData = useCallback(async () => {
    if (!user || user.role !== "teamleader") {
      setIsLoading(false)
      return
    }

    // First fetch the group where team_leader_id = user.id
    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .select("*")
      .eq("team_leader_id", user.id)
      .single()

    if (groupError || !groupData) {
      console.error("Error fetching group:", groupError)
      setIsLoading(false)
      return
    }

    setGroup(groupData as Group)

    // Then fetch all users where group_id = groupData.id
    const { data: membersData, error: membersError } = await supabase
      .from("users")
      .select("*")
      .eq("group_id", groupData.id)

    if (membersError) {
      console.error("Error fetching members:", membersError)
    } else {
      setMembers((membersData as User[]) || [])
    }

    setIsLoading(false)
  }, [user, supabase])

  useEffect(() => {
    fetchTeamData()
  }, [fetchTeamData])

  // Realtime: refresh when any user in this group changes
  useEffect(() => {
    if (!group) return
    const channel = supabase
      .channel(`team-members-${group.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users" }, () => {
        fetchTeamData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [group, supabase, fetchTeamData])

  const toggleMentorStatus = async (userId: string, currentStatus: boolean): Promise<boolean> => {
    // Check max 2 mentors rule if trying to set to true
    if (!currentStatus) {
      const currentMentors = members.filter(m => m.is_mentor).length
      if (currentMentors >= 2) {
        return false // Exceeded limit
      }
    }

    const newStatus = !currentStatus

    const { error } = await supabase
      .from("users")
      .update({ is_mentor: newStatus })
      .eq("id", userId)

    if (error) {
      console.error("Error updating mentor status:", error)
      return false // DB update failed
    }

    // Update local state instantly
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, is_mentor: newStatus } : m))
    
    return true // Success
  }

  return { members, group, isLoading, toggleMentorStatus }
}
