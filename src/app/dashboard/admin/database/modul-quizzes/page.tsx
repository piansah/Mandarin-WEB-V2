"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, Search, ClipboardCheck } from "lucide-react"
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

interface ModulQuiz {
  id: string
  module_id: string
  title: string
  passing_score: number
  created_at: string
}

interface ModulModule {
  id: string
  title: string
  slug: string
}

export default function ModulQuizzesPage() {
  const [quizzes, setQuizzes] = React.useState<ModulQuiz[]>([])
  const [modules, setModules] = React.useState<ModulModule[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingQuiz, setEditingQuiz] = React.useState<ModulQuiz | null>(null)
  const [deletingQuiz, setDeletingQuiz] = React.useState<ModulQuiz | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState({
    module_id: "",
    title: "",
    passing_score: 70
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchModulModules()
    fetchModulQuizzes()
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

  const fetchModulQuizzes = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("modul_quizzes")
        .select("*", { count: "exact", head: true })

      if (selectedModuleId) {
        countQuery = countQuery.eq("module_id", selectedModuleId)
      }

      if (searchQuery) {
        countQuery = countQuery.ilike("title", `%${searchQuery}%`)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("modul_quizzes")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to)

      if (selectedModuleId) {
        query = query.eq("module_id", selectedModuleId)
      }

      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Modul Quizzes fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setQuizzes(data || [])
    } catch (error) {
      console.error("Error fetching modul quizzes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding modul quiz:", formData)
      const { error } = await supa
        .from("modul_quizzes")
        .insert({
          module_id: formData.module_id,
          title: formData.title,
          passing_score: formData.passing_score
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        module_id: "",
        title: "",
        passing_score: 70
      })
      fetchModulQuizzes()
    } catch (error) {
      console.error("Error adding modul quiz:", error)
      alert("Gagal menambahkan modul quiz")
    }
  }

  const handleEdit = async () => {
    if (!editingQuiz) return

    try {
      console.log("Updating modul quiz:", formData)
      const { error } = await supa
        .from("modul_quizzes")
        .update({
          module_id: formData.module_id,
          title: formData.title,
          passing_score: formData.passing_score
        })
        .eq("id", editingQuiz.id)

      if (error) throw error

      setEditingQuiz(null)
      setShowAddModal(false)
      setFormData({
        module_id: "",
        title: "",
        passing_score: 70
      })
      fetchModulQuizzes()
    } catch (error) {
      console.error("Error updating modul quiz:", error)
      alert("Gagal mengupdate modul quiz")
    }
  }

  const handleDeleteClick = (quiz: ModulQuiz) => {
    setDeletingQuiz(quiz)
  }

  const handleDelete = async () => {
    if (!deletingQuiz) return

    try {
      console.log("Deleting modul quiz:", deletingQuiz.id)
      
      // Quiz questions are linked to module_id, not quiz_id
      // So we can delete quiz without checking for questions
      const { error } = await supa
        .from("modul_quizzes")
        .delete()
        .eq("id", deletingQuiz.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingQuiz(null)
      fetchModulQuizzes()
    } catch (error) {
      console.error("Error deleting modul quiz:", error)
      setBlockingAlert({ 
        message: `Gagal menghapus modul quiz: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      setDeletingQuiz(null)
    }
  }

  const openEditModal = (quiz: ModulQuiz) => {
    setEditingQuiz(quiz)
    setFormData({
      module_id: quiz.module_id,
      title: quiz.title,
      passing_score: quiz.passing_score
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
            <ClipboardCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul Quizzes</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola quiz untuk modul pembelajaran</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari quiz..."
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
          Tambah Quiz
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Passing Score</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul quiz
                  </TableCell>
                </TableRow>
              ) : (
                quizzes.map((quiz) => {
                  const module = modules.find(m => m.id === quiz.module_id)
                  return (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{quiz.title}</TableCell>
                      <TableCell>
                        {module ? (
                          <span className="text-sm">{module.title}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{quiz.passing_score}%</TableCell>
                      <TableCell>{new Date(quiz.created_at).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(quiz)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(quiz)}>
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
              <CardTitle>{editingQuiz ? "Edit Modul Quiz" : "Tambah Modul Quiz"}</CardTitle>
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
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Judul quiz..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Passing Score (%)</label>
                <Input
                  type="number"
                  value={formData.passing_score}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, passing_score: Number.isNaN(parsed) ? 70 : parsed })
                  }}
                  min={0}
                  max={100}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingQuiz ? handleEdit : handleAdd} className="flex-1">
                  {editingQuiz ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingQuiz(null); setFormData({ module_id: "", title: "", passing_score: 70 }) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingQuiz && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Modul Quiz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus quiz ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Title: {deletingQuiz.title}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingQuiz(null)}>
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

      {/* Blocking Alert Modal */}
      {blockingAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Peringatan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm">{blockingAlert.message}</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setBlockingAlert(null)}>
                  OK
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}