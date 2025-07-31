import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function safeToFixed(value, decimals = 1, fallback = '0') {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback
  }
  
  // Convert to number if it's a string
  const num = typeof value === 'number' ? value : Number(value)
  
  // Check if it's a valid number
  if (isNaN(num) || !isFinite(num)) {
    return fallback
  }
  
  // Apply toFixed
  return num.toFixed(decimals)
}