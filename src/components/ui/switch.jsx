import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    className={`switch ${checked ? 'checked' : ''} ${className || ''}`}
    onClick={() => onCheckedChange?.(!checked)}
    ref={ref}
    {...props}
  >
    <span className="switch-thumb" />
  </button>
))
Switch.displayName = "Switch"

export { Switch }