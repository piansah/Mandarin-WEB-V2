"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, BookOpen, Loader2 } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Database } from "@/lib/database.types"

type FlashcardSet = Database["public"]["Tables"]["flashcard_sets"]["Row"]

const EMPTY_FORM = { day_number: 1, title: "", description: "", hsk_level: 1, badge: "", sort_order: 0 }

export default function FlashcardSetsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingSet, setEditingSet] = React.useState<FlashcardSet | null>(null)
  const [deletingSet, setDeletingSet] = React.useState<FlashcardSet | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])
  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage])

  const { data, isLoading } = useQuery({
    queryKey: ["flashcard-sets", currentPage, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      let query = supa.from("flashcard_sets").select("*", { count: "exact" })
      if (debouncedSearch.trim()) query = query.ilike("title", `%${debouncedSearch}%`)
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("sort_order", { ascending: true }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
  })

  const sets = data?.rows ?? []
  const totalRows = data?.total ?? 0
  const totalPages = Math.ceil(totalRows / rowsPerPage)

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("flashcard_sets").insert({ ...formData, is_default: true })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flashcard-sets"] }); setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (e: Error) => alert(e.message),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingSet) return
      const { error } = await supa.from("flashcard_sets").update(formData).eq("id", editingSet.id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flashcard-sets"] }); setEditingSet(null); setFormData(EMPTY_FORM) },
    onError: (e: Error) => alert(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingSet) return
      const { count, error: ce } = await supa.from("flashcard_cards").select("*", { count: "exact", head: true }).eq("set_id", deletingSet.id)
      if (ce) throw ce
      if (count && count > 0) {
        setDeletingSet(null)
        setBlockingAlert({ message: `Tidak dapat menghapus set karena masih ada ${count} kartu terkait.` })
        return
      }
      const { error } = await supa.from("flashcard_sets").delete().eq("id", deletingSet.id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flashcard-sets"] }); setDeletingSet(null) },
    onError: (e: Error) => { setDeletingSet(null); setBlockingAlert({ message: e.message }) },
  })

  const openEditModal = (s: FlashcardSet) => {
    setEditingSet(s)
    setFormData({ day_number: s.day_number, title: s.title, description: s.description ?? "", hsk_level: s.hsk_level, badge: s.badge, sort_order: s.sort_order })
  }
  const openAddModal = () => { setEditingSet(null); setFormData(EMPTY_FORM); setShowAddModal(true) }
  const isMutating = addMutation.isPending || editMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col p-6 gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold tracking-tight">Flashcard Sets</h1></div>
        <p className="text-sm text-muted-foreground">Kelola deck flashcard dan vocabulary</p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari flashcard set..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={openAddModal}><Plus className="h-4 w-4 mr-2" />Tambah Set</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : sets.length === 0 ? (
        <Card className="border-muted/50"><CardContent className="py-12 text-center"><BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Tidak ada flashcard set ditemukan</p></CardContent></Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Title</TableHead><TableHead>Day</TableHead>
                <TableHead>HSK Level</TableHead><TableHead>Badge</TableHead><TableHead>Description</TableHead>
                <TableHead>Sort Order</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sets.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.id}</TableCell><TableCell>{s.title}</TableCell>
                    <TableCell><Badge variant="secondary">Day {s.day_number}</Badge></TableCell>
                    <TableCell><Badge variant="outline">HSK {s.hsk_level}</Badge></TableCell>
                    <TableCell>{s.badge && <Badge variant="default">{s.badge}</Badge>}</TableCell>
                    <TableCell className="max-w-xs truncate">{s.description ?? "-"}</TableCell>
                    <TableCell>{s.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(s)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingSet(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      {(showAddModal || editingSet) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle>{editingSet ? "Edit Flashcard Set" : "Tambah Flashcard Set"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Title", key: "title", ph: "Day 1 - Basic Greetings", type: "text" },
                { label: "Description", key: "description", ph: "Deskripsi singkat...", type: "text" },
                { label: "Badge", key: "badge", ph: "Beginner", type: "text" },
                { label: "Day Number", key: "day_number", ph: "", type: "number" },
                { label: "HSK Level", key: "hsk_level", ph: "", type: "number" },
                { label: "Sort Order", key: "sort_order", ph: "", type: "number" },
              ].map(({ label, key, ph, type }) => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <Input type={type} value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: type === "number" ? (parseInt(e.target.value) || 0) : e.target.value })} placeholder={ph} />
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <Button onClick={() => editingSet ? editMutation.mutate() : addMutation.mutate()} className="flex-1" disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : editingSet ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingSet(null) }}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {deletingSet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-destructive">Hapus Flashcard Set</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus set ini?</p>
              <div className="p-3 bg-muted rounded-md"><p className="text-sm font-medium">Title: {deletingSet.title}</p><p className="text-sm">Day: {deletingSet.day_number}</p></div>
              <p className="text-xs text-destructive">Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingSet(null)}>Batal</Button>
                <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {blockingAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-destructive">Peringatan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{blockingAlert.message}</p>
              <div className="flex justify-end"><Button onClick={() => setBlockingAlert(null)}>OK</Button></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
