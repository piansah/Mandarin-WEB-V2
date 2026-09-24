"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, FileText, Loader2 } from "lucide-react"
import { WORD_CLASS_LABELS } from "@/lib/hanzi-utils"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Database } from "@/lib/database.types"

type FlashcardCard = Database["public"]["Tables"]["flashcard_cards"]["Row"]

const EMPTY_FORM = { set_id: null as number | null, hanzi: "", pinyin: "", arti: "", catatan: "", word_class: "" }

export default function FlashcardCardsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedSetId, setSelectedSetId] = React.useState<number | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingCard, setEditingCard] = React.useState<FlashcardCard | null>(null)
  const [deletingCard, setDeletingCard] = React.useState<FlashcardCard | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage, selectedSetId])

  // Dropdown sets
  const { data: setsData } = useQuery({
    queryKey: ["flashcard-sets-list"],
    queryFn: async () => {
      const { data, error } = await supa.from("flashcard_sets").select("id, title").order("sort_order", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
  const sets = setsData ?? []

  // Cards query
  const { data, isLoading } = useQuery({
    queryKey: ["flashcard-cards", currentPage, rowsPerPage, debouncedSearch, selectedSetId],
    queryFn: async () => {
      let query = supa.from("flashcard_cards").select("*", { count: "exact" })
      if (selectedSetId) query = query.eq("set_id", selectedSetId)
      if (debouncedSearch.trim()) {
        const t = `%${debouncedSearch}%`
        query = query.or(`hanzi.ilike.${t},pinyin.ilike.${t},arti.ilike.${t}`)
      }
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
  })

  const cards = data?.rows ?? []
  const totalRows = data?.total ?? 0
  const totalPages = Math.ceil(totalRows / rowsPerPage)

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!formData.set_id) throw new Error("Pilih Flashcard Set terlebih dahulu")
      const { error } = await supa.from("flashcard_cards").insert({
        set_id: formData.set_id,
        hanzi: formData.hanzi,
        pinyin: formData.pinyin,
        arti: formData.arti,
        catatan: formData.catatan || null,
        word_class: formData.word_class || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcard-cards"] })
      setShowAddModal(false)
      setFormData(EMPTY_FORM)
    },
    onError: (err: Error) => alert(err.message),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingCard || !formData.set_id) throw new Error("Pilih Flashcard Set terlebih dahulu")
      const { error } = await supa.from("flashcard_cards").update({
        set_id: formData.set_id,
        hanzi: formData.hanzi,
        pinyin: formData.pinyin,
        arti: formData.arti,
        catatan: formData.catatan || null,
        word_class: formData.word_class || null,
      }).eq("id", editingCard.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcard-cards"] })
      setEditingCard(null)
      setFormData(EMPTY_FORM)
    },
    onError: (err: Error) => alert(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingCard) return
      const { error } = await supa.from("flashcard_cards").delete().eq("id", deletingCard.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcard-cards"] })
      setDeletingCard(null)
    },
    onError: (err: Error) => alert(err.message),
  })

  const openEditModal = (card: FlashcardCard) => {
    setEditingCard(card)
    setFormData({ set_id: card.set_id, hanzi: card.hanzi, pinyin: card.pinyin, arti: card.arti ?? "", catatan: card.catatan ?? "", word_class: card.word_class ?? "" })
  }

  const openAddModal = () => {
    setEditingCard(null)
    setFormData({ ...EMPTY_FORM, set_id: selectedSetId })
    setShowAddModal(true)
  }

  const isMutating = addMutation.isPending || editMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col p-6 gap-6">
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Flashcard Cards</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola kartu vocabulary dan flashcard</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari kartu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <select value={selectedSetId ?? ""} onChange={(e) => setSelectedSetId(e.target.value ? parseInt(e.target.value) : null)} className="px-3 py-2 border rounded-md bg-background">
            <option value="">Semua Set</option>
            {sets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <Button onClick={openAddModal}><Plus className="h-4 w-4 mr-2" />Tambah Kartu</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : cards.length === 0 ? (
        <Card className="border-muted/50"><CardContent className="py-12 text-center"><FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Tidak ada flashcard card ditemukan</p></CardContent></Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead><TableHead>Hanzi</TableHead><TableHead>Pinyin</TableHead>
                  <TableHead>Arti</TableHead><TableHead>Word Class</TableHead><TableHead>Set</TableHead>
                  <TableHead>Catatan</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">{card.id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-medium">{card.hanzi}</TableCell>
                    <TableCell>{card.pinyin}</TableCell>
                    <TableCell>{card.arti}</TableCell>
                    <TableCell>{card.word_class && <Badge variant="secondary">{card.word_class}</Badge>}</TableCell>
                    <TableCell><Badge variant="outline">Set {card.set_id}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{card.catatan ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(card)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingCard(card)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 border-t">
              <Pagination currentPage={currentPage} totalPages={totalPages} rowsPerPage={rowsPerPage} totalRows={totalRows} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage} />
            </div>
          </CardContent>
        </Card>
      )}

      {(showAddModal || editingCard) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader><CardTitle>{editingCard ? "Edit Flashcard Card" : "Tambah Flashcard Card"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Flashcard Set</label>
                <select value={formData.set_id ?? ""} onChange={(e) => setFormData({ ...formData, set_id: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border rounded-md bg-background">
                  <option value="">Pilih Set</option>
                  {sets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              {[
                { label: "Hanzi", key: "hanzi", ph: "你好" },
                { label: "Pinyin", key: "pinyin", ph: "nǐ hǎo" },
                { label: "Arti", key: "arti", ph: "Halo" },
                { label: "Catatan", key: "catatan", ph: "Catatan tambahan..." },
              ].map(({ label, key, ph }) => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <Input value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} placeholder={ph} />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-sm font-medium">Word Class</label>
                <select value={formData.word_class} onChange={(e) => setFormData({ ...formData, word_class: e.target.value })} className="w-full px-3 py-2 border rounded-md bg-background">
                  <option value="">Pilih Kelas Kata</option>
                  {Object.entries(WORD_CLASS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => editingCard ? editMutation.mutate() : addMutation.mutate()} className="flex-1" disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCard ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingCard(null) }}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {deletingCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-destructive">Hapus Flashcard Card</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus flashcard card ini?</p>
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="text-sm font-medium">Hanzi: {deletingCard.hanzi}</p>
                <p className="text-sm">Pinyin: {deletingCard.pinyin}</p>
              </div>
              <p className="text-xs text-destructive">Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingCard(null)}>Batal</Button>
                <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
