/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Flashcard Word Detail Page */


"use client"

import * as React from "react"
import { PageLoader } from "@/components/page-loader"
import { TonePinyin, TonePinyinText } from "@/components/tone-pinyin"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { BookOpen, Flag, Heart, MoreHorizontal, Plus, Volume2, X, ArrowLeft } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { fetchCharacterDictionary, fetchCharacterEntries, type CharacterDictionary, type CharacterDictionaryEntry } from "@/lib/character-dictionary"
import { speakMandarin, speakParagraph } from "@/lib/tts"
import { toggleFavorite, checkFavorite, listFavorites } from "@/lib/personal-decks"
import { ReportModal } from "@/components/report-modal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AddSentenceModal } from "@/components/add-sentence-modal"
import { SwipeToReport } from "@/components/swipe-to-report"
import { isHanzi, IDS_LABELS, WORD_CLASS_LABELS, decompParts } from "@/lib/hanzi-utils"
import { getWordDetailPath, initGlobalSearchCache, segmentSentenceByPinyin, sentenceContainsExactWord, sentenceMeaningMatches, type SegmentedWord } from "@/lib/hanzi-segmentation"
import styles from "./page.module.css"
import { sortRelatedWords } from "@/lib/flashcard-related-words"

type DetailTab = "kalimat" | "stroke" | "karakter" | "kata"
type Card = { id: string; set_id: number | string; hanzi: string; pinyin: string; arti: string; catatan?: string | null; word_class?: string | null; hsk_level?: number | null; badge?: string | null }
type ExampleSentence = { id: number; hanzi: string | null; pinyin: string | null; arti: string | null; section_label?: string | null; linkedToWord?: boolean }
type CompoundWord = { id?: string | number; set_id?: number; source?: "hsk" | "compound"; hanzi: string; pinyin: string | null; arti: string | null; badge?: string | null }
type WordPopoverState = { hanzi: string; pinyin: string; arti: string; x: number; y: number }
type DictionaryMap = CharacterDictionary
type DictionaryEntry = CharacterDictionaryEntry
type ContentReportState = {
  isOpen: boolean
  contentType: "kalimat" | "kosakata"
  contentId: number | string
  contentLabel: string
}

function getDetailTab(value: string | null): DetailTab {
  return value === "stroke" || value === "karakter" || value === "kata" ? value : "kalimat"
}

function useLongPress(onTap: () => void, onLongPress: () => void) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAt = React.useRef({ x: 0, y: 0 })
  const held = React.useRef(false)
  const clear = React.useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null }, [])
  React.useEffect(() => clear, [clear])
  return {
    onPointerDown: (event: React.PointerEvent) => { held.current = false; startedAt.current = { x: event.clientX, y: event.clientY }; timer.current = setTimeout(() => { held.current = true; if (navigator.vibrate) navigator.vibrate(40); onLongPress() }, 550) },
    onPointerMove: (event: React.PointerEvent) => { const started = startedAt.current; if (Math.abs(event.clientX - started.x) > 18 || Math.abs(event.clientY - started.y) > 18) clear() },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClick: (event: React.MouseEvent) => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; return } onTap() },
  }
}

function heroBadgeLabel(card: Card): string | null {
  if (card.hsk_level) return `HSK ${card.hsk_level}`
  const normalized = card.badge?.trim().toLowerCase() ?? ""
  if (normalized === "common") return "Common"
  if (normalized === "native") return "Native"
  if (card.badge?.trim()) return card.badge.trim()
  if (String(card.set_id) === "search") return "Native"
  return null
}

function getHanziLookupTerms(text: string | null | undefined): string[] {
  if (!text) return []
  const terms = new Set<string>()
  for (const run of text.match(/[\u3400-\u9fff]+/g) ?? []) {
    if (run.length > 1) terms.add(run)
    for (let start = 0; start < run.length; start++) {
      for (let length = 1; length <= Math.min(4, run.length - start); length++) {
        terms.add(run.slice(start, start + length))
      }
    }
  }
  return [...terms]
}

export default function WordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const cardId = String(params.cardId)
  const supa = useSupabase()
  const [tab, setTab] = React.useState<DetailTab>(() => getDetailTab(searchParams.get("tab")))
  const [card, setCard] = React.useState<Card | null>(null)
  const [deckHanziPinyin, setDeckHanziPinyin] = React.useState<Array<{ hanzi: string; pinyin: string }>>([])
  const [examples, setExamples] = React.useState<ExampleSentence[]>([])
  const [compounds, setCompounds] = React.useState<CompoundWord[]>([])
  const [favoriteWords, setFavoriteWords] = React.useState<Set<string>>(new Set())
  const [cacheReady, setCacheReady] = React.useState(false)
  const [needsMeaningMatch, setNeedsMeaningMatch] = React.useState(false)
  const [wordPopover, setWordPopover] = React.useState<WordPopoverState | null>(null)
  const [dictionary, setDictionary] = React.useState<CharacterDictionary | null>(null)
  const [dictionaryKey, setDictionaryKey] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [tabLoading, setTabLoading] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [favorited, setFavorited] = React.useState(false)
  const [reportModal, setReportModal] = React.useState<ContentReportState>({
    isOpen: false,
    contentType: "kosakata",
    contentId: cardId,
    contentLabel: "",
  })
  const [addSentenceModal, setAddSentenceModal] = React.useState(false)
  const fromSearch = searchParams.get('from') === 'search'
  const relevantExamples = React.useMemo(() => examples.filter(example => {
    if (!cacheReady || !example.hanzi || !card) return false
    if (!sentenceContainsExactWord(example.hanzi, card.hanzi, card.pinyin, example.pinyin)) return false

    // Apply meaning match filter for hanzi appearing in multiple HSK levels
    // For multi-level hanzi, even linked examples must match the correct meaning
    if (needsMeaningMatch) {
      const meaningMatch = sentenceMeaningMatches(card.arti, example.arti)
      // Treat null as no match for multi-level hanzi to be strict
      if (meaningMatch !== true) return false
    }

    return true
  }), [examples, card, cacheReady, needsMeaningMatch])

  React.useEffect(() => {
    setTab(getDetailTab(searchParams.get("tab")))
  }, [searchParams])

  React.useEffect(() => {
    const scrollContainer = contentRef.current?.closest(".overflow-auto")
    if (!scrollContainer) return

    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const handleScroll = () => {
      setIsScrolling(true)
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => setIsScrolling(false), 700)
    }

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll)
      if (idleTimer) clearTimeout(idleTimer)
    }
  }, [loading])

  function handleTabChange(nextTab: DetailTab) {
    setTab(nextTab)
    const url = new URL(window.location.href)
    if (nextTab === "kalimat") url.searchParams.delete("tab")
    else url.searchParams.set("tab", nextTab)
    router.replace(`${url.pathname}${url.search}`, { scroll: false })
  }

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      // Saat komponen pertama kali mount / route param belum sepenuhnya
      // siap, `cardId` bisa sesaat bernilai kosong atau string "undefined".
      // Kalau tetap lanjut fetch, query pasti gagal menemukan data dan
      // halaman sempat menampilkan teks merah "tidak ditemukan" sebelum
      // param yang benar masuk dan effect ini jalan ulang. Jadi query
      // ditunda dulu sampai cardId benar-benar valid — state `loading`
      // (true sejak awal) tetap dipertahankan sehingga yang tampil cuma
      // spinner, bukan pesan error.
      if (!cardId || cardId === "undefined" || cardId === "null") return
      setLoading(true)
      let cardRes = await supa.from("flashcard_cards").select("id, set_id, hanzi, pinyin, arti, catatan, word_class").eq("id", cardId).single()
      if (cardRes.error) cardRes = await supa.from("flashcard_cards").select("id, set_id, hanzi, pinyin, arti").eq("id", cardId).single()
      if (cardRes.data) {
        let hsk_level: number | null = null
        if (cardRes.data.set_id != null) {
          const [setRes, deckCardsRes] = await Promise.all([
            supa.from("flashcard_sets").select("hsk_level").eq("id", cardRes.data.set_id).maybeSingle(),
            supa.from("flashcard_cards").select("hanzi, pinyin").eq("set_id", cardRes.data.set_id),
          ])
          hsk_level = setRes.data?.hsk_level ?? null
          const lookupTerms = getHanziLookupTerms(cardRes.data.catatan)
          const noteCardsRes = lookupTerms.length
            ? await supa.from("flashcard_cards").select("hanzi, pinyin").in("hanzi", lookupTerms)
            : { data: [] }
          const lookup = new Map<string, string>()
          for (const item of [...(noteCardsRes.data ?? []), ...(deckCardsRes.data ?? [])]) {
            if (item.hanzi && item.pinyin) lookup.set(item.hanzi, item.pinyin)
          }
          // Notes may contain a whole compound (e.g. 美国) with only the
          // first syllable recorded beside it. Fill missing character readings
          // from the character dictionary so the compound can still be rebuilt
          // as one pinyin unit (měiguó), even when no matching vocab card exists.
          const noteCharacters = [...new Set(cardRes.data.catatan?.match(/[\u3400-\u9fff]/gu) ?? [])]
          const missingCharacters = noteCharacters.filter(character => !lookup.has(character))
          if (missingCharacters.length) {
            try {
              const characterEntries = await fetchCharacterEntries(supa, missingCharacters)
              for (const [character, entry] of Object.entries(characterEntries)) {
                if (entry.pinyin[0]) lookup.set(character, entry.pinyin[0])
              }
            } catch {
              // Keep the available flashcard readings if the dictionary is unavailable.
            }
          }
          if (!cancelled) setDeckHanziPinyin([...lookup].map(([hanzi, pinyin]) => ({ hanzi, pinyin })))
        }
        if (!cancelled) setCard({ ...cardRes.data, hsk_level })

        // Check if hanzi appears in multiple HSK levels
        if (!cancelled && cardRes.data.hanzi) {
          const hanzi = cardRes.data.hanzi
          const escaped = hanzi.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
          // Query hanzi_items where hanzi exactly matches OR contains the target
          const { data: hanziItems } = await supa
            .from("hanzi_items")
            .select("hanzi, hanzi_key")
            .or(`hanzi.eq."${escaped}",hanzi.ilike."%${escaped}%"`)
            .limit(1000)

          if (hanziItems && hanziItems.length > 0) {
            // Filter to only items where the hanzi actually contains the target character
            const relevantItems = hanziItems.filter(row => row.hanzi && row.hanzi.includes(hanzi))
            const setKeys = [...new Set(relevantItems.map(row => row.hanzi_key).filter(Boolean))]
            const { data: hanziSets } = await supa
              .from("hanzi_sets")
              .select("badge")
              .in("key", setKeys)

            const badges = new Set((hanziSets ?? []).map(s => s.badge).filter(Boolean))
            // Count unique HSK levels (HSK 1, HSK 2, etc.)
            const hskLevels = new Set<string>()
            for (const badge of badges) {
              const match = badge?.trim().match(/^HSK\s*([1-6])$/i)
              if (match) hskLevels.add(`HSK ${match[1]}`)
            }
            setNeedsMeaningMatch(hskLevels.size >= 2)
          } else {
            setNeedsMeaningMatch(false)
          }
        }

        setLoading(false)
        return
      }

      const compoundRes = await supa.from("word_compounds").select("id, hanzi, pinyin, arti, badge").eq("id", Number(cardId)).maybeSingle()
      if (cancelled) return
      if (compoundRes.data) {
        setCard({
          id: String(compoundRes.data.id),
          set_id: "search",
          hanzi: compoundRes.data.hanzi,
          pinyin: compoundRes.data.pinyin ?? "",
          arti: compoundRes.data.arti ?? "",
          badge: compoundRes.data.badge,
        })
        setNeedsMeaningMatch(false)
      } else {
        setCard(null)
        setNeedsMeaningMatch(false)
      }
      setLoading(false)
    }
    load(); return () => { cancelled = true }
  }, [cardId])

  React.useEffect(() => {
    let cancelled = false
    initGlobalSearchCache().then(() => { if (!cancelled) setCacheReady(true) })
    return () => { cancelled = true }
  }, [])

  // Tutup popup detail kata saat klik di luar popup atau saat scroll.
  React.useEffect(() => {
    if (!wordPopover) return
    function close() { setWordPopover(null) }
    document.addEventListener("click", close)
    window.addEventListener("scroll", close, true)
    return () => {
      document.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [wordPopover])

  React.useEffect(() => {
    if (!card) return
    checkFavorite(card.hanzi).then(setFavorited)
  }, [card])

  React.useEffect(() => {
    let cancelled = false
    listFavorites().then(favorites => {
      if (!cancelled) setFavoriteWords(new Set(favorites.map(favorite => favorite.hanzi)))
    })
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (!card) return
    const activeCard = card
    let cancelled = false
    async function loadExamples() {
      setTabLoading(true)
      const [hanziRes, directRes, sentenceRes] = await Promise.all([
        supa.from("hanzi_items").select("id, section_label, hanzi, pinyin, arti").ilike("hanzi", `%${activeCard.hanzi}%`).order("id").limit(20),
        supa.from("word_examples").select("id, hanzi, pinyin, arti").eq("word_hanzi", activeCard.hanzi).order("id"),
        supa.from("word_examples").select("id, hanzi, pinyin, arti").ilike("hanzi", `%${activeCard.hanzi}%`).order("id").limit(20),
      ])
      if (cancelled) return
      const seen = new Set<string>()
      setExamples([
        ...(hanziRes.data ?? []).map(item => ({ ...item, linkedToWord: false })),
        ...(directRes.data ?? []).map(item => ({ ...item, linkedToWord: true })),
        ...(sentenceRes.data ?? []).map(item => ({ ...item, linkedToWord: false })),
      ].filter(item => { const key = `${item.id}-${item.hanzi}`; if (seen.has(key)) return false; seen.add(key); return true }))
      setTabLoading(false)
    }
    loadExamples(); return () => { cancelled = true }
  }, [card])

  React.useEffect(() => {
    if (!card || tab !== "kata") return
    const activeCard = card
    let cancelled = false
    async function loadCompounds() {
      setTabLoading(true)
      const select = "hanzi, pinyin, arti, badge"
      const [primary, flashcardMatches] = await Promise.all([
        supa.from("word_compounds").select(`id, ${select}`).ilike("hanzi", `%${activeCard.hanzi}%`).order("frequency", { ascending: false }).limit(30),
        supa.from("flashcard_cards").select("id, set_id, hanzi, pinyin, arti, flashcard_sets(hsk_level)").ilike("hanzi", `%${activeCard.hanzi}%`).limit(30),
      ])
      const flashcardWords: CompoundWord[] = (flashcardMatches.data ?? []).map(word => ({
        id: word.id,
        set_id: word.set_id,
        source: "hsk",
        hanzi: word.hanzi,
        pinyin: word.pinyin,
        arti: word.arti,
        badge: word.flashcard_sets?.hsk_level ? `HSK ${word.flashcard_sets.hsk_level}` : null,
      }))
      let data: CompoundWord[] = [...flashcardWords, ...(primary.data ?? []).map(word => ({ ...word, source: "compound" as const }))]

      // Dataset compounds tidak selalu memiliki kata lengkap (mis. 你好),
      // sehingga gunakan karakter penyusunnya sebagai fallback — tapi hasilnya
      // harus tetap mengandung SEMUA karakter penyusun (AND), bukan salah satu (OR),
      // supaya tidak muncul kata yang cuma nyambung ke satu suku kata saja.
      if (data.length === 0 && [...activeCard.hanzi].length > 1) {
        let fallbackQuery = supa.from("word_compounds").select(`id, ${select}`)
        let fallbackCardsQuery = supa.from("flashcard_cards").select("id, set_id, hanzi, pinyin, arti, flashcard_sets(hsk_level)")
        for (const char of [...activeCard.hanzi]) {
          fallbackQuery = fallbackQuery.ilike("hanzi", `%${char}%`)
          fallbackCardsQuery = fallbackCardsQuery.ilike("hanzi", `%${char}%`)
        }
        const [fallback, fallbackCards] = await Promise.all([
          fallbackQuery.order("frequency", { ascending: false }).limit(30),
          fallbackCardsQuery.limit(30),
        ])
        const fallbackFlashcardWords: CompoundWord[] = (fallbackCards.data ?? []).map(word => ({
          id: word.id,
          set_id: word.set_id,
          source: "hsk",
          hanzi: word.hanzi,
          pinyin: word.pinyin,
          arti: word.arti,
          badge: word.flashcard_sets?.hsk_level ? `HSK ${word.flashcard_sets.hsk_level}` : null,
        }))
        data = [...fallbackFlashcardWords, ...(fallback.data ?? []).map(word => ({ ...word, source: "compound" as const }))]
      }
      if (!cancelled) {
        const unique = new Map(data.map(word => [`${word.hanzi}\u0000${word.pinyin ?? ""}\u0000${word.arti ?? ""}`, word]))
        setCompounds(sortRelatedWords([...unique.values()], activeCard.hanzi).slice(0, 30))
        setTabLoading(false)
      }
    }
    loadCompounds(); return () => { cancelled = true }
  }, [card, tab])

  React.useEffect(() => {
    if (!card || tab !== "karakter") return
    let cancelled = false
    const characters = [...new Set([...card.hanzi].filter(isHanzi))]
    const characterKey = characters.join("|")
    if (dictionaryKey === characterKey) return
    setDictionary(null)
    fetchCharacterDictionary(supa, characters)
      .then(data => {
        if (cancelled) return
        setDictionary(data)
        setDictionaryKey(characterKey)
      })
      .catch(error => {
        console.error("Gagal memuat data karakter:", error)
        if (!cancelled) {
          setDictionary({})
          setDictionaryKey(characterKey)
        }
      })
    return () => { cancelled = true }
  }, [card, dictionaryKey, supa, tab])

  if (loading) return <PageLoader />
  if (!card && cardId && cardId !== "undefined" && cardId !== "null") return <div className="p-8 text-sm text-red-400">Detail kata tidak ditemukan.</div>
  if (!card) return null

  const chars = [...card.hanzi].filter(isHanzi)
  const tabs: Array<{ id: DetailTab; label: string }> = [{ id: "kalimat", label: "Kalimat" }, { id: "stroke", label: "Goresan" }, { id: "karakter", label: "Karakter" }, { id: "kata", label: "Kata" }]

  async function handleToggleFavorite() {
    if (!card) return
    const result = await toggleFavorite({
      hanzi: card.hanzi,
      pinyin: card.pinyin,
      arti: card.arti,
      word_class: card.word_class,
      catatan: card.catatan,
      source: "flashcard",
      source_id: Number(card.id),
    })
    if (!result.error) {
      setFavorited(result.isFavorited)
    }
  }

  function openReportModal() {
    if (!card) return
    setReportModal({ isOpen: true, contentType: "kosakata", contentId: cardId, contentLabel: card.hanzi })
  }

  function openSentenceReportModal(example: ExampleSentence) {
    setReportModal({
      isOpen: true,
      contentType: "kalimat",
      contentId: example.id,
      contentLabel: example.hanzi ?? "Contoh kalimat",
    })
  }

  function openRelatedWordReportModal(word: CompoundWord) {
    setReportModal({
      isOpen: true,
      contentType: "kosakata",
      contentId: word.id ?? word.hanzi,
      contentLabel: word.hanzi,
    })
  }

  async function handleRelatedWordFavorite(word: CompoundWord) {
    const wasFavorited = favoriteWords.has(word.hanzi)
    setFavoriteWords(current => {
      const next = new Set(current)
      if (wasFavorited) next.delete(word.hanzi)
      else next.add(word.hanzi)
      return next
    })

    const sourceId = word.id == null ? null : Number(word.id)
    const result = await toggleFavorite({
      hanzi: word.hanzi,
      pinyin: word.pinyin ?? "",
      arti: word.arti ?? "",
      source: word.source ?? "compound",
      source_id: sourceId != null && Number.isFinite(sourceId) ? sourceId : null,
    })
    if (result.error) {
      setFavoriteWords(current => {
        const next = new Set(current)
        if (wasFavorited) next.add(word.hanzi)
        else next.delete(word.hanzi)
        return next
      })
    } else {
      setFavoriteWords(current => {
        const next = new Set(current)
        if (result.isFavorited) next.add(word.hanzi)
        else next.delete(word.hanzi)
        return next
      })
    }
  }

  function closeReportModal() {
    setReportModal(current => ({ ...current, isOpen: false, contentLabel: "" }))
  }

  function openWordPopover(seg: SegmentedWord, e: React.MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    // pinyin/arti sudah ikut dari hasil segmentText() (cache global), jadi
    // popup langsung tampil tanpa query tambahan. TTS TIDAK diputar di sini
    // — hanya dipicu saat tombol "Dengar" di dalam popup ditekan.
    setWordPopover({
      hanzi: seg.hanzi,
      pinyin: seg.pinyin || "Tidak ditemukan",
      arti: seg.arti || "Tidak ditemukan",
      x: Math.min(Math.max(rect.left, 12), window.innerWidth - 232),
      y: rect.bottom + 8,
    })
  }

  function openAddSentenceModal() {
    setAddSentenceModal(true)
  }

  function closeAddSentenceModal() {
    setAddSentenceModal(false)
  }

  return <div className={styles.page}>
    <nav className={styles.tabs}>{tabs.map(item => <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} onClick={() => handleTabChange(item.id)}>{item.label}</button>)}</nav>
    <Hero card={card} hanziPinyin={deckHanziPinyin} favorited={favorited} onToggleFavorite={handleToggleFavorite} onReport={openReportModal} />
    <div ref={contentRef} className={styles.content}>{tabLoading && <LoadingLine label="Memuat data..." />}{tab === "kalimat" && !tabLoading && <SentenceTab examples={relevantExamples} cacheReady={cacheReady} onAddSentence={openAddSentenceModal} onWordOpen={openWordPopover} onReport={openSentenceReportModal} />}{tab === "stroke" && <div className={styles.strokeGrid}>{chars.map((char, index) => <StrokePreview key={`${char}-${index}`} char={char} />)}</div>}{tab === "karakter" && <div>{chars.map((char, index) => <CharBreakdown key={`${char}-${index}`} char={char} dictionary={dictionary} />)}</div>}{tab === "kata" && !tabLoading && <WordTab compounds={compounds} favoriteWords={favoriteWords} isScrolling={isScrolling} onSpeak={hanzi => speakMandarin(hanzi)} onOpen={word => { const path = getWordDetailPath(word); if (path) router.push(path) }} onReport={openRelatedWordReportModal} onFavorite={handleRelatedWordFavorite} />}</div>

    {/* Popup detail kata hasil segmentasi contoh kalimat */}
    {wordPopover && (
      <div
        className={styles.wordPopover}
        style={{ left: wordPopover.x, top: wordPopover.y }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.wordPopoverHeader}>
          <div className="min-w-0">
            <div className={styles.wordPopoverHanzi}>{wordPopover.hanzi}</div>
            {wordPopover.pinyin && <div className={styles.wordPopoverPinyin}>{wordPopover.pinyin}</div>}
          </div>
          <button type="button" onClick={() => setWordPopover(null)} className={styles.wordPopoverClose} aria-label="Tutup">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {wordPopover.arti && <p className={styles.wordPopoverArti}>{wordPopover.arti}</p>}
        <button
          type="button"
          onClick={() => speakMandarin(wordPopover.hanzi)}
          className={styles.wordPopoverListen}
        >
          <Volume2 className="h-3.5 w-3.5" />
          Dengar
        </button>
      </div>
    )}

    {/* Report Modal */}
    <ReportModal
      isOpen={reportModal.isOpen}
      onClose={closeReportModal}
      contentType={reportModal.contentType}
      contentId={reportModal.contentId}
      contentLabel={reportModal.contentLabel}
    />

    {/* Add Sentence Modal */}
    <AddSentenceModal
      isOpen={addSentenceModal}
      onClose={closeAddSentenceModal}
      hanziKey={card?.hanzi || ""}
      onSuccess={() => {
        // Reload the vocabulary data to refresh examples
        if (!cardId) return
        supa.from("flashcard_cards").select("*").eq("id", cardId).single().then(({ data }) => {
          if (data) setCard(data)
        })
        closeAddSentenceModal()
      }}
    />
  </div>
}

function Hero({ card, hanziPinyin, favorited, onToggleFavorite, onReport }: { card: Card; hanziPinyin: Array<{ hanzi: string; pinyin: string }>; favorited: boolean; onToggleFavorite: () => void; onReport: () => void }) {
  const gesture = useLongPress(() => speakMandarin(card.hanzi), () => speakMandarin(card.hanzi))
  const badge = heroBadgeLabel(card)
  return <section className={styles.hero}>{badge && <span className={styles.hskBadge}>{badge}</span>}<div className={styles.heroTools}><button type="button" aria-label="Laporkan kesalahan" className={styles.toolButton} onClick={onReport}><Flag className="h-5 w-5" /></button><button type="button" aria-label="Favorit" className={`${styles.toolButton} ${favorited ? styles.toolButtonActive : ""}`} onClick={onToggleFavorite}><Heart className={`h-5 w-5 ${favorited ? "fill-current" : ""}`} /></button></div><div className={styles.heroContent} {...gesture}><div className={styles.hanzi}>{card.hanzi}</div><div className={styles.pinyin}><TonePinyin text={card.pinyin || ""} /></div><div className={styles.meaning}>{card.arti}</div>{card.word_class && <div className={styles.wordClass}>{WORD_CLASS_LABELS[card.word_class] ?? card.word_class}</div>}{card.catatan && <p className={styles.note}><TonePinyinText text={card.catatan} hanziPinyin={hanziPinyin} /></p>}</div></section>
}

function SentenceTab({ examples, cacheReady, onAddSentence, onWordOpen, onReport }: { examples: ExampleSentence[]; cacheReady: boolean; onAddSentence: () => void; onWordOpen: (segment: SegmentedWord, e: React.MouseEvent) => void; onReport: (example: ExampleSentence) => void }) {
  if (examples.length === 0) return <EmptyLine label="Belum ada contoh kalimat." />
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          data-bottom-accent="on"
          onClick={onAddSentence}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          Tambah Contoh Kalimat
        </button>
      </div>
      <div className={styles.sentenceGroupTitle}>{examples.length} contoh kalimat</div>
      <div className={styles.sentenceList}>{examples.map(example => <SentenceCard key={`${example.id}-${example.hanzi}`} example={example} cacheReady={cacheReady} onWordOpen={onWordOpen} onReport={onReport} />)}</div>
    </div>
  )
}

function SentenceCard({ example, cacheReady, onWordOpen, onReport }: { example: ExampleSentence; cacheReady: boolean; onWordOpen: (segment: SegmentedWord, e: React.MouseEvent) => void; onReport: (example: ExampleSentence) => void }) {
  const sentence = example.hanzi || ""
  const [activeSegment, setActiveSegment] = React.useState<number | null>(null)
  const playbackId = React.useRef(0)

  // Segmentasi kosakata pada kalimat memakai cache global yang sama dengan
  // fitur pencarian & cerita (segmentText), sehingga tiap potongan kata
  // sudah membawa pinyin & arti asli untuk ditampilkan di popup — bukan
  // sekadar status "diketahui/tidak" seperti sebelumnya.
  const segments = React.useMemo(() => (cacheReady ? segmentSentenceByPinyin(sentence, example.pinyin) : []), [sentence, example.pinyin, cacheReady])

  const playSentence = React.useCallback(() => {
    const currentPlaybackId = ++playbackId.current
    const playableSegments = segments.length > 0 ? segments : [{ hanzi: sentence, found: false }]
    let charOffset = 0
    const ranges = playableSegments.map((segment, index) => {
      const start = charOffset
      charOffset += segment.hanzi.length
      return { index, start, end: charOffset }
    })
    const first = ranges.find(range => isHanzi(playableSegments[range.index].hanzi[0] ?? ""))
    setActiveSegment(first?.index ?? 0)
    let playbackRate = 1
    const totalChars = Math.max(1, sentence.length)
    let lastActiveCharIndex = 0
    let lastActiveSegment = first?.index ?? -1
    const startedAt = performance.now()
    const findWordRange = (charIndex: number) => {
      const exact = ranges.find(range => charIndex >= range.start && charIndex < range.end)
      if (exact && isHanzi(playableSegments[exact.index].hanzi[0] ?? "")) return exact
      if (exact) {
        return [...ranges].reverse().find(range =>
          isHanzi(playableSegments[range.index].hanzi[0] ?? "") && range.end <= exact.start,
        )
      }
      return ranges
        .filter(range => isHanzi(playableSegments[range.index].hanzi[0] ?? ""))
        .filter(range => range.end <= charIndex)
        .at(-1)
    }
    const applyCharacterIndex = (charIndex: number) => {
      const range = findWordRange(charIndex)
      if (range && range.index > lastActiveSegment) {
        lastActiveSegment = range.index
        setActiveSegment(range.index)
      }
    }
    const fallback = window.setInterval(() => {
      if (playbackId.current !== currentPlaybackId) return
      // Normal tetap 260 ms. Pelan/Lambat dipercepat agar highlight tidak
      // tertinggal dari audio pada voice browser yang lebih cepat.
      const msPerChar = playbackRate >= 0.95 ? 260 : playbackRate >= 0.5 ? 350 : 450
      const estimatedIndex = Math.min(totalChars - 1, Math.floor((performance.now() - startedAt) / msPerChar))
      if (estimatedIndex > lastActiveCharIndex) {
        // Batasi satu langkah karakter per tick agar tab yang sempat tertahan
        // tidak membuat highlight meloncat beberapa kata sekaligus.
        lastActiveCharIndex = Math.min(estimatedIndex, lastActiveCharIndex + 1)
        applyCharacterIndex(lastActiveCharIndex)
      }
    }, 50)
    void speakParagraph(sentence, undefined, undefined, rate => { playbackRate = rate }).finally(() => {
      window.clearInterval(fallback)
      if (playbackId.current === currentPlaybackId) setActiveSegment(null)
    })
  }, [segments, sentence])
  const gesture = useLongPress(playSentence, playSentence)

  return (
    <SwipeToReport onReport={() => onReport(example)}>
      <article className={`${styles.sentenceCard} ${activeSegment !== null ? styles.sentenceCardPlaying : ""}`} {...gesture}>
        <div className={styles.sentenceHanzi}>
          {segments.length > 0
            ? segments.map((segment, index) => isHanzi(segment.hanzi[0] ?? "")
              ? <SentenceToken key={`${segment.hanzi}-${index}`} segment={segment} active={activeSegment === index} onOpen={onWordOpen} />
              : <React.Fragment key={`${segment.hanzi}-${index}`}>{segment.hanzi}</React.Fragment>)
            : sentence}
        </div>
        {example.pinyin && <div className={styles.sentencePinyin}><TonePinyin text={example.pinyin} /></div>}
        {example.arti && <div className={styles.sentenceMeaning}>{example.arti}</div>}
      </article>
    </SwipeToReport>
  )
}

function SentenceToken({ segment, active, onOpen }: { segment: SegmentedWord; active: boolean; onOpen: (segment: SegmentedWord, e: React.MouseEvent) => void }) {
  // Tap kata hanya membuka popup detail (hanzi/pinyin/arti) — TTS tidak
  // diputar otomatis di sini, hanya lewat tombol "Dengar" di dalam popup.
  return (
    <button
      type="button"
      aria-label={`Detail kata ${segment.hanzi}`}
      className={`${segment.found ? styles.knownToken : styles.singleToken} ${active ? styles.ttsActiveToken : ""}`}
      onClick={event => { event.stopPropagation(); onOpen(segment, event) }}
    >
      {segment.hanzi}
    </button>
  )
}

function getVocabularyBadge(badge?: string | null) {
  const normalized = badge?.trim().toLowerCase() ?? ""
  const hsk = normalized.match(/hsk\s*([1-6])/)
  if (hsk) return { label: `HSK ${hsk[1]}`, tone: `wordBadgeHsk${hsk[1]}` }
  if (normalized === "common") return { label: "Common", tone: "wordBadgeCommon" }
  if (normalized === "native" || !normalized) return { label: "Native", tone: "wordBadgeNative" }
  return { label: badge ?? "Native", tone: "wordBadgeNative" }
}

function WordTab({ compounds, favoriteWords, isScrolling, onSpeak, onOpen, onReport, onFavorite }: { compounds: CompoundWord[]; favoriteWords: Set<string>; isScrolling: boolean; onSpeak: (hanzi: string) => void; onOpen: (word: CompoundWord) => void; onReport: (word: CompoundWord) => void; onFavorite: (word: CompoundWord) => void }) {
  if (compounds.length === 0) return <EmptyLine label="Tidak ada kata gabungan ditemukan." />
  return <div className={styles.wordList}>{compounds.map((word, index) => <SwipeToReport key={`${word.hanzi}-${word.id ?? index}`} onFavorite={() => onFavorite(word)} favorited={favoriteWords.has(word.hanzi)}><WordRow word={word} count={index + 1} isScrolling={isScrolling} onSpeak={onSpeak} onOpen={onOpen} onReport={onReport} /></SwipeToReport>)}</div>
}

function WordRow({ word, count, isScrolling, onSpeak, onOpen, onReport }: { word: CompoundWord; count: number; isScrolling: boolean; onSpeak: (hanzi: string) => void; onOpen: (word: CompoundWord) => void; onReport: (word: CompoundWord) => void }) {
  const badge = getVocabularyBadge(word.badge)
  return (
    <div className={styles.wordRow}>
      <button type="button" data-bottom-accent="off" className={styles.wordRowLink} onClick={() => onSpeak(word.hanzi)} aria-label={`Dengarkan ${word.hanzi}`}>
        <span className={styles.wordHanzi}>{word.hanzi}</span>
        <span className={styles.wordInfo}>
          <span className={styles.wordPinyin}><TonePinyin text={word.pinyin ?? ""} /></span>
          <span className={styles.wordMeaning}>{word.arti}</span>
        </span>
      </button>
      <div className={styles.wordActions}>
        <span className={`${styles.wordBadge} ${styles[badge.tone]}`}>{badge.label}</span>
        {isScrolling ? (
          <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-1 text-[11px] font-medium tabular-nums text-muted-foreground animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none" aria-label={`Kosakata ${count}`}>
            #{count}
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type="button" data-bottom-accent="off" className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={`Menu kosakata ${word.hanzi}`} title="Menu kosakata" />
              }
            >
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="grid w-44 grid-cols-2 gap-1 sm:w-64">
              <DropdownMenuItem onClick={() => onOpen(word)} className="min-h-16 flex-col justify-center gap-1 px-1.5 py-2 text-center text-xs sm:min-h-20 sm:gap-2 sm:px-2 sm:py-3 sm:text-sm">
                <BookOpen aria-hidden="true" className="size-4 text-primary sm:size-5" />
                <span>Detail</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReport(word)} className="min-h-16 flex-col justify-center gap-1 px-1.5 py-2 text-center text-xs sm:min-h-20 sm:gap-2 sm:px-2 sm:py-3 sm:text-sm">
                <Flag aria-hidden="true" className="size-4 text-destructive sm:size-5" />
                <span>Laporkan</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

function CharBreakdown({ char, dictionary }: { char: string; dictionary: DictionaryMap | null }) {
  const entry = dictionary?.[char]; const { ids, label, parts } = decompParts(entry)
  return <section className={styles.charBlock}><div className={styles.charMain}><div className={styles.charHeader}><CharSpeaker char={char} className={styles.charHanzi} /><div className="min-w-0">{entry?.pinyin?.length ? <div className={styles.pinyin}><TonePinyin text={entry.pinyin.join(", ")} /></div> : <div className="text-sm text-slate-500">Pinyin belum tersedia</div>}<div className={styles.charDefinition}>{entry?.definition || "Data karakter belum tersedia."}</div>{label && <div className={styles.charStructure}>{ids} · {label}</div>}</div></div>{entry?.etymology?.hint && <p className={styles.charEtymology}>{entry.etymology.hint}</p>}</div>{parts.length > 0 ? <><div className={styles.componentLabel}>↓ komponen</div><div className={styles.componentGrid}>{parts.map(part => <CharComponent key={part} char={part} entry={dictionary?.[part]} />)}</div></> : <p className="py-3 text-center text-sm text-slate-500">Tidak ada data komponen.</p>}</section>
}
function CharSpeaker({ char, className }: { char: string; className: string }) { const gesture = useLongPress(() => speakMandarin(char), () => speakMandarin(char)); return <button type="button" aria-label={`Dengarkan ${char}`} className={className} {...gesture}>{char}</button> }
function CharComponent({ char, entry }: { char: string; entry?: DictionaryEntry }) { const { ids, label, parts } = decompParts(entry); return <article className={styles.componentCard}><div className={styles.componentHeader}><CharSpeaker char={char} className={styles.componentHanzi} /><div className="min-w-0">{entry?.pinyin?.length ? <div className={styles.pinyin}><TonePinyin text={entry.pinyin.join(", ")} /></div> : null}<div className={styles.charDefinition}>{entry?.definition || "Data komponen belum tersedia."}</div>{label && <div className={styles.charStructure}>{ids} · {label}</div>}</div></div>{entry?.etymology?.hint && <p className={styles.charEtymology}>{entry.etymology.hint}</p>}{parts.length > 0 && <p className={styles.componentSub}>Komponen: {parts.join(" · ")}</p>}</article> }

function StrokePreview({ char }: { char: string }) {
  const targetRef = React.useRef<HTMLDivElement>(null); const writerRef = React.useRef<{ animateCharacter: () => void } | null>(null)
  React.useEffect(() => { let cancelled = false; const target = targetRef.current; if (!target) return; target.innerHTML = ""; import("hanzi-writer").then(({ default: HanziWriter }) => { if (cancelled || !targetRef.current) return; writerRef.current = HanziWriter.create(targetRef.current, char, { width: 260, height: 260, padding: 20, strokeColor: "#edf6ff", outlineColor: "#1b4965", drawingColor: "#42d6a4", showOutline: true, showCharacter: false }) }); return () => { cancelled = true; target.innerHTML = "" } }, [char])
  return <button type="button" data-bottom-accent="on" aria-label={`Putar animasi stroke ${char}`} className="flex w-full cursor-pointer flex-col items-center rounded-xl border border-border/60 bg-card/70 px-5 pb-6 pt-7 transition-colors hover:border-primary/55" onClick={() => writerRef.current?.animateCharacter()}><div ref={targetRef} className="h-[260px] w-[260px]" /></button>
}
function LoadingLine({ label }: { label: string }) { return <div className="flex justify-center py-12 text-sm text-slate-400">{label}</div> }
function EmptyLine({ label }: { label: string }) { return <div className="py-12 text-center text-sm text-slate-400">{label}</div> }
