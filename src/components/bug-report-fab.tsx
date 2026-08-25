"use client"

/**
 * Tombol mengambang "Lapor Bug" — pasang sekali di `app/dashboard/layout.tsx`
 * (lihat INTEGRATION.md) supaya muncul di semua halaman dashboard, persis
 * seperti FAB global di project lama (`initBugReportFAB`).
 */

import * as React from "react"
import { Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { submitBugReport } from "@/lib/bug-report"

export function BugReportFab() {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) return
    setSaving(true)
    setErrorMsg(null)
    const { error } = await submitBugReport({ title: title.trim(), description: description.trim() })
    setSaving(false)
    if (error) {
      setErrorMsg("Gagal mengirim laporan. Coba lagi ya.")
      return
    }
    setSent(true)
    setTitle("")
    setDescription("")
    setTimeout(() => {
      setOpen(false)
      setSent(false)
    }, 1200)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Laporkan Bug"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card text-primary shadow-lg shadow-black/20 transition-transform hover:scale-105"
      >
        <Bug className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-primary" />
              Laporkan Masalah
            </DialogTitle>
          </DialogHeader>

          {sent ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Laporan terkirim, terima kasih! 🙏
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Temukan bug atau kesalahan teknis? Beritahu kami agar bisa segera diperbaiki.
              </p>
              <div className="flex flex-col gap-3 py-2">
                <Input
                  placeholder="Judul masalah, misalnya: Suara tidak muncul"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Jelaskan apa yang terjadi dan langkah untuk memunculkan masalah tersebut..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
                {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
              </div>
              <DialogFooter>
                <Button disabled={saving || !title.trim() || !description.trim()} onClick={handleSubmit}>
                  {saving ? "Mengirim..." : "Kirim Laporan"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
