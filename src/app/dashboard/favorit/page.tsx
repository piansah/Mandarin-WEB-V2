"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listFavorites, removeFavorite, type FavoriteCard } from "@/lib/personal-decks"
import { Heart, Trash2, Volume2 } from "lucide-react"
import { TonePinyin } from "@/components/tone-pinyin"
import { HskBadge } from "@/components/hsk-badge"
import { speakMandarin } from "@/lib/tts"

export default function FavoritesPage() {
  const router = useRouter()
  const [favorites, setFavorites] = React.useState<FavoriteCard[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    loadFavorites()
  }, [])

  async function loadFavorites() {
    setLoading(true)
    const data = await listFavorites()
    setFavorites(data)
    setLoading(false)
  }

  async function handleRemoveFavorite(id: number) {
    if (!confirm("Yakin ingin menghapus kata ini dari favorit?")) return
    const result = await removeFavorite(id)
    if (!result.error) {
      loadFavorites()
    } else {
      alert(result.error)
    }
  }

  function handleOpenDetail(card: FavoriteCard) {
    if (card.source_id && card.source) {
      // Navigate to the original deck word detail
      router.push(`/dashboard/flashcard/${card.source_id}/word/${card.source}`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat favorit...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-red-500 fill-red-500" />
          <h1 className="text-2xl font-bold tracking-tight">Kata Favorit</h1>
        </div>
        <p className="text-sm text-muted-foreground">Koleksi kata yang kamu simpan untuk referensi</p>
      </div>

      {/* Empty State */}
      {favorites.length === 0 && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">⭐</div>
            <div>
              <h3 className="text-lg font-medium">Belum ada favorit</h3>
              <p className="text-sm text-muted-foreground">
                Simpan kata yang penting atau menarik dengan menambahkannya ke favorit
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Favorites Grid */}
      {favorites.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{favorites.length} kata favorit</p>
          </div>
          <div className="flex flex-col gap-2">
            {favorites.map((card, index) => (
              <div
                key={card.id}
                className="flex cursor-pointer items-center gap-4 rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/30"
                onClick={() => handleOpenDetail(card)}
              >
                <div className="font-hanzi min-w-[3.5rem] shrink-0 whitespace-nowrap text-3xl leading-tight text-foreground">{card.hanzi}</div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <TonePinyin text={card.pinyin} className="text-sm font-medium" />
                  <span className="truncate text-sm text-muted-foreground">{card.arti}</span>
                </div>
                <div className="ml-1 flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); speakMandarin(card.hanzi) }}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Dengar"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                  {card.word_class && (
                    <Badge variant="secondary" className="text-xs">
                      {card.word_class}
                    </Badge>
                  )}
                  <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleRemoveFavorite(card.id) }}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    aria-label="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
