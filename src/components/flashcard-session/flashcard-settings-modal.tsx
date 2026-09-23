import { X, Volume2, VolumeX, AlignJustify, Shuffle, RefreshCw } from "lucide-react"
import { FlashcardPrefs } from "./types"

type Props = {
  prefs: FlashcardPrefs
  onUpdatePrefs: (prefs: FlashcardPrefs) => void
  onClose: () => void
  onResetSrs?: () => void
  showResetSrs?: boolean
}

export function FlashcardSettingsModal({ prefs, onUpdatePrefs, onClose, onResetSrs, showResetSrs }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-card border border-border/50 rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-foreground">Pengaturan Sesi</h3>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Auto-play TTS */}
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/40">
          <div className="flex items-center gap-3">
            {prefs.autoPlayTts ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            <div>
              <div className="text-sm font-semibold">Auto-play Suara</div>
              <div className="text-xs text-muted-foreground">Otomatis putar pengucapan saat kartu dibalik</div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.autoPlayTts}
            onClick={() => onUpdatePrefs({ ...prefs, autoPlayTts: !prefs.autoPlayTts })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              prefs.autoPlayTts ? "bg-primary" : "bg-muted"
            }`}
          >
            <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
              prefs.autoPlayTts ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* Card Order */}
        <div className="space-y-2">
          <div className="text-sm font-semibold">Urutan Kartu</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdatePrefs({ ...prefs, cardOrder: "sequential" })}
              className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                prefs.cardOrder === "sequential"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30"
              }`}
            >
              <AlignJustify className="h-4 w-4" />
              Berurutan
            </button>
            <button
              type="button"
              onClick={() => onUpdatePrefs({ ...prefs, cardOrder: "shuffle" })}
              className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                prefs.cardOrder === "shuffle"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Shuffle className="h-4 w-4" />
              Acak
            </button>
          </div>
        </div>

        {/* Swipe Enabled */}
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/40">
          <div>
            <div className="text-sm font-semibold">Gestur Swipe</div>
            <div className="text-xs text-muted-foreground">Nilai kartu dengan menggeser kiri/kanan/atas/bawah</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.swipeEnabled}
            onClick={() => onUpdatePrefs({ ...prefs, swipeEnabled: !prefs.swipeEnabled })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              prefs.swipeEnabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
              prefs.swipeEnabled ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* Reset SRS */}
        {showResetSrs && onResetSrs && (
          <div className="pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={onResetSrs}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-orange-500/30 bg-orange-500/5 text-orange-500 hover:bg-orange-500/10 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Hapus Progress SRS
            </button>
          </div>
        )}
      </div>
    </div>
  )
}