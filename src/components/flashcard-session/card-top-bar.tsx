import * as React from "react"
import { Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { speakMandarin } from "@/lib/tts"
import { SwipeFlashcard } from "./types"

type Props = {
  card: SwipeFlashcard
}

export function CardTopBar({ card }: Props) {
  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-auto">
      <Badge variant="outline" className="bg-background/50 backdrop-blur-sm shadow-sm border-border/50 text-[10px] font-medium tracking-wide">
        HSK {card.hskLevel ?? 1}
      </Badge>
      <button
        type="button"
        className="h-8 w-8 flex items-center justify-center rounded-full bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors cursor-pointer"
        onClick={(e) => { e.stopPropagation(); speakMandarin(card.hanzi) }}
        aria-label="Putar suara"
        data-no-drag
      >
        <Volume2 className="h-4 w-4" />
      </button>
    </div>
  )
}