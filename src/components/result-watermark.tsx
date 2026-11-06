type ResultWatermarkProps = {
  pattern?: string[]
  className?: string
}

const DEFAULT_PATTERN = ["完", "学", "習", "語", "字"]
const WATERMARK_COUNT = 30
const MOBILE_WATERMARK_COUNT = 12

export function ResultWatermark({ pattern = DEFAULT_PATTERN, className = "" }: ResultWatermarkProps) {
  const safePattern = pattern.length > 0 ? pattern : DEFAULT_PATTERN

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 grid grid-cols-3 grid-rows-4 place-items-center overflow-hidden select-none pointer-events-none font-hanzi text-foreground/[0.055] dark:text-foreground/[0.075] lg:grid-cols-6 lg:grid-rows-5 ${className}`}
    >
      {Array.from({ length: WATERMARK_COUNT }, (_, index) => (
        <span
          key={index}
          className={`font-black leading-none ${index >= MOBILE_WATERMARK_COUNT ? "hidden lg:block" : ""} ${
            index % 3 === 0 ? "text-7xl lg:text-8xl" : index % 3 === 1 ? "text-6xl lg:text-9xl" : "text-8xl lg:text-[10rem]"
          }`}
          style={{ transform: `rotate(${index % 2 === 0 ? -12 : 10}deg)` }}
        >
          {safePattern[index % safePattern.length]}
        </span>
      ))}
    </div>
  )
}
