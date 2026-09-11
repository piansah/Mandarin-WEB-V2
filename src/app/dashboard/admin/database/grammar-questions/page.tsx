"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Edit, Trash2, Search, Layers } from "lucide-react"
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

interface GrammarQuestion {
  id: number
  pattern_id: number
  words: any
  correct_order: any
  translation: string
  alt_orders: any
  sort_order: number | null
  pinyin_word: any
  explanation: string | null
  created_at: string
  updated_at: string
}

interface GrammarPattern {
  id: number
  title: string
}

export default function GrammarQuestionsPage() {
  const router = useRouter()
  const [questions, setQuestions] = React.useState<GrammarQuestion[]>([])
  const [patterns, setPatterns] = React.useState<GrammarPattern[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedPatternId, setSelectedPatternId] = React.useState<number | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<GrammarQuestion | null>(null)
  const [deletingQuestion, setDeletingQuestion] = React.useState<GrammarQuestion | null>(null)
  const [formData, setFormData] = React.useState({
    pattern_id: 0,
    words: "",
    correct_order: "",
    translation: "",
    alt_orders: "",
    sort_order: 0,
    pinyin_word: "",
    explanation: ""
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchGrammarPatterns()
    fetchGrammarQuestions()
  }, [selectedPatternId])

  const fetchGrammarPatterns = async () => {
    try {
      const { data, error } = await supa
        .from("grammar_patterns")
        .select("id, title")
        .order("sort_order", { ascending: true })

      if (error) throw error
      setPatterns(data || [])
    } catch (error) {
      console.error("Error fetching grammar patterns:", error)
    }
  }

  const fetchGrammarQuestions = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("grammar_questions")
        .select("*", { count: "exact", head: true })

      if (selectedPatternId) {
        countQuery = countQuery.eq("pattern_id", selectedPatternId)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("grammar_questions")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(from, to)

      if (selectedPatternId) {
        query = query.eq("pattern_id", selectedPatternId)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Grammar Questions fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`,
        selectedPatternId
      })
      
      setQuestions(data || [])
      setTotalRows(totalCount || 0)
    } catch (error) {
      console.error("Error fetching grammar questions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const { error } = await supa
        .from("grammar_questions")
        .insert({
          pattern_id: formData.pattern_id,
          words: formData.words ? JSON.parse(formData.words) : null,
          correct_order: formData.correct_order ? JSON.parse(formData.correct_order) : null,
          translation: formData.translation,
          alt_orders: formData.alt_orders ? JSON.parse(formData.alt_orders) : null,
          sort_order: formData.sort_order,
          pinyin_word: formData.pinyin_word ? JSON.parse(formData.pinyin_word) : null,
          explanation: formData.explanation || null
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ pattern_id: 0, words: "", correct_order: "", translation: "", alt_orders: "", sort_order: 0, pinyin_word: "", explanation: "" })
      fetchGrammarQuestions()
    } catch (error) {
      console.error("Error adding grammar question:", error)
      alert("Gagal menambahkan grammar question")
    }
  }

  const handleEdit = async () => {
    if (!editingQuestion) return

    try {
      const { error } = await supa
        .from("grammar_questions")
        .update({
          pattern_id: formData.pattern_id,
          words: formData.words ? JSON.parse(formData.words) : null,
          correct_order: formData.correct_order ? JSON.parse(formData.correct_order) : null,
          translation: formData.translation,
          alt_orders: formData.alt_orders ? JSON.parse(formData.alt_orders) : null,
          sort_order: formData.sort_order,
          pinyin_word: formData.pinyin_word ? JSON.parse(formData.pinyin_word) : null,
          explanation: formData.explanation || null
        })
        .eq("id", editingQuestion.id)

      if (error) throw error

      setEditingQuestion(null)
      setFormData({ pattern_id: 0, words: "", correct_order: "", translation: "", alt_orders: "", sort_order: 0, pinyin_word: "", explanation: "" })
      fetchGrammarQuestions()
    } catch (error) {
      console.error("Error updating grammar question:", error)
      alert("Gagal mengupdate grammar question")
    }
  }

  const handleDelete = async () => {
    if (!deletingQuestion) return

    try {
      console.log("Deleting grammar question:", deletingQuestion.id)
      const { error } = await supa
        .from("grammar_questions")
        .delete()
        .eq("id", deletingQuestion.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingQuestion(null)
      fetchGrammarQuestions()
    } catch (error) {
      console.error("Error deleting grammar question:", error)
      alert(`Gagal menghapus grammar question: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const openEditModal = (question: GrammarQuestion) => {
    setEditingQuestion(question)
    setFormData({
      pattern_id: question.pattern_id,
      words: question.words ? JSON.stringify(question.words, null, 2) : "",
      correct_order: question.correct_order ? JSON.stringify(question.correct_order, null, 2) : "",
      translation: question.translation,
      alt_orders: question.alt_orders ? JSON.stringify(question.alt_orders, null, 2) : "",
      sort_order: question.sort_order || 0,
      pinyin_word: question.pinyin_word ? JSON.stringify(question.pinyin_word, null, 2) : "",
      explanation: question.explanation || ""
    })
  }

  const openAddModal = () => {
    setEditingQuestion(null)
    setFormData({ pattern_id: selectedPatternId || 0, words: "", correct_order: "", translation: "", alt_orders: "", sort_order: 0, pinyin_word: "", explanation: "" })
    setShowAddModal(true)
  }

  const filteredQuestions = questions.filter(question => 
    question.translation.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination logic (server-side)
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  
  // Reset to page 1 when search or rowsPerPage changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, rowsPerPage, selectedPatternId])
  
  // Re-fetch data when page changes
  React.useEffect(() => {
    fetchGrammarQuestions()
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari soal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedPatternId || ""}
            onChange={(e) => setSelectedPatternId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="">Semua Pattern</option>
            {patterns.map(pattern => (
              <option key={pattern.id} value={pattern.id}>{pattern.title}</option>
            ))}
          </select>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Soal
        </Button>
      </div>

      {/* Grammar Questions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredQuestions.length === 0 ? (
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
                {filteredQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="font-medium">{question.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Pattern {question.pattern_id}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{question.translation}</TableCell>
                    <TableCell>{question.sort_order}</TableCell>
                    <TableCell className="max-w-xs truncate">{question.explanation || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(question)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingQuestion(question)}>
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
      {(showAddModal || editingQuestion) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingQuestion ? "Edit Grammar Question" : "Tambah Grammar Question"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Grammar Pattern</label>
                <select
                  value={formData.pattern_id}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, pattern_id: Number.isNaN(parsed) ? 0 : parsed })
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Pilih Pattern</option>
                  {patterns.map(pattern => (
                    <option key={pattern.id} value={pattern.id}>{pattern.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Translation</label>
                <Input
                  value={formData.translation}
                  onChange={(e) => setFormData({ ...formData, translation: e.target.value })}
                  placeholder="Terjemahan kalimat..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Words (JSON)</label>
                <textarea
                  value={formData.words}
                  onChange={(e) => setFormData({ ...formData, words: e.target.value })}
                  placeholder='["word1", "word2", ...]'
                  className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Correct Order (JSON)</label>
                <textarea
                  value={formData.correct_order}
                  onChange={(e) => setFormData({ ...formData, correct_order: e.target.value })}
                  placeholder='[0, 1, 2, ...]'
                  className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pinyin Word (JSON)</label>
                <textarea
                  value={formData.pinyin_word}
                  onChange={(e) => setFormData({ ...formData, pinyin_word: e.target.value })}
                  placeholder='["pinyin1", "pinyin2", ...]'
                  className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alt Orders (JSON)</label>
                <textarea
                  value={formData.alt_orders}
                  onChange={(e) => setFormData({ ...formData, alt_orders: e.target.value })}
                  placeholder='[[0, 1], [1, 0], ...]'
                  className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px] font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Explanation</label>
                <Input
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  placeholder="Penjelasan soal..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, sort_order: Number.isNaN(parsed) ? 0 : parsed })
                  }}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingQuestion ? handleEdit : handleAdd} className="flex-1">
                  {editingQuestion ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingQuestion(null) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Grammar Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus grammar question ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Translation: {deletingQuestion.translation}</p>
                  <p className="text-sm">Pattern ID: {deletingQuestion.pattern_id}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingQuestion(null)}>
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
