"use client"

import * as React from "react"
import { Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { submitBugReport } from "@/lib/bug-report"

export function BugReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setTitle("")
      setDescription("")
      setSent(false)
      setErrorMsg(null)
    }
  }, [open])

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
      onOpenChange(false)
      setSent(false)
    }, 1200)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  )
}
