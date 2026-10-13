"use client"

import * as React from "react"
import { Bell, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/browser"
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications"

type Notification = {
  id: number
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

const POLL_INTERVAL_MS = 60_000

export function NotificationDropdown() {
  const [open, setOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePress)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress)
    }
  }, [])

  /**
   * @param silent true untuk refresh latar belakang (tanpa spinner "Memuat...")
   */
  const loadNotifications = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const supa = createClient()
      const {
        data: { user },
      } = await supa.auth.getUser()
      if (!user) return

      const [listRes, countRes] = await Promise.all([
        supa
          .from("notifications" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        // Hitung unread langsung dari database, bukan hanya dari 10 terbaru
        supa
          .from("notifications" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false),
      ])

      if (listRes.error) {
        console.error("[Notification] Gagal memuat notifikasi:", listRes.error)
        setLoadError(listRes.error.message)
        return
      }

      setLoadError(null)
      const rows = (listRes.data ?? []) as unknown as Notification[]
      setNotifications(rows)

      if (countRes.error) {
        console.error("[Notification] Gagal menghitung unread:", countRes.error)
        setUnreadCount(rows.filter((n) => !n.read).length)
      } else {
        setUnreadCount(countRes.count ?? 0)
      }
    } catch (error) {
      console.error("[Notification] Error tak terduga saat memuat:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Muat saat pertama kali tampil
  React.useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Refresh otomatis: event dari createNotification, kembali ke tab, dan polling
  React.useEffect(() => {
    const refresh = () => loadNotifications(true)
    const onVisibility = () => {
      if (!document.hidden) refresh()
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", onVisibility)
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", onVisibility)
      window.clearInterval(timer)
    }
  }, [loadNotifications])

  const markAsRead = async (id: number) => {
    try {
      const supa = createClient()
      const {
        data: { user },
      } = await supa.auth.getUser()
      if (!user) return

      const { error } = await supa
        .from("notifications" as any)
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", user.id)

      if (error) {
        console.error("[Notification] Gagal menandai dibaca:", error)
        return
      }

      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("[Notification] Error saat menandai dibaca:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const supa = createClient()
      const {
        data: { user },
      } = await supa.auth.getUser()
      if (!user) return

      const { error } = await supa
        .from("notifications" as any)
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)

      if (error) {
        console.error("[Notification] Gagal menandai semua dibaca:", error)
        return
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error("[Notification] Error saat menandai semua dibaca:", error)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Baru saja"
    if (diffMins < 60) return `${diffMins} menit lalu`
    if (diffHours < 24) return `${diffHours} jam lalu`
    if (diffDays < 7) return `${diffDays} hari lalu`
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full relative shrink-0"
        aria-label="Notifikasi"
        onClick={() => {
          const willOpen = !open
          setOpen(willOpen)
          if (willOpen) loadNotifications()
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-md shadow-lg z-50 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Notifikasi</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                Tandai semua dibaca
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat...
              </div>
            ) : loadError ? (
              <div className="p-4 text-center text-sm text-red-400">
                Gagal memuat notifikasi: {loadError}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Belum ada notifikasi</div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-muted transition-colors cursor-pointer ${
                      !notification.read ? "bg-muted/30" : ""
                    }`}
                    onClick={() => {
                      if (!notification.read) markAsRead(notification.id)
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{notification.title}</p>
                          {!notification.read && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">{formatTime(notification.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}