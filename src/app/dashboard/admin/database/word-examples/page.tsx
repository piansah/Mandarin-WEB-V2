"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { Plus, Edit, Trash2, Search, Loader2 } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Database } from "@/lib/database.types"

type WordExample = Database["public"]["Tables"]["word_examples"]["Row"]

export default function WordExamplesPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  // UI State
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingExample, setEditingExample] = React.useState<WordExample | null>(null)
  const [deletingExample, setDeletingExample] = React.useState<WordExample | null>(null)
  const [formData, setFormData] = React.useState({
    word_hanzi: "",
    hanzi: "",
    pinyin: "",
    arti: ""
  })
  
  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to page 1 on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset to page 1 when rowsPerPage changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [rowsPerPage])

  // --- QUERY: Fetch Word Examples ---
  const { data, isLoading } = useQuery({
    queryKey: ["word-examples", currentPage, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      let query = supa.from("word_examples").select("*", { count: "exact" })

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch}%`
        query = query.or(`word_hanzi.ilike.${term},hanzi.ilike.${term},pinyin.ilike.${term},arti.ilike.${term}`)
      }

      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw error
      
      return {
        examples: data || [],
        totalCount: count || 0
      }
    }
  })

  const examples = data?.examples || []
  const totalRows = data?.totalCount || 0
  const totalPages = Math.ceil(totalRows / rowsPerPage)

  // --- MUTATIONS ---
  const addMutation = useMutation({
    mutationFn: async (newExample: { word_hanzi: string; hanzi: string; pinyin: string | null; arti: string | null }) => {
      const { error } = await supa.from("word_examples").insert(newExample)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["word-examples"] })
      setShowAddModal(false)
      setFormData({ word_hanzi: "", hanzi: "", pinyin: "", arti: "" })
    },
    onError: (error) => {
      console.error("Error adding word example:", error)
      alert("Gagal menambahkan contoh kalimat")
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { word_hanzi: string; hanzi: string; pinyin: string | null; arti: string | null } }) => {
      const { error } = await supa.from("word_examples").update(data).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["word-examples"] })
      setEditingExample(null)
      setFormData({ word_hanzi: "", hanzi: "", pinyin: "", arti: "" })
    },
    onError: (error) => {
      console.error("Error updating word example:", error)
      alert("Gagal mengupdate contoh kalimat")
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supa.from("word_examples").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["word-examples"] })
      setDeletingExample(null)
    },
    onError: (error) => {
      console.error("Error deleting word example:", error)
      alert("Gagal menghapus contoh kalimat")
    }
  })

  // Handlers
  const handleAdd = () => addMutation.mutate({
    word_hanzi: formData.word_hanzi,
    hanzi: formData.hanzi,
    pinyin: formData.pinyin || null,
    arti: formData.arti || null
  })

  const handleEdit = () => {
    if (editingExample) {
      updateMutation.mutate({
        id: editingExample.id,
        data: {
          word_hanzi: formData.word_hanzi,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin || null,
          arti: formData.arti || null
        }
      })
    }
  }

  const handleDelete = () => {
    if (deletingExample) {
      deleteMutation.mutate(deletingExample.id)
    }
  }

  const openEditModal = (example: WordExample) => {
    setEditingExample(example)
    setFormData({
      word_hanzi: example.word_hanzi,
      hanzi: example.hanzi,
      pinyin: example.pinyin || "",
      arti: example.arti || ""
    })
  }

  const isMutating = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Word Examples</h1>
          <p className="text-sm text-muted-foreground">Kelola contoh kalimat kata (Powered by React Query)</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kata hanzi, kalimat, pinyin, atau arti..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowAddModal(true)} disabled={isLoading || isMutating}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table Area */}
      <Card>
        <CardContent className="p-0 relative min-h-[300px]">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Word Hanzi</TableHead>
                <TableHead>Kalimat Hanzi</TableHead>
                <TableHead>Pinyin</TableHead>
                <TableHead>Arti</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {examples.map((example) => (
                <TableRow key={example.id}>
                  <TableCell className="font-medium">{example.id}</TableCell>
                  <TableCell>{example.word_hanzi}</TableCell>
                  <TableCell>{example.hanzi}</TableCell>
                  <TableCell>{example.pinyin || "-"}</TableCell>
                  <TableCell>{example.arti || "-"}</TableCell>
                  <TableCell>
                    {new Date(example.created_at || "").toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(example)}
                        disabled={isMutating}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingExample(example)}
                        disabled={isMutating}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && examples.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              )}
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Tambah Contoh Kalimat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Word Hanzi</Label>
                <Input
                  value={formData.word_hanzi}
                  onChange={(e) => setFormData({ ...formData, word_hanzi: e.target.value })}
                  placeholder="Contoh: 我"
                />
              </div>
              <div>
                <Label>Kalimat Hanzi</Label>
                <Textarea
                  value={formData.hanzi}
                  onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                  placeholder="Contoh: 我是一个学生"
                  rows={3}
                />
              </div>
              <div>
                <Label>Pinyin</Label>
                <Input
                  value={formData.pinyin}
                  onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                  placeholder="Contoh: wǒ shì yī gè xuéshēng"
                />
              </div>
              <div>
                <Label>Arti</Label>
                <Textarea
                  value={formData.arti}
                  onChange={(e) => setFormData({ ...formData, arti: e.target.value })}
                  placeholder="Contoh: Saya adalah seorang siswa"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={addMutation.isPending}>
                  Batal
                </Button>
                <Button onClick={handleAdd} disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editingExample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Contoh Kalimat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Word Hanzi</Label>
                <Input
                  value={formData.word_hanzi}
                  onChange={(e) => setFormData({ ...formData, word_hanzi: e.target.value })}
                />
              </div>
              <div>
                <Label>Kalimat Hanzi</Label>
                <Textarea
                  value={formData.hanzi}
                  onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Pinyin</Label>
                <Input
                  value={formData.pinyin}
                  onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                />
              </div>
              <div>
                <Label>Arti</Label>
                <Textarea
                  value={formData.arti}
                  onChange={(e) => setFormData({ ...formData, arti: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingExample(null)} disabled={updateMutation.isPending}>
                  Batal
                </Button>
                <Button onClick={handleEdit} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingExample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Contoh Kalimat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus contoh kalimat ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Word Hanzi: {deletingExample.word_hanzi}</p>
                  <p className="text-sm">Kalimat: {deletingExample.hanzi}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingExample(null)} disabled={deleteMutation.isPending}>
                  Batal
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
