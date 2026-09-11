"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, FileText, ExternalLink } from "lucide-react"
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

interface ModulModulePart {
  id: string
  module_id: string
  order_index: number
  title: string
  content: any
  part_type: string
  created_at: string
  updated_at: string
}

interface ModulModule {
  id: string
  title: string
  slug: string
}

export default function ModulModulePartsPage() {
  const [parts, setParts] = React.useState<ModulModulePart[]>([])
  const [modules, setModules] = React.useState<ModulModule[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingPart, setEditingPart] = React.useState<ModulModulePart | null>(null)
  const [deletingPart, setDeletingPart] = React.useState<ModulModulePart | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState({
    module_id: "",
    order_index: 0,
    title: "",
    content: "",
    part_type: "content"
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchModulModules()
    fetchModulModuleParts()
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

  const fetchModulModuleParts = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("modul_module_parts")
        .select("*", { count: "exact", head: true })

      if (selectedModuleId) {
        countQuery = countQuery.eq("module_id", selectedModuleId)
      }

      if (searchQuery) {
        countQuery = countQuery.or(`title.ilike.%${searchQuery}%,part_type.ilike.%${searchQuery}%`)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("modul_module_parts")
        .select("*")
        .order("order_index", { ascending: true })
        .range(from, to)

      if (selectedModuleId) {
        query = query.eq("module_id", selectedModuleId)
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,part_type.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Modul Module Parts fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setParts(data || [])
    } catch (error) {
      console.error("Error fetching modul module parts:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding modul module part:", formData)
      
      // Parse JSON content
      let parsedContent = null
      try {
        parsedContent = formData.content ? JSON.parse(formData.content) : null
      } catch (e) {
        alert("Invalid JSON format for content")
        return
      }

      const { error } = await supa
        .from("modul_module_parts")
        .insert({
          module_id: formData.module_id,
          order_index: formData.order_index,
          title: formData.title,
          content: parsedContent,
          part_type: formData.part_type
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        module_id: "",
        order_index: 0,
        title: "",
        content: "",
        part_type: "content"
      })
      fetchModulModuleParts()
    } catch (error) {
      console.error("Error adding modul module part:", error)
      alert("Gagal menambahkan modul module part")
    }
  }

  const handleEdit = async () => {
    if (!editingPart) return

    try {
      console.log("Updating modul module part:", formData)
      
      // Parse JSON content
      let parsedContent = null
      try {
        parsedContent = formData.content ? JSON.parse(formData.content) : null
      } catch (e) {
        alert("Invalid JSON format for content")
        return
      }

      const { error } = await supa
        .from("modul_module_parts")
        .update({
          module_id: formData.module_id,
          order_index: formData.order_index,
          title: formData.title,
          content: parsedContent,
          part_type: formData.part_type
        })
        .eq("id", editingPart.id)

      if (error) throw error

      setEditingPart(null)
      setShowAddModal(false)
      setFormData({
        module_id: "",
        order_index: 0,
        title: "",
        content: "",
        part_type: "content"
      })
      fetchModulModuleParts()
    } catch (error) {
      console.error("Error updating modul module part:", error)
      alert("Gagal mengupdate modul module part")
    }
  }

  const handleDeleteClick = (part: ModulModulePart) => {
    setDeletingPart(part)
  }

  const handleDelete = async () => {
    if (!deletingPart) return

    try {
      console.log("Deleting modul module part:", deletingPart.id)
      
      // Cek apakah ada vocab cards yang terkait dengan part ini
      const { count: vocabCount, error: countError } = await supa
        .from("modul_vocab_cards")
        .select("*", { count: "exact", head: true })
        .eq("module_part_id", deletingPart.id)

      console.log("Vocab count check:", { vocabCount, error: countError })

      if (countError) {
        console.error("Error checking vocab count:", countError)
        setBlockingAlert({ message: "Gagal mengecek vocab terkait" })
        setDeletingPart(null)
        return
      }

      if (vocabCount && vocabCount > 0) {
        console.log("Blocking delete due to related vocab:", vocabCount)
        setBlockingAlert({ 
          message: `Tidak dapat menghapus part ini karena masih ada ${vocabCount} vocab cards yang terkait. Pindahkan atau hapus vocab terlebih dahulu.` 
        })
        setDeletingPart(null)
        return
      }

      console.log("Proceeding with delete, no related vocab found")
      const { error } = await supa
        .from("modul_module_parts")
        .delete()
        .eq("id", deletingPart.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingPart(null)
      fetchModulModuleParts()
    } catch (error) {
      console.error("Error deleting modul module part:", error)
      setBlockingAlert({ 
        message: `Gagal menghapus modul module part: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      setDeletingPart(null)
    }
  }

  const openEditModal = (part: ModulModulePart) => {
    setEditingPart(part)
    setFormData({
      module_id: part.module_id,
      order_index: part.order_index,
      title: part.title,
      content: part.content ? JSON.stringify(part.content, null, 2) : "",
      part_type: part.part_type
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
            <h1 className="text-2xl font-bold tracking-tight">Modul Module Parts</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola bagian modul (content/practice/quiz)</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari part..."
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
          Tambah Part
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
                <TableHead>Type</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Content</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul module part
                  </TableCell>
                </TableRow>
              ) : (
                parts.map((part) => {
                  const module = modules.find(m => m.id === part.module_id)
                  return (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">{part.title}</TableCell>
                      <TableCell>
                        {module ? (
                          <span className="text-sm">{module.title}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          part.part_type === "content" ? "default" :
                          part.part_type === "practice" ? "secondary" :
                          "outline"
                        }>
                          {part.part_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{part.order_index}</TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {part.content ? JSON.stringify(part.content).substring(0, 50) + "..." : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(part)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(part)}>
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
              <CardTitle>{editingPart ? "Edit Modul Module Part" : "Tambah Modul Module Part"}</CardTitle>
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
                  placeholder="Judul part..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Part Type</label>
                <Select value={formData.part_type} onValueChange={(value) => setFormData({ ...formData, part_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="content">Content</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Content (JSON)</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder='{"type": "text", "content": "..."}'
                  className="font-mono text-sm min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Format JSON untuk content modul. Contoh: {`{"type": "text", "content": "..."}`}
                </p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingPart ? handleEdit : handleAdd} className="flex-1">
                  {editingPart ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingPart(null); setFormData({ module_id: "", order_index: 0, title: "", content: "", part_type: "content" }) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingPart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Modul Module Part</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus part ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Title: {deletingPart.title}</p>
                  <p className="text-sm">Type: {deletingPart.part_type}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingPart(null)}>
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