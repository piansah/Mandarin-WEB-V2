"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Flag } from "lucide-react"
import { submitContentReport } from "@/lib/bug-reports"

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  contentType: "kalimat" | "kosakata"
  contentId: number | string
  contentLabel: string
}

const REPORT_REASONS = {
  wrong_arti: "Arti salah",
  wrong_pinyin: "Pinyin salah", 
  typo: "Typo/kesalahan ketik",
  inappropriate: "Konten tidak pantas",
  other: "Lainnya",
}

export function ReportModal({
  isOpen,
  onClose,
  contentType,
  contentId,
  contentLabel,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = React.useState<string | null>(null)
  const [description, setDescription] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  if (!isOpen) return null

  async function handleSubmit() {
    if (!selectedReason) {
      alert("Pilih alasan report terlebih dahulu")
      return
    }

    setSubmitting(true)
    const result = await submitContentReport(
      contentType,
      contentId,
      contentLabel,
      selectedReason,
      description.trim() || null
    )
    setSubmitting(false)

    if (result.error) {
      alert(result.error)
    } else {
      setSubmitted(true)
      setTimeout(() => {
        onClose()
        setSubmitted(false)
        setSelectedReason(null)
        setDescription("")
      }, 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-orange-500" />
                Report Konten
              </CardTitle>
              <CardDescription className="mt-2">
                Laporkan masalah pada: <span className="font-medium">{contentLabel}</span>
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm text-muted-foreground">Report berhasil dikirim. Terima kasih!</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Alasan Report</label>
                <div className="space-y-2">
                  {Object.entries(REPORT_REASONS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedReason(value)}
                      className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                        selectedReason === value
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-border hover:border-orange-500/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Detail (opsional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan lebih detail tentang masalahnya..."
                  className="w-full px-3 py-2 rounded-md border bg-background min-h-[80px]"
                  maxLength={500}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedReason}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {submitting ? "Mengirim..." : "Kirim Report"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
