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
import { Plus, Edit, Trash2, MoreVertical, Search, Tag, Loader2 } from "lucide-react"
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

interface ModulTag {
  id: string
  name: string
}

export default function ModulTagsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingTag, setEditingTag] = React.useState<ModulTag | null>(null)
  const [deletingTag, setDeletingTag] = React.useState<ModulTag | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [formData, setFormData] = React.useState({ name: "" })
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage])

  const { data, isLoading: loading } = useQuery({
    queryKey: ["modul-tags", currentPage, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      let query = supa.from("modul_tags").select("*", { count: "exact" })
      if (debouncedSearch.trim()) query = query.ilike("name", `%${debouncedSearch}%`)
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("name", { ascending: true }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data || [], total: count || 0 }
    },
  })

  const tags = data?.rows || []
  const totalRows = data?.total || 0

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("modul_tags").insert({ name: formData.name })
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-tags"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-tags"] })
      queryClient.setQueriesData({ queryKey: ["modul-tags"] }, (old: { rows: ModulTag[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: [{ id: crypto.randomUUID(), name: formData.name }, ...old.rows], total: old.total + 1 }
      })
      return { previousData }
    },
    onSuccess: () => { setShowAddModal(false); setFormData({ name: "" }) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal menambahkan modul tag")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-tags"] }),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingTag) return
      const { error } = await supa.from("modul_tags").update({ name: formData.name }).eq("id", editingTag.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-tags"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-tags"] })
      queryClient.setQueriesData({ queryKey: ["modul-tags"] }, (old: { rows: ModulTag[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.map((row: ModulTag) => row.id === editingTag?.id ? { ...row, name: formData.name } : row) }
      })
      return { previousData }
    },
    onSuccess: () => { setEditingTag(null); setShowAddModal(false); setFormData({ name: "" }) },
    onError: (_e: unknown, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      toast.error("Gagal mengupdate modul tag")
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-tags"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingTag) return
      const { count: moduleCount, error: countError } = await supa
        .from("modul_module_tags")
        .select("*", { count: "exact", head: true })
        .eq("tag_id", deletingTag.id)
      if (countError) throw new Error("Gagal mengecek modul terkait")
      if (moduleCount && moduleCount > 0) {
        throw new Error(`Tidak dapat menghapus tag ini karena masih ada ${moduleCount} modul yang terkait.`)
      }
      const { error } = await supa.from("modul_tags").delete().eq("id", deletingTag.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-tags"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-tags"] })
      queryClient.setQueriesData({ queryKey: ["modul-tags"] }, (old: { rows: ModulTag[], total: number } | undefined) => {
        if (!old) return old
        return { ...old, rows: old.rows.filter((row: ModulTag) => row.id !== deletingTag?.id), total: Math.max(0, old.total - 1) }
      })
      return { previousData }
    },
    onSuccess: () => { setDeletingTag(null) },
    onError: (error: Error, _v: unknown, context: { previousData?: [readonly unknown[], unknown][] } | undefined) => {
      setBlockingAlert({ message: error.message })
      setDeletingTag(null)
      if (context?.previousData) context.previousData.forEach(([qk, d]: [readonly unknown[], unknown]) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-tags"] }),
  })

  const handleAdd = () => addMutation.mutate()
  const handleEdit = () => editMutation.mutate()
  const handleDelete = () => deleteMutation.mutate()
  const handleDeleteClick = (tag: ModulTag) => { setDeletingTag(tag) }

  const openEditModal = (tag: ModulTag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name
    })
    setShowAddModal(true)
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul Tags</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola tags untuk kategorisasi modul</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Tag
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul tag
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(tag)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(tag)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalRows / rowsPerPage)}
        rowsPerPage={rowsPerPage}
        totalRows={totalRows}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
      />

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{editingTag ? "Edit Modul Tag" : "Tambah Modul Tag"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama tag..."
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingTag ? handleEdit : handleAdd} className="flex-1">
                  {editingTag ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingTag(null); setFormData({ name: "" }) }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Modul Tag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Kamu yakin ingin menghapus tag ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Name: {deletingTag.name}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingTag(null)}>
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