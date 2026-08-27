import * as React from "react"
import { X, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

type LearningHeaderProps = {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  rightContent?: React.ReactNode
  progress?: number
  icon?: "x" | "arrow"
  onClose?: () => void
}

export function LearningHeader({
  title,
  subtitle,
  rightContent,
  progress,
  icon = "x",
  onClose,
}: LearningHeaderProps) {
  const router = useRouter()
  const IconComponent = icon === "x" ? X : ArrowLeft

  return (
    <div className="flex flex-col flex-shrink-0 w-full sticky top-0 bg-background/80 backdrop-blur-md z-30">
      <header className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 w-full">
        <button
          type="button"
          onClick={onClose || (() => router.back())}
          className="grid place-items-center w-10 h-10 flex-shrink-0 rounded-full bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          aria-label="Kembali"
        >
          <IconComponent className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {title && (
            <div className="truncate text-[15px] font-bold leading-snug">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>

        {rightContent && (
          <div className="flex-shrink-0 min-w-[38px] text-right text-[13px] font-bold text-emerald-500">
            {rightContent}
          </div>
        )}
      </header>

      {progress !== undefined && (
        <div className="w-full h-1.5 bg-border/40">
          <div
            className="h-full bg-emerald-500 transition-all duration-400 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}
