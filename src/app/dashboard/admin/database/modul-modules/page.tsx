"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, BookOpen, ExternalLink } from "lucide-react"
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
  const [modules, setModules] = React.useState<ModulModule[]>([])
  const [levels, setLevels] = React.useState<ModulLevel[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedLevelId, setSelectedLevelId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingModule, setEditingModule] = React.useState<ModulModule | null>(null)
  const [deletingModule, setDeletingModule] = React.useState<ModulModule | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState({
    level_id: "",
    title: "",
    slug: "",
    description: "",
    summary: "",
    order_index: 0,
    duration_minutes: 0,
    part_count: 0,
    has_quiz: false,
    is_published: true
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchModulLevels()
    fetchModulModules()
  }, [selectedLevelId, currentPage, rowsPerPage])

  // Refresh levels when modal opens
  React.useEffect(() => {
    if (showAddModal) {
      fetchModulLevels()
    }
  }, [showAddModal])

  const fetchModulLevels = async () => {
    try {
      const { data, error } = await supa
        .from("modul_levels")
        .select("id, code, label")
        .order("order_index", { ascending: true })

      if (error) throw error
      setLevels(data || [])
      console.log("Levels fetched:", data)
    } catch (error) {
      console.error("Error fetching modul levels:", error)
    }
  }

  const fetchModulModules = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("modul_modules")
        .select("*", { count: "exact", head: true })

      if (selectedLevelId) {
        countQuery = countQuery.eq("level_id", selectedLevelId)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("modul_modules")
        .select("*")
        .order("order_index", { ascending: true })
        .range(from, to)

      if (selectedLevelId) {
        query = query.eq("level_id", selectedLevelId)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Modul Modules fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setModules(data || [])
    } catch (error) {
      console.error("Error fetching modul modules:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding modul module:", formData)
      const { error } = await supa
        .from("modul_modules")
        .insert({
          level_id: formData.level_id,
          title: formData.title,
          slug: formData.slug,
          description: formData.description || null,
          summary: formData.summary || null,
          order_index: formData.order_index,
          duration_minutes: formData.duration_minutes,
          part_count: formData.part_count,
          has_quiz: formData.has_quiz,
          is_published: formData.is_published
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        level_id: "",
        title: "",
        slug: "",
        description: "",
        summary: "",
        order_index: 0,
        duration_minutes: 0,
        part_count: 0,
        has_quiz: false,
        is_published: true
      })
      fetchModulModules()
    } catch (error) {
      console.error("Error adding modul module:", error)
      alert("Gagal menambahkan modul module")
    }
  }

  const handleEdit = async () => {
    if (!editingModule) return

    try {
      console.log("Updating modul module:", formData)
      const { error } = await supa
        .from("modul_modules")
        .update({
          level_id: formData.level_id,
          title: formData.title,
          slug: formData.slug,
          description: formData.description || null,
          summary: formData.summary || null,
          order_index: formData.order_index,
          duration_minutes: formData.duration_minutes,
          part_count: formData.part_count,
          has_quiz: formData.has_quiz,
          is_published: formData.is_published
        })
        .eq("id", editingModule.id)

      if (error) throw error

      setEditingModule(null)
      setShowAddModal(false)
      setFormData({
        level_id: "",
        title: "",
        slug: "",
        description: "",
        summary: "",
        order_index: 0,
        duration_minutes: 0,
        part_count: 0,
        has_quiz: false,
        is_published: true
      })
      fetchModulModules()
    } catch (error) {
      console.error("Error updating modul module:", error)
      alert("Gagal mengupdate modul module")
    }
  }

  const handleDeleteClick = (module: ModulModule) => {
    setDeletingModule(module)
  }

  const handleDelete = async () => {
    if (!deletingModule) return

    try {
      console.log("Deleting modul module:", deletingModule.id)
      
      // Cek apakah ada parts yang terkait dengan module ini
      const { count: partCount, error: countError } = await supa
        .from("modul_module_parts")
        .select("*", { count: "exact", head: true })
        .eq("module_id", deletingModule.id)

      console.log("Part count check:", { partCount, error: countError })

      if (countError) {
        console.error("Error checking part count:", countError)
        setBlockingAlert({ message: "Gagal mengecek part terkait" })
        setDeletingModule(null)
        return
      }

      if (partCount && partCount > 0) {
        console.log("Blocking delete due to related parts:", partCount)
        setBlockingAlert({ 
          message: `Tidak dapat menghapus modul ini karena masih ada ${partCount} part yang terkait. Pindahkan atau hapus part terlebih dahulu.` 
        })
        setDeletingModule(null)
        return
      }

      console.log("Proceeding with delete, no related parts found")
      const { error } = await supa
        .from("modul_modules")
        .delete()
        .eq("id", deletingModule.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingModule(null)
      fetchModulModules()
    } catch (error) {
      console.error("Error deleting modul module:", error)
      setBlockingAlert({ 
        message: `Gagal menghapus modul module: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      setDeletingModule(null)
    }
  }

  const openEditModal = async (module: ModulModule) => {
    // Refresh levels sebelum membuka modal
    await fetchModulLevels()
    setEditingModule(module)
    setFormData({
      level_id: module.level_id,
      title: module.title,
      slug: module.slug,
      description: module.description || "",
      summary: module.summary || "",
      order_index: module.order_index,
      duration_minutes: module.duration_minutes,
      part_count: module.part_count,
      has_quiz: module.has_quiz,
      is_published: module.is_published
    })
    setShowAddModal(true)
  }

  const filteredModules = modules.filter(module => 
    module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (module.description && module.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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
        <Button onClick={async () => { 
          await fetchModulLevels(); 
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
              {filteredModules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul module
                  </TableCell>
                </TableRow>
              ) : (
                filteredModules.map((module) => {
                  const level = levels.find(l => l.id === module.level_id)
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
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(module)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(module)}>
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
                  Apakah Anda yakin ingin menghapus modul ini?
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