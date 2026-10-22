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
  const parts = text.split(/(\s+|[,!.?·。，！？、；：()]+)/)
  const attachedPunctuation = parts.reduce<string[]>((result, part) => {
    if (/^[,!.?·。，！？、；：()]+$/.test(part) && result.length > 0 && !/^\s+$/.test(result[result.length - 1])) {
      result[result.length - 1] += part
    } else {
      result.push(part)
    }
    return result
  }, [])

  return (
    <span className={`inline leading-none tracking-normal ${className ?? ""}`}>
      {attachedPunctuation.map((part, index) => {
        if (!part || /^\s+$/.test(part)) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        const punctuation = part.match(/([,!.?·。，！？、；：()]+)$/)?.[0] ?? ""
        const word = punctuation ? part.slice(0, -punctuation.length) : part
        if (!word) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        return splitPinyin(word).map((syllable, syllableIndex, syllables) => {
          const tone = [...syllable].map(char => toneMap[char]).find(Boolean) ?? "tone0"
          const trailingPunctuation = syllableIndex === syllables.length - 1 ? punctuation : ""
          return <span key={`${syllable}-${syllableIndex}`} className={`inline-block ${tone}`}>{syllable}{trailingPunctuation}</span>
        })
      })}
    </span>
  )
}
