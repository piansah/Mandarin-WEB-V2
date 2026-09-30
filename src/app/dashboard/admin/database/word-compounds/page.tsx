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
import { Plus, Edit, Trash2, MoreVertical, Search, Layers, Loader2 } from "lucide-react"
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

interface WordCompound {
  id: number
  hanzi: string
  pinyin: string
  arti: string | null
  badge: string
  frequency: number
}

export default function WordCompoundsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const EMPTY_FORM = { hanzi: "", pinyin: "", arti: "", badge: "native", frequency: 1 }
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingCompound, setEditingCompound] = React.useState<WordCompound | null>(null)
  const [deletingCompound, setDeletingCompound] = React.useState<WordCompound | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage])

  const { data, isLoading: loading } = useQuery({
    queryKey: ["word-compounds", currentPage, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      let query = supa.from("word_compounds").select("*", { count: "exact" })
      if (debouncedSearch.trim()) {
        query = query.or(`hanzi.ilike.%${debouncedSearch}%,pinyin.ilike.%${debouncedSearch}%,arti.ilike.%${debouncedSearch}%`)
      }
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("frequency", { ascending: false }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data || [], total: count || 0 }
    },
  })

  const compounds = data?.rows || []
  const totalRows = data?.total || 0
  const totalPages = Math.ceil(totalRows / rowsPerPage)

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("word_compounds").insert({
        hanzi: formData.hanzi, pinyin: formData.pinyin, arti: formData.arti || null,
        badge: formData.badge, frequency: formData.frequency
      })
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["word-compounds"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["word-compounds"] })
      queryClient.setQueriesData({ queryKey: ["word-compounds"] }, (old: any) => {
        if (!old) return old
        return { ...old, rows: [{ id: Date.now(), ...formData }, ...old.rows], total: old.total + 1 }
      })
      return { previousData }
    },
    onSuccess: () => { setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: any) => {
      toast.error("Gagal menambahkan word compound")
      if (context?.previousData) context.previousData.forEach(([qk, d]: any) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["word-compounds"] }),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingCompound) return
      const { error } = await supa.from("word_compounds").update({
        hanzi: formData.hanzi, pinyin: formData.pinyin, arti: formData.arti || null,
        badge: formData.badge, frequency: formData.frequency
      }).eq("id", editingCompound.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["word-compounds"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["word-compounds"] })
      queryClient.setQueriesData({ queryKey: ["word-compounds"] }, (old: any) => {
        if (!old) return old
        return { ...old, rows: old.rows.map((row: any) => row.id === editingCompound?.id ? { ...row, ...formData } : row) }
      })
      return { previousData }
    },
    onSuccess: () => { setEditingCompound(null); setFormData(EMPTY_FORM) },
    onError: (_e: unknown, _v: unknown, context: any) => {
      toast.error("Gagal mengupdate word compound")
      if (context?.previousData) context.previousData.forEach(([qk, d]: any) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["word-compounds"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingCompound) return
      const { error } = await supa.from("word_compounds").delete().eq("id", deletingCompound.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["word-compounds"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["word-compounds"] })
      queryClient.setQueriesData({ queryKey: ["word-compounds"] }, (old: any) => {
        if (!old) return old
        return { ...old, rows: old.rows.filter((row: any) => row.id !== deletingCompound?.id), total: Math.max(0, old.total - 1) }
      })
      return { previousData }
    },
    onSuccess: () => { setDeletingCompound(null) },
    onError: (error: Error, _v: unknown, context: any) => {
      toast.error(`Gagal menghapus word compound: ${error.message}`)
      if (context?.previousData) context.previousData.forEach(([qk, d]: any) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["word-compounds"] }),
  })

  const handleAdd = () => addMutation.mutate()
  const handleEdit = () => editMutation.mutate()
  const handleDelete = () => deleteMutation.mutate()

  const openEditModal = (compound: WordCompound) => {
    setEditingCompound(compound)
    setFormData({ hanzi: compound.hanzi, pinyin: compound.pinyin, arti: compound.arti || "", badge: compound.badge, frequency: compound.frequency })
  }

  const openAddModal = () => {
    setEditingCompound(null)
    setFormData(EMPTY_FORM)
    setShowAddModal(true)
  }

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
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
      ) : compounds.length === 0 ? (
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
                  <TableHead>Meaning</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compounds.map((compound: any) => (
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
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(compound)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeletingCompound(compound)} className="text-destructive">
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
      {(showAddModal || editingCompound) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
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
                  onChange={(e) => {
                    // Saat field dikosongkan (mis. select-all lalu ketik ulang),
                    // e.target.value sesaat jadi "" -> parseInt("") = NaN, yang
                    // kalau langsung disimpan bikin React error "Received NaN
                    // for the `value` attribute" karena input ini controlled.
                    // Fallback ke 0 dulu selagi kosong, bukan NaN.
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, frequency: Number.isNaN(parsed) ? 0 : parsed })
                  }}
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

      {/* Delete Confirm Modal */}
      {deletingCompound && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Word Compound</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus word compound ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Hanzi: {deletingCompound.hanzi}</p>
                  <p className="text-sm">Pinyin: {deletingCompound.pinyin}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingCompound(null)}>
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
