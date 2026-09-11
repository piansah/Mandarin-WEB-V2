"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, Search, Layers } from "lucide-react"
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

interface ModulLevel {
  id: string
  code: string
  label: string
  description: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export default function ModulLevelsPage() {
  const [levels, setLevels] = React.useState<ModulLevel[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingLevel, setEditingLevel] = React.useState<ModulLevel | null>(null)
  const [deletingLevel, setDeletingLevel] = React.useState<ModulLevel | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState({
    code: "",
    label: "",
    description: "",
    order_index: 0
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchModulLevels()
  }, [currentPage, rowsPerPage])

  const fetchModulLevels = async () => {
    try {
      // Dapatkan total count dulu
      const { count: totalCount, error: countError } = await supa
        .from("modul_levels")
        .select("*", { count: "exact", head: true })

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      const { data, error } = await supa
        .from("modul_levels")
        .select("*")
        .order("order_index", { ascending: true })
        .range(from, to)

      if (error) throw error

      console.log("Modul Levels fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setLevels(data || [])
    } catch (error) {
      console.error("Error fetching modul levels:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding modul level:", formData)
      const { error } = await supa
        .from("modul_levels")
        .insert({
          code: formData.code,
          label: formData.label,
          description: formData.description || null,
          order_index: formData.order_index
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ code: "", label: "", description: "", order_index: 0 })
      fetchModulLevels()
    } catch (error) {
      console.error("Error adding modul level:", error)
      alert("Gagal menambahkan modul level")
    }
  }

  const handleEdit = async () => {
    if (!editingLevel) return

    try {
      console.log("Updating modul level:", formData)
      const { error } = await supa
        .from("modul_levels")
        .update({
          code: formData.code,
          label: formData.label,
          description: formData.description || null,
          order_index: formData.order_index
        })
        .eq("id", editingLevel.id)

      if (error) throw error

      setEditingLevel(null)
      setShowAddModal(false)
      setFormData({ code: "", label: "", description: "", order_index: 0 })
      fetchModulLevels()
    } catch (error) {
      console.error("Error updating modul level:", error)
      alert("Gagal mengupdate modul level")
    }
  }

  const handleDeleteClick = (level: ModulLevel) => {
    setDeletingLevel(level)
  }

  const handleDelete = async () => {
    if (!deletingLevel) return

    try {
      console.log("Deleting modul level:", deletingLevel.id)
      
      // Cek apakah ada modules yang terkait dengan level ini
      const { count: moduleCount, error: countError } = await supa
        .from("modul_modules")
        .select("*", { count: "exact", head: true })
        .eq("level_id", deletingLevel.id)

      console.log("Module count check:", { moduleCount, error: countError })

      if (countError) {
        console.error("Error checking module count:", countError)
        setBlockingAlert({ message: "Gagal mengecek modul terkait" })
        setDeletingLevel(null)
        return
      }

      if (moduleCount && moduleCount > 0) {
        console.log("Blocking delete due to related modules:", moduleCount)
        setBlockingAlert({ 
          message: `Tidak dapat menghapus level ini karena masih ada ${moduleCount} modul yang terkait. Pindahkan atau hapus modul terlebih dahulu.` 
        })
        setDeletingLevel(null)
        return
      }

      console.log("Proceeding with delete, no related modules found")
      const { error } = await supa
        .from("modul_levels")
        .delete()
        .eq("id", deletingLevel.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingLevel(null)
      fetchModulLevels()
    } catch (error) {
      console.error("Error deleting modul level:", error)
      setBlockingAlert({ 
        message: `Gagal menghapus modul level: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      setDeletingLevel(null)
    }
  }

  const openEditModal = (level: ModulLevel) => {
    setEditingLevel(level)
    setFormData({
      code: level.code,
      label: level.label,
      description: level.description || "",
      order_index: level.order_index
    })
    setShowAddModal(true)
  }

  const filteredLevels = levels.filter(level => 
    level.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    level.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (level.description && level.description.toLowerCase().includes(searchQuery.toLowerCase()))
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
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul Levels</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola level HSK dan kategori modul</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari level..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Level
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLevels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul level
                  </TableCell>
                </TableRow>
              ) : (
                filteredLevels.map((level) => (
                  <TableRow key={level.id}>
                    <TableCell className="font-medium">{level.code}</TableCell>
                    <TableCell>{level.label}</TableCell>
                    <TableCell className="max-w-xs truncate">{level.description || "-"}</TableCell>
                    <TableCell>{level.order_index}</TableCell>
                    <TableCell>{new Date(level.created_at).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(level)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(level)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
              <CardTitle>{editingLevel ? "Edit Modul Level" : "Tambah Modul Level"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Contoh: HSK1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Contoh: HSK Level 1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi level..."
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
                <Button onClick={editingLevel ? handleEdit : handleAdd} className="flex-1">
                  {editingLevel ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingLevel(null); setFormData({ code: "", label: "", description: "", order_index: 0 }) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingLevel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Modul Level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus modul level ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Code: {deletingLevel.code}</p>
                  <p className="text-sm">Label: {deletingLevel.label}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingLevel(null)}>
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