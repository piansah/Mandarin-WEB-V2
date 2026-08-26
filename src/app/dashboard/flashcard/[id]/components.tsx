import * as React from "react"
import { getTone, TONE_CLASS } from "@/lib/hanzi-utils"

export function ColorPinyin({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, index) => {
        const tone = [...part].map(getTone).find(Boolean)
        return (
          <span key={`${part}-${index}`} className={tone ? TONE_CLASS[tone] : undefined}>
            {part}
          </span>
        )
      })}
    </>
  )
}
