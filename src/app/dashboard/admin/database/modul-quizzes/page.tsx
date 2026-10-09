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
import { Plus, Edit, Trash2, MoreVertical, Search, ClipboardCheck, Loader2 } from "lucide-react"
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
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const EMPTY_FORM = { module_id: "", title: "", passing_score: 70 }
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingQuiz, setEditingQuiz] = React.useState<ModulQuiz | null>(null)
  const [deletingQuiz, setDeletingQuiz] = React.useState<ModulQuiz | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
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
    queryKey: ["modul-quizzes", currentPage, rowsPerPage, debouncedSearch, selectedModuleId],
    queryFn: async () => {
      let query = supa.from("modul_quizzes").select("*", { count: "exact" })
      if (selectedModuleId) query = query.eq("module_id", selectedModuleId)
      if (debouncedSearch.trim()) query = query.ilike("title", `%${debouncedSearch}%`)
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data || [], total: count || 0 }
    },
  })

  const quizzes = data?.rows || []
  const totalRows = data?.total || 0

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("modul_quizzes").insert({
        module_id: formData.module_id, title: formData.title, passing_score: formData.passing_score
      })
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-quizzes"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-quizzes"] })
      queryClient.setQueriesData({ queryKey: ["modul-quizzes"] }, (old: { rows: ModulQuiz[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: [{ id: crypto.randomUUID(), ...formData, created_at: new Date().toISOString() }, ...old.rows], total: old.total + 1 }
      })
      return { previousData }
    },
    onSuccess: () => { setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal menambahkan modul quiz")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-quizzes"] }),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingQuiz) return
      const { error } = await supa.from("modul_quizzes").update({
        module_id: formData.module_id, title: formData.title, passing_score: formData.passing_score
      }).eq("id", editingQuiz.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-quizzes"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-quizzes"] })
      queryClient.setQueriesData({ queryKey: ["modul-quizzes"] }, (old: { rows: ModulQuiz[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.map((row: ModulQuiz) => row.id === editingQuiz?.id ? { ...row, ...formData } : row) }
      })
      return { previousData }
    },
    onSuccess: () => { setEditingQuiz(null); setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal mengupdate modul quiz")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-quizzes"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingQuiz) return
      const { error } = await supa.from("modul_quizzes").delete().eq("id", deletingQuiz.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-quizzes"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-quizzes"] })
      queryClient.setQueriesData({ queryKey: ["modul-quizzes"] }, (old: { rows: ModulQuiz[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.filter((row: ModulQuiz) => row.id !== deletingQuiz?.id), total: Math.max(0, old.total - 1) }
      })
      return { previousData }
    },
    onSuccess: () => { setDeletingQuiz(null) },
    onError: (error: Error, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      setBlockingAlert({ message: error.message })
      setDeletingQuiz(null)
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-quizzes"] }),
  })

  const handleAdd = () => addMutation.mutate()
  const handleEdit = () => editMutation.mutate()
  const handleDelete = () => deleteMutation.mutate()
  const handleDeleteClick = (quiz: ModulQuiz) => { setDeletingQuiz(quiz) }

  const openEditModal = (quiz: ModulQuiz) => {
    setEditingQuiz(quiz)
    setFormData({ module_id: quiz.module_id, title: quiz.title, passing_score: quiz.passing_score })
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
                <TableHead>modul</TableHead>
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
                  const modul = modules.find(m => m.id === quiz.module_id)
                  return (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{quiz.title}</TableCell>
                      <TableCell>
                        {modul ? (
                          <span className="text-sm">{modul.title}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{quiz.passing_score}%</TableCell>
                      <TableCell>{new Date(quiz.created_at).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(quiz)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(quiz)} className="text-destructive">
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
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-background rounded-lg border shadow-lg">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle>{editingQuiz ? "Edit Modul Quiz" : "Tambah Modul Quiz"}</CardTitle>
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
                  Apakah Kamu yakin ingin menghapus quiz ini?
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
