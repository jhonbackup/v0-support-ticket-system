import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateTimeDiffSeconds(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  
  if (isNaN(startTime) || isNaN(endTime)) return null
  
  const diff = (endTime - startTime) / 1000
  return diff >= 0 ? diff : null
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0 || isNaN(seconds)) return "N/A"
  
  if (seconds < 60) return `${Math.floor(seconds)}s`
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  
  if (h > 0) {
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }
  
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}
