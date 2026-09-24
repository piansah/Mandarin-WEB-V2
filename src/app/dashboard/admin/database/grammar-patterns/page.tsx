"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, Layers, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Database } from "@/lib/database.types"

type GrammarPattern = Database["public"]["Tables"]["grammar_patterns"]["Row"]

const EMPTY_FORM = { title: "", slug: "", hsk_level: 1, theory_text: "", example_json: "", badge: "", sort_order: 0, sub_title: "" }

export default function GrammarPatternsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingPattern, setEditingPattern] = React.useState<GrammarPattern | null>(null)
  const [deletingPattern, setDeletingPattern] = React.useState<GrammarPattern | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage])

  // --- QUERY ---
  const { data, isLoading } = useQuery({
    queryKey: ["grammar-patterns", currentPage, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      let query = supa.from("grammar_patterns").select("*", { count: "exact" })
      if (debouncedSearch.trim()) {
        const t = `%${debouncedSearch}%`
        query = query.or(`title.ilike.${t},slug.ilike.${t}`)
      }
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query
        .order("sort_order", { ascending: true })
        .range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
  })

  const patterns = data?.rows ?? []
  const totalRows = data?.total ?? 0
  const totalPages = Math.ceil(totalRows / rowsPerPage)

  // --- MUTATIONS ---
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("grammar_patterns").insert({
        title: formData.title,
        slug: formData.slug,
        hsk_level: formData.hsk_level,
        theory_text: formData.theory_text || null,
        example_json: formData.example_json ? JSON.parse(formData.example_json) : null,
        badge: formData.badge || null,
        sort_order: formData.sort_order,
        sub_title: formData.sub_title || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grammar-patterns"] })
      setShowAddModal(false)
      setFormData(EMPTY_FORM)
    },
    onError: () => alert("Gagal menambahkan grammar pattern"),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingPattern) return
      const { error } = await supa.from("grammar_patterns").update({
        title: formData.title,
        slug: formData.slug,
        hsk_level: formData.hsk_level,
        theory_text: formData.theory_text || null,
        example_json: formData.example_json ? JSON.parse(formData.example_json) : null,
        badge: formData.badge || null,
        sort_order: formData.sort_order,
        sub_title: formData.sub_title || null,
      }).eq("id", editingPattern.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grammar-patterns"] })
      setEditingPattern(null)
      setFormData(EMPTY_FORM)
    },
    onError: () => alert("Gagal mengupdate grammar pattern"),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingPattern) return
      // Cek soal terkait
      const { count, error: countError } = await supa
        .from("grammar_questions")
        .select("*", { count: "exact", head: true })
        .eq("pattern_id", deletingPattern.id)
      if (countError) throw countError
      if (count && count > 0) {
        setDeletingPattern(null)
        setBlockingAlert({ message: `Tidak dapat menghapus pattern ini karena masih ada ${count} soal terkait. Hapus soal terlebih dahulu.` })
        return
      }
      const { error } = await supa.from("grammar_patterns").delete().eq("id", deletingPattern.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grammar-patterns"] })
      setDeletingPattern(null)
    },
    onError: (err: Error) => {
      setDeletingPattern(null)
      setBlockingAlert({ message: `Gagal menghapus: ${err.message}` })
    },
  })

  const openEditModal = (pattern: GrammarPattern) => {
    setEditingPattern(pattern)
    setFormData({
      title: pattern.title,
      slug: pattern.slug,
      hsk_level: pattern.hsk_level ?? 1,
      theory_text: pattern.theory_text ?? "",
      example_json: pattern.example_json ? JSON.stringify(pattern.example_json, null, 2) : "",
      badge: pattern.badge ?? "",
      sort_order: pattern.sort_order ?? 0,
      sub_title: pattern.sub_title ?? "",
    })
  }

  const openAddModal = () => {
    setEditingPattern(null)
    setFormData(EMPTY_FORM)
    setShowAddModal(true)
  }

  const isMutating = addMutation.isPending || editMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari grammar pattern..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Pattern
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : patterns.length === 0 ? (
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
                {patterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell className="font-medium">{pattern.id}</TableCell>
                    <TableCell>{pattern.title}</TableCell>
                    <TableCell className="font-mono text-xs">{pattern.slug}</TableCell>
                    <TableCell className="max-w-xs truncate">{pattern.sub_title ?? "-"}</TableCell>
                    <TableCell><Badge variant="outline">HSK {pattern.hsk_level ?? "-"}</Badge></TableCell>
                    <TableCell>{pattern.badge && <Badge variant="default">{pattern.badge}</Badge>}</TableCell>
                    <TableCell>{pattern.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(pattern)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingPattern(pattern)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 border-t">
              <Pagination currentPage={currentPage} totalPages={totalPages} rowsPerPage={rowsPerPage} totalRows={totalRows} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingPattern) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader><CardTitle>{editingPattern ? "Edit Grammar Pattern" : "Tambah Grammar Pattern"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Title", key: "title", placeholder: "Noun + Noun Construction" },
                { label: "Slug", key: "slug", placeholder: "noun-noun-construction" },
                { label: "Sub Title", key: "sub_title", placeholder: "Deskripsi singkat..." },
                { label: "Theory Text", key: "theory_text", placeholder: "Penjelasan teori..." },
                { label: "Badge", key: "badge", placeholder: "Beginner" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <Input value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} placeholder={placeholder} />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-sm font-medium">HSK Level</label>
                <Input type="number" min="1" max="6" value={formData.hsk_level} onChange={(e) => setFormData({ ...formData, hsk_level: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Example JSON</label>
                <textarea value={formData.example_json} onChange={(e) => setFormData({ ...formData, example_json: e.target.value })} placeholder='{"examples": [...]}' className="w-full px-3 py-2 border rounded-md bg-background min-h-[100px] font-mono text-xs" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => editingPattern ? editMutation.mutate() : addMutation.mutate()} className="flex-1" disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPattern ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingPattern(null) }}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      {deletingPattern && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-destructive">Hapus Grammar Pattern</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus grammar pattern ini?</p>
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="text-sm font-medium">Title: {deletingPattern.title}</p>
                <p className="text-sm">Slug: {deletingPattern.slug}</p>
              </div>
              <p className="text-xs text-destructive">Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingPattern(null)}>Batal</Button>
                <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Blocking Alert */}
      {blockingAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-destructive">Peringatan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{blockingAlert.message}</p>
              <div className="flex justify-end">
                <Button onClick={() => setBlockingAlert(null)}>OK</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
