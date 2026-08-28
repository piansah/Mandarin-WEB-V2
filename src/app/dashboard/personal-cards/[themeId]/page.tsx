"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listDecks, createDeck, updateDeck, deleteDeck, type PersonalDeck } from "@/lib/personal-decks"
import { listThemes, type PersonalTheme } from "@/lib/personal-decks"
import { Plus, Trash2, ArrowLeft, Layers, ChevronRight, Edit2 } from "lucide-react"

export default function ThemeDetailPage() {
  const params = useParams()
  const themeId = parseInt(params.themeId as string)
  const router = useRouter()
  
  const [theme, setTheme] = React.useState<PersonalTheme | null>(null)
  const [decks, setDecks] = React.useState<PersonalDeck[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [showEditModal, setShowEditModal] = React.useState(false)
  const [editingDeck, setEditingDeck] = React.useState<PersonalDeck | null>(null)
  const [deckTitle, setDeckTitle] = React.useState("")
  const [deckDescription, setDeckDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    loadThemeAndDecks()
  }, [themeId])

  async function loadThemeAndDecks() {
    setLoading(true)
    const [themesData, decksData] = await Promise.all([
      listThemes(),
      listDecks(themeId),
    ])
    const currentTheme = themesData.find((t) => t.id === themeId)
    setTheme(currentTheme || null)
    setDecks(decksData)
    setLoading(false)
  }

  async function handleCreateDeck() {
    if (!deckTitle.trim()) return
    setSaving(true)
    const result = await createDeck(themeId, deckTitle.trim(), deckDescription.trim() || null)
    setSaving(false)
    if (!result.error) {
      setShowCreateModal(false)
      setDeckTitle("")
      setDeckDescription("")
      loadThemeAndDecks()
    } else {
      alert(result.error)
    }
  }

  async function handleUpdateDeck() {
    if (!editingDeck || !deckTitle.trim()) return
    setSaving(true)
    const result = await updateDeck(editingDeck.id, deckTitle.trim(), deckDescription.trim() || null)
    setSaving(false)
    if (!result.error) {
      setShowEditModal(false)
      setEditingDeck(null)
      setDeckTitle("")
      setDeckDescription("")
      loadThemeAndDecks()
    } else {
      alert(result.error)
    }
  }

  async function handleDeleteDeck(id: number) {
    if (!confirm("Yakin ingin menghapus deck ini? Semua kartu di dalamnya juga akan terhapus.")) return
    const result = await deleteDeck(id)
    if (!result.error) {
      loadThemeAndDecks()
    } else {
      alert(result.error)
    }
  }

  function openEditModal(deck: PersonalDeck) {
    setEditingDeck(deck)
    setDeckTitle(deck.title)
    setDeckDescription(deck.description || "")
    setShowEditModal(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat tema...</p>
      </div>
    )
  }

  if (!theme) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Tema tidak ditemukan.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{theme.icon || "📚"}</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{theme.name}</h1>
            <p className="text-sm text-muted-foreground">{decks.length} deck</p>
          </div>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Buat Deck Baru
          </Button>
        </div>
      </div>

      {/* Create Deck Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Buat Deck Baru</CardTitle>
              <CardDescription>Deck adalah kumpulan kartu kosakata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Judul Deck</label>
                <input
                  type="text"
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  placeholder="Contoh: Kata dasar, Verba umum..."
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Deskripsi (opsional)</label>
                <textarea
                  value={deckDescription}
                  onChange={(e) => setDeckDescription(e.target.value)}
                  placeholder="Deskripsi singkat tentang deck ini..."
                  className="w-full px-3 py-2 rounded-md border bg-background min-h-[80px]"
                  maxLength={200}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Batal
                </Button>
                <Button onClick={handleCreateDeck} disabled={saving || !deckTitle.trim()}>
                  {saving ? "Membuat..." : "Buat Deck"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Deck Modal */}
      {showEditModal && editingDeck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Deck</CardTitle>
              <CardDescription>Ubah judul dan deskripsi deck</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Judul Deck</label>
                <input
                  type="text"
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Deskripsi (opsional)</label>
                <textarea
                  value={deckDescription}
                  onChange={(e) => setDeckDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background min-h-[80px]"
                  maxLength={200}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Batal
                </Button>
                <Button onClick={handleUpdateDeck} disabled={saving || !deckTitle.trim()}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {decks.length === 0 && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">📇</div>
            <div>
              <h3 className="text-lg font-medium">Belum ada deck</h3>
              <p className="text-sm text-muted-foreground">Mulai dengan membuat deck baru untuk menambah kartu kosakata</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Buat Deck Pertama
            </Button>
          </div>
        </Card>
      )}

      {/* Decks Grid */}
      {decks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <Card key={deck.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{deck.title}</CardTitle>
                    {deck.description && (
                      <CardDescription className="line-clamp-2">{deck.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditModal(deck)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteDeck(deck.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="gap-1">
                    <Layers className="h-3 w-3" />
                    {deck.card_count || 0} kartu
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/personal-cards/${themeId}/${deck.id}`)}
                  >
                    Lihat Kartu
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
