"use client"

import { useAuth } from "@/lib/auth-context"
import { AgentView } from "@/components/views/agent-view"
import { FloorwalkerView } from "@/components/views/floorwalker-view"
import { AdminView } from "@/components/views/admin-view"

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  switch (user.role) {
    case "agent":
      return <AgentView />
    case "floorwalker":
    case "teamleader":
      return <FloorwalkerView />
    case "admin":
      return <AdminView />
    default:
      return <div>Unknown role</div>
  }
}
