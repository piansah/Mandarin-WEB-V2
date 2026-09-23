import * as React from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  resetting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function FlashcardResetModal({ resetting, onCancel, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm bg-card border border-border/50 rounded-2xl shadow-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold">Hapus Progress SRS?</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Semua progress SRS akan dihapus. Kartu akan dianggap baru dan akan muncul di review hari ini.
        </p>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={resetting}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={resetting}
            className="flex-1"
          >
            {resetting ? "Menghapus..." : "Hapus"}
          </Button>
        </div>
      </div>
    </div>
  )
}