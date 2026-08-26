"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Flag, Heart, Plus, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"
import { speakMandarin } from "@/lib/tts"
import { toggleFavorite, checkFavorite } from "@/lib/personal-decks"
import { ReportModal } from "@/components/report-modal"
import { AddSentenceModal } from "@/components/add-sentence-modal"
import styles from "./page.module.css"

type DetailTab = "kalimat" | "stroke" | "karakter" | "kata"
type Card = { id: string; set_id: number | string; hanzi: string; pinyin: string; arti: string; catatan?: string | null; word_class?: string | null; hsk_level?: number | null; badge?: string | null }
type ExampleSentence = { id: number; hanzi: string | null; pinyin: string | null; arti: string | null; section_label?: string | null }
type CompoundWord = { hanzi: string; pinyin: string | null; arti: string | null; badge?: string | null }
type DictionaryEntry = { pinyin?: string[]; definition?: string; decomposition?: string; etymology?: { hint?: string } }
type DictionaryMap = Record<string, DictionaryEntry>
type Segment = { text: string; hanzi: boolean; known: boolean }

const toneMap: Record<string, string> = { ā: "1", á: "2", ǎ: "3", à: "4", ē: "1", é: "2", ě: "3", è: "4", ī: "1", í: "2", ǐ: "3", ì: "4", ō: "1", ó: "2", ǒ: "3", ò: "4", ū: "1", ú: "2", ǔ: "3", ù: "4", ǖ: "1", ǘ: "2", ǚ: "3", ǜ: "4" }
const wordClassLabel: Record<string, string> = { noun: "Nomina · 名词 (míngcí)", verb: "Verba · 动词 (dòngcí)", adj: "Adjektiva · 形容词 (xíngróngcí)", adv: "Adverbia · 副词 (fùcí)", conj: "Konjungsi · 连词 (liáncí)", particle: "Partikel · 助词 (zhùcí)", pron: "Pronomina · 代词 (dàicí)", num: "Numeralia · 数词 (shùcí)", classifier: "Klasifikator · 量词 (liàngcí)", prep: "Preposisi · 介词 (jiècí)", interj: "Interjeksi · 叹词 (tàncí)" }
const idsLabels: Record<string, string> = { "⿰": "kiri · kanan", "⿱": "atas · bawah", "⿲": "kiri · tengah · kanan", "⿳": "atas · tengah · bawah", "⿴": "luar · dalam", "⿵": "atas terbuka · dalam", "⿶": "bawah terbuka · dalam", "⿷": "kiri terbuka · dalam", "⿸": "kiri atas · dalam", "⿹": "kanan atas · dalam", "⿺": "kiri bawah · dalam", "⿻": "bertumpang" }

function isHanzi(char: string) {
  const code = char.charCodeAt(0)
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
}

function splitPinyin(word: string) {
  return word.match(/[bpmfdtnlgkhjqxzcsryw]{0,2}[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜaeiouü]+(?:ng?|r)?/gi) ?? [word]
}

function ColorPinyin({ text }: { text: string }) {
  return <>{text.split(/(\s+|[,!.?·。，！？、；：()]+)/).map((part, index) => {
    if (!part || /^(\s+|[,!.?·。，！？、；：()]+)$/.test(part)) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    return splitPinyin(part).map((syllable, syllableIndex) => {
      const tone = [...syllable].map(char => toneMap[char]).find(Boolean)
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

function segmentSentence(text: string, knownWords: Set<string>): Segment[] {
  const words = [...knownWords].filter(word => [...word].length > 1).sort((a, b) => [...b].length - [...a].length)
  const segments: Segment[] = []
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (!isHanzi(char)) { segments.push({ text: char, hanzi: false, known: false }); index += 1; continue }
    const match = words.find(word => text.startsWith(word, index))
    if (match) { segments.push({ text: match, hanzi: true, known: true }); index += match.length }
    else { segments.push({ text: char, hanzi: true, known: false }); index += 1 }
  }
  return segments
}

function decompParts(entry?: DictionaryEntry) {
  const raw = entry?.decomposition || ""
  const ids = raw[0] || ""
  const parts = raw ? [...raw].filter(char => char !== ids && char !== "？" && !idsLabels[char]) : []
  return { ids, label: idsLabels[ids] || "", parts: [...new Set(parts)] }
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
  const [tab, setTab] = React.useState<DetailTab>("kalimat")
  const [card, setCard] = React.useState<Card | null>(null)
  const [examples, setExamples] = React.useState<ExampleSentence[]>([])
  const [compounds, setCompounds] = React.useState<CompoundWord[]>([])
  const [knownWords, setKnownWords] = React.useState<Set<string>>(new Set())
  const [dictionary, setDictionary] = React.useState<DictionaryMap | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [tabLoading, setTabLoading] = React.useState(false)
  const [favorited, setFavorited] = React.useState(false)
  const [reportModal, setReportModal] = React.useState({ isOpen: false, contentLabel: "" })
  const [addSentenceModal, setAddSentenceModal] = React.useState(false)
  const fromSearch = searchParams.get('from') === 'search'

  React.useEffect(() => {
    const supa = createClient(); let cancelled = false
    async function load() {
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
    if (!card) return
    const activeCard = card
    const supa = createClient(); let cancelled = false
    async function loadVocabulary() {
      const [cardsRes, compoundsRes] = await Promise.all([supa.from("flashcard_cards").select("hanzi").limit(2000), supa.from("word_compounds").select("hanzi").limit(2000)])
      if (cancelled) return
      const words = [activeCard.hanzi, ...(cardsRes.data ?? []).map(item => item.hanzi), ...(compoundsRes.data ?? []).map(item => item.hanzi)]
      setKnownWords(new Set(words.filter(Boolean)))
    }
    loadVocabulary(); return () => { cancelled = true }
  }, [card])

  React.useEffect(() => {
    if (!card) return
    checkFavorite(card.hanzi).then(setFavorited)
  }, [card])

  React.useEffect(() => {
    if (!card) return
    const activeCard = card
    const supa = createClient(); let cancelled = false
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
    const supa = createClient(); let cancelled = false
    async function loadCompounds() {
      setTabLoading(true)
      const select = "hanzi, pinyin, arti, badge"
      const primary = await supa.from("word_compounds").select(select).ilike("hanzi", `%${activeCard.hanzi}%`).order("frequency", { ascending: false }).limit(30)
      let data = primary.data ?? []

      // Dataset compounds tidak selalu memiliki kata lengkap (mis. 你好),
      // sehingga gunakan karakter penyusunnya sebagai fallback yang relevan.
      if (data.length === 0 && [...activeCard.hanzi].length > 1) {
        const characterFilters = [...activeCard.hanzi].map(char => `hanzi.ilike.%${char}%`).join(",")
        const fallback = await supa.from("word_compounds").select(select).or(characterFilters).order("frequency", { ascending: false }).limit(30)
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
    const supa = createClient()
    
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
    <button type="button" onClick={() => router.back()} className="absolute top-16 left-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background border border-border/60">
      <ArrowLeft className="h-5 w-5" />
    </button>
    <Hero card={card} favorited={favorited} onToggleFavorite={handleToggleFavorite} onReport={openReportModal} />
    <div className={styles.content}>{tabLoading && <LoadingLine label="Memuat data..." />}{tab === "kalimat" && !tabLoading && <SentenceTab examples={examples} knownWords={knownWords} card={card} onAddSentence={openAddSentenceModal} />}{tab === "stroke" && <div className={styles.strokeGrid}>{chars.map((char, index) => <StrokePreview key={`${char}-${index}`} char={char} />)}</div>}{tab === "karakter" && <div>{chars.map((char, index) => <CharBreakdown key={`${char}-${index}`} char={char} dictionary={dictionary} />)}</div>}{tab === "kata" && !tabLoading && <WordTab compounds={compounds} />}</div>
    
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
  return <section className={styles.hero}>{badge && <span className={styles.hskBadge}>{badge}</span>}<div className={styles.heroTools}><button type="button" aria-label="Laporkan kesalahan" className={styles.toolButton} onClick={onReport}><Flag className="h-5 w-5" /></button><button type="button" aria-label="Favorit" className={`${styles.toolButton} ${favorited ? styles.toolButtonActive : ""}`} onClick={onToggleFavorite}><Heart className={`h-5 w-5 ${favorited ? "fill-current" : ""}`} /></button></div><div className={styles.heroContent} {...gesture}><div className={styles.hanzi}>{card.hanzi}</div><div className={styles.pinyin}><ColorPinyin text={card.pinyin || ""} /></div><div className={styles.meaning}>{card.arti}</div>{card.word_class && <div className={styles.wordClass}>{wordClassLabel[card.word_class] ?? card.word_class}</div>}{card.catatan && <p className={styles.note}>{card.catatan}</p>}</div></section>
}

function SentenceTab({ examples, knownWords, card, onAddSentence }: { examples: ExampleSentence[]; knownWords: Set<string>; card: Card; onAddSentence: () => void }) {
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
      <div className={styles.sentenceList}>{examples.map(example => <SentenceCard key={`${example.id}-${example.hanzi}`} example={example} knownWords={knownWords} />)}</div>
    </div>
  )
}

function SentenceCard({ example, knownWords }: { example: ExampleSentence; knownWords: Set<string> }) {
  const sentence = example.hanzi || ""
  const gesture = useLongPress(() => speakMandarin(sentence), () => speakMandarin(sentence))
  
  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.openBugReportModal?.(
      `Kesalahan Kalimat: ${sentence}`,
      `Ditemukan kesalahan pada kalimat: ${sentence} (${example.pinyin || ""})`,
      'content',
      String(example.id)
    )
  }
  
  return (
    <div className="relative group">
      <article className={styles.sentenceCard} {...gesture}>
        <div className={styles.sentenceHanzi}>{segmentSentence(sentence, knownWords).map((segment, index) => segment.hanzi ? <SentenceToken key={`${segment.text}-${index}`} segment={segment} /> : <React.Fragment key={`${segment.text}-${index}`}>{segment.text}</React.Fragment>)}</div>
        {example.pinyin && <div className={styles.sentencePinyin}><ColorPinyin text={example.pinyin} /></div>}
        {example.arti && <div className={styles.sentenceMeaning}>{example.arti}</div>}
      </article>
      <button
        type="button"
        onClick={handleReport}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background border border-border/60 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Report kalimat"
      >
        <Flag className="h-3 w-3 text-orange-500" />
      </button>
    </div>
  )
}

function SentenceToken({ segment }: { segment: Segment }) {
  const gesture = useLongPress(() => speakMandarin(segment.text), () => speakMandarin(segment.text))
  return <button type="button" aria-label={`Dengarkan ${segment.text}`} className={segment.known ? styles.knownToken : styles.singleToken} onPointerDown={event => { event.stopPropagation(); gesture.onPointerDown(event) }} onPointerMove={gesture.onPointerMove} onPointerUp={event => { event.stopPropagation(); gesture.onPointerUp() }} onPointerCancel={gesture.onPointerCancel} onClick={event => { event.stopPropagation(); gesture.onClick(event) }}>{segment.text}</button>
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
