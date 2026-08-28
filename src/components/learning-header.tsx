import * as React from "react"

type LearningHeaderProps = {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  rightContent?: React.ReactNode
  progress?: number
}

export function LearningHeader({
  title,
  subtitle,
  rightContent,
  progress,
}: LearningHeaderProps) {
  return (
    <div className="flex flex-col flex-shrink-0 w-full sticky top-0 bg-background/80 backdrop-blur-md z-30">
      <header className="flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3 w-full">
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
