"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Flag, Heart, Plus, Volume2, X } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { toggleFavorite, checkFavorite } from "@/lib/personal-decks"
import { ReportModal } from "@/components/report-modal"
import { AddSentenceModal } from "@/components/add-sentence-modal"
import { SwipeToReport } from "@/components/swipe-to-report"
import { getTone, isHanzi, IDS_LABELS, WORD_CLASS_LABELS, decompParts, splitPinyin, TONE_CLASS } from "@/lib/hanzi-utils"
import { initGlobalSearchCache, segmentText, type SegmentedWord } from "@/lib/hanzi-segmentation"
import styles from "./page.module.css"

type DetailTab = "kalimat" | "stroke" | "karakter" | "kata"
type Card = { id: string; set_id: number | string; hanzi: string; pinyin: string; arti: string; catatan?: string | null; word_class?: string | null; hsk_level?: number | null; badge?: string | null }
type ExampleSentence = { id: number; hanzi: string | null; pinyin: string | null; arti: string | null; section_label?: string | null }
type CompoundWord = { hanzi: string; pinyin: string | null; arti: string | null; badge?: string | null }
type DictionaryEntry = { pinyin?: string[]; definition?: string; decomposition?: string; etymology?: { hint?: string } }
type DictionaryMap = Record<string, DictionaryEntry>
type WordPopoverState = { hanzi: string; pinyin: string; arti: string; x: number; y: number }

function ColorPinyin({ text }: { text: string }) {
  return <>{text.split(/(\s+|[,!.?·。，！？、；：()]+)/).map((part, index) => {
    if (!part || /^(\s+|[,!.?·。，！？、；：()]+)$/.test(part)) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    return splitPinyin(part).map((syllable, syllableIndex) => {
      const tone = [...syllable].map(getTone).find(Boolean)
      return <span key={`${syllable}-${syllableIndex}`} className={tone ? styles[`tone${tone}` as "tone1" | "tone2" | "tone3" | "tone4"] : styles.tone0}>{syllable}</span>
    })
  })}</>
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

export default function WordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const cardId = String(params.cardId)
  const supa = useSupabase()
  const [tab, setTab] = React.useState<DetailTab>("kalimat")
  const [card, setCard] = React.useState<Card | null>(null)
  const [examples, setExamples] = React.useState<ExampleSentence[]>([])
  const [compounds, setCompounds] = React.useState<CompoundWord[]>([])
  const [cacheReady, setCacheReady] = React.useState(false)
  const [wordPopover, setWordPopover] = React.useState<WordPopoverState | null>(null)
  const [dictionary, setDictionary] = React.useState<DictionaryMap | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [tabLoading, setTabLoading] = React.useState(false)
  const [favorited, setFavorited] = React.useState(false)
  const [reportModal, setReportModal] = React.useState({ isOpen: false, contentLabel: "" })
  const [addSentenceModal, setAddSentenceModal] = React.useState(false)
  const fromSearch = searchParams.get('from') === 'search'

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
          const setRes = await supa.from("flashcard_sets").select("hsk_level").eq("id", cardRes.data.set_id).maybeSingle()
          hsk_level = setRes.data?.hsk_level ?? null
        }
        if (!cancelled) setCard({ ...cardRes.data, hsk_level })
        setLoading(false)
        return
      }

      const compoundRes = await supa.from("word_compounds").select("id, hanzi, pinyin, arti, badge").eq("id", cardId).maybeSingle()
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
      } else {
        setCard(null)
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
      setExamples([...(hanziRes.data ?? []), ...(directRes.data ?? []), ...(sentenceRes.data ?? [])].filter(item => { const key = `${item.id}-${item.hanzi}`; if (seen.has(key)) return false; seen.add(key); return true }))
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
      const primary = await supa.from("word_compounds").select(select).ilike("hanzi", `%${activeCard.hanzi}%`).order("frequency", { ascending: false }).limit(30)
      let data = primary.data ?? []

      // Dataset compounds tidak selalu memiliki kata lengkap (mis. 你好),
      // sehingga gunakan karakter penyusunnya sebagai fallback — tapi hasilnya
      // harus tetap mengandung SEMUA karakter penyusun (AND), bukan salah satu (OR),
      // supaya tidak muncul kata yang cuma nyambung ke satu suku kata saja.
      if (data.length === 0 && [...activeCard.hanzi].length > 1) {
        let fallbackQuery = supa.from("word_compounds").select(select)
        for (const char of [...activeCard.hanzi]) {
          fallbackQuery = fallbackQuery.ilike("hanzi", `%${char}%`)
        }
        const fallback = await fallbackQuery.order("frequency", { ascending: false }).limit(30)
        data = fallback.data ?? []
      }
      if (!cancelled) { setCompounds(data); setTabLoading(false) }
    }
    loadCompounds(); return () => { cancelled = true }
  }, [card, tab])

  React.useEffect(() => {
    if (tab !== "karakter" || dictionary) return
    let cancelled = false
    fetch("/data/dictionary.json").then(response => response.ok ? response.json() : null).then((data: DictionaryMap | null) => { if (!cancelled) setDictionary(data) }).catch(() => { if (!cancelled) setDictionary({}) })
    return () => { cancelled = true }
  }, [dictionary, tab])

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  if (!card) return <div className="p-8 text-sm text-red-400">Detail kata tidak ditemukan.</div>

  const chars = [...card.hanzi].filter(isHanzi)
  const tabs: Array<{ id: DetailTab; label: string }> = [{ id: "kalimat", label: "Sentences" }, { id: "stroke", label: "Stroke" }, { id: "karakter", label: "Char" }, { id: "kata", label: "Word" }]

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
    setReportModal({ isOpen: true, contentLabel: card.hanzi })
  }

  function closeReportModal() {
    setReportModal({ isOpen: false, contentLabel: "" })
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

  function handleAddSentenceSuccess() {
    // Reload the vocabulary data to refresh examples
    const controller = new AbortController()
    const signal = controller.signal

    const loadVocabulary = async () => {
      if (!cardId) return
      const { data: cardData } = await supa.from("flashcard_cards").select("*").eq("id", cardId).single()
      if (cardData) setCard(cardData)
    }

    loadVocabulary()
    closeAddSentenceModal()
  }

  return <div className={styles.page}>
    <nav className={styles.tabs}>{tabs.map(item => <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
    <Hero card={card} favorited={favorited} onToggleFavorite={handleToggleFavorite} onReport={openReportModal} />
    <div className={styles.content}>{tabLoading && <LoadingLine label="Memuat data..." />}{tab === "kalimat" && !tabLoading && <SentenceTab examples={examples} cacheReady={cacheReady} card={card} onAddSentence={openAddSentenceModal} onWordOpen={openWordPopover} />}{tab === "stroke" && <div className={styles.strokeGrid}>{chars.map((char, index) => <StrokePreview key={`${char}-${index}`} char={char} />)}</div>}{tab === "karakter" && <div>{chars.map((char, index) => <CharBreakdown key={`${char}-${index}`} char={char} dictionary={dictionary} />)}</div>}{tab === "kata" && !tabLoading && <WordTab compounds={compounds} />}</div>

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
      contentType="kosakata"
      contentId={cardId}
      contentLabel={reportModal.contentLabel}
    />

    {/* Add Sentence Modal */}
    <AddSentenceModal
      isOpen={addSentenceModal}
      onClose={closeAddSentenceModal}
      hanziKey={card?.hanzi || ""}
      onSuccess={handleAddSentenceSuccess}
    />
  </div>
}

function Hero({ card, favorited, onToggleFavorite, onReport }: { card: Card; favorited: boolean; onToggleFavorite: () => void; onReport: () => void }) {
  const gesture = useLongPress(() => speakMandarin(card.hanzi), () => speakMandarin(card.hanzi))
  const badge = heroBadgeLabel(card)
  return <section className={styles.hero}>{badge && <span className={styles.hskBadge}>{badge}</span>}<div className={styles.heroTools}><button type="button" aria-label="Laporkan kesalahan" className={styles.toolButton} onClick={onReport}><Flag className="h-5 w-5" /></button><button type="button" aria-label="Favorit" className={`${styles.toolButton} ${favorited ? styles.toolButtonActive : ""}`} onClick={onToggleFavorite}><Heart className={`h-5 w-5 ${favorited ? "fill-current" : ""}`} /></button></div><div className={styles.heroContent} {...gesture}><div className={styles.hanzi}>{card.hanzi}</div><div className={styles.pinyin}><ColorPinyin text={card.pinyin || ""} /></div><div className={styles.meaning}>{card.arti}</div>{card.word_class && <div className={styles.wordClass}>{WORD_CLASS_LABELS[card.word_class] ?? card.word_class}</div>}{card.catatan && <p className={styles.note}>{card.catatan}</p>}</div></section>
}

function SentenceTab({ examples, cacheReady, card, onAddSentence, onWordOpen }: { examples: ExampleSentence[]; cacheReady: boolean; card: Card; onAddSentence: () => void; onWordOpen: (segment: SegmentedWord, e: React.MouseEvent) => void }) {
  if (examples.length === 0) return <EmptyLine label="Belum ada contoh kalimat." />
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={onAddSentence}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          Tambah Contoh Kalimat
        </button>
      </div>
      <div className={styles.sentenceList}>{examples.map(example => <SentenceCard key={`${example.id}-${example.hanzi}`} example={example} cacheReady={cacheReady} onWordOpen={onWordOpen} />)}</div>
    </div>
  )
}

function SentenceCard({ example, cacheReady, onWordOpen }: { example: ExampleSentence; cacheReady: boolean; onWordOpen: (segment: SegmentedWord, e: React.MouseEvent) => void }) {
  const sentence = example.hanzi || ""
  const gesture = useLongPress(() => speakMandarin(sentence), () => speakMandarin(sentence))

  // Segmentasi kosakata pada kalimat memakai cache global yang sama dengan
  // fitur pencarian & cerita (segmentText), sehingga tiap potongan kata
  // sudah membawa pinyin & arti asli untuk ditampilkan di popup — bukan
  // sekadar status "diketahui/tidak" seperti sebelumnya.
  const segments = React.useMemo(() => (cacheReady ? segmentText(sentence) : []), [sentence, cacheReady])

  const handleReport = () => {
    window.openBugReportModal?.(
      `Kesalahan Kalimat: ${sentence}`,
      `Ditemukan kesalahan pada kalimat: ${sentence} (${example.pinyin || ""})`,
      'content',
      String(example.id)
    )
  }

  return (
    <SwipeToReport onReport={() => handleReport()}>
      <article className={styles.sentenceCard} {...gesture}>
        <div className={styles.sentenceHanzi}>
          {segments.length > 0
            ? segments.map((segment, index) => isHanzi(segment.hanzi[0] ?? "")
                ? <SentenceToken key={`${segment.hanzi}-${index}`} segment={segment} onOpen={onWordOpen} />
                : <React.Fragment key={`${segment.hanzi}-${index}`}>{segment.hanzi}</React.Fragment>)
            : sentence}
        </div>
        {example.pinyin && <div className={styles.sentencePinyin}><ColorPinyin text={example.pinyin} /></div>}
        {example.arti && <div className={styles.sentenceMeaning}>{example.arti}</div>}
      </article>
    </SwipeToReport>
  )
}

function SentenceToken({ segment, onOpen }: { segment: SegmentedWord; onOpen: (segment: SegmentedWord, e: React.MouseEvent) => void }) {
  // Tap kata hanya membuka popup detail (hanzi/pinyin/arti) — TTS tidak
  // diputar otomatis di sini, hanya lewat tombol "Dengar" di dalam popup.
  return (
    <button
      type="button"
      aria-label={`Detail kata ${segment.hanzi}`}
      className={segment.found ? styles.knownToken : styles.singleToken}
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

function WordTab({ compounds }: { compounds: CompoundWord[] }) { if (compounds.length === 0) return <EmptyLine label="Tidak ada kata gabungan ditemukan." />; return <div className={styles.wordList}>{compounds.map((word, index) => <WordRow key={`${word.hanzi}-${index}`} word={word} index={index} />)}</div> }
function WordRow({ word, index }: { word: CompoundWord; index: number }) { const gesture = useLongPress(() => speakMandarin(word.hanzi), () => speakMandarin(word.hanzi)); const badge = getVocabularyBadge(word.badge); return <button type="button" className={styles.wordRow} {...gesture}><span className={styles.wordHanzi}>{word.hanzi}</span><span className={styles.wordInfo}><span className={styles.wordPinyin}><ColorPinyin text={word.pinyin ?? ""} /></span><span className={styles.wordMeaning}>{word.arti}</span></span><span className={styles.wordMeta}><span className={`${styles.wordBadge} ${styles[badge.tone]}`}>{badge.label}</span><span className={styles.wordNumber}>#{index + 1}</span></span></button> }

function CharBreakdown({ char, dictionary }: { char: string; dictionary: DictionaryMap | null }) {
  const entry = dictionary?.[char]; const { ids, label, parts } = decompParts(entry)
  return <section className={styles.charBlock}><div className={styles.charMain}><div className={styles.charHeader}><CharSpeaker char={char} className={styles.charHanzi} /><div className="min-w-0">{entry?.pinyin?.length ? <div className={styles.pinyin}><ColorPinyin text={entry.pinyin.join(", ")} /></div> : <div className="text-sm text-slate-500">Pinyin belum tersedia</div>}<div className={styles.charDefinition}>{entry?.definition || "Data karakter belum ada di dictionary.json."}</div>{label && <div className={styles.charStructure}>{ids} · {label}</div>}</div></div>{entry?.etymology?.hint && <p className={styles.charEtymology}>{entry.etymology.hint}</p>}</div>{parts.length > 0 ? <><div className={styles.componentLabel}>↓ komponen</div><div className={styles.componentGrid}>{parts.map(part => <CharComponent key={part} char={part} entry={dictionary?.[part]} />)}</div></> : <p className="py-3 text-center text-sm text-slate-500">Tidak ada data komponen.</p>}</section>
}
function CharSpeaker({ char, className }: { char: string; className: string }) { const gesture = useLongPress(() => speakMandarin(char), () => speakMandarin(char)); return <button type="button" aria-label={`Dengarkan ${char}`} className={className} {...gesture}>{char}</button> }
function CharComponent({ char, entry }: { char: string; entry?: DictionaryEntry }) { const { ids, label, parts } = decompParts(entry); return <article className={styles.componentCard}><div className={styles.componentHeader}><CharSpeaker char={char} className={styles.componentHanzi} /><div className="min-w-0">{entry?.pinyin?.length ? <div className={styles.pinyin}><ColorPinyin text={entry.pinyin.join(", ")} /></div> : null}<div className={styles.charDefinition}>{entry?.definition || "Data komponen belum tersedia."}</div>{label && <div className={styles.charStructure}>{ids} · {label}</div>}</div></div>{entry?.etymology?.hint && <p className={styles.charEtymology}>{entry.etymology.hint}</p>}{parts.length > 0 && <p className={styles.componentSub}>Komponen: {parts.join(" · ")}</p>}</article> }

function StrokePreview({ char }: { char: string }) {
  const targetRef = React.useRef<HTMLDivElement>(null); const writerRef = React.useRef<{ animateCharacter: () => void } | null>(null)
  React.useEffect(() => { let cancelled = false; const target = targetRef.current; if (!target) return; target.innerHTML = ""; import("hanzi-writer").then(({ default: HanziWriter }) => { if (cancelled || !targetRef.current) return; writerRef.current = HanziWriter.create(targetRef.current, char, { width: 260, height: 260, padding: 20, strokeColor: "#edf6ff", outlineColor: "#1b4965", drawingColor: "#42d6a4", showOutline: true, showCharacter: false }) }); return () => { cancelled = true; target.innerHTML = "" } }, [char])
  return <button type="button" aria-label={`Putar animasi stroke ${char}`} className="flex w-full cursor-pointer flex-col items-center rounded-xl border border-border/60 bg-card/70 px-5 pb-6 pt-7 transition-colors hover:border-primary/55" onClick={() => writerRef.current?.animateCharacter()}><div ref={targetRef} className="h-[260px] w-[260px]" /></button>
}
function LoadingLine({ label }: { label: string }) { return <div className="flex justify-center py-12 text-sm text-slate-400">{label}</div> }
function EmptyLine({ label }: { label: string }) { return <div className="py-12 text-center text-sm text-slate-400">{label}</div> }