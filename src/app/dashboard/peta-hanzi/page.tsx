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

const WORDS_PER_EXPANSION = 8
const MAX_NODES = 60

// Kondisi peta sebelum satu kali ekspansi, dipakai untuk tombol "Kembali"
type Snapshot = {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
}

export default function PetaHanziPage() {
  const supa = useSupabase()
  const [searchValue, setSearchValue] = React.useState("")
  const [rootChar, setRootChar] = React.useState<string | null>(null)
  const [nodes, setNodes] = React.useState<Map<string, GraphNode>>(new Map())
  const [edges, setEdges] = React.useState<GraphEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
  const [selectedWord, setSelectedWord] = React.useState<VocabularyWord | null>(null)
  const [examples, setExamples] = React.useState<ExampleSentence[]>([])
  const [loading, setLoading] = React.useState(false)
  const [expandingNodeId, setExpandingNodeId] = React.useState<string | null>(null)
  const [history, setHistory] = React.useState<Snapshot[]>([])

  // Caches
  const wordCacheRef = React.useRef<Map<string, VocabularyWord[]>>(new Map())
  const exampleCacheRef = React.useRef<Map<string, ExampleSentence[]>>(new Map())
  const expansionRequestIdRef = React.useRef(0)

  const resetGraph = () => {
    setHistory([])
    setNodes(new Map())
    setEdges([])
    setSelectedNodeId(null)
    setSelectedWord(null)
    setExamples([])
    setRootChar(null)
    setSearchValue("")
  }

  const handleUndo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    expansionRequestIdRef.current++ // batalkan request ekspansi yang masih berjalan
    setHistory(history.slice(0, -1))
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setSelectedNodeId(null)
    setSelectedWord(null)
    setExamples([])
  }

  const handleSearch = async (char: string) => {
    if (!char) return

    setHistory([])
    setLoading(true)
    setRootChar(char)
    setSelectedNodeId(null)
    setSelectedWord(null)
    setExamples([])

    try {
      // Check cache first
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

      // Filter and rank words
      const filtered = words.filter(w => isMultiChar(w.hanzi) && w.hanzi !== char && [...w.hanzi].includes(char))
      const ranked = rankWords(filtered)
      const merged = mergeWords([], ranked, WORDS_PER_EXPANSION, char)

      // Create root node
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

      // Create child nodes
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
          newEdges.push({
            id: `${char}-${partner}`,
            fromId: char,
            toId: partner,
            word,
          })
        } else {
          // Leaf node for longer words
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
          newEdges.push({
            id: `${char}-${leafId}`,
            fromId: char,
            toId: leafId,
            word,
          })
        }
      })

      // Layout children
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

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    const node = nodes.get(nodeId)
    if (!node) return

    // Find the word associated with this node
    const edge = edges.find(e => e.toId === nodeId)
    if (edge) {
      setSelectedWord(edge.word)
      loadExamples(edge.word.hanzi)
    } else if (node.parentId === null) {
      // Root node selected - show no word selected state
      setSelectedWord(null)
      setExamples([])
    }
  }

  const loadExamples = async (word: string) => {
    try {
      const cached = exampleCacheRef.current.get(word)
      const examples = cached || await fetchExamplesForWord(supa, word, 8)

      if (!cached) {
        exampleCacheRef.current.set(word, examples)
      }

      // Client-side filter and merge
      const hanziItems = examples.filter(e => e.source === "hanzi_items")
      const wordExamples = examples.filter(e => e.source === "word_examples")
      const ranked = rankExamples(hanziItems)
      const merged = mergeExamples(ranked, wordExamples, 8, word)

      setExamples(merged)
    } catch (error) {
      console.error("Error fetching examples:", error)
      toast.error("Gagal memuat contoh kalimat")
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

    // Mark as loading
    setNodes(prev => {
      const updated = new Map(prev)
      const n = updated.get(nodeId)
      if (n) {
        updated.set(nodeId, { ...n, isLoading: true })
      }
      return updated
    })

    try {
      const words = await fetchWordsForChar(supa, node.hanzi, WORDS_PER_EXPANSION)

      // Filter and rank
      const filtered = words.filter(w =>
        isMultiChar(w.hanzi) &&
        w.hanzi !== node.hanzi &&
        [...w.hanzi].includes(node.hanzi)
      )
      const ranked = rankWords(filtered)
      const merged = mergeWords([], ranked, WORDS_PER_EXPANSION, node.hanzi)

      if (merged.length === 0) {
        // Mark as exhausted
        setNodes(prev => {
          const updated = new Map(prev)
          const n = updated.get(nodeId)
          if (n) {
            updated.set(nodeId, { ...n, isLoading: false, isExhausted: true })
          }
          return updated
        })
        return
      }

      // Check if this is still the current request
      if (requestId !== expansionRequestIdRef.current) {
        return
      }

      // Create new nodes and edges
      const newNodes = new Map(nodes)
      const newEdges = [...edges]
      const childIds: string[] = []

      merged.forEach((word) => {
        const partner = getPartner(word.hanzi, node.hanzi)
        if (partner) {
          // Check if partner already exists (avoid duplicates)
          if (newNodes.has(partner)) {
            return
          }
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
          newEdges.push({
            id: `${nodeId}-${partner}`,
            fromId: nodeId,
            toId: partner,
            word,
          })
          childIds.push(partner)
        } else {
          // Leaf node for longer words
          const leafId = `leaf-${word.id}-${nodeId}`
          if (newNodes.has(leafId)) {
            return
          }
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
          newEdges.push({
            id: `${nodeId}-${leafId}`,
            fromId: nodeId,
            toId: leafId,
            word,
          })
          childIds.push(leafId)
        }
      })

      // Layout new children
      const layouted = layoutChildren(node, childIds, node.depth, newNodes)

      // Mark as expanded
      const n = layouted.get(nodeId)
      if (n) {
        layouted.set(nodeId, { ...n, isLoading: false, isExpanded: true })
      }

      // Simpan kondisi SEBELUM ekspansi (nodes & edges di sini masih versi lama)
      setHistory((h) => [...h, { nodes, edges }])

      setNodes(layouted)
      setEdges(newEdges)
    } catch (error) {
      console.error("Error expanding node:", error)
      toast.error("Gagal memuat kosakata tambahan")
      setNodes(prev => {
        const updated = new Map(prev)
        const n = updated.get(nodeId)
        if (n) {
          updated.set(nodeId, { ...n, isLoading: false })
        }
        return updated
      })
    } finally {
      setExpandingNodeId(null)
    }
  }

  return (
    <div className="w-full px-6 py-10 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Peta Hanzi</h1>
        </div>
        <p className="text-muted-foreground">
          Jelajahi kosakata dari satu karakter Hanzi
        </p>
      </div>

      {/* Search Bar */}
      <HanziSearchBar
        value={searchValue}
        onChange={setSearchValue}
        onSubmit={handleSearch}
        loading={loading}
      />

      {/* Empty State */}
      {!rootChar && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Network className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Masukkan karakter Hanzi untuk memulai</p>
        </div>
      )}

      {/* Graph and Detail */}
      {rootChar && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            loading={expandingNodeId !== null}
          />
        </div>
      )}
    </div>
  )
}