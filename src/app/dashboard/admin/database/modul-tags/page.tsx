"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, Search, Tag } from "lucide-react"
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

interface ModulTag {
  id: string
  name: string
}

export default function ModulTagsPage() {
  const [tags, setTags] = React.useState<ModulTag[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingTag, setEditingTag] = React.useState<ModulTag | null>(null)
  const [deletingTag, setDeletingTag] = React.useState<ModulTag | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState({
    name: ""
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchModulTags()
  }, [currentPage, rowsPerPage, searchQuery])

  const fetchModulTags = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("modul_tags")
        .select("*", { count: "exact", head: true })

      if (searchQuery) {
        countQuery = countQuery.ilike("name", `%${searchQuery}%`)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("modul_tags")
        .select("*")
        .order("name", { ascending: true })
        .range(from, to)

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Modul Tags fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setTags(data || [])
    } catch (error) {
      console.error("Error fetching modul tags:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding modul tag:", formData)
      const { error } = await supa
        .from("modul_tags")
        .insert({
          name: formData.name
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ name: "" })
      fetchModulTags()
    } catch (error) {
      console.error("Error adding modul tag:", error)
      alert("Gagal menambahkan modul tag")
    }
  }

  const handleEdit = async () => {
    if (!editingTag) return

    try {
      console.log("Updating modul tag:", formData)
      const { error } = await supa
        .from("modul_tags")
        .update({
          name: formData.name
        })
        .eq("id", editingTag.id)

      if (error) throw error

      setEditingTag(null)
      setShowAddModal(false)
      setFormData({ name: "" })
      fetchModulTags()
    } catch (error) {
      console.error("Error updating modul tag:", error)
      alert("Gagal mengupdate modul tag")
    }
  }

  const handleDeleteClick = (tag: ModulTag) => {
    setDeletingTag(tag)
  }

  const handleDelete = async () => {
    if (!deletingTag) return

    try {
      console.log("Deleting modul tag:", deletingTag.id)
      
      // Cek apakah ada modules yang terkait dengan tag ini
      const { count: moduleCount, error: countError } = await supa
        .from("modul_module_tags")
        .select("*", { count: "exact", head: true })
        .eq("tag_id", deletingTag.id)

      console.log("Module count check:", { moduleCount, error: countError })

      if (countError) {
        console.error("Error checking module count:", countError)
        setBlockingAlert({ message: "Gagal mengecek modul terkait" })
        setDeletingTag(null)
        return
      }

      if (moduleCount && moduleCount > 0) {
        console.log("Blocking delete due to related modules:", moduleCount)
        setBlockingAlert({ 
          message: `Tidak dapat menghapus tag ini karena masih ada ${moduleCount} modul yang terkait. Pindahkan atau hapus modul terlebih dahulu.` 
        })
        setDeletingTag(null)
        return
      }

      console.log("Proceeding with delete, no related modules found")
      const { error } = await supa
        .from("modul_tags")
        .delete()
        .eq("id", deletingTag.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingTag(null)
      fetchModulTags()
    } catch (error) {
      console.error("Error deleting modul tag:", error)
      setBlockingAlert({ 
        message: `Gagal menghapus modul tag: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      setDeletingTag(null)
    }
  }

  const openEditModal = (tag: ModulTag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name
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
            <Tag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul Tags</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola tags untuk kategorisasi modul</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Tag
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul tag
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(tag)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(tag)}>
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
              <CardTitle>{editingTag ? "Edit Modul Tag" : "Tambah Modul Tag"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama tag..."
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingTag ? handleEdit : handleAdd} className="flex-1">
                  {editingTag ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingTag(null); setFormData({ name: "" }) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Modul Tag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus tag ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Name: {deletingTag.name}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingTag(null)}>
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