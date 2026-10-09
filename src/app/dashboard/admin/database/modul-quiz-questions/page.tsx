"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, MoreVertical, Search, HelpCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  // eslint-disable-next-line
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
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const EMPTY_FORM = {
    module_id: "", question_text: "", question_type: "mcq",
    options: "", correct_option_id: "", order_index: 0
  }
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<ModulQuizQuestion | null>(null)
  const [deletingQuestion, setDeletingQuestion] = React.useState<ModulQuizQuestion | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage, selectedModuleId])

  const { data: modulesData } = useQuery({
    queryKey: ["modul-modules-list"],
    queryFn: async () => {
      const { data, error } = await supa.from("modul_modules").select("id, title, slug").order("order_index", { ascending: true })
      if (error) throw error
      return data || []
    },
  })
  const modules = modulesData || []

  const { data, isLoading: loading } = useQuery({
    queryKey: ["modul-quiz-questions", currentPage, rowsPerPage, debouncedSearch, selectedModuleId],
    queryFn: async () => {
      let query = supa.from("modul_quiz_questions").select("*", { count: "exact" })
      if (selectedModuleId) query = query.eq("module_id", selectedModuleId)
      if (debouncedSearch.trim()) query = query.ilike("question_text", `%${debouncedSearch}%`)
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("order_index", { ascending: true }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data || [], total: count || 0 }
    },
  })

  const questions = data?.rows || []
  const totalRows = data?.total || 0

  const parsePayload = () => {
    let parsedOptions = null
    try {
      parsedOptions = formData.options ? JSON.parse(formData.options) : null
    } catch { alert("Invalid JSON format for options"); return null }
    return {
      module_id: formData.module_id, question_text: formData.question_text, question_type: formData.question_type,
      options: parsedOptions, correct_option_id: formData.correct_option_id, order_index: formData.order_index
    }
  }

  const addMutation = useMutation({
    mutationFn: async (payload: ModulQuizQuestion) => {
      const { error } = await supa.from("modul_quiz_questions").insert(payload)
      if (error) throw error
    },
    onMutate: async (payload: ModulQuizQuestion) => {
      await queryClient.cancelQueries({ queryKey: ["modul-quiz-questions"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-quiz-questions"] })
      queryClient.setQueriesData({ queryKey: ["modul-quiz-questions"] }, (old: { rows: ModulQuizQuestion[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: [{ id: crypto.randomUUID(), ...payload }, ...old.rows], total: old.total + 1 }
      })
      return { previousData }
    },
    onSuccess: () => { setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal menambahkan modul quiz question")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-quiz-questions"] }),
  })

  const editMutation = useMutation({
    mutationFn: async (payload: ModulQuizQuestion) => {
      if (!editingQuestion) return
      const { error } = await supa.from("modul_quiz_questions").update(payload).eq("id", editingQuestion.id)
      if (error) throw error
    },
    onMutate: async (payload: ModulQuizQuestion) => {
      await queryClient.cancelQueries({ queryKey: ["modul-quiz-questions"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-quiz-questions"] })
      queryClient.setQueriesData({ queryKey: ["modul-quiz-questions"] }, (old: { rows: ModulQuizQuestion[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.map((row: ModulQuizQuestion) => row.id === editingQuestion?.id ? { ...row, ...payload } : row) }
      })
      return { previousData }
    },
    onSuccess: () => { setEditingQuestion(null); setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal mengupdate modul quiz question")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-quiz-questions"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingQuestion) return
      const { error } = await supa.from("modul_quiz_questions").delete().eq("id", deletingQuestion.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-quiz-questions"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-quiz-questions"] })
      queryClient.setQueriesData({ queryKey: ["modul-quiz-questions"] }, (old: { rows: ModulQuizQuestion[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.filter((row: ModulQuizQuestion) => row.id !== deletingQuestion?.id), total: Math.max(0, old.total - 1) }
      })
      return { previousData }
    },
    onSuccess: () => { setDeletingQuestion(null) },
    onError: (error: Error, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error(`Gagal menghapus modul quiz question: ${error.message}`)
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-quiz-questions"] }),
  })

  const handleAdd = () => { const p = parsePayload(); if (p) addMutation.mutate(p) }
  const handleEdit = () => { const p = parsePayload(); if (p) editMutation.mutate(p) }
  const handleDelete = () => deleteMutation.mutate()
  const handleDeleteClick = (question: ModulQuizQuestion) => { setDeletingQuestion(question) }

  const openEditModal = (question: ModulQuizQuestion) => {
    setEditingQuestion(question)
    setFormData({
      module_id: question.module_id, question_text: question.question_text, question_type: question.question_type,
      options: question.options ? JSON.stringify(question.options, null, 2) : "",
      correct_option_id: question.correct_option_id, order_index: question.order_index
    })
    setShowAddModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
              <SelectValue placeholder="Filter modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua modul</SelectItem>
              {modules.map((modul) => (
                <SelectItem key={modul.id} value={modul.id}>
                  {modul.title}
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
                <TableHead>modul</TableHead>
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
                  const modul = modules.find(m => m.id === question.module_id)
                  return (
                    <TableRow key={question.id}>
                      <TableCell className="font-medium max-w-xs truncate">{question.question_text}</TableCell>
                      <TableCell>
                        {modul ? (
                          <span className="text-sm">{modul.title}</span>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <div className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer">
                              <MoreVertical className="h-4 w-4" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(question)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteClick(question)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-lg border shadow-lg">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle>{editingQuestion ? "Edit Modul Quiz Question" : "Tambah Modul Quiz Question"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">modul</label>
                  <Select value={formData.module_id} onValueChange={(value) => setFormData({ ...formData, module_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih modul" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {modules.map((modul) => (
                        <SelectItem key={modul.id} value={modul.id}>
                          {modul.title}
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
                    <SelectContent className="z-[10000]">
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
                    Format JSON untuk pilihan jawaban. Contoh: {`[{"id": "A", "text": "你好"}, {"id": "B", "text": "再见"}]`}
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
                  Apakah Kamu yakin ingin menghapus question ini?
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
