"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/types"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (employeeCode: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem("support_user")
    if (storedUser) {
      const parsed = JSON.parse(storedUser) as User
      setUser(parsed)
      // Refresh from DB to get latest current_mode, is_mentor, etc.
      const supabase = createClient()
      supabase
        .from("users")
        .select("*")
        .eq("id", parsed.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUser(data as User)
            localStorage.setItem("support_user", JSON.stringify(data))
          }
        })
    }
    setIsLoading(false)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()
    if (data) {
      setUser(data as User)
      localStorage.setItem("support_user", JSON.stringify(data))
    }
  }, [user])

  // Listen for realtime changes to this user's record
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase
      .channel(`auth-user-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as User
          setUser(updated)
          localStorage.setItem("support_user", JSON.stringify(updated))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (employeeCode: string): Promise<{ success: boolean; error?: string }> => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("employee_code", employeeCode.toUpperCase())
      .single()

    if (error || !data) {
      return { success: false, error: "Invalid employee code" }
    }

    setUser(data)
    localStorage.setItem("support_user", JSON.stringify(data))
    return { success: true }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("support_user")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

