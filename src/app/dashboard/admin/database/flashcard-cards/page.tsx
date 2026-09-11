"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Edit, Trash2, Search, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"
import { WORD_CLASS_LABELS } from "@/lib/hanzi-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"

interface FlashcardCard {
  id: string
  set_id: number
  hanzi: string
  pinyin: string
  arti: string
  catatan: string | null
  word_class: string | null
  created_at: string
}

interface FlashcardSet {
  id: number
  title: string
}

export default function FlashcardCardsPage() {
  const router = useRouter()
  const [cards, setCards] = React.useState<FlashcardCard[]>([])
  const [sets, setSets] = React.useState<FlashcardSet[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedSetId, setSelectedSetId] = React.useState<number | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingCard, setEditingCard] = React.useState<FlashcardCard | null>(null)
  const [deletingCard, setDeletingCard] = React.useState<FlashcardCard | null>(null)
  const [formData, setFormData] = React.useState({
    set_id: null as number | null,
    hanzi: "",
    pinyin: "",
    arti: "",
    catatan: "",
    word_class: ""
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchFlashcardSets()
    fetchFlashcardCards()
  }, [selectedSetId])

  const fetchFlashcardSets = async () => {
    try {
      const { data, error } = await supa
        .from("flashcard_sets")
        .select("id, title")
        .order("sort_order", { ascending: true })

      if (error) throw error
      setSets(data || [])
    } catch (error) {
      console.error("Error fetching flashcard sets:", error)
    }
  }

  const fetchFlashcardCards = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("flashcard_cards")
        .select("*", { count: "exact", head: true })

      if (selectedSetId) {
        countQuery = countQuery.eq("set_id", selectedSetId)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("flashcard_cards")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to)

      if (selectedSetId) {
        query = query.eq("set_id", selectedSetId)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Flashcard Cards fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`,
        selectedSetId
      })
      
      setCards(data || [])
      setTotalRows(totalCount || 0)
    } catch (error) {
      console.error("Error fetching flashcard cards:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!formData.set_id) {
      alert("Silakan pilih Flashcard Set terlebih dahulu")
      return
    }

    try {
      console.log("Adding flashcard card:", formData)
      const { error } = await supa
        .from("flashcard_cards")
        .insert({
          set_id: formData.set_id,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          arti: formData.arti,
          catatan: formData.catatan || null,
          word_class: formData.word_class || null
        })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setShowAddModal(false)
      setFormData({ set_id: null, hanzi: "", pinyin: "", arti: "", catatan: "", word_class: "" })
      fetchFlashcardCards()
    } catch (error) {
      console.error("Error adding flashcard card:", error)
      alert(`Gagal menambahkan flashcard card: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleEdit = async () => {
    if (!editingCard) return

    if (!formData.set_id) {
      alert("Silakan pilih Flashcard Set terlebih dahulu")
      return
    }

    try {
      console.log("Updating flashcard card:", formData)
      const { error } = await supa
        .from("flashcard_cards")
        .update({
          set_id: formData.set_id,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          arti: formData.arti,
          catatan: formData.catatan || null,
          word_class: formData.word_class || null
        })
        .eq("id", editingCard.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setEditingCard(null)
      setFormData({ set_id: null, hanzi: "", pinyin: "", arti: "", catatan: "", word_class: "" })
      fetchFlashcardCards()
    } catch (error) {
      console.error("Error updating flashcard card:", error)
      alert(`Gagal mengupdate flashcard card: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDelete = async () => {
    if (!deletingCard) return

    try {
      console.log("Deleting flashcard card:", deletingCard.id)
      const { error } = await supa
        .from("flashcard_cards")
        .delete()
        .eq("id", deletingCard.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingCard(null)
      fetchFlashcardCards()
    } catch (error) {
      console.error("Error deleting flashcard card:", error)
      alert(`Gagal menghapus flashcard card: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const openEditModal = (card: FlashcardCard) => {
    setEditingCard(card)
    setFormData({
      set_id: card.set_id,
      hanzi: card.hanzi,
      pinyin: card.pinyin,
      arti: card.arti,
      catatan: card.catatan || "",
      word_class: card.word_class || ""
    })
  }

  const openAddModal = () => {
    setEditingCard(null)
    setFormData({ set_id: selectedSetId || 0, hanzi: "", pinyin: "", arti: "", catatan: "", word_class: "" })
    setShowAddModal(true)
  }

  const filteredCards = cards.filter(card => 
    card.hanzi.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.arti.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination logic (server-side)
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  
  // Reset to page 1 when search or rowsPerPage changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, rowsPerPage, selectedSetId])
  
  // Re-fetch data when page changes
  React.useEffect(() => {
    fetchFlashcardCards()
  }, [currentPage, rowsPerPage])

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Flashcard Cards</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola kartu vocabulary dan flashcard</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kartu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedSetId || ""}
            onChange={(e) => setSelectedSetId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="">Semua Set</option>
            {sets.map(set => (
              <option key={set.id} value={set.id}>{set.title}</option>
            ))}
          </select>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Kartu
        </Button>
      </div>

      {/* Flashcard Cards Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredCards.length === 0 ? (
        <Card className="border-muted/50">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada flashcard card ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Hanzi</TableHead>
                  <TableHead>Pinyin</TableHead>
                  <TableHead>Arti</TableHead>
                  <TableHead>Word Class</TableHead>
                  <TableHead>Set ID</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">{card.id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-medium">{card.hanzi}</TableCell>
                    <TableCell>{card.pinyin}</TableCell>
                    <TableCell>{card.arti}</TableCell>
                    <TableCell>
                      {card.word_class && <Badge variant="secondary">{card.word_class}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Set {card.set_id}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{card.catatan || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(card)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingCard(card)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 border-t">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                rowsPerPage={rowsPerPage}
                totalRows={totalRows}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingCard) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingCard ? "Edit Flashcard Card" : "Tambah Flashcard Card"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Flashcard Set</label>
                <select
                  value={formData.set_id ?? ""}
                  onChange={(e) => {
                    const value = e.target.value
                    const parsed = value ? parseInt(value, 10) : null
                    setFormData({ ...formData, set_id: Number.isNaN(parsed) ? null : parsed })
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Pilih Set</option>
                  {sets.map(set => (
                    <option key={set.id} value={set.id}>{set.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hanzi</label>
                <Input
                  value={formData.hanzi}
                  onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                  placeholder="你好"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pinyin</label>
                <Input
                  value={formData.pinyin}
                  onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                  placeholder="nǐ hǎo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Arti</label>
                <Input
                  value={formData.arti}
                  onChange={(e) => setFormData({ ...formData, arti: e.target.value })}
                  placeholder="Halo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Word Class</label>
                <select
                  value={formData.word_class}
                  onChange={(e) => setFormData({ ...formData, word_class: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Pilih Kelas Kata</option>
                  {Object.entries(WORD_CLASS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan</label>
                <Input
                  value={formData.catatan}
                  onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                  placeholder="Catatan tambahan..."
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingCard ? handleEdit : handleAdd} className="flex-1">
                  {editingCard ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingCard(null) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Flashcard Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus flashcard card ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Hanzi: {deletingCard.hanzi}</p>
                  <p className="text-sm">Pinyin: {deletingCard.pinyin}</p>
                  <p className="text-sm">Arti: {deletingCard.arti}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingCard(null)}>
                  Batal
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
