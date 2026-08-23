import { createClient } from "@/lib/supabase/server"
import { BookOpen } from "lucide-react"
import { FlashcardDeckList, type FlashcardSet } from "@/components/flashcard-deck-list"

export default async function FlashcardPage() {
  const supa = await createClient()
  const { data: sets, error } = await supa
    .from("flashcard_sets")
    .select("id, title, description, hsk_level, badge, flashcard_cards(count)")
    .eq("is_default", true)
    .order("id", { ascending: true })

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">Daftar Kata</h1>
        <p className="text-red-400 text-sm">Gagal memuat data: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Daftar Kata</h1>
        </div>
        <p className="text-sm text-muted-foreground">Pilih deck untuk mulai belajar</p>
      </div>

      <FlashcardDeckList sets={(sets ?? []).map(set => ({ ...set, wordCount: set.flashcard_cards?.[0]?.count ?? 0 })) as FlashcardSet[]} />
    </div>
  )
}
