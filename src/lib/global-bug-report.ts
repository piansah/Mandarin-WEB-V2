"use client"

/**
 * GLOBAL BUG REPORT — function global untuk openBugReportModal
 * Ini dipakai oleh komponen yang butuh akses cepat ke bug report
 *
 * PENTING: modul ini HARUS di-import dari Client Component (bukan dari
 * Server Component layout) supaya kode registrasi `window.openBugReportModal`
 * beneran jalan di browser. Kalau di-import cuma dari Server Component,
 * `typeof window !== "undefined"` di bawah selalu false pas SSR, dan modul ini
 * nggak ikut ke-bundle buat client — jadi window.openBugReportModal nggak
 * pernah ke-set sama sekali di browser, dan semua pemanggil
 * `window.openBugReportModal?.(...)` diam-diam no-op (gara-gara optional
 * chaining) tanpa error apapun.
 */

import { toast } from "sonner"
import { submitContentReport } from "./bug-reports"

let bugReportModalElement: HTMLElement | null = null
let currentBugReportResolve: ((value: boolean) => void) | null = null

export function openBugReportModal(
  title: string,
  description: string,
  reportType: "bug" | "content" | "suggestion",
  targetId?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    currentBugReportResolve = resolve
    
    // Buat modal sederhana
    const modal = document.createElement("div")
    modal.className = "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    modal.innerHTML = `
      <div class="bg-card rounded-lg max-w-md w-full p-6 border border-border">
        <h3 class="text-lg font-bold mb-2">Laporan: ${title}</h3>
        <p class="text-sm text-muted-foreground mb-4">${description}</p>
        <div class="flex gap-2 justify-end">
          <button id="bug-cancel" class="px-4 py-2 rounded border border-border hover:bg-muted">Batal</button>
          <button id="bug-submit" class="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90">Kirim</button>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    bugReportModalElement = modal
    
    const cancelBtn = modal.querySelector("#bug-cancel") as HTMLButtonElement
    const submitBtn = modal.querySelector("#bug-submit") as HTMLButtonElement
    
    cancelBtn.onclick = () => {
      closeModal()
      resolve(false)
    }
    
    submitBtn.onclick = async () => {
      submitBtn.disabled = true
      submitBtn.textContent = "Mengirim..."
      try {
        if (reportType === "content" && targetId) {
          const res = await submitContentReport("kalimat", targetId, title, "Laporan user", description)
          if (res?.error) {
            toast.error(res.error, { position: "bottom-right" })
            submitBtn.disabled = false
            submitBtn.textContent = "Kirim"
            return
          }
        }
        closeModal()
        toast.success("Laporan berhasil dikirim!", {
          description: "Terima kasih atas bantuan Anda.",
          position: "bottom-right",
        })
        resolve(true)
      } catch (err) {
        console.error("Gagal mengirim laporan:", err)
        toast.error("Gagal mengirim laporan. Coba lagi nanti.", { position: "bottom-right" })
        submitBtn.disabled = false
        submitBtn.textContent = "Kirim"
      }
    }
  })
}

function closeModal() {
  if (bugReportModalElement) {
    document.body.removeChild(bugReportModalElement)
    bugReportModalElement = null
  }
  currentBugReportResolve = null
}

// Register ke window object
if (typeof window !== "undefined") {
  ;(window as Window & { openBugReportModal?: typeof openBugReportModal }).openBugReportModal = openBugReportModal
}
