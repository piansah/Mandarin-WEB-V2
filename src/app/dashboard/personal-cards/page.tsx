"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listThemes, createTheme, deleteTheme, type PersonalTheme } from "@/lib/personal-decks"
import { Plus, Trash2, FolderOpen, ChevronRight } from "lucide-react"

export default function PersonalCardsPage() {
  const [themes, setThemes] = React.useState<PersonalTheme[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [newThemeName, setNewThemeName] = React.useState("")
  const [selectedIcon, setSelectedIcon] = React.useState("📚")
  const [creating, setCreating] = React.useState(false)
  const router = useRouter()

  const ICON_OPTIONS = ["📚", "🎯", "🌟", "🔥", "⚡", "📖", "🎨", "🎵", "🎮", "🧠"]

  React.useEffect(() => {
    loadThemes()
  }, [])

  async function loadThemes() {
    setLoading(true)
    const data = await listThemes()
    setThemes(data)
    setLoading(false)
  }

  async function handleCreateTheme() {
    if (!newThemeName.trim()) return
    setCreating(true)
    const result = await createTheme(newThemeName.trim(), selectedIcon)
    setCreating(false)
    if (!result.error) {
      setShowCreateModal(false)
      setNewThemeName("")
      setSelectedIcon("📚")
      loadThemes()
    } else {
      alert(result.error)
    }
  }

  async function handleDeleteTheme(id: number) {
    if (!confirm("Yakin ingin menghapus tema ini? Semua deck dan kartu di dalamnya juga akan terhapus.")) return
    const result = await deleteTheme(id)
    if (!result.error) {
      loadThemes()
    } else {
      alert(result.error)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat deck pribadi...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Deck Pribadi</h1>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Buat Tema Baru
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Kelola deck kartu pribadi untuk belajar kosakata khusus</p>
      </div>

      {/* Create Theme Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Buat Tema Baru</CardTitle>
              <CardDescription>Tema adalah kumpulan deck untuk topik tertentu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nama Tema</label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="Contoh: Bisnis, Travel, Makanan..."
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setSelectedIcon(icon)}
                      className={`w-10 h-10 rounded-lg border-2 text-xl flex items-center justify-center transition-all ${
                        selectedIcon === icon ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Batal
                </Button>
                <Button onClick={handleCreateTheme} disabled={creating || !newThemeName.trim()}>
                  {creating ? "Membuat..." : "Buat Tema"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {themes.length === 0 && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">📚</div>
            <div>
              <h3 className="text-lg font-medium">Belum ada tema</h3>
              <p className="text-sm text-muted-foreground">Mulai dengan membuat tema baru untuk mengorganisir deck pribadimu</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Buat Tema Pertama
            </Button>
          </div>
        </Card>
      )}

      {/* Themes Grid */}
      {themes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <Card key={theme.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{theme.icon || "📚"}</div>
                    <div>
                      <CardTitle className="text-lg">{theme.name}</CardTitle>
                      <CardDescription>
                        {theme.deck_count || 0} deck
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteTheme(theme.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/dashboard/personal-cards/${theme.id}`)}
                >
                  Buka Tema
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
