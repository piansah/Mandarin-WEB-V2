import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"

type FlashcardSet = {
  id: number
  title: string
  description: string | null
  hsk_level: number | null
  badge: string | null
}

export default async function FlashcardPage() {
  const supa = await createClient()
  const { data: sets, error } = await supa
    .from("flashcard_sets")
    .select("id, title, description, hsk_level, badge")
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

  // Kelompokkan berdasarkan HSK level
  const grouped: Record<number, FlashcardSet[]> = {}
  for (const s of sets ?? []) {
    const level = s.hsk_level ?? 1
    if (!grouped[level]) grouped[level] = []
    grouped[level].push(s)
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

      {/* Grid per level */}
      {Object.entries(grouped)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([level, decks]) => (
          <div key={level} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="h-px flex-1 bg-border/50" />
              HSK {level}
              <span className="h-px flex-1 bg-border/50" />
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {decks.map((deck) => (
                <Link href={`/dashboard/flashcard/${deck.id}`} key={deck.id} className="block group">
                  <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer flex flex-col">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                        {deck.badge ?? `HSK ${deck.hsk_level ?? 1}`}
                      </Badge>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground border-transparent text-[10px] uppercase">
                        Belum
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 flex flex-col flex-1">
                      <h3 className="font-bold text-sm leading-tight mb-1 group-hover:text-primary transition-colors">
                        {deck.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">{deck.description ?? ""}</p>
                      <div className="mt-auto">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full h-7 text-xs bg-primary/15 text-primary hover:bg-primary/25 border-0"
                        >
                          Buka
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
