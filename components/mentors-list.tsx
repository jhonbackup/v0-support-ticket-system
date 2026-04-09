"use client"

import type { User, Group } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Users, Zap, ZapOff, Shield } from "lucide-react"

type MentorWithGroup = User & { group?: Group | null }

interface MentorsListProps {
  mode: "tl" | "fw"
  mentors: MentorWithGroup[]
  isLoading: boolean
  actionLoadingId: string | null
  onToggleMentor: (mentor: MentorWithGroup) => void
}

export function MentorsList({ mode, mentors, isLoading, actionLoadingId, onToggleMentor }: MentorsListProps) {
  if (isLoading) {
    return <div className="flex justify-center p-4"><Spinner className="h-6 w-6" /></div>
  }

  return (
    <div className="mt-8 space-y-4">
      {mode === "tl" && (
        <div>
          <h3 className="text-xl font-semibold">Mentores Disponibles</h3>
          <p className="text-sm text-muted-foreground">Mentors from all groups available for support activation</p>
        </div>
      )}

      <div className="bg-card rounded-md border shadow-sm mt-4">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-4 font-medium">Name</th>
              {mode === "tl" && <th className="px-4 py-4 font-medium">Group</th>}
              <th className="px-4 py-4 font-medium text-center">Status</th>
              <th className="px-4 py-4 font-medium text-center">Support Mode</th>
              <th className="px-4 py-4 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mentors.map((mentor) => {
              const isSupporting = mentor.current_mode === "supporting"
              return (
                <tr key={mentor.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-4 font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {mentor.name}
                    <span className="text-[10px] text-muted-foreground font-mono">({mentor.employee_code})</span>
                  </td>
                  {mode === "tl" && (
                    <td className="px-4 py-4">
                      {mentor.group ? (
                        <Badge variant="outline">{mentor.group.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 flex-nowrap">
                      <span className={`h-2 w-2 rounded-full ${mentor.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <span className="text-xs capitalize">{mentor.status || "offline"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {isSupporting ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <Zap className="h-3 w-3 mr-1" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                        <Shield className="h-3 w-3 mr-1" />
                        Disponible
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Button
                      size="sm"
                      variant={isSupporting ? "destructive" : "default"}
                      className="text-xs"
                      disabled={actionLoadingId === mentor.id}
                      onClick={() => onToggleMentor(mentor)}
                    >
                      {actionLoadingId === mentor.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : isSupporting ? (
                        <><ZapOff className="h-3.5 w-3.5 mr-1" /> Desactivar</>
                      ) : (
                        <><Zap className="h-3.5 w-3.5 mr-1" /> Activar</>
                      )}
                    </Button>
                  </td>
                </tr>
              )
            })}
            {mentors.length === 0 && (
              <tr><td colSpan={mode === "tl" ? 5 : 4} className="text-center py-6 text-muted-foreground">No mentors found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
