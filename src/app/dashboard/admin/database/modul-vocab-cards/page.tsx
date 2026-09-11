"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, Search, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ModulVocabCard {
  id: string
  module_part_id: string
  hanzi: string
  pinyin: string
  translation: string | null
  audio_url: string | null
  order_index: number
}

interface ModulModulePart {
  id: string
  title: string
  part_type: string
}

interface ModulModule {
  id: string
  title: string
}

export default function ModulVocabCardsPage() {
  const [vocabCards, setVocabCards] = React.useState<ModulVocabCard[]>([])
  const [moduleParts, setModuleParts] = React.useState<ModulModulePart[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedPartId, setSelectedPartId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingCard, setEditingCard] = React.useState<ModulVocabCard | null>(null)
  const [deletingCard, setDeletingCard] = React.useState<ModulVocabCard | null>(null)
  const [formData, setFormData] = React.useState({
    module_part_id: "",
    hanzi: "",
    pinyin: "",
    translation: "",
    audio_url: "",
    order_index: 0
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchModuleParts()
    fetchModulVocabCards()
  }, [selectedPartId, currentPage, rowsPerPage, searchQuery])

  const fetchModuleParts = async () => {
    try {
      const { data, error } = await supa
        .from("modul_module_parts")
        .select("id, title, part_type")
        .order("order_index", { ascending: true })

      if (error) throw error
      setModuleParts(data || [])
    } catch (error) {
      console.error("Error fetching module parts:", error)
    }
  }

  const fetchModulVocabCards = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("modul_vocab_cards")
        .select("*", { count: "exact", head: true })

      if (selectedPartId) {
        countQuery = countQuery.eq("module_part_id", selectedPartId)
      }

      if (searchQuery) {
        countQuery = countQuery.or(`hanzi.ilike.%${searchQuery}%,pinyin.ilike.%${searchQuery}%,translation.ilike.%${searchQuery}%`)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("modul_vocab_cards")
        .select("*")
        .order("order_index", { ascending: true })
        .range(from, to)

      if (selectedPartId) {
        query = query.eq("module_part_id", selectedPartId)
      }

      if (searchQuery) {
        query = query.or(`hanzi.ilike.%${searchQuery}%,pinyin.ilike.%${searchQuery}%,translation.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Modul Vocab Cards fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setVocabCards(data || [])
    } catch (error) {
      console.error("Error fetching modul vocab cards:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding modul vocab card:", formData)
      const { error } = await supa
        .from("modul_vocab_cards")
        .insert({
          module_part_id: formData.module_part_id,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          translation: formData.translation || null,
          audio_url: formData.audio_url || null,
          order_index: formData.order_index
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        module_part_id: "",
        hanzi: "",
        pinyin: "",
        translation: "",
        audio_url: "",
        order_index: 0
      })
      fetchModulVocabCards()
    } catch (error) {
      console.error("Error adding modul vocab card:", error)
      alert("Gagal menambahkan modul vocab card")
    }
  }

  const handleEdit = async () => {
    if (!editingCard) return

    try {
      console.log("Updating modul vocab card:", formData)
      const { error } = await supa
        .from("modul_vocab_cards")
        .update({
          module_part_id: formData.module_part_id,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          translation: formData.translation || null,
          audio_url: formData.audio_url || null,
          order_index: formData.order_index
        })
        .eq("id", editingCard.id)

      if (error) throw error

      setEditingCard(null)
      setShowAddModal(false)
      setFormData({
        module_part_id: "",
        hanzi: "",
        pinyin: "",
        translation: "",
        audio_url: "",
        order_index: 0
      })
      fetchModulVocabCards()
    } catch (error) {
      console.error("Error updating modul vocab card:", error)
      alert("Gagal mengupdate modul vocab card")
    }
  }

  const handleDeleteClick = (card: ModulVocabCard) => {
    setDeletingCard(card)
  }

  const handleDelete = async () => {
    if (!deletingCard) return

    try {
      console.log("Deleting modul vocab card:", deletingCard.id)
      const { error } = await supa
        .from("modul_vocab_cards")
        .delete()
        .eq("id", deletingCard.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingCard(null)
      fetchModulVocabCards()
    } catch (error) {
      console.error("Error deleting modul vocab card:", error)
      alert(`Gagal menghapus modul vocab card: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setDeletingCard(null)
    }
  }

  const openEditModal = (card: ModulVocabCard) => {
    setEditingCard(card)
    setFormData({
      module_part_id: card.module_part_id,
      hanzi: card.hanzi,
      pinyin: card.pinyin,
      translation: card.translation || "",
      audio_url: card.audio_url || "",
      order_index: card.order_index
    })
    setShowAddModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul Vocab Cards</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola vocabulary cards per part modul</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari vocab..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedPartId || "all"} onValueChange={(value) => setSelectedPartId(value === "all" ? null : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter Part" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Part</SelectItem>
              {moduleParts.map((part) => (
                <SelectItem key={part.id} value={part.id}>
                  {part.title} ({part.part_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Vocab
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hanzi</TableHead>
                <TableHead>Pinyin</TableHead>
                <TableHead>Translation</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vocabCards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul vocab card
                  </TableCell>
                </TableRow>
              ) : (
                vocabCards.map((card) => {
                  const part = moduleParts.find(p => p.id === card.module_part_id)
                  return (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{card.hanzi}</TableCell>
                      <TableCell>{card.pinyin}</TableCell>
                      <TableCell>{card.translation || "-"}</TableCell>
                      <TableCell>
                        {part ? (
                          <span className="text-sm">{part.title}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{card.order_index}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(card)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(card)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalRows / rowsPerPage)}
        rowsPerPage={rowsPerPage}
        totalRows={totalRows}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
      />

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{editingCard ? "Edit Modul Vocab Card" : "Tambah Modul Vocab Card"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Module Part</label>
                <Select value={formData.module_part_id} onValueChange={(value) => setFormData({ ...formData, module_part_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih part" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleParts.map((part) => (
                      <SelectItem key={part.id} value={part.id}>
                        {part.title} ({part.part_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hanzi</label>
                <Input
                  value={formData.hanzi}
                  onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                  placeholder="Han zi..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pinyin</label>
                <Input
                  value={formData.pinyin}
                  onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                  placeholder="Pinyin..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Translation</label>
                <Input
                  value={formData.translation}
                  onChange={(e) => setFormData({ ...formData, translation: e.target.value })}
                  placeholder="Arti..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Audio URL</label>
                <Input
                  value={formData.audio_url}
                  onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
                  placeholder="URL audio..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Order Index</label>
                <Input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, order_index: Number.isNaN(parsed) ? 0 : parsed })
                  }}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingCard ? handleEdit : handleAdd} className="flex-1">
                  {editingCard ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingCard(null); setFormData({ module_part_id: "", hanzi: "", pinyin: "", translation: "", audio_url: "", order_index: 0 }) }}>
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
              <CardTitle className="text-destructive">Hapus Modul Vocab Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus vocab card ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Hanzi: {deletingCard.hanzi}</p>
                  <p className="text-sm">Pinyin: {deletingCard.pinyin}</p>
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