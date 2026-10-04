"use client"

import * as React from "react"
import { PenLine } from "lucide-react"
import { toast } from "sonner"
import { useUnlockedHSK } from "@/lib/tier-unlock"
import { HanziPracticeSheet, WordSelector } from "@/components/hanzi-practice-sheet"
import { useSupabase } from "@/hooks/use-supabase"
import { type VocabularyWord } from "@/lib/hanzi-map"

const MAX_WORDS = 60
const STORAGE_KEY = "hanzi-practice-words"

export default function TulisHanziPage() {
  const supa = useSupabase()
  const unlockedHSK = useUnlockedHSK()
  const [selectedWords, setSelectedWords] = React.useState<VocabularyWord[]>([])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [hydrated, setHydrated] = React.useState(false)

  // Muat dari localStorage saat mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as VocabularyWord[]
        if (Array.isArray(parsed)) setSelectedWords(parsed)
      }
    } catch {
      // abaikan
    }
    setHydrated(true)
  }, [])

  // Simpan hanya setelah data awal selesai dimuat (supaya tidak menimpa dengan [])
  React.useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedWords))
    } catch {
      // abaikan
    }
  }, [selectedWords, hydrated])

  // Index selalu valid walau kata dihapus
  const safeIndex = Math.min(selectedIndex, Math.max(selectedWords.length - 1, 0))

  const handleAddWords = (words: VocabularyWord[]) => {
    const currentSet = new Set(selectedWords.map((w) => w.hanzi))
    const seen = new Set<string>()
    const newWords = words.filter((w) => {
      if (currentSet.has(w.hanzi) || seen.has(w.hanzi)) return false
      seen.add(w.hanzi)
      return true
    })

    if (newWords.length === 0) {
      toast.info("Kata sudah ada di lembar")
      return
    }

    const room = MAX_WORDS - selectedWords.length
    if (newWords.length > room) {
      toast.info(`Maksimal ${MAX_WORDS} kata per lembar (sisa ${room})`)
      return
    }

    setSelectedWords((prev) => [...prev, ...newWords])
    toast.success(`Ditambahkan ${newWords.length} kata`)
  }

  const handleRemoveWord = (hanzi: string) => {
    setSelectedWords((prev) => prev.filter((w) => w.hanzi !== hanzi))
  }

  const handleRemoveChapter = (chapterId: string | number) => {
    setSelectedWords((prev) => prev.filter((w) => w.set_id !== chapterId))
  }

  const handleClearAll = () => {
    setSelectedWords([])
    setSelectedIndex(0)
    toast.success("Semua kata dihapus")
  }

  const handleAddFromChapter = async (hskLevel: number, chapterId: string | number) => {
    try {
      const id = typeof chapterId === "string" ? parseInt(chapterId, 10) : chapterId
      const { data, error } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti, word_class, set_id")
        .eq("set_id", id)

      if (error) throw error

      if (!data || data.length === 0) {
        toast.info("Tidak ada kata di bab ini")
        return
      }

      const words: VocabularyWord[] = data.map((item) => ({
        id: item.id,
        hanzi: item.hanzi,
        pinyin: item.pinyin,
        arti: item.arti,
        word_class: item.word_class,
        source: "flashcard",
        hsk_level: hskLevel,
        set_id: item.set_id,
      }))

      handleAddWords(words)
    } catch (error) {
      console.error("Error fetching chapter words:", error)
      toast.error("Gagal memuat kata dari bab")
    }
  }

  if (!unlockedHSK) {
    return (
      <div className="w-full px-6 py-10">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-6 py-10 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1 mb-4 no-print">
        <div className="flex items-center gap-2">
          <PenLine className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Tulis Hanzi</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Buat lembar latihan menulis Hanzi kustom
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="no-print">
          <WordSelector
            unlockedHSK={unlockedHSK}
            selectedWords={selectedWords}
            onAddFromChapter={handleAddFromChapter}
            onRemoveChapter={handleRemoveChapter}
            onAddWord={(word) => handleAddWords([word])}
            onRemoveWord={handleRemoveWord}
            onClearAll={handleClearAll}
            maxWords={MAX_WORDS}
          />
        </div>
        <HanziPracticeSheet
          words={selectedWords}
          selectedIndex={safeIndex}
          onSelectedIndexChange={setSelectedIndex}
        />
      </div>
    </div>
  )
}