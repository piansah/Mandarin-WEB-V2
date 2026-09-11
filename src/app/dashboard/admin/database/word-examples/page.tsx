"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import { ArrowLeft, Plus, Edit, Trash2, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"

interface WordExample {
  id: number
  word_hanzi: string
  hanzi: string
  pinyin: string | null
  arti: string | null
  added_by: string | null
  created_at: string
}

export default function WordExamplesPage() {
  const router = useRouter()
  const [examples, setExamples] = React.useState<WordExample[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingExample, setEditingExample] = React.useState<WordExample | null>(null)
  const [deletingExample, setDeletingExample] = React.useState<WordExample | null>(null)
  const [formData, setFormData] = React.useState({
    word_hanzi: "",
    hanzi: "",
    pinyin: "",
    arti: ""
  })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [totalRows, setTotalRows] = React.useState(0)

  const supa = createClient()

  React.useEffect(() => {
    fetchWordExamples()
  }, [])

  const fetchWordExamples = async () => {
    try {
      // Dapatkan total count dulu
      const { count: totalCount, error: countError } = await supa
        .from("word_examples")
        .select("*", { count: "exact", head: true })

      if (countError) throw countError

      // Fetch data dengan pagination di level Supabase
      const from = (currentPage - 1) * rowsPerPage
      const to = from + rowsPerPage - 1

      const { data, error } = await supa
        .from("word_examples")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw error

      console.log("Word Examples fetched:", { 
        totalCount, 
        dataLength: data?.length, 
        currentPage, 
        rowsPerPage,
        range: `${from}-${to}`
      })
      
      setExamples(data || [])
      setTotalRows(totalCount || 0)
    } catch (error) {
      console.error("Error fetching word examples:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredExamples = examples.filter(example => 
    example.word_hanzi.toLowerCase().includes(searchQuery.toLowerCase()) ||
    example.hanzi.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (example.pinyin && example.pinyin.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (example.arti && example.arti.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Pagination logic (server-side)
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  
  // Reset to page 1 when search or rowsPerPage changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, rowsPerPage])
  
  // Re-fetch data when page changes
  React.useEffect(() => {
    fetchWordExamples()
  }, [currentPage, rowsPerPage])

  const handleAdd = async () => {
    try {
      const { error } = await supa
        .from("word_examples")
        .insert({
          word_hanzi: formData.word_hanzi,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin || null,
          arti: formData.arti || null
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ word_hanzi: "", hanzi: "", pinyin: "", arti: "" })
      fetchWordExamples()
    } catch (error) {
      console.error("Error adding word example:", error)
      alert("Gagal menambahkan contoh kalimat")
    }
  }

  const handleEdit = async () => {
    if (!editingExample) return

    try {
      const { error } = await supa
        .from("word_examples")
        .update({
          word_hanzi: formData.word_hanzi,
          hanzi: formData.hanzi,
          pinyin: formData.pinyin || null,
          arti: formData.arti || null
        })
        .eq("id", editingExample.id)

      if (error) throw error

      setEditingExample(null)
      setFormData({ word_hanzi: "", hanzi: "", pinyin: "", arti: "" })
      fetchWordExamples()
    } catch (error) {
      console.error("Error updating word example:", error)
      alert("Gagal mengupdate contoh kalimat")
    }
  }

  const handleDelete = async () => {
    if (!deletingExample) return

    try {
      const { error } = await supa
        .from("word_examples")
        .delete()
        .eq("id", deletingExample.id)

      if (error) throw error

      setDeletingExample(null)
      fetchWordExamples()
    } catch (error) {
      console.error("Error deleting word example:", error)
      alert("Gagal menghapus contoh kalimat")
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
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Word Examples</h1>
          <p className="text-sm text-muted-foreground">Kelola contoh kalimat kata</p>
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
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {!loading && (
        <Card>
          <CardContent className="p-0">
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
                {filteredExamples.map((example) => (
                  <TableRow key={example.id}>
                    <TableCell className="font-medium">{example.id}</TableCell>
                    <TableCell>{example.word_hanzi}</TableCell>
                    <TableCell>{example.hanzi}</TableCell>
                    <TableCell>{example.pinyin || "-"}</TableCell>
                    <TableCell>{example.arti || "-"}</TableCell>
                    <TableCell>
                      {new Date(example.created_at).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(example)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingExample(example)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredExamples.length === 0 && (
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
      )}

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
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Batal
                </Button>
                <Button onClick={handleAdd}>
                  Simpan
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
                <Button variant="outline" onClick={() => setEditingExample(null)}>
                  Batal
                </Button>
                <Button onClick={handleEdit}>
                  Update
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
                <Button variant="outline" onClick={() => setDeletingExample(null)}>
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
