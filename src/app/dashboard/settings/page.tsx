"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchUserSettings, updateDisplayName, updateHanziMode, updateHanziFont, signOut, type UserSettings } from "@/lib/user-settings"
import type { HanziMode } from "@/lib/placement"
import { User, Mic, LogOut, Save, Check, Type } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = React.useState<UserSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editingName, setEditingName] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [selectedHanziMode, setSelectedHanziMode] = React.useState<HanziMode | null>(null)
  const [selectedHanziFont, setSelectedHanziFont] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  React.useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    const data = await fetchUserSettings()
    setSettings(data)
    if (data) {
      setNewName(data.displayName)
      setSelectedHanziMode(data.hanziMode)
      setSelectedHanziFont(data.hanziFont)
    }
    setLoading(false)
  }

  async function handleSaveName() {
    if (!newName.trim()) return
    setSaving(true)
    const result = await updateDisplayName(newName.trim())
    setSaving(false)
    if (!result.error) {
      setEditingName(false)
      showSaveSuccess()
      loadSettings()
    } else {
      alert(result.error)
    }
  }

  async function handleSaveHanziMode() {
    if (!selectedHanziMode) return
    setSaving(true)
    const result = await updateHanziMode(selectedHanziMode)
    setSaving(false)
    if (!result.error) {
      showSaveSuccess()
      loadSettings()
    } else {
      alert(result.error)
    }
  }

  async function handleSaveHanziFont() {
    if (!selectedHanziFont) return
    setSaving(true)
    const result = await updateHanziFont(selectedHanziFont)
    setSaving(false)
    if (!result.error) {
      showSaveSuccess()
      loadSettings()
      // Force page reload to apply new font
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } else {
      alert(result.error)
    }
  }

  function showSaveSuccess() {
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  async function handleSignOut() {
    if (!confirm("Yakin ingin keluar?")) return
    await signOut()
    router.push("/login")
    router.refresh()
  }

  const HANZI_MODES: { value: HanziMode; label: string; description: string }[] = [
    { value: 0, label: "Simplified", description: "汉字简体 - Hanzi versi sederhana" },
    { value: 1, label: "Traditional", description: "漢字繁體 - Hanzi versi tradisional" },
  ]

  const HANZI_FONTS: { value: string; label: string; description: string; sample: string }[] = [
    { value: "noto-sans-sc", label: "Noto Sans SC", description: "Font modern dan clean", sample: "木" },
    { value: "ma-shan-zheng", label: "Ma Shan Zheng", description: "Font brush style tradisional", sample: "木" },
    { value: "zcool-xiao-wei", label: "ZCOOL XiaoWei", description: "Font fun dan playful", sample: "木" },
    { value: "long-cang", label: "Long Cang", description: "Font elegant dan artistic", sample: "木" },
  ]

  const FONT_FAMILY_VALUES: Record<string, string> = {
    "noto-sans-sc": "var(--font-noto-sans-sc), 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    "ma-shan-zheng": "var(--font-ma-shan-zheng), 'Ma Shan Zheng', 'Noto Sans SC', sans-serif",
    "zcool-xiao-wei": "var(--font-zcool-xiao-wei), 'ZCOOL XiaoWei', 'Noto Sans SC', sans-serif",
    "long-cang": "var(--font-long-cang), 'Long Cang', 'Noto Sans SC', sans-serif",
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat pengaturan...</p>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Kamu belum login.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Kelola preferensi akun dan aplikasi</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profil
          </CardTitle>
          <CardDescription>Informasi akun dan nama tampilan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <div className="px-3 py-2 rounded-md border bg-muted/50 text-muted-foreground">
              {settings.email}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Nama Tampilan</label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border bg-background"
                  maxLength={30}
                />
                <Button onClick={handleSaveName} disabled={saving}>
                  {saving ? "Menyimpan..." : <Save className="h-4 w-4" />}
                </Button>
                <Button variant="outline" onClick={() => { setEditingName(false); setNewName(settings.displayName) }}>
                  Batal
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="px-3 py-2 rounded-md border bg-muted/50">
                  {settings.displayName}
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditingName(true)}>
                  Edit
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hanzi Mode Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Mode Hanzi
          </CardTitle>
          <CardDescription>Pilih versi hanzi yang ingin dipelajari</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {HANZI_MODES.map((mode) => (
              <div
                key={mode.value}
                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedHanziMode === mode.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedHanziMode(mode.value)}
              >
                <div>
                  <div className="font-medium">{mode.label}</div>
                  <div className="text-sm text-muted-foreground">{mode.description}</div>
                </div>
                {selectedHanziMode === mode.value && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
            ))}
          </div>
          {selectedHanziMode !== settings.hanziMode && (
            <div className="flex justify-end">
              <Button onClick={handleSaveHanziMode} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hanzi Font Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Font Hanzi
          </CardTitle>
          <CardDescription>Pilih font untuk tampilan karakter Mandarin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {HANZI_FONTS.map((font) => (
              <div
                key={font.value}
                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedHanziFont === font.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedHanziFont(font.value)}
              >
                <div className="flex items-center gap-4">
                  <div className="font-hanzi text-3xl" style={{
                    fontFamily: selectedHanziFont === font.value ? FONT_FAMILY_VALUES[font.value as keyof typeof FONT_FAMILY_VALUES] : 'var(--font-hanzi)'
                  }}>
                    {font.sample}
                  </div>
                  <div>
                    <div className="font-medium">{font.label}</div>
                    <div className="text-sm text-muted-foreground">{font.description}</div>
                  </div>
                </div>
                {selectedHanziFont === font.value && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
            ))}
          </div>
          {selectedHanziFont !== settings.hanziFont && (
            <div className="flex justify-end">
              <Button onClick={handleSaveHanziFont} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Akun</CardTitle>
          <CardDescription>Tindakan terkait akun</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        </CardContent>
      </Card>

      {/* Save Success Toast */}
      {saveSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          Perubahan disimpan
        </div>
      )}
    </div>
  )
}
