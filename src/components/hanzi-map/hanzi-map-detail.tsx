"use client"

import * as React from "react"
import { BookOpen, User } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TonePinyin } from "@/components/tone-pinyin"
import { speakMandarin } from "@/lib/tts"
import { WORD_CLASS_LABELS } from "@/lib/hanzi-utils"
import { highlightSegments, type VocabularyWord, type ExampleSentence } from "@/lib/hanzi-map"

type HanziMapDetailProps = {
  selectedWord: VocabularyWord | null
  examples: ExampleSentence[]
  loading: boolean
}

/** Render badge level HSK atau badge sumber (compound) */
function WordBadge({ word }: { word: VocabularyWord }) {
  if (word.source === "flashcard" && word.hsk_level != null) {
    const colors: Record<number, string> = {
      1: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      2: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      3: "bg-violet-500/15 text-violet-400 border-violet-500/30",
      4: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      5: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      6: "bg-red-600/15 text-red-400 border-red-600/30",
    }
    const cls = colors[word.hsk_level] ?? "bg-muted text-muted-foreground border-border"
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${cls}`}>
        HSK {word.hsk_level}
      </span>
    )
  }

  if (word.source === "compound") {
    if (word.compound_badge === "common") {
      return (
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
          Umum
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none bg-slate-500/15 text-slate-400 border-slate-500/30">
        Native
      </span>
    )
  }

  return null
}

export function HanziMapDetail({
  selectedWord,
  examples,
  loading,
}: HanziMapDetailProps) {
  if (!selectedWord) {
    return (
      <Card className="min-h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">Pilih simpul di peta untuk melihat detail</p>
      </Card>
    )
  }

  return (
    <Card className="min-h-[400px] flex flex-col gap-0 py-0 overflow-hidden">
      {/* -- Vocabulary Card -- */}
      <CardHeader className="p-0 border-b">
        <button
          type="button"
          className="flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer w-full"
          onClick={() => speakMandarin(selectedWord.hanzi)}
          title="Ketuk untuk mendengar"
        >
          <span className="font-hanzi text-5xl leading-none flex-shrink-0 select-none">
            {selectedWord.hanzi}
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <TonePinyin text={selectedWord.pinyin ?? ""} className="text-base font-medium" />
            <span className="text-sm text-muted-foreground mt-0.5 leading-snug">{selectedWord.arti}</span>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <WordBadge word={selectedWord} />
              {selectedWord.word_class && (
                <Badge variant="outline" className="text-[10px]">
                  {WORD_CLASS_LABELS[selectedWord.word_class] ?? selectedWord.word_class}
                </Badge>
              )}
            </div>
          </div>
        </button>
      </CardHeader>

      {/* -- Contoh Kalimat -- */}
      <CardContent className="flex-1 overflow-auto px-5 py-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Contoh Kalimat
        </h4>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : examples.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada contoh kalimat.</p>
        ) : (
          <div className="space-y-2">
            {examples.map((example) => (
              <button
                key={String(example.id)}
                type="button"
                className="w-full text-left rounded-xl border border-border/50 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60 cursor-pointer"
                onClick={() => speakMandarin(example.hanzi)}
                title="Ketuk untuk mendengar"
              >
                <div className="font-hanzi text-base leading-snug mb-1">
                  {highlightSegments(example.hanzi, selectedWord.hanzi).map((seg, i) => (
                    <span key={i} className={seg.isMatch ? "text-primary font-semibold" : ""}>
                      {seg.text}
                    </span>
                  ))}
                </div>
                {example.pinyin && (
                  <TonePinyin text={example.pinyin} className="text-xs mb-1 block" />
                )}
                {example.arti && (
                  <div className="text-xs text-muted-foreground">{example.arti}</div>
                )}
                {example.user_contribution && (
                  <Badge variant="secondary" className="mt-2 text-[10px] flex w-fit items-center gap-1">
                    <User className="h-3 w-3" />
                    Kontribusi
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


