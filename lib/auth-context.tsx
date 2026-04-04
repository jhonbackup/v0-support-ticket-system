"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/types"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (employeeCode: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem("support_user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

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
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
