"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, BookOpen } from "lucide-react"
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

interface FlashcardSet {
  id: number
  day_number: number
  title: string
  is_default: boolean
  description: string | null
  hsk_level: number
  badge: string
  sort_order: number
  created_at: string
}

export default function FlashcardSetsPage() {
  const [sets, setSets] = React.useState<FlashcardSet[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingSet, setEditingSet] = React.useState<FlashcardSet | null>(null)
  const [deletingSet, setDeletingSet] = React.useState<FlashcardSet | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState({
    day_number: 1,
    title: "",
    description: "",
    hsk_level: 1,
    badge: "",
    sort_order: 0
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchFlashcardSets()
  }, [currentPage, rowsPerPage])

  const fetchFlashcardSets = async () => {
    try {
      // Dapatkan total count dulu
      const { count: totalCount, error: countError } = await supa
        .from("flashcard_sets")
        .select("*", { count: "exact", head: true })

      if (countError) throw countError

      setTotalRows(totalCount || 0)

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      const { data, error } = await supa
        .from("flashcard_sets")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(from, to)

      if (error) throw error

      console.log("Flashcard Sets fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setSets(data || [])
    } catch (error) {
      console.error("Error fetching flashcard sets:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      console.log("Adding flashcard set:", formData)
      const { error } = await supa
        .from("flashcard_sets")
        .insert({
          day_number: formData.day_number,
          title: formData.title,
          description: formData.description,
          hsk_level: formData.hsk_level,
          badge: formData.badge,
          sort_order: formData.sort_order,
          is_default: true
        })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setShowAddModal(false)
      setFormData({ day_number: 1, title: "", description: "", hsk_level: 1, badge: "", sort_order: 0 })
      fetchFlashcardSets()
    } catch (error) {
      console.error("Error adding flashcard set:", error)
      alert(`Gagal menambahkan flashcard set: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleEdit = async () => {
    if (!editingSet) return

    try {
      const { error } = await supa
        .from("flashcard_sets")
        .update({
          day_number: formData.day_number,
          title: formData.title,
          description: formData.description,
          hsk_level: formData.hsk_level,
          badge: formData.badge,
          sort_order: formData.sort_order
        })
        .eq("id", editingSet.id)

      if (error) throw error

      setEditingSet(null)
      setFormData({ day_number: 1, title: "", description: "", hsk_level: 1, badge: "", sort_order: 0 })
      fetchFlashcardSets()
    } catch (error) {
      console.error("Error updating flashcard set:", error)
      alert("Gagal mengupdate flashcard set")
    }
  }

  const handleDeleteClick = (set: FlashcardSet) => {
    setDeletingSet(set)
  }

  const handleDelete = async () => {
    if (!deletingSet) return

    try {
      console.log("Deleting flashcard set:", deletingSet.id)
      
      // Cek apakah ada cards yang terkait dengan set ini
      const { count: cardCount, error: countError } = await supa
        .from("flashcard_cards")
        .select("*", { count: "exact", head: true })
        .eq("set_id", deletingSet.id)

      console.log("Card count check:", { cardCount, error: countError })

      if (countError) {
        console.error("Error checking card count:", countError)
        setBlockingAlert({ message: "Gagal mengecek kartu terkait" })
        setDeletingSet(null)
        return
      }

      if (cardCount && cardCount > 0) {
        console.log("Blocking delete due to related cards:", cardCount)
        setBlockingAlert({ 
          message: `Tidak dapat menghapus set ini karena masih ada ${cardCount} kartu yang terkait. Pindahkan atau hapus kartu terlebih dahulu.` 
        })
        setDeletingSet(null)
        return
      }

      console.log("Proceeding with delete, no related cards found")
      const { error } = await supa
        .from("flashcard_sets")
        .delete()
        .eq("id", deletingSet.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      setDeletingSet(null)
      fetchFlashcardSets()
    } catch (error) {
      console.error("Error deleting flashcard set:", error)
      setBlockingAlert({ 
        message: `Gagal menghapus flashcard set: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      setDeletingSet(null)
    }
  }

  const openEditModal = (set: FlashcardSet) => {
    setEditingSet(set)
    setFormData({
      day_number: set.day_number,
      title: set.title,
      description: set.description || "",
      hsk_level: set.hsk_level,
      badge: set.badge,
      sort_order: set.sort_order
    })
  }

  const openAddModal = () => {
    setEditingSet(null)
    setFormData({ day_number: 1, title: "", description: "", hsk_level: 1, badge: "", sort_order: 0 })
    setShowAddModal(true)
  }

  const filteredSets = sets.filter(set => 
    set.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (set.description && set.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Pagination logic (server-side)
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  
  // Reset to page 1 when search or rowsPerPage changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, rowsPerPage])
  
  // Re-fetch data when page changes
  React.useEffect(() => {
    fetchFlashcardSets()
  }, [currentPage, rowsPerPage])

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Flashcard Sets</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola deck flashcard dan vocabulary</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari flashcard set..."
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

      {/* Flashcard Sets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredSets.length === 0 ? (
        <Card className="border-muted/50">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada flashcard set ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>HSK Level</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSets.map((set) => (
                  <TableRow key={set.id}>
                    <TableCell className="font-medium">{set.id}</TableCell>
                    <TableCell>{set.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Day {set.day_number}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">HSK {set.hsk_level}</Badge>
                    </TableCell>
                    <TableCell>
                      {set.badge && <Badge variant="default">{set.badge}</Badge>}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{set.description || "-"}</TableCell>
                    <TableCell>{set.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(set)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(set)}>
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
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{editingSet ? "Edit Flashcard Set" : "Tambah Flashcard Set"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Day Number</label>
                <Input
                  type="number"
                  value={formData.day_number}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, day_number: Number.isNaN(parsed) ? 0 : parsed })
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Day 1 - Basic Greetings"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi singkat..."
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
              <CardTitle className="text-destructive">Hapus Flashcard Set</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus flashcard set ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Title: {deletingSet.title}</p>
                  <p className="text-sm">Day: {deletingSet.day_number}</p>
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
