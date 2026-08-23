import { BookOpen } from "lucide-react"
import {
  CumulativeFlashcardSetList,
  type CumulativeFlashcardSet,
} from "@/components/cumulative-flashcard-set-list"
import { createClient } from "@/lib/supabase/server"

export default async function CumulativeFlashcardPage() {
  const supa = await createClient()
  const { data: sets, error } = await supa
    .from("hanzi_sets")
    .select("key, title, sub, description, badge, hsk_level, hanzi_items(count)")
    .order("hsk_level", { ascending: true })
    .order("sort_order", { ascending: true })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Flashcard Kumulatif</h1>
        </div>
        <p className="text-sm text-muted-foreground">Baca kalimat bertahap untuk menguatkan kosakata.</p>
      </div>

      {error ? (
        <p className="text-sm text-red-400">Gagal memuat set: {error.message}</p>
      ) : !sets?.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Belum ada set kalimat.</p>
      ) : (
        <CumulativeFlashcardSetList sets={(sets ?? []).map((set) => ({
          ...set,
          itemCount: set.hanzi_items?.[0]?.count ?? 0,
        })) as CumulativeFlashcardSet[]} />
      )}
    </div>
  )
}
