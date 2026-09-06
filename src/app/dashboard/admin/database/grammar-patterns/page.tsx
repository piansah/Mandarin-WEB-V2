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

interface GrammarPattern {
  id: number
  title: string
  slug: string
  hsk_level: number | null
  theory_text: string | null
  example_json: any
  badge: string | null
  sort_order: number | null
  sub_title: string | null
  created_at: string
  updated_at: string
}

export default function GrammarPatternsPage() {
  const router = useRouter()
  const [patterns, setPatterns] = React.useState<GrammarPattern[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingPattern, setEditingPattern] = React.useState<GrammarPattern | null>(null)
  const [formData, setFormData] = React.useState({
    title: "",
    slug: "",
    hsk_level: 1,
    theory_text: "",
    example_json: "",
    badge: "",
    sort_order: 0,
    sub_title: ""
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  const supa = createClient()

  React.useEffect(() => {
    fetchGrammarPatterns()
  }, [])

  const fetchGrammarPatterns = async () => {
    try {
      const { data, error } = await supa
        .from("grammar_patterns")
        .select("*")
        .order("sort_order", { ascending: true })

      if (error) throw error
      setPatterns(data || [])
    } catch (error) {
      console.error("Error fetching grammar patterns:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const { error } = await supa
        .from("grammar_patterns")
        .insert({
          title: formData.title,
          slug: formData.slug,
          hsk_level: formData.hsk_level,
          theory_text: formData.theory_text || null,
          example_json: formData.example_json ? JSON.parse(formData.example_json) : null,
          badge: formData.badge || null,
          sort_order: formData.sort_order,
          sub_title: formData.sub_title || null
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ title: "", slug: "", hsk_level: 1, theory_text: "", example_json: "", badge: "", sort_order: 0, sub_title: "" })
      fetchGrammarPatterns()
    } catch (error) {
      console.error("Error adding grammar pattern:", error)
      alert("Gagal menambahkan grammar pattern")
    }
  }

  const handleEdit = async () => {
    if (!editingPattern) return

    try {
      const { error } = await supa
        .from("grammar_patterns")
        .update({
          title: formData.title,
          slug: formData.slug,
          hsk_level: formData.hsk_level,
          theory_text: formData.theory_text || null,
          example_json: formData.example_json ? JSON.parse(formData.example_json) : null,
          badge: formData.badge || null,
          sort_order: formData.sort_order,
          sub_title: formData.sub_title || null
        })
        .eq("id", editingPattern.id)

      if (error) throw error

      setEditingPattern(null)
      setFormData({ title: "", slug: "", hsk_level: 1, theory_text: "", example_json: "", badge: "", sort_order: 0, sub_title: "" })
      fetchGrammarPatterns()
    } catch (error) {
      console.error("Error updating grammar pattern:", error)
      alert("Gagal mengupdate grammar pattern")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus grammar pattern ini?")) return

    try {
      const { error } = await supa
        .from("grammar_patterns")
        .delete()
        .eq("id", id)

      if (error) throw error
      fetchGrammarPatterns()
    } catch (error) {
      console.error("Error deleting grammar pattern:", error)
      alert("Gagal menghapus grammar pattern")
    }
  }

  const openEditModal = (pattern: GrammarPattern) => {
    setEditingPattern(pattern)
    setFormData({
      title: pattern.title,
      slug: pattern.slug,
      hsk_level: pattern.hsk_level || 1,
      theory_text: pattern.theory_text || "",
      example_json: pattern.example_json ? JSON.stringify(pattern.example_json, null, 2) : "",
      badge: pattern.badge || "",
      sort_order: pattern.sort_order || 0,
      sub_title: pattern.sub_title || ""
    })
  }

  const openAddModal = () => {
    setEditingPattern(null)
    setFormData({ title: "", slug: "", hsk_level: 1, theory_text: "", example_json: "", badge: "", sort_order: 0, sub_title: "" })
    setShowAddModal(true)
  }

  const filteredPatterns = patterns.filter(pattern => 
    pattern.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pattern.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pattern.sub_title && pattern.sub_title.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredPatterns.length / rowsPerPage)
  const paginatedPatterns = filteredPatterns.slice(
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
            <h1 className="text-2xl font-bold tracking-tight">Grammar Patterns</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola deck grammar patterns dan pola tata bahasa</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari grammar pattern..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Pattern
        </Button>
      </div>

      {/* Grammar Patterns Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredPatterns.length === 0 ? (
        <Card className="border-muted/50">
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada grammar pattern ditemukan</p>
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
                  <TableHead>Slug</TableHead>
                  <TableHead>Sub Title</TableHead>
                  <TableHead>HSK Level</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPatterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell className="font-medium">{pattern.id}</TableCell>
                    <TableCell>{pattern.title}</TableCell>
                    <TableCell className="font-mono text-xs">{pattern.slug}</TableCell>
                    <TableCell className="max-w-xs truncate">{pattern.sub_title || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">HSK {pattern.hsk_level || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      {pattern.badge && <Badge variant="default">{pattern.badge}</Badge>}
                    </TableCell>
                    <TableCell>{pattern.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(pattern)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(pattern.id)}>
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
                totalRows={filteredPatterns.length}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingPattern) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingPattern ? "Edit Grammar Pattern" : "Tambah Grammar Pattern"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Noun + Noun Construction"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="noun-noun-construction"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sub Title</label>
                <Input
                  value={formData.sub_title}
                  onChange={(e) => setFormData({ ...formData, sub_title: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, hsk_level: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Theory Text</label>
                <Input
                  value={formData.theory_text}
                  onChange={(e) => setFormData({ ...formData, theory_text: e.target.value })}
                  placeholder="Penjelasan teori..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Example JSON</label>
                <textarea
                  value={formData.example_json}
                  onChange={(e) => setFormData({ ...formData, example_json: e.target.value })}
                  placeholder='{"examples": [...] }'
                  className="w-full px-3 py-2 border rounded-md bg-background min-h-[100px] font-mono text-xs"
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
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingPattern ? handleEdit : handleAdd} className="flex-1">
                  {editingPattern ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingPattern(null) }}>
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
