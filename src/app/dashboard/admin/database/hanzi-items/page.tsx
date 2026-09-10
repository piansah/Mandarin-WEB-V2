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

interface HanziItem {
  id: number
  hanzi_key: string
  section_label: string
  section_tag: string
  sort_order: number
  hanzi: string
  pinyin: string
  arti: string
  user_contribution: boolean
}

interface HanziSet {
  id: number
  key: string
  title: string
}

export default function HanziItemsPage() {
  const router = useRouter()
  const [items, setItems] = React.useState<HanziItem[]>([])
  const [sets, setSets] = React.useState<HanziSet[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedHanziKey, setSelectedHanziKey] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<HanziItem | null>(null)
  const [formData, setFormData] = React.useState({
    hanzi_key: "",
    section_label: "",
    section_tag: "",
    sort_order: 0,
    hanzi: "",
    pinyin: "",
    arti: "",
    user_contribution: false
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchHanziSets()
    fetchHanziItems()
  }, [selectedHanziKey])

  const fetchHanziSets = async () => {
    try {
      const { data, error } = await supa
        .from("hanzi_sets")
        .select("id, key, title")
        .order("sort_order", { ascending: true })

      if (error) throw error
      setSets(data || [])
    } catch (error) {
      console.error("Error fetching hanzi sets:", error)
    }
  }

  const fetchHanziItems = async () => {
    try {
      // Dapatkan total count dulu
      let countQuery = supa
        .from("hanzi_items")
        .select("*", { count: "exact", head: true })

      if (selectedHanziKey) {
        countQuery = countQuery.eq("hanzi_key", selectedHanziKey)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) throw countError

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      let query = supa
        .from("hanzi_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(from, to)

      if (selectedHanziKey) {
        query = query.eq("hanzi_key", selectedHanziKey)
      }

      const { data, error } = await query

      if (error) throw error

      console.log("Hanzi Items fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`,
        selectedHanziKey
      })
      
      setItems(data || [])
      setTotalRows(totalCount || 0)
    } catch (error) {
      console.error("Error fetching hanzi items:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const { error } = await supa
        .from("hanzi_items")
        .insert({
          hanzi_key: formData.hanzi_key,
          section_label: formData.section_label,
          section_tag: formData.section_tag,
          sort_order: formData.sort_order,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          arti: formData.arti,
          user_contribution: formData.user_contribution
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ hanzi_key: "", section_label: "", section_tag: "", sort_order: 0, hanzi: "", pinyin: "", arti: "", user_contribution: false })
      fetchHanziItems()
    } catch (error) {
      console.error("Error adding hanzi item:", error)
      alert("Gagal menambahkan hanzi item")
    }
  }

  const handleEdit = async () => {
    if (!editingItem) return

    try {
      const { error } = await supa
        .from("hanzi_items")
        .update({
          hanzi_key: formData.hanzi_key,
          section_label: formData.section_label,
          section_tag: formData.section_tag,
          sort_order: formData.sort_order,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin,
          arti: formData.arti,
          user_contribution: formData.user_contribution
        })
        .eq("id", editingItem.id)

      if (error) throw error

      setEditingItem(null)
      setFormData({ hanzi_key: "", section_label: "", section_tag: "", sort_order: 0, hanzi: "", pinyin: "", arti: "", user_contribution: false })
      fetchHanziItems()
    } catch (error) {
      console.error("Error updating hanzi item:", error)
      alert("Gagal mengupdate hanzi item")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus hanzi item ini?")) return

    try {
      const { error } = await supa
        .from("hanzi_items")
        .delete()
        .eq("id", id)

      if (error) throw error
      fetchHanziItems()
    } catch (error) {
      console.error("Error deleting hanzi item:", error)
      alert("Gagal menghapus hanzi item")
    }
  }

  const openEditModal = (item: HanziItem) => {
    setEditingItem(item)
    setFormData({
      hanzi_key: item.hanzi_key,
      section_label: item.section_label,
      section_tag: item.section_tag,
      sort_order: item.sort_order,
      hanzi: item.hanzi,
      pinyin: item.pinyin,
      arti: item.arti,
      user_contribution: item.user_contribution
    })
  }

  const openAddModal = () => {
    setEditingItem(null)
    setFormData({ hanzi_key: selectedHanziKey || "", section_label: "", section_tag: "", sort_order: 0, hanzi: "", pinyin: "", arti: "", user_contribution: false })
    setShowAddModal(true)
  }

  const filteredItems = items.filter(item => 
    item.hanzi.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.arti.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination logic (server-side)
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  
  // Reset to page 1 when search or rowsPerPage changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, rowsPerPage, selectedHanziKey])
  
  // Re-fetch data when page changes
  React.useEffect(() => {
    fetchHanziItems()
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
            <h1 className="text-2xl font-bold tracking-tight">Hanzi Items</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola daftar kalimat estafet dan relay</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kalimat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedHanziKey || ""}
            onChange={(e) => setSelectedHanziKey(e.target.value || null)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="">Semua Sets</option>
            {sets.map(set => (
              <option key={set.key} value={set.key}>{set.title}</option>
            ))}
          </select>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Item
        </Button>
      </div>

      {/* Hanzi Items Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-muted/50">
          <CardContent className="py-12 text-center">
            <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada hanzi item ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Hanzi Key</TableHead>
                  <TableHead>Hanzi</TableHead>
                  <TableHead>Pinyin</TableHead>
                  <TableHead>Arti</TableHead>
                  <TableHead>Section Label</TableHead>
                  <TableHead>Section Tag</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>User Contribution</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.id}</TableCell>
                    <TableCell className="font-mono text-xs">{item.hanzi_key}</TableCell>
                    <TableCell className="font-medium">{item.hanzi}</TableCell>
                    <TableCell>{item.pinyin}</TableCell>
                    <TableCell>{item.arti}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.section_label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.section_tag}</Badge>
                    </TableCell>
                    <TableCell>{item.sort_order}</TableCell>
                    <TableCell>
                      {item.user_contribution ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
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
      {(showAddModal || editingItem) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingItem ? "Edit Hanzi Item" : "Tambah Hanzi Item"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Hanzi Set</label>
                <select
                  value={formData.hanzi_key}
                  onChange={(e) => setFormData({ ...formData, hanzi_key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Pilih Set</option>
                  {sets.map(set => (
                    <option key={set.key} value={set.key}>{set.title}</option>
                  ))}
                </select>
              </div>
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
                <label className="text-sm font-medium">Section Label</label>
                <Input
                  value={formData.section_label}
                  onChange={(e) => setFormData({ ...formData, section_label: e.target.value })}
                  placeholder="Contoh: Greetings"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Section Tag</label>
                <Input
                  value={formData.section_tag}
                  onChange={(e) => setFormData({ ...formData, section_tag: e.target.value })}
                  placeholder="Contoh: basic"
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="user_contribution"
                  checked={formData.user_contribution}
                  onChange={(e) => setFormData({ ...formData, user_contribution: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="user_contribution" className="text-sm font-medium">User Contribution</label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingItem ? handleEdit : handleAdd} className="flex-1">
                  {editingItem ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingItem(null) }}>
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
