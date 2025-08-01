import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
        warning:
          "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant = 'default', ...props }) {
  const variantClass = variant === 'success' ? 'badge-success' : 
                      variant === 'warning' ? 'badge-warning' : 
                      variant === 'destructive' ? 'badge-destructive' : 'badge';
  
  return (
    <div className={`badge ${variantClass} ${className || ''}`} {...props} />
  )
}

export { Badge, badgeVariants }