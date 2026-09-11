"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, HelpCircle } from "lucide-react"
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

interface ModulQuizQuestion {
  id: string
  module_id: string
  question_text: string
  question_type: string
  options: any
  correct_option_id: string
  order_index: number
}

interface ModulModule {
  id: string
  title: string
  slug: string
}

export default function ModulQuizQuestionsPage() {
  const [questions, setQuestions] = React.useState<ModulQuizQuestion[]>([])
  const [modules, setModules] = React.useState<ModulModule[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<ModulQuizQuestion | null>(null)
  const [deletingQuestion, setDeletingQuestion] = React.useState<ModulQuizQuestion | null>(null)
  const [formData, setFormData] = React.useState({
    module_id: "",
    question_text: "",
    question_type: "mcq",
    options: "",
    correct_option_id: "",
    order_index: 0
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchModulModules()
    fetchModulQuizQuestions()
  }, [selectedModuleId, currentPage, rowsPerPage, searchQuery])

  const fetchModulModules = async () => {
    try {
      const { data, error } = await supa
        .from("modul_modules")
        .select("id, title, slug")
        .order("order_index", { ascending: true })

      if (error) throw error
      setModules(data || [])
    } catch (error) {
      console.error("Error fetching modul modules:", error)
    }
  }

  const fetchModulQuizQuestions = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("modul_quiz_questions")
        .select("*", { count: "exact", head: true })

      if (selectedModuleId) {
        countQuery = countQuery.eq("module_id", selectedModuleId)
      }

      if (searchQuery) {
        countQuery = countQuery.ilike("question_text", `%${searchQuery}%`)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("modul_quiz_questions")
        .select("*")
        .order("order_index", { ascending: true })
        .range(from, to)

      if (selectedModuleId) {
        query = query.eq("module_id", selectedModuleId)
      }

      if (searchQuery) {
        query = query.ilike("question_text", `%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Modul Quiz Questions fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setQuestions(data || [])
    } catch (error) {
      console.error("Error fetching modul quiz questions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding modul quiz question:", formData)
      
      // Parse JSON options
      let parsedOptions = null
      try {
        parsedOptions = formData.options ? JSON.parse(formData.options) : null
      } catch (e) {
        alert("Invalid JSON format for options")
        return
      }

      const { error } = await supa
        .from("modul_quiz_questions")
        .insert({
          module_id: formData.module_id,
          question_text: formData.question_text,
          question_type: formData.question_type,
          options: parsedOptions,
          correct_option_id: formData.correct_option_id,
          order_index: formData.order_index
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        module_id: "",
        question_text: "",
        question_type: "mcq",
        options: "",
        correct_option_id: "",
        order_index: 0
      })
      fetchModulQuizQuestions()
    } catch (error) {
      console.error("Error adding modul quiz question:", error)
      alert("Gagal menambahkan modul quiz question")
    }
  }

  const handleEdit = async () => {
    if (!editingQuestion) return

    try {
      console.log("Updating modul quiz question:", formData)
      
      // Parse JSON options
      let parsedOptions = null
      try {
        parsedOptions = formData.options ? JSON.parse(formData.options) : null
      } catch (e) {
        alert("Invalid JSON format for options")
        return
      }

      const { error } = await supa
        .from("modul_quiz_questions")
        .update({
          module_id: formData.module_id,
          question_text: formData.question_text,
          question_type: formData.question_type,
          options: parsedOptions,
          correct_option_id: formData.correct_option_id,
          order_index: formData.order_index
        })
        .eq("id", editingQuestion.id)

      if (error) throw error

      setEditingQuestion(null)
      setShowAddModal(false)
      setFormData({
        module_id: "",
        question_text: "",
        question_type: "mcq",
        options: "",
        correct_option_id: "",
        order_index: 0
      })
      fetchModulQuizQuestions()
    } catch (error) {
      console.error("Error updating modul quiz question:", error)
      alert("Gagal mengupdate modul quiz question")
    }
  }

  const handleDeleteClick = (question: ModulQuizQuestion) => {
    setDeletingQuestion(question)
  }

  const handleDelete = async () => {
    if (!deletingQuestion) return

    try {
      console.log("Deleting modul quiz question:", deletingQuestion.id)
      const { error } = await supa
        .from("modul_quiz_questions")
        .delete()
        .eq("id", deletingQuestion.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingQuestion(null)
      fetchModulQuizQuestions()
    } catch (error) {
      console.error("Error deleting modul quiz question:", error)
      alert(`Gagal menghapus modul quiz question: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setDeletingQuestion(null)
    }
  }

  const openEditModal = (question: ModulQuizQuestion) => {
    setEditingQuestion(question)
    setFormData({
      module_id: question.module_id,
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options ? JSON.stringify(question.options, null, 2) : "",
      correct_option_id: question.correct_option_id,
      order_index: question.order_index
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
            <HelpCircle className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul Quiz Questions</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola pertanyaan quiz untuk modul</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedModuleId || "all"} onValueChange={(value) => setSelectedModuleId(value === "all" ? null : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Module</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  {module.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Question
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Correct Answer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul quiz question
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question) => {
                  const module = modules.find(m => m.id === question.module_id)
                  return (
                    <TableRow key={question.id}>
                      <TableCell className="font-medium max-w-xs truncate">{question.question_text}</TableCell>
                      <TableCell>
                        {module ? (
                          <span className="text-sm">{module.title}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          question.question_type === "mcq" ? "default" :
                          question.question_type === "audio" ? "secondary" :
                          "outline"
                        }>
                          {question.question_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{question.correct_option_id}</TableCell>
                      <TableCell>{question.order_index}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(question)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(question)}>
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
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingQuestion ? "Edit Modul Quiz Question" : "Tambah Modul Quiz Question"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Module</label>
                <Select value={formData.module_id} onValueChange={(value) => setFormData({ ...formData, module_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Question Text</label>
                <Textarea
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  placeholder="Pertanyaan quiz..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Question Type</label>
                <Select value={formData.question_type} onValueChange={(value) => setFormData({ ...formData, question_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="speaking">Speaking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Options (JSON)</label>
                <Textarea
                  value={formData.options}
                  onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                  placeholder='[{"id": "A", "text": "Option A"}, {"id": "B", "text": "Option B"}]'
                  className="font-mono text-sm min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Format JSON untuk pilihan jawaban. Contoh: {`[{"id": "A", "text": "Option A"}, {"id": "B", "text": "Option B"}]`}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Correct Option ID</label>
                <Input
                  value={formData.correct_option_id}
                  onChange={(e) => setFormData({ ...formData, correct_option_id: e.target.value })}
                  placeholder="Contoh: A"
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
                <Button onClick={editingQuestion ? handleEdit : handleAdd} className="flex-1">
                  {editingQuestion ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingQuestion(null); setFormData({ module_id: "", question_text: "", question_type: "mcq", options: "", correct_option_id: "", order_index: 0 }) }}>
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
              <CardTitle className="text-destructive">Hapus Modul Quiz Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus question ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Question: {deletingQuestion.question_text.substring(0, 50)}...</p>
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