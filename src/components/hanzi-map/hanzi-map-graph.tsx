"use client"

import * as React from "react"
import { ZoomIn, ZoomOut, RotateCcw, Undo2, Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { GraphNode, GraphEdge } from "@/lib/hanzi-map"
import { speakMandarin } from "@/lib/tts"

const MAX_NODES = 60
const DEFAULT_VIEWBOX = { x: -450, y: -450, width: 900, height: 900 }

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
  ā:1,á:2,ǎ:3,à:4, ē:1,é:2,ě:3,è:4,
  ī:1,í:2,ǐ:3,ì:4, ō:1,ó:2,ǒ:3,ò:4,
  ū:1,ú:2,ǔ:3,ù:4, ǖ:1,ǘ:2,ǚ:3,ǜ:4,
}

function detectTone(syllable: string): number {
  for (const ch of syllable) {
    if (TONE_CHARS[ch]) return TONE_CHARS[ch]
  }
  return 0
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
}: HanziMapGraphProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [viewBox, setViewBox] = React.useState(DEFAULT_VIEWBOX)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  // Auto-fit saat node berubah (dibuat persegi supaya tidak gepeng)
  React.useEffect(() => {
    if (nodes.size === 0) return
    const values = Array.from(nodes.values())
    const xs = values.map((n) => n.x)
    const ys = values.map((n) => n.y)
    const pad = 90
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    const size = Math.max(maxX - minX, maxY - minY)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setViewBox({ x: cx - size / 2, y: cy - size / 2, width: size, height: size })
  }, [nodes])

  const zoomBy = (scaleFactor: number) => {
    setViewBox((prev) => {
      const w = prev.width * scaleFactor
      const h = prev.height * scaleFactor
      return {
        x: prev.x + (prev.width - w) / 2,
        y: prev.y + (prev.height - h) / 2,
        width: w,
        height: h,
      }
    })
  }

  const handleWheel = (e: React.WheelEvent) => zoomBy(e.deltaY > 0 ? 1.1 : 0.9)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const cw = svgRef.current?.clientWidth || 1
    const ch = svgRef.current?.clientHeight || 1
    const scale = Math.max(viewBox.width / cw, viewBox.height / ch)
    const dx = (e.clientX - dragStart.x) * scale
    const dy = (e.clientY - dragStart.y) * scale
    setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }))
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handlePointerUp = () => setIsDragging(false)

  const handleReset = () => {
    setViewBox(DEFAULT_VIEWBOX)
    onReset()
  }

  const handleNodeClick = (nodeId: string, event: React.SyntheticEvent) => {
    event.stopPropagation()
    onNodeClick(nodeId)
    const node = nodes.get(nodeId)
    if (node && !node.isLeaf && !node.isExpanded && !node.isLoading && !node.isExhausted) {
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
  const limitReached = nodeCount >= MAX_NODES

  // Edge yang sedang di-hover (dari label ataupun dari node tujuan)
  const activeEdge =
    edges.find((e) => e.id === hoveredEdgeId) ??
    edges.find((e) => e.toId === hoveredNodeId) ??
    null

  const labelWidth = (text: string) => [...text].length * 15 + 18

  return (
    <Card className="min-h-[400px] flex flex-col overflow-hidden py-0 gap-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Peta Kosakata</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            title="Kembali satu langkah"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => zoomBy(0.9)} title="Perbesar">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => zoomBy(1.1)} title="Perkecil">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="relative flex-1 min-h-[560px] overflow-hidden"
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
          className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
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
                onPointerEnter={() => setHoveredEdgeId(edge.id)}
                onPointerLeave={() => setHoveredEdgeId(null)}
                onClick={(e) => {
                  e.stopPropagation()
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

            return (
              <g key={node.id} opacity={node.isLoading ? 0.55 : 1}>
                {/* cincin tipis di luar, seperti referensi */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 7}
                  fill="none"
                  stroke={isRoot || isSelected ? C.primary : C.nodeStroke}
                  strokeWidth={1.5}
                  strokeDasharray="3 5"
                  opacity={isRoot || isSelected || isHovered ? 0.8 : 0.5}
                  pointerEvents="none"
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
                  style={{ cursor: node.isExhausted ? "not-allowed" : "pointer" }}
                  onClick={(e) => handleNodeClick(node.id, e)}
                  onPointerEnter={() => setHoveredNodeId(node.id)}
                  onPointerLeave={() => setHoveredNodeId(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Perluas ${node.hanzi}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
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
                {node.isExhausted && (
                  <text
                    x={node.x}
                    y={node.y + r + 22}
                    textAnchor="middle"
                    fontSize={11}
                    fill={C.muted}
                    pointerEvents="none"
                  >
                    Kosong
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
              const longestLine = Math.max(hanzi.length * 16, pinyin.length * 7.5, arti.length * 6.5)
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
        <span>Arahkan kursor ke kata di garis untuk melihat pinyin dan arti</span>
      </div>
    </Card>
  )
}