"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TicketWithDetails } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Star } from "lucide-react"
import { toast } from "sonner"

interface RatingDialogProps {
  ticket: TicketWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RatingDialog({ ticket, open, onOpenChange, onSuccess }: RatingDialogProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      toast.error("Please select a rating")
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from("ratings").insert({
      ticket_id: ticket.id,
      rating,
      comment: comment.trim() || null,
    })

    if (error) {
      toast.error("Failed to submit rating")
      setIsLoading(false)
      return
    }

    toast.success("Thank you for your feedback!")
    setRating(0)
    setComment("")
    setIsLoading(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            How was the support you received for: &quot;{ticket.issue.slice(0, 50)}...&quot;
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Rating</FieldLabel>
              <div className="flex gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="transition-transform hover:scale-110"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoveredRating || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </Field>
            
            <Field>
              <FieldLabel htmlFor="comment">Comment (Optional)</FieldLabel>
              <Textarea
                id="comment"
                placeholder="Share any additional feedback..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || rating === 0}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              Submit Rating
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
