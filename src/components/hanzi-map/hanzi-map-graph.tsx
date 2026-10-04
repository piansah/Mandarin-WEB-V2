"use client"

import * as React from "react"
import { ZoomIn, ZoomOut, RotateCcw, Undo2, Network, Maximize2, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { GraphNode, GraphEdge } from "@/lib/hanzi-map"
import { speakMandarin } from "@/lib/tts"

const DEFAULT_MAX_NODES = 80
const DEFAULT_VIEWBOX = { x: -450, y: -450, width: 900, height: 900 }
const MIN_VIEW_SIZE = 200
const MAX_VIEW_SIZE = 8000
const FIT_PADDING = 90
/** Jarak geser (px layar) sebelum gerakan dianggap drag, bukan klik */
const DRAG_THRESHOLD = 5

// Semua warna diambil langsung dari variabel base CSS (oklch).
// Jangan dibungkus hsl(...) karena variabelmu bukan format HSL.
const C = {
  line: "color-mix(in oklch, var(--primary) 45%, transparent)",
  lineActive: "var(--primary)",
  nodeFill: "var(--card)",
  nodeStroke: "var(--border)",
  rootFill: "color-mix(in oklch, var(--primary) 18%, var(--card))",
  primary: "var(--primary)",
  primaryFg: "var(--primary-foreground)",
  fg: "var(--foreground)",
  muted: "var(--muted-foreground)",
  pill: "var(--background)",
  tooltipBg: "var(--popover)",
  tone: ["var(--tone-0)", "var(--tone-1)", "var(--tone-2)", "var(--tone-3)", "var(--tone-4)"],
}

// Peta aksara bertanda nada → nomor nada
const TONE_CHARS: Record<string, number> = {
  ā: 1, á: 2, ǎ: 3, à: 4, ē: 1, é: 2, ě: 3, è: 4,
  ī: 1, í: 2, ǐ: 3, ì: 4, ō: 1, ó: 2, ǒ: 3, ò: 4,
  ū: 1, ú: 2, ǔ: 3, ù: 4, ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4,
}

function detectTone(syllable: string): number {
  for (const ch of syllable) {
    if (TONE_CHARS[ch]) return TONE_CHARS[ch]
  }
  return 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type ViewBox = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }

/** Hitung viewBox persegi yang memuat semua node */
function computeFitViewBox(nodes: Map<string, GraphNode>): ViewBox | null {
  if (nodes.size === 0) return null
  const values = Array.from(nodes.values())
  const xs = values.map((n) => n.x)
  const ys = values.map((n) => n.y)
  const minX = Math.min(...xs) - FIT_PADDING
  const maxX = Math.max(...xs) + FIT_PADDING
  const minY = Math.min(...ys) - FIT_PADDING
  const maxY = Math.max(...ys) + FIT_PADDING
  const size = Math.max(maxX - minX, maxY - minY)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { x: cx - size / 2, y: cy - size / 2, width: size, height: size }
}

/** Render pinyin sebagai array <tspan> berwarna per suku kata dalam SVG */
function PinyinTspans({ text, x = 0, dy = 0, fontSize = 11 }: { text: string; x?: number; dy?: number; fontSize?: number }) {
  const parts = text.split(/(\s+|[,!.?·。，！？、；：()]+)/)
  const syllableRe = /[bpmfdtnlgkhjqxzcsryw]{0,2}[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜaeiouü]+(?:ng?|r)?/gi
  const spans: { text: string; tone: number }[] = []
  for (const part of parts) {
    if (!part) continue
    if (/^(\s+|[,!.?·。，！？、；：()]+)$/.test(part)) {
      spans.push({ text: part, tone: 0 })
    } else {
      const matches = part.match(syllableRe) ?? [part]
      for (const syl of matches) spans.push({ text: syl, tone: detectTone(syl) })
    }
  }
  return (
    <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize} dy={dy} x={x}>
      {spans.map((s, i) => (
        <tspan key={i} fill={C.tone[s.tone]}>{s.text}</tspan>
      ))}
    </text>
  )
}

type HanziMapGraphProps = {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  selectedNodeId: string | null
  onNodeClick: (nodeId: string) => void
  onNodeExpand: (nodeId: string) => void
  onReset: () => void
  onUndo: () => void
  canUndo: boolean
  loading?: boolean
  notFound?: boolean
  /** Batas jumlah simpul. Kirim konstanta yang sama dengan halaman agar konsisten. */
  maxNodes?: number
}

export function HanziMapGraph({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  onNodeExpand,
  onReset,
  onUndo,
  canUndo,
  loading,
  notFound,
  maxNodes = DEFAULT_MAX_NODES,
}: HanziMapGraphProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [viewBox, setViewBox] = React.useState<ViewBox>(DEFAULT_VIEWBOX)
  const [isDragging, setIsDragging] = React.useState(false)
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  // Popup kosakata hanya muncul lewat klik/tap, bukan hover.
  const [pinnedEdgeId, setPinnedEdgeId] = React.useState<string | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  const [showZoomHint, setShowZoomHint] = React.useState(false)

  // Drag bookkeeping (ref agar tidak memicu render tiap gerakan)
  const pointerStartRef = React.useRef<{ x: number; y: number; id: number } | null>(null)
  const lastPointerRef = React.useRef({ x: 0, y: 0 })
  const movedRef = React.useRef(false)
  const hintTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pinch bookkeeping: semua pointer aktif + state gestur dua jari
  const pointersRef = React.useRef<Map<number, Point>>(new Map())
  const pinchRef = React.useRef<{ dist: number; mid: Point } | null>(null)

  // Auto-fit hanya saat jumlah node atau node akar berubah
  const fitKeyRef = React.useRef<string>("")

  const showCanvas = !notFound && !(loading && nodes.size === 0)

  React.useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [])

  const fitToScreen = React.useCallback(() => {
    const fit = computeFitViewBox(nodes)
    if (fit) setViewBox(fit)
  }, [nodes])

  React.useEffect(() => {
    if (nodes.size === 0) {
      fitKeyRef.current = ""
      return
    }
    const rootId = Array.from(nodes.values()).find((n) => n.parentId === null)?.id ?? ""
    const key = `${rootId}:${nodes.size}`
    if (key === fitKeyRef.current) return
    fitKeyRef.current = key
    const fit = computeFitViewBox(nodes)
    if (fit) setViewBox(fit)
  }, [nodes])

  /**
   * Zoom dengan faktor tertentu. (ox, oy) = posisi pointer relatif terhadap
   * pusat elemen SVG dalam piksel layar; titik di bawah pointer tetap diam.
   * Tombol zoom memakai (0, 0) sehingga zoom ke tengah.
   */
  const zoomAt = React.useCallback((factor: number, ox = 0, oy = 0) => {
    const el = svgRef.current
    const cw = el?.clientWidth || 1
    const ch = el?.clientHeight || 1
    setViewBox((prev) => {
      const width = clamp(prev.width * factor, MIN_VIEW_SIZE, MAX_VIEW_SIZE)
      const f = width / prev.width
      const height = prev.height * f
      const scale = Math.max(prev.width / cw, prev.height / ch)
      const cx = prev.x + prev.width / 2
      const cy = prev.y + prev.height / 2
      const px = cx + ox * scale
      const py = cy + oy * scale
      const ncx = px - ox * scale * f
      const ncy = py - oy * scale * f
      return { x: ncx - width / 2, y: ncy - height / 2, width, height }
    })
  }, [])

  // Wheel: listener non-passive supaya preventDefault benar-benar bekerja.
  // Zoom hanya dengan Ctrl/Cmd + scroll (juga pinch trackpad); scroll biasa
  // tetap menggulir halaman.
  React.useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setShowZoomHint(true)
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
        hintTimerRef.current = setTimeout(() => setShowZoomHint(false), 1200)
        return
      }
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const ox = e.clientX - rect.left - rect.width / 2
      const oy = e.clientY - rect.top - rect.height / 2
      const delta = clamp(e.deltaY, -120, 120)
      zoomAt(Math.exp(delta * 0.0025), ox, oy)
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [showCanvas, zoomAt])

  /** Ambil dua pointer pertama → jarak & titik tengah (koordinat layar) */
  const readPinch = () => {
    const pts = Array.from(pointersRef.current.values())
    if (pts.length < 2) return null
    const [a, b] = pts
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Mouse: hanya tombol kiri. Sentuhan/pen: button selalu 0.
    if (e.pointerType === "mouse" && e.button !== 0) return

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size >= 2) {
      // Mulai gestur cubit: batalkan drag satu jari
      const pinch = readPinch()
      if (pinch) pinchRef.current = pinch
      pointerStartRef.current = null
      movedRef.current = true // cegah klik node saat jari dilepas
      setIsDragging(true)
      return
    }

    pointerStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    movedRef.current = false
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    // ===== Cubit dua jari: zoom + geser =====
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const next = readPinch()
      const el = svgRef.current
      if (!next || !el) return
      const prev = pinchRef.current
      pinchRef.current = next

      if (prev.dist < 1 || next.dist < 1) return

      const cw = el.clientWidth || 1
      const ch = el.clientHeight || 1
      const rect = el.getBoundingClientRect()
      const dxPx = next.mid.x - prev.mid.x
      const dyPx = next.mid.y - prev.mid.y
      // Jari merenggang → dist membesar → viewBox mengecil (zoom in)
      const factor = prev.dist / next.dist
      const ox = next.mid.x - rect.left - rect.width / 2
      const oy = next.mid.y - rect.top - rect.height / 2

      // Satu pembaruan state agar geser & zoom konsisten
      setViewBox((vb) => {
        const scale = Math.max(vb.width / cw, vb.height / ch)
        // 1) geser mengikuti titik tengah jari
        const panned = { ...vb, x: vb.x - dxPx * scale, y: vb.y - dyPx * scale }
        // 2) zoom di sekitar titik tengah jari
        const width = clamp(panned.width * factor, MIN_VIEW_SIZE, MAX_VIEW_SIZE)
        const f = width / panned.width
        const height = panned.height * f
        const cx = panned.x + panned.width / 2
        const cy = panned.y + panned.height / 2
        const px = cx + ox * scale
        const py = cy + oy * scale
        const ncx = px - ox * scale * f
        const ncy = py - oy * scale * f
        return { x: ncx - width / 2, y: ncy - height / 2, width, height }
      })
      return
    }

    // ===== Drag satu jari / mouse =====
    const start = pointerStartRef.current
    if (!start || start.id !== e.pointerId) return

    if (!movedRef.current) {
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (dist < DRAG_THRESHOLD) return
      // Baru dianggap drag: tangkap pointer supaya drag tetap jalan di luar SVG.
      // Dilakukan setelah melewati ambang agar klik pada node tidak terganggu.
      movedRef.current = true
      setIsDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // pointer mungkin sudah dilepas; abaikan
      }
    }

    const el = svgRef.current
    const cw = el?.clientWidth || 1
    const ch = el?.clientHeight || 1
    const dxPx = e.clientX - lastPointerRef.current.x
    const dyPx = e.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: e.clientX, y: e.clientY }

    setViewBox((prev) => {
      const scale = Math.max(prev.width / cw, prev.height / ch)
      return { ...prev, x: prev.x - dxPx * scale, y: prev.y - dyPx * scale }
    })
  }

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId)

    // Gestur cubit berakhir begitu jari tinggal satu/nol.
    // Jari yang tersisa tidak melanjutkan drag (menghindari lompatan);
    // pengguna perlu mengangkat & menyentuh lagi.
    if (pointersRef.current.size < 2) {
      pinchRef.current = null
    }

    const start = pointerStartRef.current
    if (start && start.id === e.pointerId) {
      pointerStartRef.current = null
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    }

    if (pointersRef.current.size === 0) {
      setIsDragging(false)
    }
    // movedRef sengaja tidak direset di sini: event click yang menyusul
    // drag harus bisa membacanya. Direset di pointerdown berikutnya.
  }

  const handleReset = () => {
    setViewBox(DEFAULT_VIEWBOX)
    fitKeyRef.current = ""
    setPinnedEdgeId(null)
    onReset()
  }

  const handleNodeClick = (nodeId: string, event: React.SyntheticEvent) => {
    event.stopPropagation()
    // Abaikan klik yang sebenarnya akhir dari drag / cubit
    if (movedRef.current) {
      movedRef.current = false
      return
    }

    // Pin popup kosakata untuk node ini (node akar tidak punya edge → null)
    setPinnedEdgeId(edges.find((e) => e.toId === nodeId)?.id ?? null)

    const node = nodes.get(nodeId)
    if (!node) return

    // Node sudah di-expand → klik lagi = undo (collapse)
    if (node.isExpanded && canUndo) {
      onUndo()
      return
    }

    onNodeClick(nodeId)
    if (!node.isLeaf && !node.isExpanded && !node.isLoading && !node.isExhausted) {
      onNodeExpand(nodeId)
    }
  }

  if (notFound) {
    return (
      <Card className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Tidak ada kosakata untuk karakter ini</p>
        </div>
      </Card>
    )
  }

  if (loading && nodes.size === 0) {
    return (
      <Card className="min-h-[400px] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </Card>
    )
  }

  const nodeCount = nodes.size
  const limitReached = nodeCount >= maxNodes

  // Edge aktif untuk popup: hanya yang di-pin lewat klik/tap. Dicari dari
  // `edges`, jadi popup otomatis hilang jika edge-nya sudah tidak ada
  // (mis. setelah undo).
  const activeEdge = edges.find((e) => e.id === pinnedEdgeId) ?? null

  const labelWidth = (text: string) => [...text].length * 15 + 18

  return (
    <Card className="min-h-[400px] flex flex-col overflow-hidden py-0 gap-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Network className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium whitespace-nowrap">Peta Kosakata</span>
        </div>

        {/* Desktop / tablet: tombol langsung */}
        <div className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            title="Kembali satu langkah"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => zoomAt(0.8)} title="Perbesar">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => zoomAt(1.25)} title="Perkecil">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={fitToScreen} title="Pas layar">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile: menu popup titik tiga */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Menu peta" />}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem closeOnClick={false} onClick={onUndo} disabled={!canUndo}>
                <Undo2 className="h-4 w-4" />
                Kembali satu langkah
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem closeOnClick={false} onClick={() => zoomAt(0.8)}>
                <ZoomIn className="h-4 w-4" />
                Perbesar
              </DropdownMenuItem>
              <DropdownMenuItem closeOnClick={false} onClick={() => zoomAt(1.25)}>
                <ZoomOut className="h-4 w-4" />
                Perkecil
              </DropdownMenuItem>
              <DropdownMenuItem closeOnClick={false} onClick={fitToScreen}>
                <Maximize2 className="h-4 w-4" />
                Pas layar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem closeOnClick={false} onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className="relative flex-1 min-h-[560px] overflow-hidden overscroll-contain"
        style={{
          backgroundColor: "var(--background)",
          backgroundImage:
            "radial-gradient(color-mix(in oklch, var(--muted-foreground) 28%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className={`absolute inset-0 h-full w-full touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={() => {
            // Abaikan klik yang merupakan akhir dari drag / cubit
            if (movedRef.current) return
            // Klik/tap area kosong menutup popup yang di-pin
            setPinnedEdgeId(null)
          }}
        >
          {/* Garis */}
          {edges.map((edge) => {
            const from = nodes.get(edge.fromId)
            const to = nodes.get(edge.toId)
            if (!from || !to) return null
            const active = edge.toId === selectedNodeId || edge.id === activeEdge?.id
            return (
              <line
                key={`line-${edge.id}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={active ? C.lineActive : C.line}
                strokeWidth={active ? 3 : 2}
                strokeLinecap="round"
              />
            )
          })}

          {/* Label kata: selalu horizontal, menimpa garis */}
          {edges.map((edge) => {
            const from = nodes.get(edge.fromId)
            const to = nodes.get(edge.toId)
            if (!from || !to) return null
            const mx = (from.x + to.x) / 2
            const my = (from.y + to.y) / 2
            const w = labelWidth(edge.word.hanzi)
            const active = edge.toId === selectedNodeId || edge.id === activeEdge?.id
            return (
              <g
                key={`label-${edge.id}`}
                transform={`translate(${mx}, ${my})`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (movedRef.current) {
                    movedRef.current = false
                    return
                  }
                  setPinnedEdgeId(edge.id)
                  onNodeClick(edge.toId)
                  speakMandarin(edge.word.hanzi)
                }}
              >
                <rect
                  x={-w / 2}
                  y={-13}
                  width={w}
                  height={26}
                  rx={13}
                  fill={C.pill}
                  stroke={active ? C.lineActive : C.nodeStroke}
                  strokeWidth={active ? 1.5 : 1}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-hanzi pointer-events-none"
                  fontSize={14}
                  fill={active ? C.primary : C.fg}
                >
                  {edge.word.hanzi}
                </text>
              </g>
            )
          })}

          {/* Node */}
          {Array.from(nodes.values()).map((node) => {
            const isSelected = node.id === selectedNodeId
            const isHovered = node.id === hoveredNodeId
            const isRoot = node.parentId === null
            const r = isRoot ? 44 : node.isLeaf ? 30 : 34
            const fontSize = isRoot ? 36 : node.isLeaf ? 18 : 28

            const fill = isSelected ? C.primary : isRoot ? C.rootFill : C.nodeFill
            const stroke = isSelected || isRoot || isHovered ? C.primary : C.nodeStroke

            // Node expanded + hover = tampilkan hint collapse
            const showCollapseHint = node.isExpanded && isHovered && canUndo
            const cursor = node.isExhausted ? "not-allowed" : "pointer"

            return (
              <g key={node.id} opacity={node.isLoading ? 0.55 : 1}>
                {/* Cincin luar: solid jika expanded (menandakan bisa collapse), dashed jika belum */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 7}
                  fill="none"
                  stroke={node.isExpanded || isRoot || isSelected ? C.primary : C.nodeStroke}
                  strokeWidth={node.isExpanded ? 2 : 1.5}
                  strokeDasharray={node.isExpanded ? undefined : "3 5"}
                  opacity={node.isExpanded || isRoot || isSelected || isHovered ? 0.8 : 0.4}
                  pointerEvents="none"
                  className={prefersReducedMotion ? "" : "transition-all duration-200"}
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isRoot || isSelected ? 3 : 2}
                  strokeDasharray={node.isLeaf ? "5 4" : undefined}
                  className={prefersReducedMotion ? "" : "transition-[stroke] duration-200"}
                  style={{ cursor }}
                  onClick={(e) => handleNodeClick(node.id, e)}
                  onPointerEnter={() => setHoveredNodeId(node.id)}
                  onPointerLeave={() => setHoveredNodeId(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={node.isExpanded ? `Ciutkan ${node.hanzi}` : `Perluas ${node.hanzi}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      movedRef.current = false
                      handleNodeClick(node.id, e)
                    }
                  }}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-hanzi pointer-events-none"
                  fontSize={fontSize}
                  fill={isSelected ? C.primaryFg : C.fg}
                >
                  {node.hanzi}
                </text>
                {node.isLoading && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 12}
                    fill="none"
                    stroke={C.primary}
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    className="animate-spin"
                    style={{ animationDuration: "1s", transformOrigin: `${node.x}px ${node.y}px` }}
                  />
                )}
                {/* Label status di bawah node */}
                {(node.isExhausted || showCollapseHint) && (
                  <text
                    x={node.x}
                    y={node.y + r + 22}
                    textAnchor="middle"
                    fontSize={11}
                    fill={showCollapseHint ? C.primary : C.muted}
                    pointerEvents="none"
                    className={prefersReducedMotion ? "" : "transition-[fill] duration-150"}
                  >
                    {showCollapseHint ? "↩ ciutkan" : "Kosong"}
                  </text>
                )}
              </g>
            )
          })}

          {/* Tooltip pinyin berwarna + arti (paling atas) */}
          {activeEdge &&
            (() => {
              const from = nodes.get(activeEdge.fromId)
              const to = nodes.get(activeEdge.toId)
              if (!from || !to) return null
              const mx = (from.x + to.x) / 2
              const my = (from.y + to.y) / 2
              const pinyin = activeEdge.word.pinyin ?? ""
              const arti = activeEdge.word.arti ?? ""
              const hanzi = activeEdge.word.hanzi
              // Estimasi lebar tooltip berdasarkan teks terpanjang
              const longestLine = Math.max([...hanzi].length * 16, pinyin.length * 7.5, arti.length * 6.5)
              const w = Math.min(440, longestLine + 32)
              const h = arti ? 62 : 44
              return (
                <g transform={`translate(${mx}, ${my - h / 2 - 10})`} pointerEvents="none">
                  <rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    rx={10}
                    fill={C.tooltipBg}
                    stroke={C.primary}
                    strokeWidth={1}
                  />
                  {/* Hanzi */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-hanzi"
                    fontSize={14}
                    fill={C.fg}
                    dy={arti ? -18 : -10}
                  >
                    {hanzi}
                  </text>
                  {/* Pinyin berwarna */}
                  {pinyin && <PinyinTspans text={pinyin} fontSize={11} dy={arti ? 0 : 8} />}
                  {/* Arti */}
                  {arti && (
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fill={C.muted}
                      dy={18}
                    >
                      {arti}
                    </text>
                  )}
                </g>
              )
            })()}
        </svg>

        {showZoomHint && (
          <div
            role="status"
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
          >
            Tahan CTRL/CMD sambil scroll untuk zoom
          </div>
        )}

        {limitReached && (
          <div className="absolute bottom-4 left-4 right-4 rounded-lg border bg-card/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            Batas peta tercapai ({nodeCount} simpul)
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t text-xs text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-primary bg-primary/20" />
          Karakter
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-dashed border-muted-foreground" />
          Kata panjang
        </div>
        <span className="md:hidden">Seret untuk menggeser, cubit untuk zoom</span>
        <span className="hidden md:inline">Seret untuk menggeser, Ctrl + scroll untuk zoom</span>
        <span className="hidden md:inline">Klik kata di garis atau karakter untuk melihat pinyin dan arti</span>
      </div>
    </Card>
  )
}