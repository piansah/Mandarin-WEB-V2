"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, MoreVertical, Search, Flag, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const EMPTY_FORM = { key: "", title: "", sub: "", description: "", badge: "", hsk_level: 1, sort_order: 0, unlock_after: 0 }
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingSet, setEditingSet] = React.useState<HanziSet | null>(null)
  const [deletingSet, setDeletingSet] = React.useState<HanziSet | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage])

  const { data, isLoading: loading } = useQuery({
    queryKey: ["hanzi-sets", currentPage, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      let query = supa.from("hanzi_sets").select("*", { count: "exact" })
      if (debouncedSearch.trim()) {
        const t = `%${debouncedSearch}%`
        query = query.or(`title.ilike.${t},key.ilike.${t}`)
      }
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("sort_order", { ascending: true }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data || [], total: count || 0 }
    },
  })

  const sets = data?.rows || []
  const totalRows = data?.total || 0

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("hanzi_sets").insert({
        key: formData.key, title: formData.title, sub: formData.sub,
        description: formData.description || null, badge: formData.badge,
        hsk_level: formData.hsk_level, sort_order: formData.sort_order, unlock_after: formData.unlock_after
      })
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["hanzi-sets"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["hanzi-sets"] })
      queryClient.setQueriesData({ queryKey: ["hanzi-sets"] }, (old: { rows: HanziSet[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: [{ id: Date.now(), ...formData }, ...old.rows], total: old.total + 1 }
      })
      return { previousData }
    },
    onSuccess: () => { setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal menambahkan hanzi set")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["hanzi-sets"] }),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingSet) return
      const { error } = await supa.from("hanzi_sets").update({
        key: formData.key, title: formData.title, sub: formData.sub,
        description: formData.description || null, badge: formData.badge,
        hsk_level: formData.hsk_level, sort_order: formData.sort_order, unlock_after: formData.unlock_after
      }).eq("id", editingSet.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["hanzi-sets"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["hanzi-sets"] })
      queryClient.setQueriesData({ queryKey: ["hanzi-sets"] }, (old: { rows: HanziSet[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.map((row: HanziSet) => row.id === editingSet?.id ? { ...row, ...formData } : row) }
      })
      return { previousData }
    },
    onSuccess: () => { setEditingSet(null); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal mengupdate hanzi set")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["hanzi-sets"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingSet) return
      const { count: itemCount, error: countError } = await supa
        .from("hanzi_items").select("*", { count: "exact", head: true }).eq("hanzi_key", deletingSet.key)
      if (countError) throw new Error("Gagal mengecek item terkait")
      if (itemCount && itemCount > 0) {
        throw new Error(`Tidak dapat menghapus set ini karena masih ada ${itemCount} item yang terkait.`)
      }
      const { error } = await supa.from("hanzi_sets").delete().eq("id", deletingSet.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["hanzi-sets"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["hanzi-sets"] })
      queryClient.setQueriesData({ queryKey: ["hanzi-sets"] }, (old: { rows: HanziSet[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.filter((row: HanziSet) => row.id !== deletingSet?.id), total: Math.max(0, old.total - 1) }
      })
      return { previousData }
    },
    onSuccess: () => { setDeletingSet(null) },
    onError: (error: Error, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      setBlockingAlert({ message: error.message })
      setDeletingSet(null)
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["hanzi-sets"] }),
  })

  const handleAdd = () => addMutation.mutate()
  const handleEdit = () => editMutation.mutate()
  const handleDelete = () => deleteMutation.mutate()
  const handleDeleteClick = (set: HanziSet) => { setDeletingSet(set) }

  const openEditModal = (set: HanziSet) => {
    setEditingSet(set)
    setFormData({
      key: set.key, title: set.title, sub: set.sub,
      description: set.description || "", badge: set.badge,
      hsk_level: set.hsk_level, sort_order: set.sort_order, unlock_after: set.unlock_after
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

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
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
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(set)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(set)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                  Apakah Kamu yakin ingin menghapus hanzi set ini?
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
