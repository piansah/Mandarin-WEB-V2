import * as React from "react"

const toneMap: Record<string, string> = {
  ā: "tone1", á: "tone2", ǎ: "tone3", à: "tone4",
  ē: "tone1", é: "tone2", ě: "tone3", è: "tone4",
  ī: "tone1", í: "tone2", ǐ: "tone3", ì: "tone4",
  ō: "tone1", ó: "tone2", ǒ: "tone3", ò: "tone4",
  ū: "tone1", ú: "tone2", ǔ: "tone3", ù: "tone4",
  ǖ: "tone1", ǘ: "tone2", ǚ: "tone3", ǜ: "tone4",
}

function splitPinyin(word: string) {
  return word.match(/[bpmfdtnlgkhjqxzcsryw]{0,2}[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜaeiouü]+(?:ng?|r)?/gi) ?? [word]
}

export function TonePinyin({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`inline leading-none tracking-normal ${className ?? ""}`}>
      {text.split(/(\s+|[,!.?·。，！？、；：()]+)/).map((part, index) => {
        if (!part || /^(\s+|[,!.?·。，！？、；：()]+)$/.test(part)) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        return splitPinyin(part).map((syllable, syllableIndex) => {
          const tone = [...syllable].map(char => toneMap[char]).find(Boolean) ?? "tone0"
          return <span key={`${syllable}-${syllableIndex}`} className={`inline-block ${tone}`}>{syllable}</span>
        })
      })}
    </span>
  )
}
