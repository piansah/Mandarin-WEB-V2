"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Edit, Trash2, Search, Layers } from "lucide-react"
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

interface WordCompound {
  id: number
  hanzi: string
  pinyin: string
  arti: string | null
  badge: string
  frequency: number
}

export default function WordCompoundsPage() {
  const router = useRouter()
  const [compounds, setCompounds] = React.useState<WordCompound[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingCompound, setEditingCompound] = React.useState<WordCompound | null>(null)
  const [formData, setFormData] = React.useState({
    hanzi: "",
    pinyin: "",
    arti: "",
    badge: "native",
    frequency: 1
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  const supa = createClient()

  React.useEffect(() => {
    fetchWordCompounds()
  }, [])

  const fetchWordCompounds = async () => {
    try {
      const { data, error } = await supa
        .from("word_compounds")
        .select("*")
        .order("frequency", { ascending: false })

      if (error) throw error
      setCompounds(data || [])
    } catch (error) {
      console.error("Error fetching word compounds:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const { error } = await supa
        .from("word_compounds")
        .insert({
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          arti: formData.arti || null,
          badge: formData.badge,
          frequency: formData.frequency
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ hanzi: "", pinyin: "", arti: "", badge: "native", frequency: 1 })
      fetchWordCompounds()
    } catch (error) {
      console.error("Error adding word compound:", error)
      alert("Gagal menambahkan word compound")
    }
  }

  const handleEdit = async () => {
    if (!editingCompound) return

    try {
      const { error } = await supa
        .from("word_compounds")
        .update({
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          arti: formData.arti || null,
          badge: formData.badge,
          frequency: formData.frequency
        })
        .eq("id", editingCompound.id)

      if (error) throw error

      setEditingCompound(null)
      setFormData({ hanzi: "", pinyin: "", arti: "", badge: "native", frequency: 1 })
      fetchWordCompounds()
    } catch (error) {
      console.error("Error updating word compound:", error)
      alert("Gagal mengupdate word compound")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus word compound ini?")) return

    try {
      const { error } = await supa
        .from("word_compounds")
        .delete()
        .eq("id", id)

      if (error) throw error
      fetchWordCompounds()
    } catch (error) {
      console.error("Error deleting word compound:", error)
      alert("Gagal menghapus word compound")
    }
  }

  const openEditModal = (compound: WordCompound) => {
    setEditingCompound(compound)
    setFormData({
      hanzi: compound.hanzi,
      pinyin: compound.pinyin,
      arti: compound.arti || "",
      badge: compound.badge,
      frequency: compound.frequency
    })
  }

  const openAddModal = () => {
    setEditingCompound(null)
    setFormData({ hanzi: "", pinyin: "", arti: "", badge: "native", frequency: 1 })
    setShowAddModal(true)
  }

  const filteredCompounds = compounds.filter(compound => 
    compound.hanzi.toLowerCase().includes(searchQuery.toLowerCase()) ||
    compound.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (compound.arti && compound.arti.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredCompounds.length / rowsPerPage)
  const paginatedCompounds = filteredCompounds.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Word Compounds</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola kata majemuk dan komposisi</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari kata majemuk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Compound
        </Button>
      </div>

      {/* Word Compounds Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredCompounds.length === 0 ? (
        <Card className="border-muted/50">
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada word compound ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Hanzi</TableHead>
                  <TableHead>Pinyin</TableHead>
                  <TableHead>Arti</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCompounds.map((compound) => (
                  <TableRow key={compound.id}>
                    <TableCell className="font-medium">{compound.id}</TableCell>
                    <TableCell className="font-medium">{compound.hanzi}</TableCell>
                    <TableCell>{compound.pinyin}</TableCell>
                    <TableCell>{compound.arti || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={compound.badge === "common" ? "default" : "secondary"}>
                        {compound.badge}
                      </Badge>
                    </TableCell>
                    <TableCell>{compound.frequency}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(compound)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(compound.id)}>
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
                totalRows={filteredCompounds.length}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingCompound) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingCompound ? "Edit Word Compound" : "Tambah Word Compound"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Hanzi</label>
                <Input
                  value={formData.hanzi}
                  onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                  placeholder="你好"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pinyin</label>
                <Input
                  value={formData.pinyin}
                  onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                  placeholder="nǐ hǎo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Arti</label>
                <Input
                  value={formData.arti}
                  onChange={(e) => setFormData({ ...formData, arti: e.target.value })}
                  placeholder="Halo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Badge</label>
                <select
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="native">Native</option>
                  <option value="common">Common</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Frequency</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingCompound ? handleEdit : handleAdd} className="flex-1">
                  {editingCompound ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingCompound(null) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
