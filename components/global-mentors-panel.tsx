"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User, Group } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Users, Zap, ZapOff, Shield } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useMentorActivation } from "@/hooks/use-mentor-activation"
import { toast } from "sonner"

type MentorWithGroup = User & { group?: Group | null }

export function GlobalMentorsPanel() {
  const { user } = useAuth()
  const [mentors, setMentors] = useState<MentorWithGroup[]>([])
  const [loading, setLoading] = useState(true)
  const { activateMentor, deactivateMentor } = useMentorActivation(user)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchMentors = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("users")
      .select("*, group:groups(*)")
      .eq("is_mentor", true)
      .order("name", { ascending: true })

    if (data) {
      setMentors(data as MentorWithGroup[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMentors()
    const supabase = createClient()
    const ch = supabase
      .channel("global-mentors-refresh")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users" }, () => fetchMentors())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [fetchMentors])

  const handleToggleMentor = async (mentor: MentorWithGroup) => {
    setActionLoading(mentor.id)
    const isActive = mentor.current_mode === "supporting"
    const success = isActive 
      ? await deactivateMentor(mentor.id) 
      : await activateMentor(mentor.id, mentor.group_id ?? null)
    
    setActionLoading(null)
    if (success) {
      toast.success(isActive ? "Mentor deactivated" : "Mentor activated for support")
      fetchMentors()
    } else {
      toast.error("Failed to update mentor status")
    }
  }

  if (loading) {
    return <div className="flex justify-center p-4"><Spinner className="h-6 w-6" /></div>
  }

  return (
    <div className="mt-8 space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Mentores Disponibles</h3>
        <p className="text-sm text-muted-foreground">Mentors from all groups available for support activation</p>
      </div>

      <div className="bg-card rounded-md border shadow-sm mt-4">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-4 font-medium">Name</th>
              <th className="px-4 py-4 font-medium">Group</th>
              <th className="px-4 py-4 font-medium text-center">Status</th>
              <th className="px-4 py-4 font-medium text-center">Support Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mentors.map((mentor) => (
              <tr key={mentor.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-4 font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {mentor.name}
                  <span className="text-[10px] text-muted-foreground font-mono">({mentor.employee_code})</span>
                </td>
                <td className="px-4 py-4">
                  {mentor.group ? (
                    <Badge variant="outline">{mentor.group.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center gap-1.5 flex-nowrap">
                    <span className={`h-2 w-2 rounded-full ${mentor.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className="text-xs capitalize">{mentor.status}</span>
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <Button
                    size="sm"
                    variant={mentor.current_mode === "supporting" ? "destructive" : "default"}
                    className="text-xs"
                    disabled={actionLoading === mentor.id}
                    onClick={() => handleToggleMentor(mentor)}
                  >
                    {actionLoading === mentor.id ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : mentor.current_mode === "supporting" ? (
                      <><ZapOff className="h-3.5 w-3.5 mr-1" /> Desactivar</>
                    ) : (
                      <><Zap className="h-3.5 w-3.5 mr-1" /> Activar</>
                    )}
                  </Button>
                </td>
              </tr>
            ))}
            {mentors.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No mentors found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
