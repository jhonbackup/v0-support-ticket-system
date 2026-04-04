"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Headset } from "lucide-react"

export default function LoginPage() {
  const [employeeCode, setEmployeeCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const result = await login(employeeCode)
    
    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Login failed")
    }
    
    setIsLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Headset className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Support Ticket System</CardTitle>
          <CardDescription>Enter your employee code to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="employeeCode">Employee Code</FieldLabel>
                <Input
                  id="employeeCode"
                  type="text"
                  placeholder="e.g., AGT001"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="uppercase"
                  required
                />
              </Field>
            </FieldGroup>
            
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
            
            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              Sign In
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Demo accounts:</p>
            <p className="font-mono text-xs mt-1">AGT001 (Agent) | FLW001 (Floorwalker)</p>
            <p className="font-mono text-xs">TL001 (Team Lead) | ADM001 (Admin)</p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
