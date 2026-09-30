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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, MoreVertical, Search, FileText, ExternalLink, BookOpen, MessageSquare, Loader2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ModulModulePart {
  id: string
  module_id: string
  order_index: number
  title: string
  // eslint-disable-next-line
  content: any
  // eslint-disable-next-line
  vocab_parts: any
  // eslint-disable-next-line
  kalimat_parts: any
  created_at: string
  updated_at: string
}

interface ModulModule {
  id: string
  title: string
  slug: string
}

export default function ModulModulePartsPage() {
  const supa = useSupabase()
  const queryClient = useQueryClient()

  const EMPTY_FORM = {
    module_id: "", order_index: 0, title: "", content: "", vocab_parts: "", kalimat_parts: ""
  }
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingPart, setEditingPart] = React.useState<ModulModulePart | null>(null)
  const [deletingPart, setDeletingPart] = React.useState<ModulModulePart | null>(null)
  const [blockingAlert, setBlockingAlert] = React.useState<{ message: string } | null>(null)
  const [contentMode, setContentMode] = React.useState<"text" | "json">("text")
  const [plainContent, setPlainContent] = React.useState("")
  const [vocabMode, setVocabMode] = React.useState<"simple" | "json">("simple")
  const [vocabCards, setVocabCards] = React.useState<Array<{ hanzi: string; pinyin: string; translation: string; order_index: number }>>([])
  const [kalimatMode, setKalimatMode] = React.useState<"simple" | "json">("simple")
  const [kalimatCards, setKalimatCards] = React.useState<Array<{ hanzi: string; pinyin: string; translation: string; order_index: number }>>([])
  const [formData, setFormData] = React.useState(EMPTY_FORM)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => { setCurrentPage(1) }, [rowsPerPage, selectedModuleId])

  const { data: modulesData } = useQuery({
    queryKey: ["modul-modules-list"],
    queryFn: async () => {
      const { data, error } = await supa.from("modul_modules").select("id, title, slug").order("order_index", { ascending: true })
      if (error) throw error
      return data || []
    },
  })
  const modules = modulesData || []

  const { data, isLoading: loading } = useQuery({
    queryKey: ["modul-module-parts", currentPage, rowsPerPage, debouncedSearch, selectedModuleId],
    queryFn: async () => {
      let query = supa.from("modul_module_parts").select("id, module_id, order_index, title, content, vocab_parts, kalimat_parts, created_at, updated_at", { count: "exact" })
      if (selectedModuleId) query = query.eq("module_id", selectedModuleId)
      if (debouncedSearch.trim()) query = query.ilike('title', `%${debouncedSearch}%`)
      const from = (currentPage - 1) * rowsPerPage
      const { data, count, error } = await query.order("order_index", { ascending: true }).range(from, from + rowsPerPage - 1)
      if (error) throw error
      return { rows: data || [], total: count || 0 }
    },
  })

  const parts = data?.rows || []
  const totalRows = data?.total || 0

  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supa.from("modul_module_parts").insert(payload)
      if (error) throw error
    },
    onMutate: async (payload: any) => {
      await queryClient.cancelQueries({ queryKey: ["modul-module-parts"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-module-parts"] })
      queryClient.setQueriesData({ queryKey: ["modul-module-parts"] }, (old: any) => {
        if (!old) return old
        return { ...old, rows: [{ id: crypto.randomUUID(), ...payload }, ...old.rows], total: old.total + 1 }
      })
      return { previousData }
    },
    onSuccess: () => {
      setShowAddModal(false)
      setFormData(EMPTY_FORM)
      setPlainContent(""); setContentMode("text")
      setVocabCards([]); setVocabMode("simple")
      setKalimatCards([]); setKalimatMode("simple")
    },
    onError: (_e: unknown, _v: unknown, context: any) => {
      toast.error("Gagal menambahkan modul modul part")
      if (context?.previousData) context.previousData.forEach(([qk, d]: any) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-module-parts"] }),
  })

  const editMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!editingPart) return
      const { error } = await supa.from("modul_module_parts").update(payload).eq("id", editingPart.id)
      if (error) throw error
    },
    onMutate: async (payload: any) => {
      await queryClient.cancelQueries({ queryKey: ["modul-module-parts"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-module-parts"] })
      queryClient.setQueriesData({ queryKey: ["modul-module-parts"] }, (old: any) => {
        if (!old) return old
        return { ...old, rows: old.rows.map((row: any) => row.id === editingPart?.id ? { ...row, ...payload } : row) }
      })
      return { previousData }
    },
    onSuccess: () => {
      setEditingPart(null)
      setShowAddModal(false)
      setFormData(EMPTY_FORM)
      setPlainContent(""); setContentMode("text")
      setVocabCards([]); setVocabMode("simple")
      setKalimatCards([]); setKalimatMode("simple")
    },
    onError: (_e: unknown, _v: unknown, context: any) => {
      toast.error("Gagal mengupdate modul modul part")
      if (context?.previousData) context.previousData.forEach(([qk, d]: any) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-module-parts"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingPart) return
      const hasVocab = deletingPart.vocab_parts && typeof deletingPart.vocab_parts === 'object' && 'cards' in deletingPart.vocab_parts && Array.isArray((deletingPart.vocab_parts as any).cards) && (deletingPart.vocab_parts as any).cards.length > 0
      if (hasVocab) {
        throw new Error(`Part ini masih memiliki ${(deletingPart.vocab_parts as any).cards.length} vocab cards. Hapus vocab terlebih dahulu.`)
      }
      const { error } = await supa.from("modul_module_parts").delete().eq("id", deletingPart.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["modul-module-parts"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["modul-module-parts"] })
      queryClient.setQueriesData({ queryKey: ["modul-module-parts"] }, (old: any) => {
        if (!old) return old
        return { ...old, rows: old.rows.filter((row: any) => row.id !== deletingPart?.id), total: Math.max(0, old.total - 1) }
      })
      return { previousData }
    },
    onSuccess: () => { setDeletingPart(null) },
    onError: (error: Error, _v: unknown, context: any) => {
      setBlockingAlert({ message: error.message })
      setDeletingPart(null)
      if (context?.previousData) context.previousData.forEach(([qk, d]: any) => queryClient.setQueryData(qk, d))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["modul-module-parts"] }),
  })

  const parsePayload = () => {
    let parsedContent = null
    try {
      if (contentMode === "text" && plainContent) parsedContent = { paragraphs: plainContent.split('\n').filter(p => p.trim()) }
      else if (formData.content) parsedContent = JSON.parse(formData.content)
    } catch { alert("Invalid JSON format for content"); return null }

    let parsedVocabParts = null
    try {
      if (vocabMode === "simple" && vocabCards.length > 0) parsedVocabParts = { cards: vocabCards }
      else if (formData.vocab_parts) parsedVocabParts = JSON.parse(formData.vocab_parts)
    } catch { alert("Invalid JSON format for vocab_parts"); return null }

    let parsedKalimatParts = null
    try {
      if (kalimatMode === "simple" && kalimatCards.length > 0) parsedKalimatParts = { cards: kalimatCards }
      else if (formData.kalimat_parts) parsedKalimatParts = JSON.parse(formData.kalimat_parts)
    } catch { alert("Invalid JSON format for kalimat_parts"); return null }

    return {
      module_id: formData.module_id, order_index: formData.order_index, title: formData.title,
      content: parsedContent, vocab_parts: parsedVocabParts, kalimat_parts: parsedKalimatParts
    }
  }

  const handleAdd = () => {
    if (!formData.module_id) return alert("Silakan pilih modul terlebih dahulu")
    if (!formData.title) return alert("Judul (Title) tidak boleh kosong")
    const payload = parsePayload()
    if (payload) addMutation.mutate(payload)
  }

  const handleEdit = () => {
    if (!formData.module_id) return alert("Silakan pilih modul terlebih dahulu")
    if (!formData.title) return alert("Judul (Title) tidak boleh kosong")
    const payload = parsePayload()
    if (payload) editMutation.mutate(payload)
  }

  const handleDelete = () => deleteMutation.mutate()
  const handleDeleteClick = (part: ModulModulePart) => { setDeletingPart(part) }

  const openEditModal = (part: ModulModulePart) => {
    setEditingPart(part)
    setFormData({
      module_id: part.module_id, order_index: part.order_index, title: part.title,
      content: part.content ? JSON.stringify(part.content, null, 2) : "",
      vocab_parts: part.vocab_parts ? JSON.stringify(part.vocab_parts, null, 2) : "",
      kalimat_parts: part.kalimat_parts ? JSON.stringify(part.kalimat_parts, null, 2) : ""
    })
    
    if (part.content && typeof part.content === 'object' && 'paragraphs' in part.content && Array.isArray(part.content.paragraphs)) {
      setPlainContent(part.content.paragraphs.join('\n')); setContentMode("text")
    } else { setPlainContent(""); setContentMode("json") }

    if (part.vocab_parts && typeof part.vocab_parts === 'object' && 'cards' in part.vocab_parts && Array.isArray(part.vocab_parts.cards)) {
      setVocabCards(part.vocab_parts.cards); setVocabMode("simple")
    } else { setVocabCards([]); setVocabMode("json") }

    if (part.kalimat_parts && typeof part.kalimat_parts === 'object' && 'cards' in part.kalimat_parts && Array.isArray(part.kalimat_parts.cards)) {
      setKalimatCards(part.kalimat_parts.cards); setKalimatMode("simple")
    } else { setKalimatCards([]); setKalimatMode("json") }
    
    setShowAddModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Modul modul Parts</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola bagian modul (content/practice/quiz)</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari part..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedModuleId || "all"} onValueChange={(value) => setSelectedModuleId(value === "all" ? null : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua modul</SelectItem>
              {modules.map((modul) => (
                <SelectItem key={modul.id} value={modul.id}>
                  {modul.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Part
        </Button>
      </div>

      {/* Table */}
      <Card className="border-muted/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>modul</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Vocab</TableHead>
                <TableHead>Kalimat</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Tidak ada data modul modul part
                  </TableCell>
                </TableRow>
              ) : (
                parts.map((part) => {
                  const modul = modules.find(m => m.id === part.module_id)
                  return (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">{part.title}</TableCell>
                      <TableCell>
                        {modul ? (
                          <span className="text-sm">{modul.title}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{part.order_index}</TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {part.content && typeof part.content === 'object' && 'paragraphs' in part.content 
                          ? `${(part.content as any).paragraphs?.length || 0} paragraf` 
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {part.vocab_parts && typeof part.vocab_parts === 'object' && 'cards' in part.vocab_parts 
                          ? `${(part.vocab_parts as any).cards?.length || 0} vocab` 
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {part.kalimat_parts && typeof part.kalimat_parts === 'object' && 'cards' in part.kalimat_parts 
                          ? `${(part.kalimat_parts as any).cards?.length || 0} kalimat` 
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <div className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(part)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(part)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    </TableRow>
                  )
                })
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
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-lg border shadow-lg">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle>{editingPart ? "Edit Modul modul Part" : "Tambah Modul modul Part"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">modul</label>
                <Select value={formData.module_id} onValueChange={(value) => setFormData({ ...formData, module_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih modul" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {modules.map((modul) => (
                      <SelectItem key={modul.id} value={modul.id}>
                        {modul.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Judul part..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Order Index</label>
                <Input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setFormData({ ...formData, order_index: Number.isNaN(parsed) ? 0 : parsed })
                  }}
                />
              </div>
              
              {/* Content Section */}
              <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">📄 Content</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={contentMode === "text" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setContentMode("text")}
                    >
                      Teks Biasa
                    </Button>
                    <Button
                      type="button"
                      variant={contentMode === "json" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setContentMode("json")}
                    >
                      JSON
                    </Button>
                  </div>
                </div>
                {contentMode === "text" ? (
                  <>
                    <Textarea
                      value={plainContent}
                      onChange={(e) => setPlainContent(e.target.value)}
                      placeholder="Ketik paragraf di sini. Setiap baris baru akan menjadi paragraf terpisah."
                      className="text-sm min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ketik paragraf biasa. Setiap baris baru akan menjadi paragraf terpisah.
                    </p>
                  </>
                ) : (
                  <>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder='{"paragraphs": ["paragraf 1", "paragraf 2"]}'
                      className="font-mono text-sm min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format JSON untuk content. Contoh: {`{"paragraphs": ["paragraf 1", "paragraf 2"]}`}
                    </p>
                  </>
                )}
              </div>

              {/* Vocab Parts Section */}
              <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">🎴 Vocab Parts</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={vocabMode === "simple" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVocabMode("simple")}
                    >
                      Simple
                    </Button>
                    <Button
                      type="button"
                      variant={vocabMode === "json" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVocabMode("json")}
                    >
                      JSON
                    </Button>
                  </div>
                </div>
                {vocabMode === "simple" ? (
                  <>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Hanzi"
                          id="new-vocab-hanzi"
                          className="text-sm"
                        />
                        <Input
                          placeholder="Pinyin"
                          id="new-vocab-pinyin"
                          className="text-sm"
                        />
                        <Input
                          placeholder="Translation"
                          id="new-vocab-translation"
                          className="text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const hanzi = (document.getElementById('new-vocab-hanzi') as HTMLInputElement)?.value || ""
                          const pinyin = (document.getElementById('new-vocab-pinyin') as HTMLInputElement)?.value || ""
                          const translation = (document.getElementById('new-vocab-translation') as HTMLInputElement)?.value || ""
                          if (hanzi && pinyin) {
                            setVocabCards([...vocabCards, { hanzi, pinyin, translation, order_index: vocabCards.length }])
                            ;(document.getElementById('new-vocab-hanzi') as HTMLInputElement).value = ""
                            ;(document.getElementById('new-vocab-pinyin') as HTMLInputElement).value = ""
                            ;(document.getElementById('new-vocab-translation') as HTMLInputElement).value = ""
                          }
                        }}
                      >
                        + Tambah Card
                      </Button>
                    </div>
                    {vocabCards.length > 0 && (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {vocabCards.map((card, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border border-border">
                            <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                              <span className="font-medium">{card.hanzi}</span>
                              <span className="text-muted-foreground">{card.pinyin}</span>
                              <span>{card.translation}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setVocabCards(vocabCards.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Textarea
                      value={formData.vocab_parts}
                      onChange={(e) => setFormData({ ...formData, vocab_parts: e.target.value })}
                      placeholder='{"cards": [{"hanzi": "你好", "pinyin": "nǐ hǎo", "translation": "Halo", "order_index": 0}]}'
                      className="font-mono text-sm min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format JSON untuk vocab cards. Contoh: {`{"cards": [{"hanzi": "你好", "pinyin": "nǐ hǎo", "translation": "Halo", "order_index": 0}]}`}
                    </p>
                  </>
                )}
              </div>

              {/* Kalimat Parts Section */}
              <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">📝 Contoh Kalimat</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={kalimatMode === "simple" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setKalimatMode("simple")}
                    >
                      Simple
                    </Button>
                    <Button
                      type="button"
                      variant={kalimatMode === "json" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setKalimatMode("json")}
                    >
                      JSON
                    </Button>
                  </div>
                </div>
                {kalimatMode === "simple" ? (
                  <>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Hanzi"
                          id="new-kalimat-hanzi"
                          className="text-sm"
                        />
                        <Input
                          placeholder="Pinyin"
                          id="new-kalimat-pinyin"
                          className="text-sm"
                        />
                        <Input
                          placeholder="Translation"
                          id="new-kalimat-translation"
                          className="text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const hanzi = (document.getElementById('new-kalimat-hanzi') as HTMLInputElement)?.value || ""
                          const pinyin = (document.getElementById('new-kalimat-pinyin') as HTMLInputElement)?.value || ""
                          const translation = (document.getElementById('new-kalimat-translation') as HTMLInputElement)?.value || ""
                          if (hanzi && pinyin) {
                            setKalimatCards([...kalimatCards, { hanzi, pinyin, translation, order_index: kalimatCards.length }])
                            ;(document.getElementById('new-kalimat-hanzi') as HTMLInputElement).value = ""
                            ;(document.getElementById('new-kalimat-pinyin') as HTMLInputElement).value = ""
                            ;(document.getElementById('new-kalimat-translation') as HTMLInputElement).value = ""
                          }
                        }}
                      >
                        + Tambah Kalimat
                      </Button>
                    </div>
                    {kalimatCards.length > 0 && (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {kalimatCards.map((card, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border border-border">
                            <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                              <span className="font-medium">{card.hanzi}</span>
                              <span className="text-muted-foreground">{card.pinyin}</span>
                              <span>{card.translation}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setKalimatCards(kalimatCards.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Textarea
                      value={formData.kalimat_parts}
                      onChange={(e) => setFormData({ ...formData, kalimat_parts: e.target.value })}
                      placeholder='{"cards": [{"hanzi": "你好", "pinyin": "nǐ hǎo", "translation": "Halo", "order_index": 0}]}'
                      className="font-mono text-sm min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format JSON untuk contoh kalimat. Contoh: {`{"cards": [{"hanzi": "你好", "pinyin": "nǐ hǎo", "translation": "Halo", "order_index": 0}]}`}
                    </p>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={editingPart ? handleEdit : handleAdd} className="flex-1">
                  {editingPart ? "Update" : "Tambah"}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingPart(null); setFormData({ module_id: "", order_index: 0, title: "", content: "", vocab_parts: "", kalimat_parts: "" }); setPlainContent(""); setContentMode("text"); setVocabCards([]); setVocabMode("simple"); setKalimatCards([]); setKalimatMode("simple") }}>
                  Batal
                </Button>
              </div>
            </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingPart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Hapus Modul modul Part</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Apakah Anda yakin ingin menghapus part ini?
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Title: {deletingPart.title}</p>
                </div>
                <p className="text-xs text-destructive">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingPart(null)}>
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
