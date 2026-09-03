"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  fetchUserProfile,
  updateAvatar,
  updateProfileName,
  uploadAvatarPhoto,
  AVATAR_OPTIONS,
  BADGES,
  type UserProfile,
} from "@/lib/user-profile"
import { Trophy, Star, Flame, BookOpen, Target, Award, Settings, Camera, Loader2 } from "lucide-react"

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editingName, setEditingName] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()

  React.useEffect(() => {
    fetchUserProfile().then((p) => {
      setProfile(p)
      setLoading(false)
      if (p) setNewName(p.displayName)
    })
  }, [])

  const handleSaveName = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const result = await updateProfileName(newName.trim())
    setSaving(false)
    if (!result.error) {
      setEditingName(false)
      fetchUserProfile().then(setProfile)
    } else {
      alert(result.error)
    }
  }

  const handleSelectAvatar = async (avatarId: string) => {
    setSaving(true)
    const result = await updateAvatar(avatarId)
    setSaving(false)
    if (!result.error) {
      fetchUserProfile().then(setProfile)
    } else {
      alert(result.error)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi tipe & ukuran
    if (!file.type.startsWith("image/")) {
      alert("Hanya file gambar yang diizinkan.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran foto maksimal 5 MB.")
      return
    }

    // Tampilkan preview lokal dulu agar terasa instan
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)

    setUploading(true)
    const result = await uploadAvatarPhoto(file)
    setUploading(false)

    if (result.error) {
      alert("Gagal upload: " + result.error)
      setPreviewUrl(null)
    } else {
      // Langsung update state untuk data database.
      setProfile((prev) =>
        prev ? { ...prev, customAvatarUrl: result.url } : prev
      )
      // Sengaja TIDAK men-set previewUrl(null) di sini agar foto tidak berkedip
      // menunggu browser mendownload URL foto asli dari Supabase.
      // localUrl (blob) tetap akan dipakai selama user di halaman ini.
    }

    // Reset input agar bisa pilih file sama lagi
    e.target.value = ""
  }

  const getLevelProgress = (level: number): number => {
    if (level < 10) return ((level - 1) / 9) * 100
    if (level < 20) return ((level - 11) / 9) * 100
    if (level < 30) return ((level - 21) / 9) * 100
    if (level < 40) return ((level - 31) / 9) * 100
    return Math.min(100, ((level - 41) / 59) * 100)
  }

  const getXPForNextLevel = (level: number): number => {
    if (level < 10) return level * 100
    if (level < 20) return 1000 + (level - 11) * 400
    if (level < 30) return 5000 + (level - 21) * 1000
    if (level < 40) return 15000 + (level - 31) * 3500
    return 50000 + (level - 41) * 10000
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat profil...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Kamu belum login.</p>
      </div>
    )
  }

  // Prioritas tampilan: preview lokal → custom upload → emoji fallback
  const displaySrc = previewUrl ?? profile.customAvatarUrl ?? undefined

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Profil Saya</h1>
        <p className="text-sm text-muted-foreground">Kelola profil, level, dan pencapaianmu</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
            {/* Avatar with upload button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploading}
                className="relative group focus:outline-none"
                title="Klik untuk ganti foto profil"
              >
                <Avatar className="h-24 w-24 border-4 border-primary">
                  <AvatarImage src={displaySrc} alt={profile.displayName} />
                  <AvatarFallback className="text-3xl">
                    {profile.avatar ?? profile.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Overlay kamera */}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>

              <Badge className="absolute bottom-0 right-0 bg-primary">
                Lvl {profile.level}
              </Badge>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex-1 flex flex-col items-center md:items-start space-y-2">
              <div className="flex items-center gap-2">
                {editingName ? (
                  <div className="flex flex-col md:flex-row items-center gap-3 w-full">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none w-full max-w-[200px] md:max-w-[300px] text-center md:text-left"
                      maxLength={30}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveName} disabled={saving}>
                        {saving ? "Menyimpan..." : "Simpan"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNewName(profile.displayName) }}>
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 max-w-full">
                    <h2 className="text-2xl font-bold truncate">{profile.displayName}</h2>
                    <Button size="sm" variant="ghost" onClick={() => setEditingName(true)} className="shrink-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Award className="h-3 w-3 mr-1" />
                  {profile.title}
                </Badge>
              </div>
              {/* Upload hint */}
            </div>
          </div>

          {/* Level Progress */}
          <div className="mt-8 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Level {profile.level}</span>
              <span className="text-muted-foreground">Level {profile.level + 1}</span>
            </div>
            <Progress value={getLevelProgress(profile.level)} className="h-2" />
            <div className="text-xs text-muted-foreground text-center md:text-left">
              {getXPForNextLevel(profile.level + 1) - profile.totalScore} XP ke level berikutnya
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total XP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{profile.totalScore.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Streak Terbaik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{profile.bestStreak}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kata Dihafal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{profile.wordsMastered}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quiz Selesai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{profile.quizCompleted}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unlocked Tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Tier Terbuka
          </CardTitle>
          <CardDescription>Tier konten HSK yang sudah kamu buka</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {profile.unlockedTiers.map((tier) => (
              <Badge key={tier} variant="secondary" className="text-sm px-3 py-1">
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Badge Pencapaian
          </CardTitle>
          <CardDescription>Badge yang kamu dapatkan dari berbagai pencapaian</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.badges.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {profile.badges.map((badgeKey) => {
                const badge = BADGES[badgeKey]
                return (
                  <div
                    key={badgeKey}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-4xl">{badge.icon}</div>
                    <div className="text-center">
                      <div className="font-medium text-sm">{badge.name}</div>
                      <div className="text-xs text-muted-foreground">{badge.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada badge. Selesaikan quiz dan pertahankan streak untuk mendapatkan badge!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emoji Avatar Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Avatar Emoji</CardTitle>
          <CardDescription>Atau pilih avatar emoji sebagai fallback saat tidak ada foto</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-4">
            {AVATAR_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelectAvatar(option.id)}
                disabled={saving}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:border-primary/50 ${
                  profile.avatar === option.emoji ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <div className="text-3xl">{option.emoji}</div>
                <div className="text-xs text-center">{option.name}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
