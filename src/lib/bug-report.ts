/**
 * LAPOR BUG — port dari `src/JS/features/report.js`. Sama seperti versi lama:
 * insert ke tabel `bug_reports` + info perangkat otomatis, tanpa modal HTML
 * manual (diganti komponen React + shadcn Dialog di `bug-report-fab.tsx`).
 */

import { createClient } from "@/lib/supabase/browser"

export function getDeviceInfo() {
  if (typeof window === "undefined") return {}
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href,
    language: navigator.language,
    vendor: navigator.vendor,
    time: new Date().toISOString(),
  }
}

export async function submitBugReport(input: {
  title: string
  description: string
  reportType?: "bug" | "feedback"
  targetId?: string | null
}): Promise<{ error: string | null }> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()

  const { error } = await supa.from("bug_reports").insert({
    user_id: user ? user.id : null,
    title: input.title,
    description: input.description,
    device_info: getDeviceInfo(),
    report_type: input.reportType ?? "bug",
    target_id: input.targetId ?? null,
  })

  return { error: error?.message ?? null }
}
