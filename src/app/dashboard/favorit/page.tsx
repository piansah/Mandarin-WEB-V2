"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listFavorites, removeFavorite, type FavoriteCard } from "@/lib/personal-decks"
import { Star, Trash2, BookOpen, ExternalLink } from "lucide-react"

export default function FavoritesPage() {
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
          <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((card) => (
              <Card key={card.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-2xl">{card.hanzi}</CardTitle>
                      {card.pinyin && (
                        <CardDescription className="text-base">{card.pinyin}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveFavorite(card.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-lg font-medium">{card.arti}</div>
                  {card.word_class && (
                    <Badge variant="secondary" className="text-xs">
                      {card.word_class}
                    </Badge>
                  )}
                  {card.catatan && (
                    <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                      <BookOpen className="h-3 w-3 inline mr-1" />
                      {card.catatan}
                    </div>
                  )}
                  {card.source && (
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Sumber: {card.source}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
