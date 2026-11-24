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
  // Keep every Unicode punctuation mark from the stored pinyin, including
  // quote marks, dashes, ellipses, and dialogue separators.
  const parts = text.split(/(\s+|[\p{P}\p{S}]+)/u)
  const attachedPunctuation = parts.reduce<string[]>((result, part) => {
    if (/^[\p{P}\p{S}]+$/u.test(part) && result.length > 0 && !/^\s+$/u.test(result[result.length - 1])) {
      result[result.length - 1] += part
    } else {
      result.push(part)
    }
    return result
  }, [])

  return (
    <span className={`inline leading-none tracking-normal ${className ?? ""}`}>
      {attachedPunctuation.map((part, index) => {
        if (!part || /^\s+$/u.test(part)) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        const punctuation = part.match(/([\p{P}\p{S}]+)$/u)?.[0] ?? ""
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

const TONE_MARKED_PINYIN = /[\p{L}üÜ]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][\p{L}üÜ]*/gu

/** Colors tone-marked pinyin tokens inside mixed Indonesian/Hanzi text. */
export function TonePinyinText({
  text,
  className,
  hanziPinyin = [],
}: {
  text: string
  className?: string
  hanziPinyin?: Array<{ hanzi: string; pinyin: string }>
}) {
  const enrichedText = React.useMemo(() => {
    const entries = [...hanziPinyin]
      .filter(item => item.hanzi && item.pinyin)
      .sort((a, b) => b.hanzi.length - a.hanzi.length)
    if (!entries.length) return text

    const byHanzi = new Map(entries.map(item => [item.hanzi, item.pinyin]))
    const pinyinMarks = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ"
    const hanziRunPattern = new RegExp(`[\\u3400-\\u9fff]+(?:\\s*[（(]\\s*[\\p{L}üÜ${pinyinMarks}]+\\s*[）)]\\s*[\\u3400-\\u9fff]+)*`, "gu")
    const matches = [...text.matchAll(hanziRunPattern)]
    let result = ""
    let cursor = 0
    const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}üÜ]/gu, "")
    for (const match of matches) {
      const rawRun = match[0]
      const hanzi = [...rawRun.matchAll(/[\u3400-\u9fff]+/gu)].map(part => part[0]).join("")
      const start = match.index ?? 0
      const end = start + rawRun.length
      const resolveWordPinyin = (word: string) => {
        const exactPinyin = byHanzi.get(word) ?? ""
        const exactSyllables = exactPinyin ? splitPinyin(exactPinyin.replace(/\s+/gu, "")) : []
        const characterPinyin = [...word].map(character => byHanzi.get(character) ?? "")
        const hasCharacterReadings = characterPinyin.every(Boolean)

        // Some compound rows contain only the first syllable. Rebuild those
        // readings from their characters; otherwise retain the complete word.
        if (word.length > 1 && exactSyllables.length < word.length && hasCharacterReadings) {
          return characterPinyin.join("")
        }
        if (exactPinyin) return exactPinyin.replace(/\s+/gu, "")
        if (hasCharacterReadings) return characterPinyin.join("")
        return ""
      }

      // Segment the continuous Hanzi run by the longest vocabulary match.
      // Pinyin stays joined inside a word and gets a space between words.
      const pinyinWords: string[] = []
      let offset = 0
      let canResolveRun = true
      while (offset < hanzi.length) {
        const entry = entries.find(item => hanzi.startsWith(item.hanzi, offset))
        const word = entry?.hanzi ?? [...hanzi][offset]
        const pinyin = resolveWordPinyin(word)
        if (!pinyin) {
          canResolveRun = false
          break
        }
        pinyinWords.push(pinyin)
        offset += word.length
      }
      const expectedPinyin = canResolveRun ? pinyinWords.join(" ") : ""
      if (!expectedPinyin) {
        result += text.slice(cursor, end)
        cursor = end
        continue
      }
      const followingText = text.slice(end)
      const parenthetical = followingText.match(/^(\s*[（(]\s*([^）)]*)\s*[）)])/u)
      result += text.slice(cursor, start) + hanzi
      if (parenthetical) {
        const content = parenthetical[2].trim()
        const [pinyinContent = ""] = content.split(/\s*(?:[,;|/]|[–—-])\s*/u)
        const inlineMeaning = content.slice(pinyinContent.length).replace(/^[\s,;|/–—-]+/u, "").trim()
        const normalizedContent = normalize(pinyinContent)
        const normalizedExpected = normalize(expectedPinyin)
        const hasTonePinyin = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(pinyinContent)
        const looksLikePinyin = hasTonePinyin
          || normalizedContent === normalizedExpected
          || (normalizedContent.length >= 2 && normalizedExpected.startsWith(normalizedContent))
        const pinyin = expectedPinyin
        const remainingAfterFirst = text.slice(end + parenthetical[1].length)
        const followingMeaning = looksLikePinyin && !inlineMeaning
          ? remainingAfterFirst.match(/^(\s*[（(]\s*([^）)]*)\s*[）)])/u)
          : null

        if (looksLikePinyin) {
          if (inlineMeaning) {
            result += ` (${pinyin} - ${inlineMeaning})`
            cursor = end + parenthetical[1].length
          } else if (followingMeaning) {
            result += ` (${pinyin} - ${followingMeaning[2].trim()})`
            cursor = end + parenthetical[1].length + followingMeaning[1].length
          } else {
            result += ` (${pinyin})`
            cursor = end + parenthetical[1].length
          }
        } else {
          result += ` (${pinyin} - ${content})`
          cursor = end + parenthetical[1].length
        }
      } else {
        result += ` (${expectedPinyin})`
        cursor = end
      }
    }
    return result + text.slice(cursor)
  }, [text, hanziPinyin])

  const parts = enrichedText.split(TONE_MARKED_PINYIN)
  const matches = enrichedText.match(TONE_MARKED_PINYIN) ?? []
  let matchIndex = 0

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <React.Fragment key={`note-part-${index}`}>
          {part}
          {index < parts.length - 1 && <TonePinyin text={matches[matchIndex++] ?? ""} className="whitespace-nowrap" />}
        </React.Fragment>
      ))}
    </span>
  )
}
