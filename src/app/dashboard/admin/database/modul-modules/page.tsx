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
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, MoreVertical, Search, BookOpen, ExternalLink, Loader2 } from "lucide-react"
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

interface ModulModule {
  id: string
  level_id: string
  title: string
  slug: string
  description: string | null
  summary: string | null
  order_index: number
  duration_minutes: number
  part_count: number
  has_quiz: boolean
  is_published: boolean
  created_at: string
  updated_at: string
}

interface ModulLevel {
  id: string
  code: string
  label: string
}

export default function ModulModulesPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const EMPTY_FORM = {
    level_id: "", title: "", slug: "", description: "", summary: "",
    order_index: 0, duration_minutes: 0, part_count: 0, has_quiz: false, is_published: true
  }
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedLevelId, setSelectedLevelId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingModule, setEditingModule] = React.useState<ModulModule | null>(null)
  const [deletingModule, setDeletingModule] = React.useState<ModulModule | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage, selectedLevelId])

  const { data: levelsData } = useQuery({
    queryKey: ["modul-levels-list"],
    queryFn: async () => {
      const { data, error } = await supa.from("modul_levels").select("id, code, label").order("order_index", { ascending: true })
      if (error) throw error
      return data || []
    },
  })
  const levels = levelsData || []

  const { data, isLoading: loading } = useQuery({
    queryKey: ["modul-modules", currentPage, rowsPerPage, debouncedSearch, selectedLevelId],
    queryFn: async () => {
      let query = supa.from("modul_modules").select("*", { count: "exact" })
      if (selectedLevelId) query = query.eq("level_id", selectedLevelId)
      if (debouncedSearch.trim()) {
        const t = `%${debouncedSearch}%`
        query = query.or(`title.ilike.${t},slug.ilike.${t}`)
      }
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("order_index", { ascending: true }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data || [], total: count || 0 }
    },
  })

  const modules = data?.rows || []
  const totalRows = data?.total || 0

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("modul_modules").insert({
        level_id: formData.level_id, title: formData.title, slug: formData.slug,
        description: formData.description || null, summary: formData.summary || null,
        order_index: formData.order_index, duration_minutes: formData.duration_minutes,
        part_count: formData.part_count, has_quiz: formData.has_quiz, is_published: formData.is_published
      })
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-modules"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-modules"] })
      queryClient.setQueriesData({ queryKey: ["modul-modules"] }, (old: { rows: ModulModule[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: [{ id: crypto.randomUUID(), ...formData }, ...old.rows], total: old.total + 1 }
      })
      return { previousData }
    },
    onSuccess: () => { setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal menambahkan modul module")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-modules"] }),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingModule) return
      const { error } = await supa.from("modul_modules").update({
        level_id: formData.level_id, title: formData.title, slug: formData.slug,
        description: formData.description || null, summary: formData.summary || null,
        order_index: formData.order_index, duration_minutes: formData.duration_minutes,
        part_count: formData.part_count, has_quiz: formData.has_quiz, is_published: formData.is_published
      }).eq("id", editingModule.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-modules"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-modules"] })
      queryClient.setQueriesData({ queryKey: ["modul-modules"] }, (old: { rows: ModulModule[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.map((row: ModulModule) => row.id === editingModule?.id ? { ...row, ...formData } : row) }
      })
      return { previousData }
    },
    onSuccess: () => { setEditingModule(null); setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal mengupdate modul module")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-modules"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingModule) return
      const { count: partCount, error: countError } = await supa
        .from("modul_module_parts").select("*", { count: "exact", head: true }).eq("module_id", deletingModule.id)
      if (countError) throw new Error("Gagal mengecek part terkait")
      if (partCount && partCount > 0) {
        throw new Error(`Tidak dapat menghapus modul ini karena masih ada ${partCount} part yang terkait.`)
      }
      const { error } = await supa.from("modul_modules").delete().eq("id", deletingModule.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-modules"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-modules"] })
      queryClient.setQueriesData({ queryKey: ["modul-modules"] }, (old: { rows: ModulModule[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.filter((row: ModulModule) => row.id !== deletingModule?.id), total: Math.max(0, old.total - 1) }
      })
      return { previousData }
    },
    onSuccess: () => { setDeletingModule(null) },
    onError: (error: Error, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      setBlockingAlert({ message: error.message })
      setDeletingModule(null)
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-modules"] }),
  })

  const handleAdd = () => addMutation.mutate()
  const handleEdit = () => editMutation.mutate()
  const handleDelete = () => deleteMutation.mutate()
  const handleDeleteClick = (module: ModulModule) => { setDeletingModule(module) }

  const openEditModal = (module: ModulModule) => {
    setEditingModule(module)
    setFormData({
      level_id: module.level_id, title: module.title, slug: module.slug,
      description: module.description || "", summary: module.summary || "",
      order_index: module.order_index, duration_minutes: module.duration_minutes,
      part_count: module.part_count, has_quiz: module.has_quiz, is_published: module.is_published
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
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul Modules</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola modul pembelajaran dan konten</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari modul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedLevelId || "all"} onValueChange={(value) => setSelectedLevelId(value === "all" ? null : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Level</SelectItem>
              {levels.map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.code} - {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { 
          setShowAddModal(true) 
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Modul
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Parts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul module
                  </TableCell>
                </TableRow>
              ) : (
                modules.map((module: ModulModule) => {
                  const level = levels.find((l: ModulModule) => l.id === module.level_id)
                  return (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">{module.title}</TableCell>
                      <TableCell className="font-mono text-sm">{module.slug}</TableCell>
                      <TableCell>
                        {level ? (
                          <Badge variant="outline">{level.code}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{module.duration_minutes} min</TableCell>
                      <TableCell>{module.part_count}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {module.is_published ? (
                            <Badge className="bg-green-500">Published</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                          {module.has_quiz && (
                            <Badge variant="outline">Quiz</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(module)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(module)} className="text-destructive">
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
                <CardTitle>{editingModule ? "Edit Modul Module" : "Tambah Modul Module"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Level</label>
                <Select 
                  value={formData.level_id || ""} 
                  onValueChange={(value) => setFormData({ ...formData, level_id: value })}
                  disabled={levels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={levels.length === 0 ? "Tidak ada level tersedia" : "Pilih level"} />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {levels.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        Tidak ada level tersedia. Buat level terlebih dahulu.
                      </div>
                    ) : (
                      levels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {level.code} - {level.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {levels.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Buat level di <span className="font-mono">Modul Levels</span> terlebih dahulu
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Judul modul..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="URL-friendly slug..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi modul..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Summary</label>
                <Input
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Ringkasan modul..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10)
                      setFormData({ ...formData, duration_minutes: Number.isNaN(parsed) ? 0 : parsed })
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Part Count</label>
                  <Input
                    type="number"
                    value={formData.part_count}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10)
                      setFormData({ ...formData, part_count: Number.isNaN(parsed) ? 0 : parsed })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={formData.is_published ? "published" : "draft"} onValueChange={(value) => setFormData({ ...formData, is_published: value === "published" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="has_quiz"
                  checked={formData.has_quiz}
                  onChange={(e) => setFormData({ ...formData, has_quiz: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="has_quiz" className="text-sm font-medium">Has Quiz</label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingModule ? handleEdit : handleAdd} className="flex-1">
                  {editingModule ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingModule(null); setFormData({ level_id: "", title: "", slug: "", description: "", summary: "", order_index: 0, duration_minutes: 0, part_count: 0, has_quiz: false, is_published: true }) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingModule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Modul Module</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Kamu yakin ingin menghapus modul ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Title: {deletingModule.title}</p>
                  <p className="text-sm">Slug: {deletingModule.slug}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingModule(null)}>
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