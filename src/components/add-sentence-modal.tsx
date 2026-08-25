"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Plus } from "lucide-react"
import { submitUserSentence } from "@/lib/user-sentences"

interface AddSentenceModalProps {
  isOpen: boolean
  onClose: () => void
  hanziKey: string
  onSuccess?: () => void
}

export function AddSentenceModal({
  isOpen,
  onClose,
  hanziKey,
  onSuccess,
}: AddSentenceModalProps) {
  const [hanzi, setHanzi] = React.useState("")
  const [pinyin, setPinyin] = React.useState("")
  const [arti, setArti] = React.useState("")
  const [sectionLabel, setSectionLabel] = React.useState("")
  const [sectionTag, setSectionTag] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  if (!isOpen) return null

  async function handleSubmit() {
    if (!hanzi.trim() || !pinyin.trim() || !arti.trim()) {
      alert("Hanzi, pinyin, dan arti wajib diisi")
      return
    }

    setSubmitting(true)
    const result = await submitUserSentence({
      hanzi_key: hanziKey,
      hanzi: hanzi.trim(),
      pinyin: pinyin.trim(),
      arti: arti.trim(),
      section_label: sectionLabel.trim() || null,
      section_tag: sectionTag.trim() || null,
    })
    setSubmitting(false)

    if (result.error) {
      alert(result.error)
    } else {
      setSubmitted(true)
      setTimeout(() => {
        onClose()
        setSubmitted(false)
        setHanzi("")
        setPinyin("")
        setArti("")
        setSectionLabel("")
        setSectionTag("")
      }, 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Tambah Kalimat
              </CardTitle>
              <CardDescription className="mt-2">
                Tambah kalimat baru ke set ini. Kalimat akan langsung muncul dengan badge "Kontribusi User".
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
              <p className="text-sm text-muted-foreground">Kalimat berhasil dikirim untuk review!</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Hanzi *</label>
                <input
                  type="text"
                  value={hanzi}
                  onChange={(e) => setHanzi(e.target.value)}
                  placeholder="你好吗？"
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Pinyin *</label>
                <input
                  type="text"
                  value={pinyin}
                  onChange={(e) => setPinyin(e.target.value)}
                  placeholder="nǐ hǎo ma?"
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Arti *</label>
                <input
                  type="text"
                  value={arti}
                  onChange={(e) => setArti(e.target.value)}
                  placeholder="Apa kabar?"
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Section Label (opsional)</label>
                  <input
                    type="text"
                    value={sectionLabel}
                    onChange={(e) => setSectionLabel(e.target.value)}
                    placeholder="Percakapan"
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Section Tag (opsional)</label>
                  <input
                    type="text"
                    value={sectionTag}
                    onChange={(e) => setSectionTag(e.target.value)}
                    placeholder="K1"
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !hanzi.trim() || !pinyin.trim() || !arti.trim()}
                >
                  {submitting ? "Mengirim..." : "Kirim"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
