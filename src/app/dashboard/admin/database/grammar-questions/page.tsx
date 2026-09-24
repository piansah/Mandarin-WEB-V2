"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, Layers, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Database } from "@/lib/database.types"

type GrammarQuestion = Database["public"]["Tables"]["grammar_questions"]["Row"]

const EMPTY_FORM = { pattern_id: 0, words: "", correct_order: "", translation: "", alt_orders: "", sort_order: 0, pinyin_word: "", explanation: "" }

export default function GrammarQuestionsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedPatternId, setSelectedPatternId] = React.useState<number | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<GrammarQuestion | null>(null)
  const [deletingQuestion, setDeletingQuestion] = React.useState<GrammarQuestion | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage, selectedPatternId])

  // --- QUERY: Patterns for filter dropdown ---
  const { data: patternsData } = useQuery({
    queryKey: ["grammar-patterns-list"],
    queryFn: async () => {
      const { data, error } = await supa.from("grammar_patterns").select("id, title").order("sort_order", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
  const patterns = patternsData ?? []

  // --- QUERY: Questions ---
  const { data, isLoading } = useQuery({
    queryKey: ["grammar-questions", currentPage, rowsPerPage, debouncedSearch, selectedPatternId],
    queryFn: async () => {
      let query = supa.from("grammar_questions").select("*", { count: "exact" })
      if (selectedPatternId) query = query.eq("pattern_id", selectedPatternId)
      if (debouncedSearch.trim()) {
        query = query.ilike("translation", `%${debouncedSearch}%`)
      }
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query
        .order("sort_order", { ascending: true })
        .range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
  })

  const questions = data?.rows ?? []
  const totalRows = data?.total ?? 0
  const totalPages = Math.ceil(totalRows / rowsPerPage)

  // --- MUTATIONS ---
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("grammar_questions").insert({
        pattern_id: formData.pattern_id,
        words: formData.words ? JSON.parse(formData.words) : null,
        correct_order: formData.correct_order ? JSON.parse(formData.correct_order) : null,
        translation: formData.translation,
        alt_orders: formData.alt_orders ? JSON.parse(formData.alt_orders) : null,
        sort_order: formData.sort_order,
        pinyin_word: formData.pinyin_word ? JSON.parse(formData.pinyin_word) : null,
        explanation: formData.explanation || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grammar-questions"] })
      setShowAddModal(false)
      setFormData(EMPTY_FORM)
    },
    onError: () => alert("Gagal menambahkan grammar question"),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingQuestion) return
      const { error } = await supa.from("grammar_questions").update({
        pattern_id: formData.pattern_id,
        words: formData.words ? JSON.parse(formData.words) : null,
        correct_order: formData.correct_order ? JSON.parse(formData.correct_order) : null,
        translation: formData.translation,
        alt_orders: formData.alt_orders ? JSON.parse(formData.alt_orders) : null,
        sort_order: formData.sort_order,
        pinyin_word: formData.pinyin_word ? JSON.parse(formData.pinyin_word) : null,
        explanation: formData.explanation || null,
      }).eq("id", editingQuestion.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grammar-questions"] })
      setEditingQuestion(null)
      setFormData(EMPTY_FORM)
    },
    onError: () => alert("Gagal mengupdate grammar question"),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingQuestion) return
      const { error } = await supa.from("grammar_questions").delete().eq("id", deletingQuestion.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grammar-questions"] })
      setDeletingQuestion(null)
    },
    onError: (err: Error) => alert(`Gagal menghapus: ${err.message}`),
  })

  const openEditModal = (q: GrammarQuestion) => {
    setEditingQuestion(q)
    setFormData({
      pattern_id: q.pattern_id,
      words: q.words ? JSON.stringify(q.words, null, 2) : "",
      correct_order: q.correct_order ? JSON.stringify(q.correct_order, null, 2) : "",
      translation: q.translation,
      alt_orders: q.alt_orders ? JSON.stringify(q.alt_orders, null, 2) : "",
      sort_order: q.sort_order ?? 0,
      pinyin_word: q.pinyin_word ? JSON.stringify(q.pinyin_word, null, 2) : "",
      explanation: q.explanation ?? "",
    })
  }

  const openAddModal = () => {
    setEditingQuestion(null)
    setFormData({ ...EMPTY_FORM, pattern_id: selectedPatternId ?? 0 })
    setShowAddModal(true)
  }

  const isMutating = addMutation.isPending || editMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Grammar Questions</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola soal grammar dan latihan tata bahasa</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari soal..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <select
            value={selectedPatternId ?? ""}
            onChange={(e) => setSelectedPatternId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="">Semua Pattern</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Soal
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <Card className="border-muted/50">
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada grammar question ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Pattern ID</TableHead>
                  <TableHead>Translation</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Explanation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.id}</TableCell>
                    <TableCell><Badge variant="outline">Pattern {q.pattern_id}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{q.translation}</TableCell>
                    <TableCell>{q.sort_order}</TableCell>
                    <TableCell className="max-w-xs truncate">{q.explanation ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(q)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingQuestion(q)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      {/* Add/Edit Modal */}
      {(showAddModal || editingQuestion) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader><CardTitle>{editingQuestion ? "Edit Grammar Question" : "Tambah Grammar Question"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Grammar Pattern</label>
                <select value={formData.pattern_id} onChange={(e) => setFormData({ ...formData, pattern_id: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-md bg-background">
                  <option value="">Pilih Pattern</option>
                  {patterns.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Translation</label>
                <Input value={formData.translation} onChange={(e) => setFormData({ ...formData, translation: e.target.value })} placeholder="Terjemahan kalimat..." />
              </div>
              {[
                { label: "Words (JSON)", key: "words", ph: '["word1", "word2", ...]' },
                { label: "Correct Order (JSON)", key: "correct_order", ph: "[0, 1, 2, ...]" },
                { label: "Pinyin Word (JSON)", key: "pinyin_word", ph: '["pinyin1", "pinyin2", ...]' },
                { label: "Alt Orders (JSON)", key: "alt_orders", ph: "[[0,1],[1,0],...]" },
              ].map(({ label, key, ph }) => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <textarea value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} placeholder={ph} className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] font-mono text-xs" />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-sm font-medium">Explanation</label>
                <Input value={formData.explanation} onChange={(e) => setFormData({ ...formData, explanation: e.target.value })} placeholder="Penjelasan soal..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => editingQuestion ? editMutation.mutate() : addMutation.mutate()} className="flex-1" disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : editingQuestion ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingQuestion(null) }}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-destructive">Hapus Grammar Question</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus grammar question ini?</p>
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="text-sm font-medium">Translation: {deletingQuestion.translation}</p>
                <p className="text-sm">Pattern ID: {deletingQuestion.pattern_id}</p>
              </div>
              <p className="text-xs text-destructive">Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingQuestion(null)}>Batal</Button>
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
