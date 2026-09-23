import * as React from "react"
import { MousePointerClick } from "lucide-react"

export function CardHint() {
  return (
    <div className="absolute bottom-6 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground/60 animate-pulse">
      <MousePointerClick className="h-3.5 w-3.5" />
      <span>Ketuk untuk melihat arti</span>
    </div>
  )
}