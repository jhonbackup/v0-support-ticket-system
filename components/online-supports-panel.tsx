"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User, MentorActivation, Group } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Radio, Users, Clock, Ticket } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface OnlineSupportEntry {
  user: User
  activation: MentorActivation | null
  group: Group | null
  activeTickets: number
}

export function OnlineSupportsPanel() {
  const [supports, setSupports] = useState<OnlineSupportEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchSupports = useCallback(async () => {
    // Get all users in supporting mode
    const { data: supporters } = await supabase
      .from("users")
      .select("*")
      .eq("current_mode", "supporting")

    if (!supporters || supporters.length === 0) {
      setSupports([])
      setIsLoading(false)
      return
    }

    const entries: OnlineSupportEntry[] = await Promise.all(
      (supporters as User[]).map(async (u) => {
        const [{ data: act }, { count }, { data: grp }] = await Promise.all([
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
          u.group_id
            ? supabase.from("groups").select("*").eq("id", u.group_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        return {
          user: u,
          activation: act as MentorActivation | null,
          group: grp as Group | null,
          activeTickets: count ?? 0,
        }
      })
    )

    setSupports(entries)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchSupports()

    const channel = supabase
      .channel("online-supports-panel")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        () => fetchSupports()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentor_activations" },
        () => fetchSupports()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchSupports])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Radio className="h-4 w-4 text-green-500 animate-pulse" />
            Online Supports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <Spinner className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Radio className="h-4 w-4 text-green-500 animate-pulse" />
          Online Supports
          {supports.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {supports.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {supports.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No active supports right now</p>
        ) : (
          <div className="space-y-3">
            {supports.map((entry) => (
              <div
                key={entry.user.id}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold">
                  {entry.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium truncate">{entry.user.name}</span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 text-[10px] h-4 px-1.5">
                      En soporte
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {entry.user.role}{entry.group ? ` · ${entry.group.name}` : ""}
                    </span>
                    {entry.activation && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.activation.start_time), { addSuffix: false })}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Ticket className="h-3 w-3" />
                      {entry.activeTickets} active
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
