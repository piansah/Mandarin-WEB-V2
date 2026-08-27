/**
 * BUG REPORTS — sistem report menggunakan tabel bug_reports yang sudah ada
 * 
 * Report types:
 * - 'bug': laporan bug aplikasi
 * - 'content': laporan konten salah (kalimat/kosakata)
 * - 'suggestion': saran fitur
 */

import { createClient } from "@/lib/supabase/browser"

export type ReportType = "bug" | "content" | "suggestion"
export type ReportStatus = "open" | "in-progress" | "fixed" | "closed"

export type BugReport = {
  id: number
  user_id: string | null
  title: string
  description: string
  device_info: Record<string, any> | null
  status: ReportStatus
  created_at: string
  report_type: ReportType
  target_id: string | null
}

async function requireUser() {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  return { supa, user }
}

export async function submitContentReport(
  contentType: "kalimat" | "kosakata",
  contentId: number | string,
  contentLabel: string,
  reason: string,
  description: string | null
): Promise<{ error: string | null }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }

  const title = `Kesalahan ${contentType === "kalimat" ? "Kalimat" : "Kata"}: ${contentLabel}`
  const fullDescription = `Ditemukan kesalahan pada ${contentType}: ${contentLabel}\n\nAlasan: ${reason}\n\n${description || "Tidak ada detail tambahan."}`

  const deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    timestamp: new Date().toISOString(),
  }

  const { error } = await supa.from("bug_reports").insert({
    user_id: user.id,
    title,
    description: fullDescription,
    device_info: deviceInfo,
    report_type: "content",
    target_id: String(contentId),
    status: "open",
  })

  return { error: error?.message ?? null }
}

export async function checkUserContentReport(
  contentId: number | string
): Promise<boolean> {
  const { supa, user } = await requireUser()
  if (!user) return false

  const { data } = await supa
    .from("bug_reports")
    .select("id")
    .eq("user_id", user.id)
    .eq("report_type", "content")
    .eq("target_id", String(contentId))
    .maybeSingle()

  return !!data
}

/**
 * Batch version: check which of the given content IDs have been reported
 * by the current user. Returns a Set of reported IDs.
 * Uses a single DB query instead of one query per item.
 */
export async function checkUserContentReports(
  contentIds: number[]
): Promise<Set<number>> {
  if (contentIds.length === 0) return new Set()
  const { supa, user } = await requireUser()
  if (!user) return new Set()

  const targetIds = contentIds.map(String)
  const { data } = await supa
    .from("bug_reports")
    .select("target_id")
    .eq("user_id", user.id)
    .eq("report_type", "content")
    .in("target_id", targetIds)

  const reported = new Set<number>()
  for (const row of data ?? []) {
    if (row.target_id != null) {
      const parsed = Number(row.target_id)
      if (!isNaN(parsed)) reported.add(parsed)
    }
  }
  return reported
}
