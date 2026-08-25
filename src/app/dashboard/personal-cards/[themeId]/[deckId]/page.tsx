"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listCards, addCard, deleteCard, type PersonalCard } from "@/lib/personal-decks"
import { listDecks, type PersonalDeck } from "@/lib/personal-decks"
import { listThemes, type PersonalTheme } from "@/lib/personal-decks"
import { Plus, Trash2, ArrowLeft, BookOpen, Edit2 } from "lucide-react"

export default function DeckDetailPage() {
  const params = useParams()
  const themeId = parseInt(params.themeId as string)
  const deckId = parseInt(params.deckId as string)
  const router = useRouter()
  
  const [theme, setTheme] = React.useState<PersonalTheme | null>(null)
  const [deck, setDeck] = React.useState<PersonalDeck | null>(null)
  const [cards, setCards] = React.useState<PersonalCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [newCard, setNewCard] = React.useState({
    hanzi: "",
    pinyin: "",
    arti: "",
    word_class: "",
    catatan: "",
  })
  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    loadData()
  }, [themeId, deckId])

  async function loadData() {
    setLoading(true)
    const [themesData, decksData, cardsData] = await Promise.all([
      listThemes(),
      listDecks(themeId),
      listCards(deckId),
    ])
    const currentTheme = themesData.find((t) => t.id === themeId)
    const currentDeck = decksData.find((d) => d.id === deckId)
    setTheme(currentTheme || null)
    setDeck(currentDeck || null)
    setCards(cardsData)
    setLoading(false)
  }

  async function handleAddCard() {
    if (!newCard.hanzi.trim() || !newCard.arti.trim()) {
      alert("Hanzi dan arti wajib diisi")
      return
    }
    setAdding(true)
    const result = await addCard(deckId, {
      hanzi: newCard.hanzi.trim(),
      pinyin: newCard.pinyin.trim(),
      arti: newCard.arti.trim(),
      word_class: newCard.word_class.trim() || null,
      catatan: newCard.catatan.trim() || null,
    })
    setAdding(false)
    if (!result.error) {
      setShowAddModal(false)
      setNewCard({ hanzi: "", pinyin: "", arti: "", word_class: "", catatan: "" })
      loadData()
    } else {
      alert(result.error)
    }
  }

  async function handleDeleteCard(id: number) {
    if (!confirm("Yakin ingin menghapus kartu ini?")) return
    const result = await deleteCard(id)
    if (!result.error) {
      loadData()
    } else {
      alert(result.error)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat kartu...</p>
      </div>
    )
  }

  if (!theme || !deck) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Data tidak ditemukan.</p>
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
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>{theme.icon} {theme.name}</span>
            <span>/</span>
            <span>{deck.title}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Kartu Kosakata</h1>
          <p className="text-sm text-muted-foreground">{cards.length} kartu</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Kartu
        </Button>
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Tambah Kartu Baru</CardTitle>
              <CardDescription>Tambah kata baru ke deck ini</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Hanzi *</label>
                  <input
                    type="text"
                    value={newCard.hanzi}
                    onChange={(e) => setNewCard({ ...newCard, hanzi: e.target.value })}
                    placeholder="你好"
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Pinyin</label>
                  <input
                    type="text"
                    value={newCard.pinyin}
                    onChange={(e) => setNewCard({ ...newCard, pinyin: e.target.value })}
                    placeholder="nǐ hǎo"
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    maxLength={100}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Arti *</label>
                <input
                  type="text"
                  value={newCard.arti}
                  onChange={(e) => setNewCard({ ...newCard, arti: e.target.value })}
                  placeholder="Halo / Selamat"
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Kelas Kata (opsional)</label>
                <input
                  type="text"
                  value={newCard.word_class}
                  onChange={(e) => setNewCard({ ...newCard, word_class: e.target.value })}
                  placeholder="kata benda, kata kerja, dll."
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Catatan (opsional)</label>
                <textarea
                  value={newCard.catatan}
                  onChange={(e) => setNewCard({ ...newCard, catatan: e.target.value })}
                  placeholder="Catatan tambahan tentang kata ini..."
                  className="w-full px-3 py-2 rounded-md border bg-background min-h-[80px]"
                  maxLength={500}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Batal
                </Button>
                <Button onClick={handleAddCard} disabled={adding || !newCard.hanzi.trim() || !newCard.arti.trim()}>
                  {adding ? "Menambahkan..." : "Tambah Kartu"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {cards.length === 0 && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">📝</div>
            <div>
              <h3 className="text-lg font-medium">Belum ada kartu</h3>
              <p className="text-sm text-muted-foreground">Mulai dengan menambahkan kartu kosakata pertama</p>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Kartu Pertama
            </Button>
          </div>
        </Card>
      )}

      {/* Cards List */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Card key={card.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl">{card.hanzi}</CardTitle>
                    {card.pinyin && (
                      <CardDescription className="text-base">{card.pinyin}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteCard(card.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
