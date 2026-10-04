"use client"

import * as React from "react"
import { Network } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { toast } from "sonner"
import { HanziSearchBar } from "@/components/hanzi-map/hanzi-search-bar"
import { HanziMapGraph } from "@/components/hanzi-map/hanzi-map-graph"
import { HanziMapDetail } from "@/components/hanzi-map/hanzi-map-detail"
import {
  fetchWordsForChar,
  fetchExamplesForWord,
} from "@/lib/hanzi-map-data"
import {
  isMultiChar,
  getPartner,
  rankWords,
  mergeWords,
  rankExamples,
  mergeExamples,
  layoutChildren,
  type VocabularyWord,
  type ExampleSentence,
  type GraphNode,
  type GraphEdge,
} from "@/lib/hanzi-map"

const WORDS_PER_EXPANSION = 12
const MAX_NODES = 80

type Snapshot = {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
}

type DictionaryEntry = { pinyin?: string[]; definition?: string }
type DictionaryMap = Record<string, DictionaryEntry>

export default function PetaHanziPage() {
  const supa = useSupabase()
  const [searchValue, setSearchValue] = React.useState("")
  const [rootChar, setRootChar] = React.useState<string | null>(null)
  const [nodes, setNodes] = React.useState<Map<string, GraphNode>>(new Map())
  const [edges, setEdges] = React.useState<GraphEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
  const [selectedWord, setSelectedWord] = React.useState<VocabularyWord | null>(null)
  const [examples, setExamples] = React.useState<ExampleSentence[]>([])
  const [examplesLoading, setExamplesLoading] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [expandingNodeId, setExpandingNodeId] = React.useState<string | null>(null)
  const [history, setHistory] = React.useState<Snapshot[]>([])

  // Caches
  const wordCacheRef = React.useRef<Map<string, VocabularyWord[]>>(new Map())
  const exampleCacheRef = React.useRef<Map<string, ExampleSentence[]>>(new Map())
  const rootWordCacheRef = React.useRef<Map<string, VocabularyWord>>(new Map())
  const dictionaryRef = React.useRef<DictionaryMap | null>(null)
  const expansionRequestIdRef = React.useRef(0)
  const detailRequestIdRef = React.useRef(0)

  const clearDetail = () => {
    detailRequestIdRef.current++
    setSelectedWord(null)
    setExamples([])
    setExamplesLoading(false)
  }

  const resetGraph = () => {
    setHistory([])
    setNodes(new Map())
    setEdges([])
    setSelectedNodeId(null)
    clearDetail()
    setRootChar(null)
    setSearchValue("")
  }

  const handleUndo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    expansionRequestIdRef.current++
    setHistory(history.slice(0, -1))
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setSelectedNodeId(null)
    clearDetail()
  }

  // ── Detail panel ────────────────────────────────────────────────

  /** Ambil contoh kalimat. requestId menjaga agar respons lama tidak menimpa yang baru. */
  const loadExamples = async (word: string, requestId: number) => {
    setExamplesLoading(true)
    try {
      const cached = exampleCacheRef.current.get(word)
      const raw = cached || (await fetchExamplesForWord(supa, word, 8))
      if (!cached) exampleCacheRef.current.set(word, raw)

      const hanziItems = raw.filter(e => e.source === "hanzi_items")
      const wordExamples = raw.filter(e => e.source === "word_examples")
      const ranked = rankExamples(hanziItems)
      const merged = mergeExamples(ranked, wordExamples, 8, word)

      if (requestId !== detailRequestIdRef.current) return
      setExamples(merged)
    } catch (error) {
      console.error("Error fetching examples:", error)
      if (requestId === detailRequestIdRef.current) {
        toast.error("Gagal memuat contoh kalimat")
      }
    } finally {
      if (requestId === detailRequestIdRef.current) setExamplesLoading(false)
    }
  }

  const loadDictionary = async (): Promise<DictionaryMap | null> => {
    if (dictionaryRef.current) return dictionaryRef.current
    try {
      const res = await fetch("/data/dictionary.json")
      if (!res.ok) return null
      const data = (await res.json()) as DictionaryMap
      dictionaryRef.current = data
      return data
    } catch {
      return null
    }
  }

  /** Cari data kosakata untuk karakter tunggal (node akar). */
  const resolveRootWord = async (char: string): Promise<VocabularyWord> => {
    const memo = rootWordCacheRef.current.get(char)
    if (memo) return memo

    let word: VocabularyWord | null = null

    // 1) Dari cache hasil pencarian (flashcard_cards memuat karakter tunggal juga)
    const cachedWords = wordCacheRef.current.get(char) ?? []
    word = cachedWords.find(w => w.hanzi === char) ?? null

    // 2) flashcard_cards
    if (!word) {
      const { data, error } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti, word_class")
        .eq("hanzi", char)
        .limit(1)
      if (error) console.error("root flashcard_cards error:", error)
      const row = data?.[0]
      if (row) {
        word = {
          id: row.id,
          hanzi: row.hanzi,
          pinyin: row.pinyin,
          arti: row.arti,
          word_class: row.word_class,
          source: "flashcard",
          frequency: null,
        }
      }
    }

    // 3) word_compounds
    if (!word) {
      const { data, error } = await supa
        .from("word_compounds")
        .select("id, hanzi, pinyin, arti, frequency")
        .eq("hanzi", char)
        .limit(1)
      if (error) console.error("root word_compounds error:", error)
      const row = data?.[0]
      if (row) {
        word = {
          id: row.id,
          hanzi: row.hanzi,
          pinyin: row.pinyin,
          arti: row.arti,
          source: "compound",
          frequency: row.frequency,
        }
      }
    }

    // 4) dictionary.json (pinyin + definisi)
    if (!word) {
      const dict = await loadDictionary()
      const entry = dict?.[char]
      word = {
        id: `root-${char}`,
        hanzi: char,
        pinyin: entry?.pinyin?.join(", ") ?? null,
        arti: entry?.definition ?? null,
        source: "flashcard",
        frequency: null,
      }
    }

    rootWordCacheRef.current.set(char, word)
    return word
  }

  const showRootDetail = async (char: string) => {
    const requestId = ++detailRequestIdRef.current
    setExamples([])
    setExamplesLoading(true)

    try {
      const word = await resolveRootWord(char)
      if (requestId !== detailRequestIdRef.current) return
      setSelectedWord(word)
      await loadExamples(char, requestId)
    } catch (error) {
      console.error("Error loading root detail:", error)
      if (requestId === detailRequestIdRef.current) {
        setSelectedWord({ id: `root-${char}`, hanzi: char, pinyin: null, arti: null, source: "flashcard" })
        setExamplesLoading(false)
      }
    }
  }

  const showWordDetail = (word: VocabularyWord) => {
    const requestId = ++detailRequestIdRef.current
    setSelectedWord(word)
    setExamples([])
    loadExamples(word.hanzi, requestId)
  }

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    const node = nodes.get(nodeId)
    if (!node) return

    const edge = edges.find(e => e.toId === nodeId)
    if (edge) {
      showWordDetail(edge.word)
    } else if (node.parentId === null) {
      showRootDetail(node.hanzi)
    }
  }

  // ── Pencarian & ekspansi (tidak berubah) ────────────────────────

  const handleSearch = async (char: string) => {
    if (!char) return

    setHistory([])
    setLoading(true)
    setRootChar(char)
    setSelectedNodeId(null)
    clearDetail()

    try {
      const cached = wordCacheRef.current.get(char)
      const words = cached || await fetchWordsForChar(supa, char, WORDS_PER_EXPANSION)

      if (!cached) {
        wordCacheRef.current.set(char, words)
      }

      if (words.length === 0) {
        setNodes(new Map())
        setEdges([])
        toast.info("Tidak ada kosakata untuk karakter ini")
        setLoading(false)
        return
      }

      const filtered = words.filter(w => isMultiChar(w.hanzi) && w.hanzi !== char && [...w.hanzi].includes(char))
      const ranked = rankWords(filtered)
      const merged = mergeWords([], ranked, WORDS_PER_EXPANSION, char)

      const rootNode: GraphNode = {
        id: char,
        hanzi: char,
        depth: 0,
        x: 0,
        y: 0,
        parentId: null,
        isLeaf: false,
        isExpanded: false,
        isExhausted: false,
        isLoading: false,
      }

      const newNodes = new Map<string, GraphNode>([[char, rootNode]])
      const newEdges: GraphEdge[] = []

      merged.forEach((word) => {
        const partner = getPartner(word.hanzi, char)
        if (partner) {
          const childNode: GraphNode = {
            id: partner,
            hanzi: partner,
            depth: 1,
            x: 0,
            y: 0,
            parentId: char,
            isLeaf: false,
            isExpanded: false,
            isExhausted: false,
            isLoading: false,
          }
          newNodes.set(partner, childNode)
          newEdges.push({ id: `${char}-${partner}`, fromId: char, toId: partner, word })
        } else {
          const leafId = `leaf-${word.id}`
          const leafNode: GraphNode = {
            id: leafId,
            hanzi: word.hanzi,
            depth: 1,
            x: 0,
            y: 0,
            parentId: char,
            isLeaf: true,
            isExpanded: false,
            isExhausted: false,
            isLoading: false,
          }
          newNodes.set(leafId, leafNode)
          newEdges.push({ id: `${char}-${leafId}`, fromId: char, toId: leafId, word })
        }
      })

      const children = Array.from(newNodes.values())
        .filter(n => n.parentId === char)
        .map(n => n.id)
      const layouted = layoutChildren(rootNode, children, 0, newNodes)

      setNodes(layouted)
      setEdges(newEdges)
    } catch (error) {
      console.error("Error fetching words:", error)
      toast.error("Gagal memuat kosakata")
    } finally {
      setLoading(false)
    }
  }

  const handleNodeExpand = async (nodeId: string) => {
    if (nodes.size >= MAX_NODES) {
      toast.info("Batas peta tercapai")
      return
    }

    const node = nodes.get(nodeId)
    if (!node || node.isLeaf || node.isExpanded || node.isLoading) return

    const requestId = ++expansionRequestIdRef.current
    setExpandingNodeId(nodeId)

    setNodes(prev => {
      const updated = new Map(prev)
      const n = updated.get(nodeId)
      if (n) updated.set(nodeId, { ...n, isLoading: true })
      return updated
    })

    try {
      const words = await fetchWordsForChar(supa, node.hanzi, WORDS_PER_EXPANSION)

      const filtered = words.filter(w =>
        isMultiChar(w.hanzi) &&
        w.hanzi !== node.hanzi &&
        [...w.hanzi].includes(node.hanzi)
      )
      const ranked = rankWords(filtered)
      const merged = mergeWords([], ranked, WORDS_PER_EXPANSION, node.hanzi)

      if (merged.length === 0) {
        setNodes(prev => {
          const updated = new Map(prev)
          const n = updated.get(nodeId)
          if (n) updated.set(nodeId, { ...n, isLoading: false, isExhausted: true })
          return updated
        })
        return
      }

      if (requestId !== expansionRequestIdRef.current) return

      const newNodes = new Map(nodes)
      const newEdges = [...edges]
      const childIds: string[] = []

      merged.forEach((word) => {
        const partner = getPartner(word.hanzi, node.hanzi)
        if (partner) {
          if (newNodes.has(partner)) return
          const childNode: GraphNode = {
            id: partner,
            hanzi: partner,
            depth: node.depth + 1,
            x: 0,
            y: 0,
            parentId: nodeId,
            isLeaf: false,
            isExpanded: false,
            isExhausted: false,
            isLoading: false,
          }
          newNodes.set(partner, childNode)
          newEdges.push({ id: `${nodeId}-${partner}`, fromId: nodeId, toId: partner, word })
          childIds.push(partner)
        } else {
          const leafId = `leaf-${word.id}-${nodeId}`
          if (newNodes.has(leafId)) return
          const leafNode: GraphNode = {
            id: leafId,
            hanzi: word.hanzi,
            depth: node.depth + 1,
            x: 0,
            y: 0,
            parentId: nodeId,
            isLeaf: true,
            isExpanded: false,
            isExhausted: false,
            isLoading: false,
          }
          newNodes.set(leafId, leafNode)
          newEdges.push({ id: `${nodeId}-${leafId}`, fromId: nodeId, toId: leafId, word })
          childIds.push(leafId)
        }
      })

      const layouted = layoutChildren(node, childIds, node.depth, newNodes)

      const n = layouted.get(nodeId)
      if (n) layouted.set(nodeId, { ...n, isLoading: false, isExpanded: true })

      setHistory((h) => [...h, { nodes, edges }])

      setNodes(layouted)
      setEdges(newEdges)
    } catch (error) {
      console.error("Error expanding node:", error)
      toast.error("Gagal memuat kosakata tambahan")
      setNodes(prev => {
        const updated = new Map(prev)
        const n = updated.get(nodeId)
        if (n) updated.set(nodeId, { ...n, isLoading: false })
        return updated
      })
    } finally {
      setExpandingNodeId(null)
    }
  }

  return (
    <div className="w-full px-6 py-10 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Peta Hanzi</h1>
        </div>
        <p className="text-muted-foreground">
          Jelajahi kosakata dari satu karakter Hanzi
        </p>
      </div>

      <HanziSearchBar
        value={searchValue}
        onChange={setSearchValue}
        onSubmit={handleSearch}
        loading={loading}
      />

      {!rootChar && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Network className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Masukkan karakter Hanzi untuk memulai</p>
        </div>
      )}

      {rootChar && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <HanziMapGraph
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            onNodeExpand={handleNodeExpand}
            onReset={resetGraph}
            onUndo={handleUndo}
            canUndo={history.length > 0 && expandingNodeId === null}
            loading={loading}
            notFound={nodes.size === 0 && !loading}
          />
          <HanziMapDetail
            selectedWord={selectedWord}
            examples={examples}
            loading={examplesLoading}
          />
        </div>
      )}
    </div>
  )
}