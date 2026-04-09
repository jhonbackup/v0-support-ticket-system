import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/types"

/**
 * Shared mentor fetching logic used by both FW and TL views.
 * Returns all users where is_mentor = true (global, no group filter).
 */
export async function fetchMentors(): Promise<User[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("is_mentor", true)
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching mentors:", error)
    return []
  }

  console.log("Mentors fetched:", data?.length ?? 0)
  return (data as User[]) || []
}
