import React from "react"
import { cn } from "@/lib/utils"

export function PageLoader({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Memuat halaman" className={cn("flex min-h-[calc(100dvh-4rem)] w-full animate-pulse flex-col gap-6 p-4 md:gap-8 md:p-6", className)}>
      <span className="sr-only">Memuat halaman</span>
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-md bg-muted" />
        <div className="h-4 w-64 max-w-full rounded-md bg-muted/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 rounded-xl border border-border/60 bg-muted/35 md:h-28" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <div className="h-64 rounded-xl border border-border/60 bg-muted/30 md:h-80" />
        <div className="h-64 rounded-xl border border-border/60 bg-muted/30 md:h-80" />
      </div>
      <div className="grid flex-1 auto-rows-fr gap-4 md:grid-cols-3 md:gap-6">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="min-h-36 rounded-xl border border-border/60 bg-muted/30 md:min-h-44" />
        ))}
      </div>
    </div>
  )
}

export function FullscreenLoader() {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-background">
      <PageLoader className="min-h-screen" />
    </div>
  )
}
