"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  List,
  Play,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react"

export type SwipeFlashcard = {
  id: number
  hanzi: string
  pinyin: string
  arti: string

  exampleSentence?: string
  examplePinyin?: string
  exampleTranslation?: string
}

type Rating = "hafal" | "lupa" | "ragu"

type SwipeFlashcardSessionProps = {
  cards: SwipeFlashcard[]
  loading?: boolean
  wordDetailPath?: (card: SwipeFlashcard) => string

  onComplete?: (stats: {
    hafal: number
    lupa: number
    ragu: number
  }) => void

  deckTitle?: string
  deckLevel?: string
  userId?: string | null
}

function speakChinese(text: string) {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    !text.trim()
  ) {
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(
    text.trim()
  )

  utterance.lang = "zh-CN"
  utterance.rate = 0.85
  utterance.pitch = 1

  window.speechSynthesis.speak(utterance)
}

export function SwipeFlashcardSession({
  cards,
  loading = false,
  wordDetailPath,
  onComplete,
  deckTitle = "Kartu Hafalan",
  deckLevel = "Level A1",
}: SwipeFlashcardSessionProps) {
  const [currentIndex, setCurrentIndex] =
    React.useState(0)

  const [flipped, setFlipped] =
    React.useState(false)

  /*
   * Rating disimpan berdasarkan card ID.
   *
   * Ini yang memperbaiki bug:
   *
   * "0 dari 20 tersimpan"
   *
   * Tidak lagi menunggu onComplete().
   */
  const [ratings, setRatings] = React.useState<
    Record<number, Rating>
  >({})

  const [isSpeaking, setIsSpeaking] =
    React.useState<
      "word" | "example" | null
    >(null)

  const [showResult, setShowResult] =
    React.useState(false)

  const totalCards = cards.length

  const currentCard =
    cards[currentIndex]

  const ratedCount =
    Object.keys(ratings).length

  const hafalCount = Object.values(
    ratings
  ).filter(
    (rating) => rating === "hafal"
  ).length

  const lupaCount = Object.values(
    ratings
  ).filter(
    (rating) => rating === "lupa"
  ).length

  const raguCount = Object.values(
    ratings
  ).filter(
    (rating) => rating === "ragu"
  ).length

  const progress =
    totalCards > 0
      ? Math.round(
          (ratedCount / totalCards) * 100
        )
      : 0

  const resetSession = React.useCallback(() => {
    window.speechSynthesis?.cancel()

    setCurrentIndex(0)
    setFlipped(false)
    setRatings({})
    setShowResult(false)
    setIsSpeaking(null)
  }, [])

  const handleFlip = React.useCallback(() => {
    setFlipped((previous) => !previous)
  }, [])

  const handleSpeakWord = React.useCallback(() => {
    if (!currentCard) return

    setIsSpeaking("word")

    speakChinese(currentCard.hanzi)

    window.setTimeout(() => {
      setIsSpeaking(null)
    }, 1000)
  }, [currentCard])

  const handleSpeakExample =
    React.useCallback(() => {
      if (!currentCard?.exampleSentence) {
        return
      }

      setIsSpeaking("example")

      speakChinese(
        currentCard.exampleSentence
      )

      window.setTimeout(() => {
        setIsSpeaking(null)
      }, 1500)
    }, [currentCard])

  const handleRate = React.useCallback(
    (rating: Rating) => {
      if (!currentCard) return

      const cardId = currentCard.id

      setRatings((previous) => ({
        ...previous,
        [cardId]: rating,
      }))

      window.speechSynthesis?.cancel()
      setIsSpeaking(null)

      if (
        currentIndex <
        totalCards - 1
      ) {
        setCurrentIndex(
          (previous) => previous + 1
        )
        setFlipped(false)
        return
      }

      const finalRatings = {
        ...ratings,
        [cardId]: rating,
      }

      const finalHafal = Object.values(
        finalRatings
      ).filter(
        (value) => value === "hafal"
      ).length

      const finalLupa = Object.values(
        finalRatings
      ).filter(
        (value) => value === "lupa"
      ).length

      const finalRagu = Object.values(
        finalRatings
      ).filter(
        (value) => value === "ragu"
      ).length

      setTimeout(() => {
        setShowResult(true)

        onComplete?.({
          hafal: finalHafal,
          lupa: finalLupa,
          ragu: finalRagu,
        })
      }, 250)
    },
    [
      currentCard,
      currentIndex,
      totalCards,
      ratings,
      onComplete,
    ]
  )

  const handlePrevious = React.useCallback(() => {
    if (currentIndex <= 0) return

    window.speechSynthesis?.cancel()
    setIsSpeaking(null)

    setCurrentIndex(
      (previous) => previous - 1
    )
    setFlipped(false)
  }, [currentIndex])


  const handleSkip = React.useCallback(() => {
    if (
      currentIndex >=
      totalCards - 1
    ) {
      return
    }

    window.speechSynthesis?.cancel()
    setIsSpeaking(null)

    setCurrentIndex(
      (previous) => previous + 1
    )
    setFlipped(false)
  }, [
    currentIndex,
    totalCards,
  ])


  React.useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#071b2b] px-4 py-6 text-white">
        <div className="mx-auto w-full max-w-[720px]">
          <div className="h-7 w-52 animate-pulse rounded bg-white/10" />

          <div className="mt-6 h-[480px] animate-pulse rounded-[28px] bg-white/5" />
        </div>
      </main>
    )
  }

  if (totalCards === 0) {
    return (
      <main className="min-h-screen bg-[#071b2b] px-4 py-8 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#0b2236] p-8 text-center">
          <h1 className="text-xl font-bold">
            Tidak ada kartu
          </h1>

          <p className="mt-2 text-sm text-white/60">
            Deck ini belum memiliki
            kosakata.
          </p>
        </div>
      </main>
    )
  }

  if (showResult) {
    return (
      <main className="min-h-screen bg-[#071b2b] px-4 py-8 text-white">
        <div className="mx-auto w-full max-w-xl">
          <div className="rounded-[28px] border border-white/10 bg-[#0b2236] p-6 sm:p-8">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-9 w-9 text-emerald-400" />
              </div>
            </div>

            <h1 className="mt-5 text-center text-2xl font-bold">
              Sesi selesai
            </h1>

            <p className="mt-2 text-center text-sm text-white/60">
              Semua kartu sudah dinilai.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/5 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {hafalCount}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  Mudah
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {raguCount}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  Ragu
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {lupaCount}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  Lupa
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/5 p-4 text-center">
              <div className="text-sm text-white/50">
                Akurasi sesi
              </div>

              <div className="mt-1 text-3xl font-bold">
                {progress > 0
                  ? Math.round(
                      (hafalCount /
                        totalCards) *
                        100
                    )
                  : 0}
                %
              </div>
            </div>

            <button
              type="button"
              onClick={resetSession}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3.5 font-semibold transition hover:bg-white/15"
            >
              <RotateCcw className="h-4 w-4" />
              Ulangi Sesi
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#071b2b] text-white">
      <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
        <header className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[21px] font-bold leading-tight sm:text-2xl">
                {deckTitle}
              </h1>

              <p className="mt-1 truncate text-sm text-white/55">
                {deckLevel}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                window.history.back()
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.07]"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="rounded-[20px] border border-white/[0.07] bg-[#0b2236] px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <ArrowRight className="h-4 w-4" />
                <span>Jatuh Tempo Hari Ini</span>
              </div>

              <div className="mt-1 text-lg font-bold">
                {ratedCount} dari{" "}
                {totalCards} tersimpan
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <CheckCircle2 className="h-4 w-4" />
                <span>Akurasi Sesi</span>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>

                <span className="text-sm font-bold">
                  {progress}%
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <EyeOff className="h-4 w-4" />
                <span>Sudah Dikuasai</span>
              </div>

              <div className="mt-1 text-lg font-bold">
                {hafalCount}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <CheckCircle2 className="h-4 w-4" />
                <span>Dinilai</span>
              </div>

              <div className="mt-1 text-lg font-bold">
                {ratedCount}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <section className="mt-3">
          <div
            className={[
              "w-full overflow-hidden rounded-[28px]",
              "border border-white/[0.07]",
              "bg-[#0b2236]",
              "shadow-[0_20px_60px_rgba(0,0,0,0.18)]",
            ].join(" ")}
          >
            {!flipped ? (
              <button
                type="button"
                onClick={handleFlip}
                className="flex min-h-[360px] w-full flex-col items-center justify-center px-5 py-10 text-center sm:min-h-[430px] sm:px-8"
              >
                <div className="text-[68px] font-medium leading-[1.1] sm:text-[88px]">
                  {currentCard.hanzi}
                </div>

                <div className="mt-7 text-[27px] font-medium sm:text-[34px]">
                  <span className="text-emerald-400">
                    {currentCard.pinyin}
                  </span>
                </div>

                <div className="mt-3 text-[23px] font-bold sm:text-[27px]">
                  {currentCard.arti}
                </div>

                <div className="mt-8 text-xs font-medium uppercase tracking-[0.12em] text-white/30">
                  Ketuk untuk melihat jawaban
                </div>
              </button>
            ) : (
              <div className="px-5 py-7 sm:px-8 sm:py-9">
                <div className="text-center">
                  <div className="break-words text-[52px] font-medium leading-[1.12] sm:text-[76px]">
                    {currentCard.hanzi}
                  </div>

                  <div className="mt-4 break-words text-[25px] sm:text-[31px]">
                    <span className="font-medium text-emerald-400">
                      {currentCard.pinyin}
                    </span>
                  </div>

                  <div className="mt-2 break-words text-[21px] font-bold sm:text-[25px]">
                    {currentCard.arti}
                  </div>

                  {/* ======================================================
                   * TTS KOSAKATA
                   * ==================================================== */}
                  <button
                    type="button"
                    onClick={handleSpeakWord}
                    className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold transition hover:bg-white/[0.08]"
                  >
                    <Volume2
                      className={[
                        "h-4 w-4",
                        isSpeaking === "word"
                          ? "animate-pulse text-emerald-400"
                          : "",
                      ].join(" ")}
                    />

                    TTS Kosakata
                  </button>
                </div>

                {/* ========================================================
                 * EXAMPLE
                 * ====================================================== */}
                <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:mt-10 sm:p-5">
                  <div className="text-xs font-medium uppercase tracking-[0.08em] text-white/45">
                    Contoh Penggunaan
                  </div>

                  {currentCard.exampleSentence ? (
                    <>
                      <div className="mt-4 break-words text-[23px] font-medium leading-[1.6] sm:text-[28px] sm:leading-[1.55]">
                        {currentCard.exampleSentence}
                      </div>

                      {currentCard.examplePinyin && (
                        <div className="mt-2 break-words text-[16px] leading-7 text-emerald-400/90 sm:text-[18px]">
                          {currentCard.examplePinyin}
                        </div>
                      )}

                      {currentCard.exampleTranslation && (
                        <div className="mt-2 break-words text-[15px] leading-6 text-white/75 sm:text-[17px] sm:leading-7">
                          {currentCard.exampleTranslation}
                        </div>
                      )}

                      {/* ==================================================
                       * TTS CONTOH
                       * ================================================== */}
                      <button
                        type="button"
                        onClick={handleSpeakExample}
                        className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold transition hover:bg-white/[0.08]"
                      >
                        <Volume2
                          className={[
                            "h-4 w-4",
                            isSpeaking ===
                            "example"
                              ? "animate-pulse text-emerald-400"
                              : "",
                          ].join(" ")}
                        />

                        TTS Contoh
                      </button>
                    </>
                  ) : (
                    <div className="mt-4 text-sm text-white/40">
                      Belum ada contoh penggunaan.
                    </div>
                  )}
                </div>

                {/* ========================================================
                 * DETAIL WORD
                 * ====================================================== */}
                {wordDetailPath && (
                  <div className="mt-4 text-center">
                    <Link
                      href={wordDetailPath(
                        currentCard
                      )}
                      className="text-sm font-medium text-white/45 underline-offset-4 hover:text-white hover:underline"
                    >
                      Lihat detail kosakata
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ================================================================
         * NAVIGATION
         * ================================================================ */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.025] px-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </button>

          <button
            type="button"
            onClick={handleFlip}
            className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.025] px-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
          >
            <EyeOff className="h-4 w-4" />
            Sembunyi
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={
              currentIndex >=
              totalCards - 1
            }
            className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.025] px-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Lewati
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* ================================================================
         * RATING
         * ================================================================ */}
        <div className="mt-5">
          <h2 className="text-center text-base font-bold sm:text-lg">
            Seberapa mudah kamu mengingatnya?
          </h2>

          <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
            {/* LUPA */}
            <button
              type="button"
              onClick={() =>
                handleRate("lupa")
              }
              className={[
                "min-h-[58px] rounded-2xl",
                "border border-white/10",
                "bg-white/[0.025]",
                "px-2 text-sm font-bold",
                "text-red-400",
                "transition",
                "hover:bg-red-500/10",
                ratings[
                  currentCard.id
                ] === "lupa"
                  ? "ring-2 ring-red-400/50"
                  : "",
              ].join(" ")}
            >
              Lupa
            </button>

            {/* RAGU */}
            <button
              type="button"
              onClick={() =>
                handleRate("ragu")
              }
              className={[
                "min-h-[58px] rounded-2xl",
                "border border-white/10",
                "bg-white/[0.025]",
                "px-2 text-sm font-bold",
                "text-yellow-400",
                "transition",
                "hover:bg-yellow-500/10",
                ratings[
                  currentCard.id
                ] === "ragu"
                  ? "ring-2 ring-yellow-400/50"
                  : "",
              ].join(" ")}
            >
              Ragu
            </button>

            {/* HAFAL / MUDAH */}
            <button
              type="button"
              onClick={() =>
                handleRate("hafal")
              }
              className={[
                "min-h-[58px] rounded-2xl",
                "border border-white/10",
                "bg-white/[0.025]",
                "px-2 text-sm font-bold",
                "text-emerald-400",
                "transition",
                "hover:bg-emerald-500/10",
                ratings[
                  currentCard.id
                ] === "hafal"
                  ? "ring-2 ring-emerald-400/50"
                  : "",
              ].join(" ")}
            >
              Mudah
            </button>
          </div>
        </div>

        {/* ================================================================
         * SESSION POSITION
         * ================================================================ */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-white/35">
          <span>
            Kartu {currentIndex + 1}
          </span>

          <span>•</span>

          <span>
            {ratedCount} dinilai
          </span>

          <span>•</span>

          <span>
            {totalCards} total
          </span>
        </div>
      </div>
    </main>
  )
}
