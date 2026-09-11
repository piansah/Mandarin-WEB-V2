"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Edit, Trash2, Search, Flag } from "lucide-react"
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

interface HanziSet {
  id: number
  key: string
  title: string
  sub: string
  description: string | null
  badge: string
  hsk_level: number
  sort_order: number
  unlock_after: number
  created_at: string
  updated_at: string
}

export default function HanziSetsPage() {
  const router = useRouter()
  const [sets, setSets] = React.useState<HanziSet[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingSet, setEditingSet] = React.useState<HanziSet | null>(null)
  const [deletingSet, setDeletingSet] = React.useState<HanziSet | null>(null)
  const [formData, setFormData] = React.useState({
    key: "",
    title: "",
    sub: "",
    description: "",
    badge: "",
    hsk_level: 1,
    sort_order: 0,
    unlock_after: 0
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchHanziSets()
  }, [])

  const fetchHanziSets = async () => {
    try {
      // Dapatkan total count dulu
      const { count: totalCount, error: countError } = await supa
        .from("hanzi_sets")
        .select("*", { count: "exact", head: true })

      if (countError) throw countError

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      const { data, error } = await supa
        .from("hanzi_sets")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(from, to)

      if (error) throw error

      console.log("Hanzi Sets fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setSets(data || [])
      setTotalRows(totalCount || 0)
    } catch (error) {
      console.error("Error fetching hanzi sets:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const { error } = await supa
        .from("hanzi_sets")
        .insert({
          key: formData.key,
          title: formData.title,
          sub: formData.sub,
          description: formData.description || null,
          badge: formData.badge,
          hsk_level: formData.hsk_level,
          sort_order: formData.sort_order,
          unlock_after: formData.unlock_after
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ key: "", title: "", sub: "", description: "", badge: "", hsk_level: 1, sort_order: 0, unlock_after: 0 })
      fetchHanziSets()
    } catch (error) {
      console.error("Error adding hanzi set:", error)
      alert("Gagal menambahkan hanzi set")
    }
  }

  const handleEdit = async () => {
    if (!editingSet) return

    try {
      const { error } = await supa
        .from("hanzi_sets")
        .update({
          key: formData.key,
          title: formData.title,
          sub: formData.sub,
          description: formData.description || null,
          badge: formData.badge,
          hsk_level: formData.hsk_level,
          sort_order: formData.sort_order,
          unlock_after: formData.unlock_after
        })
        .eq("id", editingSet.id)

      if (error) throw error

      setEditingSet(null)
      setFormData({ key: "", title: "", sub: "", description: "", badge: "", hsk_level: 1, sort_order: 0, unlock_after: 0 })
      fetchHanziSets()
    } catch (error) {
      console.error("Error updating hanzi set:", error)
      alert("Gagal mengupdate hanzi set")
    }
  }

  const handleDelete = async () => {
    if (!deletingSet) return

    try {
      console.log("Deleting hanzi set:", deletingSet.id)
      
      // Cek apakah ada items yang terkait dengan set ini
      const { count: itemCount, error: countError } = await supa
        .from("hanzi_items")
        .select("*", { count: "exact", head: true })
        .eq("hanzi_key", deletingSet.key)

      if (countError) {
        console.error("Error checking item count:", countError)
      }

      if (itemCount && itemCount > 0) {
        alert(`Tidak dapat menghapus set ini karena masih ada ${itemCount} item yang terkait. Pindahkan atau hapus item terlebih dahulu.`)
        setDeletingSet(null)
        return
      }

      const { error } = await supa
        .from("hanzi_sets")
        .delete()
        .eq("id", deletingSet.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingSet(null)
      fetchHanziSets()
    } catch (error) {
      console.error("Error deleting hanzi set:", error)
      alert(`Gagal menghapus hanzi set: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const openEditModal = (set: HanziSet) => {
    setEditingSet(set)
    setFormData({
      key: set.key,
      title: set.title,
      sub: set.sub,
      description: set.description || "",
      badge: set.badge,
      hsk_level: set.hsk_level,
      sort_order: set.sort_order,
      unlock_after: set.unlock_after
    })
  }

  const openAddModal = () => {
    setEditingSet(null)
    setFormData({ key: "", title: "", sub: "", description: "", badge: "", hsk_level: 1, sort_order: 0, unlock_after: 0 })
    setShowAddModal(true)
  }

  const filteredSets = sets.filter(set => 
    set.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.sub.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination logic (server-side)
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  
  // Reset to page 1 when search or rowsPerPage changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, rowsPerPage])
  
  // Re-fetch data when page changes
  React.useEffect(() => {
    fetchHanziSets()
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
            <Flag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Hanzi Sets</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola deck estafet dan kalimat relay</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari hanzi set..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Set
        </Button>
      </div>

      {/* Hanzi Sets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredSets.length === 0 ? (
        <Card className="border-muted/50">
          <CardContent className="py-12 text-center">
            <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada hanzi set ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Sub</TableHead>
                  <TableHead>HSK Level</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Unlock After</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSets.map((set) => (
                  <TableRow key={set.id}>
                    <TableCell className="font-medium">{set.id}</TableCell>
                    <TableCell className="font-mono text-xs">{set.key}</TableCell>
                    <TableCell>{set.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{set.sub}</TableCell>
                    <TableCell>
                      <Badge variant="outline">HSK {set.hsk_level}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{set.badge}</Badge>
                    </TableCell>
                    <TableCell>{set.unlock_after}</TableCell>
                    <TableCell>{set.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(set)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingSet(set)}>
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
      {(showAddModal || editingSet) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingSet ? "Edit Hanzi Set" : "Tambah Hanzi Set"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Key</label>
                <Input
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="Contoh: hsk1-basics"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: HSK 1 Basics"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sub</label>
                <Input
                  value={formData.sub}
                  onChange={(e) => setFormData({ ...formData, sub: e.target.value })}
                  placeholder="Deskripsi singkat..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi lengkap..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">HSK Level</label>
                <Input
                  type="number"
                  min="1"
                  max="6"
                  value={formData.hsk_level}
                  onChange={(e) => {
                    // Guard NaN: field yang dikosongkan (mis. select-all lalu
                    // ketik ulang) bikin e.target.value jadi "", dan
                    // parseInt("") = NaN akan bikin React error "Received NaN
                    // for the `value` attribute" karena input ini controlled.
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, hsk_level: Number.isNaN(parsed) ? 0 : parsed })
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Badge</label>
                <Input
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  placeholder="Contoh: Beginner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unlock After</label>
                <Input
                  type="number"
                  value={formData.unlock_after}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, unlock_after: Number.isNaN(parsed) ? 0 : parsed })
                  }}
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
                <Button onClick={editingSet ? handleEdit : handleAdd} className="flex-1">
                  {editingSet ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingSet(null) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingSet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Hanzi Set</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus hanzi set ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Title: {deletingSet.title}</p>
                  <p className="text-sm">Key: {deletingSet.key}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingSet(null)}>
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
