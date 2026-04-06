"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Headset, LogOut } from "lucide-react"

const roleLabels: Record<string, string> = {
  agent: "Agent",
  floorwalker: "Floorwalker",
  teamleader: "Team Leader",
  admin: "Admin",
}

const roleColors: Record<string, string> = {
  agent: "bg-blue-500/10 text-blue-700 border-blue-200",
  floorwalker: "bg-green-500/10 text-green-700 border-green-200",
  teamleader: "bg-amber-500/10 text-amber-700 border-amber-200",
  admin: "bg-red-500/10 text-red-700 border-red-200",
}

export function DashboardHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  if (!user) return null

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Headset className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Support Tickets</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Badge variant="outline" className={roleColors[user.role] || "bg-slate-500/10 text-slate-700 border-slate-200"}>
              {roleLabels[user.role] || user.role}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {user.employee_code}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
