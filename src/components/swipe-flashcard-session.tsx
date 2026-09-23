"use client"

import * as React from "react"
import { TrendingUp, Star, CheckCircle2, ChevronLeft, EyeOff, SkipForward, Settings2, CheckCircle2 as CheckCircle2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/page-loader"
import { PracticeHeader } from "@/components/practice-header"
import { previewIntervalDays } from "@/lib/srs"
import styles from "./swipe-flashcard-session.module.css"

import { SwipeFlashcard, SwipeFlashcardSessionProps } from "./flashcard-session/types"
import { formatIntervalDays } from "./flashcard-session/utils"
import { useFlashcardSession } from "./flashcard-session/use-flashcard-session"
import { FlashcardCard } from "./flashcard-session/flashcard-card"
import { FlashcardSettingsModal } from "./flashcard-session/flashcard-settings-modal"
import { FlashcardResetModal } from "./flashcard-session/flashcard-reset-modal"
import { FlashcardSessionSummary } from "./flashcard-session/flashcard-session-summary"

export type { SwipeFlashcard }

export function SwipeFlashcardSession({
  cards,
  loading = false,
  emptyTitle = "Belum Ada Kartu",
  emptyEmoji = "📭",
  wordDetailPath,
  onComplete,
  deckTitle = "Kartu Hafalan",
  deckLevel = "Level A1",
  userId,
  disableSwipe: disableSwipeProp = false,
  deckCardIds,
  deckId,
}: SwipeFlashcardSessionProps) {
  const session = useFlashcardSession({
    cards, userId, deckCardIds, wordDetailPath, onComplete, disableSwipeProp
  })

  if (loading) {
    return (
      <div className={styles.page}>
        <PageLoader />
      </div>
    )
  }

  if (session.done || cards.length === 0) {
    return (
      <div className={styles.page}>
        <FlashcardSessionSummary 
          isEmpty={cards.length === 0}
          emptyEmoji={emptyEmoji}
          emptyTitle={emptyTitle}
          hafal={session.hafal}
          sulit={session.sulit}
          ragu={session.ragu}
          lupa={session.lupa}
          resultRingValue={session.resultRingValue}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (!session.card) return null

  return (
    <div className={styles.page}>
      <div className="flashcard-quiz flex flex-col flex-1 select-none relative z-10 min-h-0">
        <PracticeHeader
          title={deckTitle}
          subtitle={deckLevel}
          showStats
          stats={[
            {
              icon: TrendingUp,
              label: "Jatuh Tempo Hari Ini",
              value: `${session.headerStats.dueToday} dari ${session.headerStats.totalCards} tersimpan`,
            },
            {
              icon: CheckCircle2,
              label: "Akurasi Sesi",
              value: `${session.headerStats.accuracy}%`,
              progressPercent: session.headerStats.accuracy,
            },
            { icon: Star, label: "Sudah Dikuasai", value: session.headerStats.mastered },
            { icon: CheckCircle2Icon, label: "Dinilai", value: session.headerStats.rated },
          ]}
        />

        <div className="flex items-center gap-3 px-4 py-2 shrink-0">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${session.progress}%` }} />
          </div>
          <button
            type="button"
            aria-label="Pengaturan sesi"
            onClick={() => session.setShowSettings(true)}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {session.showSettings && (
          <FlashcardSettingsModal 
            prefs={session.prefs}
            onUpdatePrefs={session.updatePrefs}
            onClose={() => session.setShowSettings(false)}
            showResetSrs={!!deckId}
            onResetSrs={() => session.setShowResetModal(true)}
          />
        )}

        {session.showResetModal && (
          <FlashcardResetModal 
            resetting={session.resetting}
            onCancel={() => session.setShowResetModal(false)}
            onConfirm={() => deckId && session.resetDeckProgress(deckId)}
          />
        )}

        {session.resetSuccess && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top fade-in duration-300">
            <CheckCircle2Icon className="h-5 w-5" />
            <span className="text-sm font-medium">Progress SRS berhasil dihapus!</span>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 relative">
          <FlashcardCard 
            card={session.card}
            idx={session.idx}
            flip={session.flip}
            isDragging={session.isDragging}
            dragX={session.dragX}
            dragY={session.dragY}
            flyOut={session.flyOut}
            cardRef={session.cardRef}
            onCardClick={session.handleCardClick}
            onPointerDown={session.onPointerDown}
            onPointerMove={session.onPointerMove}
            onPointerCancel={session.onPointerCancel}
            onPointerUp={session.onPointerUp}
          />

          <div className="flex flex-col items-center gap-4 mt-2 h-auto w-full max-w-lg md:max-w-2xl lg:max-w-3xl">
            <div className="grid grid-cols-3 gap-2 w-full">
              <Button variant="outline" className="rounded-xl h-10 gap-1.5 text-xs font-medium" onClick={session.goToPrevious} disabled={session.idx === 0}>
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </Button>
              <Button variant="outline" className="rounded-xl h-10 gap-1.5 text-xs font-medium" onClick={session.hideAnswer}>
                <EyeOff className="h-3.5 w-3.5" /> Sembunyi
              </Button>
              <Button variant="outline" className="rounded-xl h-10 gap-1.5 text-xs font-medium" onClick={session.skipCard}>
                <SkipForward className="h-3.5 w-3.5" /> Lewati
              </Button>
            </div>

            <div className="text-sm font-semibold text-foreground">Seberapa mudah kamu mengingatnya?</div>
            <div className="grid grid-cols-4 gap-2 w-full">
              <Button
                variant="outline"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 0 ? "bg-red-500/20 border-red-500/50 text-red-500 scale-105" : "bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30"}`}
                onClick={() => { session.advance(0) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">1</span>
                <span>Lupa</span>
                <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(session.card?.srsLevel ?? 0, 0))}</span>
              </Button>
              <Button
                variant="outline"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 3 ? "bg-amber-500/20 border-amber-500/50 text-amber-500 scale-105" : "bg-amber-500/5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30"}`}
                onClick={() => { session.advance(3) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">2</span>
                <span>Sulit</span>
                <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(session.card?.srsLevel ?? 0, 3))}</span>
              </Button>
              <Button
                variant="outline"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 4 ? "bg-blue-500/20 border-blue-500/50 text-blue-500 scale-105" : "bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30"}`}
                onClick={() => { session.advance(4) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">3</span>
                <span>Ingat</span>
                <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(session.card?.srsLevel ?? 0, 4))}</span>
              </Button>
              <Button
                variant="outline"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 5 ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500 scale-105" : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30"}`}
                onClick={() => { session.advance(5) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">4</span>
                <span>Mudah</span>
                <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(session.card?.srsLevel ?? 0, 5))}</span>
              </Button>
            </div>

            <p className="hidden sm:flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">1</kbd>
              <span>–</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">4</kbd>
              <span>nilai</span>
              <span className="mx-1">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">←</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">→</kbd>
              <span>navigasi</span>
            </p>

            <div className="w-full rounded-xl border border-border/40 bg-muted/20 p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Arti setiap penilaian</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-red-400 shrink-0">Lupa ·</span>
                  <span className="text-muted-foreground">belum ingat, muncul lagi besok</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-amber-400 shrink-0">Sulit ·</span>
                  <span className="text-muted-foreground">hampir lupa, muncul lagi besok</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-blue-400 shrink-0">Ingat ·</span>
                  <span className="text-muted-foreground">ingat dengan usaha, jeda beberapa hari</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-emerald-400 shrink-0">Mudah ·</span>
                  <span className="text-muted-foreground">sangat mudah, jeda lebih lama</span>
                </div>
              </div>
            </div>

            {session.feedback && (
              <div className={`text-center px-4 py-4 rounded-xl border w-full max-w-lg mx-auto shadow-sm ${
                session.feedback.type === "ok" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                session.feedback.type === "warn" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                session.feedback.type === "interim" ? "text-muted-foreground border-transparent" :
                "bg-red-500/10 border-red-500/20 text-red-500"
              }`}>
                <div className="font-medium text-sm">{session.feedback.msg}</div>
                {session.feedback.hanzi && <div className="font-hanzi mt-1 text-xl">&quot;{session.feedback.hanzi}&quot;</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .perspective-\\[800px\\] { perspective: 800px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        `
      }} />
    </div>
  )
}