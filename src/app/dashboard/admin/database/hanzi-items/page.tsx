"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, Flag, Loader2 } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { useSupabase } from "@/hooks/use-supabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Database } from "@/lib/database.types"

type HanziItem = Database["public"]["Tables"]["hanzi_items"]["Row"]

const EMPTY_FORM = { hanzi_key: "", section_label: "", section_tag: "", sort_order: 0, hanzi: "", pinyin: "", arti: "", user_contribution: false }

export default function HanziItemsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedHanziKey, setSelectedHanziKey] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<HanziItem | null>(null)
  const [deletingItem, setDeletingItem] = React.useState<HanziItem | null>(null)
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])
  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage, selectedHanziKey])

  // Dropdown sets
  const { data: setsData } = useQuery({
    queryKey: ["hanzi-sets-list"],
    queryFn: async () => {
      const { data, error } = await supa.from("hanzi_sets").select("id, key, title").order("sort_order", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
  const sets = setsData ?? []

  const { data, isLoading } = useQuery({
    queryKey: ["hanzi-items", currentPage, rowsPerPage, debouncedSearch, selectedHanziKey],
    queryFn: async () => {
      let query = supa.from("hanzi_items").select("*", { count: "exact" })
      if (selectedHanziKey) query = query.eq("hanzi_key", selectedHanziKey)
      if (debouncedSearch.trim()) {
        const t = `%${debouncedSearch}%`
        query = query.or(`hanzi.ilike.${t},pinyin.ilike.${t},arti.ilike.${t}`)
      }
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("sort_order", { ascending: true }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
  })

  const items = data?.rows ?? []
  const totalRows = data?.total ?? 0
  const totalPages = Math.ceil(totalRows / rowsPerPage)

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supa.from("hanzi_items").insert(formData)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hanzi-items"] }); setShowAddModal(false); setFormData(EMPTY_FORM) },
    onError: (e: Error) => alert(e.message),
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return
      const { error } = await supa.from("hanzi_items").update(formData).eq("id", editingItem.id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hanzi-items"] }); setEditingItem(null); setFormData(EMPTY_FORM) },
    onError: (e: Error) => alert(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingItem) return
      const { error } = await supa.from("hanzi_items").delete().eq("id", deletingItem.id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hanzi-items"] }); setDeletingItem(null) },
    onError: (e: Error) => alert(e.message),
  })

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
      user_contribution: item.user_contribution ?? false,
    })
  }
  const openAddModal = () => { setEditingItem(null); setFormData({ ...EMPTY_FORM, hanzi_key: selectedHanziKey ?? "" }); setShowAddModal(true) }
  const isMutating = addMutation.isPending || editMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col p-6 gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2"><Flag className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold tracking-tight">Hanzi Items</h1></div>
        <p className="text-sm text-muted-foreground">Kelola daftar kalimat estafet dan relay</p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari kalimat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <select value={selectedHanziKey ?? ""} onChange={(e) => setSelectedHanziKey(e.target.value || null)} className="px-3 py-2 border rounded-md bg-background">
            <option value="">Semua Sets</option>
            {sets.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
        </div>
        <Button onClick={openAddModal}><Plus className="h-4 w-4 mr-2" />Tambah Item</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="border-muted/50"><CardContent className="py-12 text-center"><Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Tidak ada hanzi item ditemukan</p></CardContent></Card>
      ) : (
        <Card className="border-muted/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Hanzi Key</TableHead><TableHead>Hanzi</TableHead>
                <TableHead>Pinyin</TableHead><TableHead>Arti</TableHead><TableHead>Section Label</TableHead>
                <TableHead>Section Tag</TableHead><TableHead>Sort</TableHead><TableHead>Kontribusi</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell className="font-mono text-xs">{item.hanzi_key}</TableCell>
                    <TableCell className="font-medium">{item.hanzi}</TableCell>
                    <TableCell>{item.pinyin}</TableCell>
                    <TableCell>{item.arti}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.section_label}</TableCell>
                    <TableCell><Badge variant="outline">{item.section_tag}</Badge></TableCell>
                    <TableCell>{item.sort_order}</TableCell>
                    <TableCell>{item.user_contribution ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(item)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingItem(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      {(showAddModal || editingItem) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader><CardTitle>{editingItem ? "Edit Hanzi Item" : "Tambah Hanzi Item"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Hanzi Set</label>
                <select value={formData.hanzi_key} onChange={(e) => setFormData({ ...formData, hanzi_key: e.target.value })} className="w-full px-3 py-2 border rounded-md bg-background">
                  <option value="">Pilih Set</option>
                  {sets.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
                </select>
              </div>
              {[
                { label: "Hanzi", key: "hanzi", ph: "你好" },
                { label: "Pinyin", key: "pinyin", ph: "nǐ hǎo" },
                { label: "Arti", key: "arti", ph: "Halo" },
                { label: "Section Label", key: "section_label", ph: "Greetings" },
                { label: "Section Tag", key: "section_tag", ph: "basic" },
              ].map(({ label, key, ph }) => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <Input value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} placeholder={ph} />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="user_contribution" checked={formData.user_contribution} onChange={(e) => setFormData({ ...formData, user_contribution: e.target.checked })} className="w-4 h-4" />
                <label htmlFor="user_contribution" className="text-sm font-medium">User Contribution</label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => editingItem ? editMutation.mutate() : addMutation.mutate()} className="flex-1" disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : editingItem ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingItem(null) }}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {deletingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-destructive">Hapus Hanzi Item</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus hanzi item ini?</p>
              <div className="p-3 bg-muted rounded-md"><p className="text-sm font-medium">Hanzi: {deletingItem.hanzi}</p><p className="text-sm">Pinyin: {deletingItem.pinyin}</p></div>
              <p className="text-xs text-destructive">Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingItem(null)}>Batal</Button>
                <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={isMutating}>
                  {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
