"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Profile - User Account and Badges */

import { toast } from "sonner";
import { PageLoader } from "@/components/page-loader"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  fetchUserProfile,
  updateAvatar,
  updateProfileName,
  uploadAvatarPhoto,
  AVATAR_OPTIONS,
  BADGES,
  type UserProfile,
} from "@/lib/user-profile"
import { Trophy, Star, Flame, BookOpen, Target, Award, PenLine, Camera, Loader2, FolderHeart, Settings, ChevronDown, Check, LockKeyhole } from "lucide-react"

async function compressAvatarImage(file: File): Promise<File> {
  let width = 0
  let height = 0
  let drawImage: (context: CanvasRenderingContext2D, width: number, height: number) => void
  let cleanup = () => {}

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file)
    width = bitmap.width
    height = bitmap.height
    drawImage = (context, targetWidth, targetHeight) => context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    cleanup = () => bitmap.close()
  } else {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("Foto tidak dapat dibaca oleh browser."))
        image.src = objectUrl
      })
      width = image.naturalWidth
      height = image.naturalHeight
      drawImage = (context, targetWidth, targetHeight) => context.drawImage(image, 0, 0, targetWidth, targetHeight)
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
    cleanup = () => URL.revokeObjectURL(objectUrl)
  }

  try {
    const maxOutputSize = 300 * 1024
    for (const maxDimension of [512, 448, 384, 320]) {
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const targetWidth = Math.max(1, Math.round(width * scale))
      const targetHeight = Math.max(1, Math.round(height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Browser tidak dapat memproses foto.")

      // JPEG has no alpha channel; use a light background for transparent PNGs.
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, targetWidth, targetHeight)
      drawImage(context, targetWidth, targetHeight)

      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality))
        if (blob && blob.size <= maxOutputSize) {
          return new File([blob], "profile.jpg", { type: "image/jpeg", lastModified: Date.now() })
        }
      }
    }
    throw new Error("Foto masih terlalu besar setelah dikompres. Coba pilih foto lain.")
  } finally {
    cleanup()
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editingName, setEditingName] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = React.useState(false)
  const [isMobileViewport, setIsMobileViewport] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)")
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches)
    updateViewport()
    mediaQuery.addEventListener("change", updateViewport)
    return () => mediaQuery.removeEventListener("change", updateViewport)
  }, [])

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
      toast.error(result.error)
    }
  }

  const handleSelectAvatar = async (avatarId: string) => {
    const option = AVATAR_OPTIONS.find(avatar => avatar.id === avatarId)
    if (!option) return

    const previousAvatar = profile?.avatar ?? null
    // Update the badge immediately; wait for Supabase in the background and
    // roll back only if the save fails.
    setProfile(current => current ? { ...current, avatar: option.emoji } : current)
    setAvatarPickerOpen(false)
    setSaving(true)
    try {
      const result = await updateAvatar(avatarId)
      if (result.error) throw new Error(result.error)
    } catch (error) {
      setProfile(current => current ? { ...current, avatar: previousAvatar } : current)
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan avatar.")
    } finally {
      setSaving(false)
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
      toast.error("Hanya file gambar yang diizinkan.")
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 20 MB agar bisa diproses di perangkat.")
      return
    }

    setUploading(true)
    try {
      const compressedFile = await compressAvatarImage(file)
      // Preview memakai file yang sama dengan yang dikirim ke storage.
      setPreviewUrl(URL.createObjectURL(compressedFile))

      const result = await uploadAvatarPhoto(compressedFile)
      if (result.error) {
        toast.error("Gagal upload: " + result.error)
        setPreviewUrl(null)
      } else {
        setProfile((prev) =>
          prev ? { ...prev, customAvatarUrl: result.url } : prev
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto gagal diproses.")
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
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
    return <PageLoader />
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
  const isAvatarUnlocked = (option: (typeof AVATAR_OPTIONS)[number]) => profile.unlockedAvatarIds.includes(option.id)
  const unlockedAvatarOptions = AVATAR_OPTIONS.filter(isAvatarUnlocked)
  const selectedAvatar = unlockedAvatarOptions.find(option => option.emoji === profile.avatar) ?? unlockedAvatarOptions[0] ?? AVATAR_OPTIONS.find(option => option.id === "default")
  const sortedAvatarOptions = [...AVATAR_OPTIONS].reverse()
  const profileWatermark = selectedAvatar?.watermark ?? "初"

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Profile Card */}
      <Card className={`relative isolate overflow-visible ${avatarPickerOpen ? "z-20" : ""}`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
          <span className="absolute -bottom-10 -right-2 select-none font-hanzi text-[15rem] font-black leading-none text-primary/[0.09] dark:text-primary/[0.045]">
            {profileWatermark}
          </span>
        </div>
        <CardContent className="relative z-10 p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
            {/* Avatar with upload button */}
            <div className="relative shrink-0">
              <button
                type="button"
                data-bottom-accent="off"
                onClick={handleAvatarClick}
                disabled={uploading}
                className="relative group rounded-full focus:outline-none"
                title="Klik untuk ganti foto profil"
              >
                <Avatar className="h-24 w-24 border-4 border-primary">
                  <AvatarImage src={displaySrc} alt={profile.displayName} />
                  <AvatarFallback className="text-3xl">
                    {selectedAvatar?.emoji ?? profile.displayName.slice(0, 2).toUpperCase()}
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
                    <Button size="sm" variant="ghost" onClick={() => setEditingName(true)} className="shrink-0" aria-label="Edit nama" title="Edit nama">
                      <PenLine className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Award className="h-3 w-3 mr-1" />
                  {selectedAvatar?.title ?? profile.title}
                </Badge>
                <div className="relative">
                  <button
                    type="button"
                    data-bottom-accent="off"
                    aria-label="Pilih avatar gelar"
                    aria-expanded={avatarPickerOpen}
                    onClick={() => setAvatarPickerOpen(open => !open)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="text-base leading-none">{selectedAvatar?.emoji ?? "👤"}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${avatarPickerOpen ? "rotate-180" : ""}`} />
                  </button>
                  {avatarPickerOpen && !isMobileViewport && (
                    <div className="absolute left-0 top-full z-30 mt-2 hidden max-h-[min(60vh,24rem)] w-[19rem] overflow-y-auto rounded-xl border border-border bg-card p-3 text-left shadow-xl sm:block">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Avatar terbuka dari gelar</p>
                      <div className="grid grid-cols-2 gap-2">
                        {sortedAvatarOptions.map(option => {
                          const unlocked = isAvatarUnlocked(option)
                          const selected = unlocked && option.emoji === selectedAvatar?.emoji
                          return (
                            <button
                              key={option.id}
                              type="button"
                              data-bottom-accent="off"
                              disabled={!unlocked || saving}
                              onClick={() => handleSelectAvatar(option.id)}
                              title={unlocked ? option.name : `Avatar ${option.name} belum terbuka`}
                              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${selected ? "border-primary/70 bg-primary/10" : "border-border/60 bg-background/50"} ${unlocked ? "hover:bg-muted/70" : "cursor-not-allowed opacity-45"}`}
                            >
                              <span className="shrink-0 text-xl leading-none">{option.emoji}</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-1">
                                  <span className="shrink-0 font-hanzi text-sm leading-none text-muted-foreground" aria-label={`Watermark ${option.watermark}`}>{option.watermark}</span>
                                  <span className="truncate text-xs font-medium">{option.name}</span>
                                </span>
                                <span className="block truncate text-[10px] text-muted-foreground">{option.title}</span>
                              </span>
                              {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Dipilih" /> : !unlocked ? <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Sheet open={avatarPickerOpen && isMobileViewport} onOpenChange={setAvatarPickerOpen}>
                <SheetContent side="bottom" showCloseButton={false} className="max-h-[75dvh] gap-3 rounded-t-2xl border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-4 sm:hidden">
                  <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                  <SheetTitle className="text-sm">Avatar terbuka dari gelar</SheetTitle>
                  <div className="grid min-h-0 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pb-2">
                    {sortedAvatarOptions.map(option => {
                      const unlocked = isAvatarUnlocked(option)
                      const selected = unlocked && option.emoji === selectedAvatar?.emoji
                      return (
                        <button
                          key={option.id}
                          type="button"
                          data-bottom-accent="off"
                          disabled={!unlocked || saving}
                          onClick={() => handleSelectAvatar(option.id)}
                          title={unlocked ? option.name : `Avatar ${option.name} belum terbuka`}
                          className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? "border-primary/70 bg-primary/10" : "border-border/60 bg-background/50"} ${unlocked ? "hover:bg-muted/70" : "cursor-not-allowed opacity-45"}`}
                        >
                          <span className="shrink-0 text-xl leading-none">{option.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-1">
                              <span className="shrink-0 font-hanzi text-sm leading-none text-muted-foreground" aria-label={`Watermark ${option.watermark}`}>
                                {option.watermark}
                              </span>
                              <span className="truncate text-xs font-medium">{option.name}</span>
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">{option.title}</span>
                          </span>
                          {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Dipilih" /> : !unlocked ? <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </SheetContent>
              </Sheet>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Kata Dipelajari</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{profile.wordsLearned}</span>
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

      {/* Koleksi pribadi */}
      <Card>
        <CardHeader>
          <CardTitle>Koleksi pribadi</CardTitle>
          <CardDescription>Akses kosakata dan deck yang kamu simpan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/favorit"
            data-bottom-accent="off"
            className="flex min-h-16 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Star className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">Favorit</span>
              <span className="block truncate text-sm text-muted-foreground">Kosakata yang kamu simpan</span>
            </span>
          </Link>
          <Link
            href="/dashboard/personal-cards"
            data-bottom-accent="off"
            className="flex min-h-16 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderHeart className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">Deck Saya</span>
              <span className="block truncate text-sm text-muted-foreground">Deck kosakata buatanmu</span>
            </span>
          </Link>
        </CardContent>
      </Card>

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

      <div className="flex justify-end border-t border-border/50 pt-4 md:hidden">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center sm:w-auto"
          onClick={() => router.push("/dashboard/settings")}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Pengaturan
        </Button>
      </div>
    </div>
  )
}
