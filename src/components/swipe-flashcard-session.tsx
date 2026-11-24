"use client"

import * as React from "react"
import { TrendingUp, Star, CheckCircle2, ChevronLeft, ChevronDown, EyeOff, SkipForward, Settings2, CheckCircle2 as CheckCircle2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/page-loader"
import { PracticeHeader } from "@/components/practice-header"
import { TonePinyin, TonePinyinText } from "@/components/tone-pinyin"
import { useSupabase } from "@/hooks/use-supabase"
import { fetchCharacterEntries } from "@/lib/character-dictionary"
import { previewIntervalDays, getCardSrsState, computeSrsReassessment, isCardDue } from "@/lib/srs"
import styles from "./swipe-flashcard-session.module.css"

import { SwipeFlashcard, SwipeFlashcardSessionProps } from "./flashcard-session/types"
import { formatIntervalDays } from "./flashcard-session/utils"
import { useFlashcardSession } from "./flashcard-session/use-flashcard-session"
import { FlashcardCard } from "./flashcard-session/flashcard-card"
import dynamic from "next/dynamic"

const FlashcardSettingsModal = dynamic(() => import("./flashcard-session/flashcard-settings-modal").then(mod => mod.FlashcardSettingsModal))
const FlashcardResetModal = dynamic(() => import("./flashcard-session/flashcard-reset-modal").then(mod => mod.FlashcardResetModal))
const FlashcardSessionSummary = dynamic(() => import("./flashcard-session/flashcard-session-summary").then(mod => mod.FlashcardSessionSummary))

export type { SwipeFlashcard }

const WORD_CLASS_EXPLANATIONS = [
  { name: "Nomina", hanzi: "名词", pinyin: "míngcí", phrase: "Frasa kata benda", description: "menyebut orang, benda, tempat, atau konsep. Contoh: 学生 (xuéshēng, siswa), 学校 (xuéxiào, sekolah)." },
  { name: "Verba", hanzi: "动词", pinyin: "dòngcí", phrase: "Frasa kata kerja", description: "menyatakan tindakan atau keadaan. Contoh: 学习 (xuéxí, belajar), 是 (shì, adalah)." },
  { name: "Adjektiva", hanzi: "形容词", pinyin: "xíngróngcí", phrase: "Frasa kata sifat", description: "menjelaskan sifat atau keadaan orang atau benda. Contoh: 很好 (hěn hǎo, baik)." },
  { name: "Adverbia", hanzi: "副词", pinyin: "fùcí", phrase: "Frasa kata keterangan", description: "menerangkan kata kerja, kata sifat, atau kalimat, misalnya tingkat atau negasi. Contoh: 很 (hěn, sangat), 不 (bù, tidak)." },
  { name: "Konjungsi", hanzi: "连词", pinyin: "liáncí", phrase: "Frasa kata hubung", description: "menghubungkan kata, frasa, atau klausa. Contoh: 和 (hé, dan), 但是 (dànshì, tetapi)." },
  { name: "Partikel", hanzi: "助词", pinyin: "zhùcí", phrase: "Frasa partikel tata bahasa", description: "menandai fungsi tata bahasa, seperti aspek, perubahan keadaan, atau pertanyaan. Contoh: 了 (le), 吗 (ma), 的 (de)." },
  { name: "Pronomina", hanzi: "代词", pinyin: "dàicí", phrase: "Frasa kata ganti", description: "menggantikan atau menunjuk orang, benda, atau hal. Contoh: 我 (wǒ, saya), 这 (zhè, ini)." },
  { name: "Numeralia", hanzi: "数词", pinyin: "shùcí", phrase: "Frasa kata bilangan", description: "menyatakan jumlah atau urutan. Contoh: 三 (sān, tiga), 第一 (dì-yī, pertama)." },
  { name: "Klasifikator", hanzi: "量词", pinyin: "liàngcí", phrase: "Frasa kata penggolong", description: "digunakan bersama angka atau kata penunjuk sebelum kata benda. Contoh: 一个人 (yí ge rén, satu orang), 一本书 (yì běn shū, satu buku)." },
  { name: "Kata ukur", hanzi: "量词", pinyin: "liàngcí", phrase: "Frasa kata satuan ukur", description: "menyatakan satuan hitung atau ukuran. Contoh: 一杯水 (yì bēi shuǐ, segelas air)." },
  { name: "Prefiks", hanzi: "前缀", pinyin: "qiánzhuì", phrase: "Frasa imbuhan awalan", description: "diletakkan di depan kata dasar untuk membentuk kata lain. Contoh: 第 (dì-) pada 第一 (dì-yī, pertama)." },
  { name: "Preposisi", hanzi: "介词", pinyin: "jiècí", phrase: "Frasa kata depan", description: "menandai hubungan tempat, arah, atau penerima. Contoh: 在 (zài, di), 给 (gěi, kepada)." },
  { name: "Interjeksi", hanzi: "叹词", pinyin: "tàncí", phrase: "Frasa kata seru", description: "mengungkapkan seruan, reaksi, atau emosi. Contoh: 哎 (āi), 啊 (a)." },
] as const

const WORD_CLASS_KEYS: Record<string, string> = {
  noun: "Nomina",
  verb: "Verba",
  adj: "Adjektiva",
  adv: "Adverbia",
  conj: "Konjungsi",
  particle: "Partikel",
  pron: "Pronomina",
  num: "Numeralia",
  classifier: "Klasifikator",
  meas: "Kata ukur",
  prefix: "Prefiks",
  prep: "Preposisi",
  interj: "Interjeksi",
}

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
  sessionId,
  storageKey,
  reviewBatch,
  studyOnly = false,
}: SwipeFlashcardSessionProps) {
  const supa = useSupabase()
  const [noteExpanded, setNoteExpanded] = React.useState(false)
  const [wordClassGuideOpen, setWordClassGuideOpen] = React.useState(false)
  const [noteHanziPinyin, setNoteHanziPinyin] = React.useState<Array<{ hanzi: string; pinyin: string }>>([])
  const session = useFlashcardSession({
    cards, userId, deckCardIds, wordDetailPath, onComplete,
    disableSwipeProp: disableSwipeProp || noteExpanded,
    studyOnly,
    deckId, sessionId, storageKey
  })
  const activeNote = session.card?.catatan ?? ""
  React.useEffect(() => {
    let cancelled = false
    const runs = activeNote.match(/[\u3400-\u9fff]+/gu) ?? []
    const terms = new Set<string>()
    for (const run of runs) {
      for (let start = 0; start < run.length; start++) {
        for (let length = 1; length <= Math.min(4, run.length - start); length++) {
          terms.add(run.slice(start, start + length))
        }
      }
    }
    if (!terms.size) {
      setNoteHanziPinyin([])
      return () => { cancelled = true }
    }

    async function loadNotePinyin() {
      const { data } = await supa.from("flashcard_cards").select("hanzi, pinyin").in("hanzi", [...terms])
      const lookup = new Map<string, string>()
      for (const item of data ?? []) {
        if (item.hanzi && item.pinyin) lookup.set(item.hanzi, item.pinyin)
      }
      const characters = [...new Set(runs.join("").split(""))]
      const missingCharacters = characters.filter(character => !lookup.has(character))
      if (missingCharacters.length) {
        try {
          const characterEntries = await fetchCharacterEntries(supa, missingCharacters)
          for (const [character, entry] of Object.entries(characterEntries)) {
            if (entry.pinyin[0]) lookup.set(character, entry.pinyin[0])
          }
        } catch {
          // Keep any readings available from flashcard_cards.
        }
      }
      if (!cancelled) setNoteHanziPinyin([...lookup].map(([hanzi, pinyin]) => ({ hanzi, pinyin })))
    }

    void loadNotePinyin()
    return () => { cancelled = true }
  }, [activeNote, session.card?.id, supa])
  const activeWordClassName = session.card?.wordClass
    ? WORD_CLASS_KEYS[session.card.wordClass.trim().toLowerCase()] ?? session.card.wordClass.trim()
    : null
  const hasSavedDeckRating = Boolean(deckId && session.card?.lastReviewed)
  const canReassessDeckRating = Boolean(hasSavedDeckRating && !isCardDue(session.card?.nextReview))
  const savedDeckIntervalQuality = hasSavedDeckRating ? session.card?.lastQuality : null
  const savedDeckIntervalDays = hasSavedDeckRating ? session.card?.intervalDays : null

  const getRatingIntervalLabel = (quality: 0 | 3 | 4 | 5) => {
    if (studyOnly) return null
    if (!canReassessDeckRating) {
      return formatIntervalDays(previewIntervalDays(getCardSrsState(session.card ?? {}), quality))
    }
    if (savedDeckIntervalQuality === quality && typeof savedDeckIntervalDays === "number") {
      return formatIntervalDays(savedDeckIntervalDays)
    }
    return formatIntervalDays(computeSrsReassessment(
      getCardSrsState(session.card ?? {}),
      savedDeckIntervalQuality,
      quality,
    ).interval_days)
  }

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
          // If this session has completed, keep its result visible even if the
          // parent refreshes the due-card list and the active cards disappear.
          isEmpty={cards.length === 0 && !session.done}
          emptyEmoji={emptyEmoji}
          emptyTitle={emptyTitle}
          mudah={session.sessionStats.mudah}
          sulit={session.sessionStats.sulit}
          ingat={session.sessionStats.ingat}
          lupa={session.sessionStats.lupa}
          resultRingValue={session.resultRingValue}
          studyOnly={studyOnly}
          studiedCount={cards.length}
          onRetry={() => window.location.reload()}
          reviewBatch={reviewBatch ? {
            ...reviewBatch,
            saveStatus: session.completionSaveStatus,
            onRetrySave: session.retryCompletionSave,
          } : undefined}
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
          showStats={!studyOnly}
          collapsibleStats
          stats={[
            { icon: Star, label: "Sudah Dikuasai", value: `${session.headerStats.mastered} Kartu` },
            { icon: CheckCircle2Icon, label: "Dinilai", value: `${session.headerStats.rated} dari ${session.headerStats.totalCards}` },
            {
              icon: TrendingUp,
              label: "Jatuh Tempo Hari Ini",
              value: `${session.headerStats.dueToday} dari ${session.headerStats.saved ?? session.headerStats.totalCards} tersimpan`,
            },
            {
              icon: CheckCircle2,
              label: "Akurasi Sesi",
              value: `${session.headerStats.accuracy}%`,
              progressPercent: session.headerStats.accuracy,
            },
          ]}
        />

        <div className="flex items-center gap-3 px-4 py-2 shrink-0">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${session.progress}%` }} />
          </div>
          <button
            type="button"
            data-bottom-accent="off"
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

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <FlashcardCard 
            card={session.card}
            cards={cards}
            noteHanziPinyin={noteHanziPinyin}
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
            onNoteExpandedChange={setNoteExpanded}
          />

          <div className="flex flex-col items-center gap-4 mt-2 h-auto w-full max-w-lg md:max-w-2xl lg:max-w-3xl">
            <div className="grid w-full grid-cols-[1.2fr_1fr_1fr] gap-2 px-2 sm:px-0">
              <Button variant="outline" data-bottom-accent="on" style={{ "--bottom-accent-color": "color-mix(in srgb, #102538 65%, #2d5873 35%)" } as React.CSSProperties} className="min-w-0 whitespace-nowrap rounded-xl h-10 gap-1 px-1.5 text-[10px] font-medium sm:px-3 sm:text-xs" onClick={session.goToPrevious} disabled={session.idx === 0}>
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" /> Sebelumnya
              </Button>
              <Button variant="outline" data-bottom-accent="on" style={{ "--bottom-accent-color": "color-mix(in srgb, #102538 65%, #2d5873 35%)" } as React.CSSProperties} className="min-w-0 whitespace-nowrap rounded-xl h-10 gap-1 px-1.5 text-[10px] font-medium sm:px-3 sm:text-xs" onClick={session.hideAnswer}>
                <EyeOff className="h-3.5 w-3.5 shrink-0" /> Sembunyi
              </Button>
              <Button variant="outline" data-bottom-accent="on" style={{ "--bottom-accent-color": "color-mix(in srgb, #102538 65%, #2d5873 35%)" } as React.CSSProperties} className="min-w-0 whitespace-nowrap rounded-xl h-10 gap-1 px-1.5 text-[10px] font-medium sm:px-3 sm:text-xs" onClick={session.skipCard}>
                <SkipForward className="h-3.5 w-3.5 shrink-0" />
                {studyOnly ? (session.idx + 1 >= cards.length ? "Selesai" : "Berikutnya") : "Lewati"}
              </Button>
            </div>

            {studyOnly && (
              <div className="text-xs text-center text-muted-foreground">
                Latihan bebas · pilihan hanya untuk melanjutkan, tidak mengubah penilaian atau jadwal review
              </div>
            )}
            {!studyOnly && <div className="text-sm font-semibold text-foreground">Seberapa mudah kamu mengingatnya?</div>}
            <div className="grid grid-cols-4 gap-2 w-full">
              <Button
                variant="outline"
                data-bottom-accent="on"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 0 ? "!bg-red-500/20 text-red-500 scale-105" : "!bg-red-500/10 text-red-400 hover:!bg-red-500/15"}`}
                style={{ borderColor: session.selectedRating === 0 ? "rgb(239 68 68 / 70%)" : "rgb(239 68 68 / 45%)" }}
                onClick={() => { session.advance(0) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">1</span>
                <span>Lupa</span>
                {getRatingIntervalLabel(0) && <span className="text-[10px] font-normal text-muted-foreground">{getRatingIntervalLabel(0)}</span>}
              </Button>
              <Button
                variant="outline"
                data-bottom-accent="on"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 3 ? "!bg-amber-500/20 text-amber-500 scale-105" : "!bg-amber-500/10 text-amber-400 hover:!bg-amber-500/15"}`}
                style={{ borderColor: session.selectedRating === 3 ? "rgb(245 158 11 / 70%)" : "rgb(245 158 11 / 45%)" }}
                onClick={() => { session.advance(3) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">2</span>
                <span>Sulit</span>
                {getRatingIntervalLabel(3) && <span className="text-[10px] font-normal text-muted-foreground">{getRatingIntervalLabel(3)}</span>}
              </Button>
              <Button
                variant="outline"
                data-bottom-accent="on"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 4 ? "!bg-blue-500/20 text-blue-500 scale-105" : "!bg-blue-500/10 text-blue-400 hover:!bg-blue-500/15"}`}
                style={{ borderColor: session.selectedRating === 4 ? "rgb(59 130 246 / 70%)" : "rgb(59 130 246 / 45%)" }}
                onClick={() => { session.advance(4) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">3</span>
                <span>Ingat</span>
                {getRatingIntervalLabel(4) && <span className="text-[10px] font-normal text-muted-foreground">{getRatingIntervalLabel(4)}</span>}
              </Button>
              <Button
                variant="outline"
                data-bottom-accent="on"
                className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${session.selectedRating === 5 ? "!bg-emerald-500/20 text-emerald-500 scale-105" : "!bg-emerald-500/10 text-emerald-400 hover:!bg-emerald-500/15"}`}
                style={{ borderColor: session.selectedRating === 5 ? "rgb(16 185 129 / 70%)" : "rgb(16 185 129 / 45%)" }}
                onClick={() => { session.advance(5) }}
              >
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">4</span>
                <span>Mudah</span>
                {getRatingIntervalLabel(5) && <span className="text-[10px] font-normal text-muted-foreground">{getRatingIntervalLabel(5)}</span>}
              </Button>
            </div>

            {!studyOnly && <>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-red-400 shrink-0">Lupa ·</span>
                  <span className="text-muted-foreground">belum ingat, ulang dari awal</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-amber-400 shrink-0">Sulit ·</span>
                  <span className="text-muted-foreground">ingat tapi berat, jeda bertambah pelan</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-blue-400 shrink-0">Ingat ·</span>
                  <span className="text-muted-foreground">ingat dengan usaha, jeda normal</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-emerald-400 shrink-0">Mudah ·</span>
                  <span className="text-muted-foreground">sangat mudah, jeda lebih panjang</span>
                </div>
              </div>
            </div>

            <section className="w-full rounded-xl border border-border/40 bg-muted/20 p-3" aria-labelledby="word-class-guide-title">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 id="word-class-guide-title" className="text-xs font-semibold text-muted-foreground">Kelas kata Mandarin</h3>
                <button
                  type="button"
                  className="sm:hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted/40"
                  aria-label={wordClassGuideOpen ? "Tutup penjelasan kelas kata" : "Buka penjelasan kelas kata"}
                  aria-expanded={wordClassGuideOpen}
                  aria-controls="word-class-guide-list"
                  onClick={() => setWordClassGuideOpen(open => !open)}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${wordClassGuideOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
              {WORD_CLASS_EXPLANATIONS.filter(wordClass => wordClass.name === activeWordClassName).map(wordClass => (
                <article key={`active-${wordClass.name}`} className="mb-2 rounded-lg border border-primary bg-background/30 p-2.5 text-xs">
                  <h4 className="font-semibold">
                    {wordClass.name} · <span className="font-hanzi">{wordClass.hanzi}</span> <span className="font-normal text-muted-foreground">(<TonePinyin text={wordClass.pinyin} />)</span>
                  </h4>
                  <p className="mt-1 leading-relaxed text-muted-foreground"><TonePinyinText text={`${wordClass.phrase}: ${wordClass.description}`} /></p>
                </article>
              ))}
              <div id="word-class-guide-list" className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                {WORD_CLASS_EXPLANATIONS.filter(wordClass => wordClass.name !== activeWordClassName).map((wordClass) => (
                  <article key={wordClass.name} className={`${wordClassGuideOpen ? "block" : "hidden"} rounded-lg border border-border/30 bg-background/30 p-2.5 sm:block`}>
                    <h4 className="text-xs font-semibold">
                      {wordClass.name} · <span className="font-hanzi">{wordClass.hanzi}</span> <span className="font-normal text-muted-foreground">(<TonePinyin text={wordClass.pinyin} />)</span>
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground"><TonePinyinText text={`${wordClass.phrase}: ${wordClass.description}`} /></p>
                  </article>
                ))}
              </div>
            </section>
            </>}

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
