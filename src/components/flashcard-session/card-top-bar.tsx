import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { WORD_CLASS_LABELS } from "@/lib/hanzi-utils"
import { SwipeFlashcard } from "./types"

type Props = {
  card: SwipeFlashcard
}

export function CardTopBar({ card }: Props) {
  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-auto">
      {card.wordClass ? (
        <Badge variant="outline" className="bg-background/50 backdrop-blur-sm shadow-sm border-border/50 text-[10px] font-medium tracking-wide">
          {WORD_CLASS_LABELS[card.wordClass] ?? card.wordClass}
        </Badge>
      ) : <div />}
    </div>
  )
}