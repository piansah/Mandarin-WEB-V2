"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { fetchUserProfile, updateAvatar, updateProfileName, AVATAR_OPTIONS, BADGES, type UserProfile } from "@/lib/user-profile"
import { Trophy, Star, Flame, BookOpen, Target, Award, Settings, ChevronRight } from "lucide-react"

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editingName, setEditingName] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [selectedAvatar, setSelectedAvatar] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
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
    setSelectedAvatar(avatarId)
    setSaving(true)
    const result = await updateAvatar(avatarId)
    setSaving(false)
    if (!result.error) {
      fetchUserProfile().then(setProfile)
    } else {
      alert(result.error)
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
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar || undefined} alt={profile.displayName} />
                <AvatarFallback className="text-3xl">{profile.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Badge className="absolute -bottom-2 -right-2 bg-primary">
                Lvl {profile.level}
              </Badge>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none"
                      maxLength={30}
                    />
                    <Button size="sm" onClick={handleSaveName} disabled={saving}>
                      {saving ? "Menyimpan..." : "Simpan"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNewName(profile.displayName) }}>
                      Batal
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">{profile.displayName}</h2>
                    <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}>
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
            </div>

            <div className="text-right space-y-1">
              <div className="text-3xl font-bold text-primary">{profile.totalScore.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total XP</div>
            </div>
          </div>

          {/* Level Progress */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Level {profile.level}</span>
              <span className="text-muted-foreground">Level {profile.level + 1}</span>
            </div>
            <Progress value={getLevelProgress(profile.level)} className="h-2" />
            <div className="text-xs text-muted-foreground text-center">
              {getXPForNextLevel(profile.level + 1) - profile.totalScore} XP ke level berikutnya
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Streak Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{profile.streak} hari</span>
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
              <span className="text-2xl font-bold">{profile.bestStreak} hari</span>
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

      {/* Avatar Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Ganti Avatar</CardTitle>
          <CardDescription>Pilih avatar untuk profil kamu</CardDescription>
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
