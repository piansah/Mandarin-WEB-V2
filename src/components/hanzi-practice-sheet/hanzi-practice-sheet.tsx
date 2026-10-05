"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TonePinyin } from "@/components/tone-pinyin"
import { StrokeOrderDisplay } from "./stroke-order-display"
import { PracticeGrid } from "./practice-grid"
import { toast } from "sonner"
import type { VocabularyWord } from "@/lib/hanzi-map"

type HanziPracticeSheetProps = {
  words: VocabularyWord[]
  selectedIndex: number
  onSelectedIndexChange: (index: number) => void
}

export function HanziPracticeSheet({
  words,
  selectedIndex,
  onSelectedIndexChange,
}: HanziPracticeSheetProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [generatingPdf, setGeneratingPdf] = React.useState(false)
  const [strokeDataMap, setStrokeDataMap] = React.useState<Map<string, string[]>>(new Map())
  const [charIndex, setCharIndex] = React.useState(0)

  const currentWord = words[selectedIndex]
  const chars = currentWord ? [...currentWord.hanzi] : []
  const currentChar = chars[charIndex]
  const totalPages = words.reduce((sum, word) => sum + [...word.hanzi].length, 0)

  // Calculate global page index (current page across all words)
  const globalPageIndex = words.slice(0, selectedIndex).reduce((sum, word) => sum + [...word.hanzi].length, 0) + charIndex + 1

  // Pre-fetch stroke data for all characters when words change
  React.useEffect(() => {
    const fetchStrokes = async () => {
      const uniqueChars = [...new Set(words.flatMap(w => [...w.hanzi]))]
      const newMap = new Map<string, string[]>()
      
      await Promise.all(uniqueChars.map(async (char) => {
        try {
          const res = await fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data.strokes)) {
              newMap.set(char, data.strokes)
            }
          }
        } catch (error) {
          console.error(`Error loading stroke data for ${char}:`, error)
        }
      }))
      
      setStrokeDataMap(newMap)
    }

    fetchStrokes()
  }, [words])

  const handlePrev = () => {
    if (charIndex > 0) {
      setCharIndex(charIndex - 1)
    } else if (selectedIndex > 0) {
      onSelectedIndexChange(selectedIndex - 1)
      setCharIndex(words[selectedIndex - 1].hanzi.length - 1)
    }
  }

  const handleNext = () => {
    if (charIndex < chars.length - 1) {
      setCharIndex(charIndex + 1)
    } else if (selectedIndex < words.length - 1) {
      onSelectedIndexChange(selectedIndex + 1)
      setCharIndex(0)
    }
  }

  // Reset char index when word changes
  React.useEffect(() => {
    setCharIndex(0)
  }, [selectedIndex])

  // Helper function to render pinyin with tone colors
  const renderPinyinWithTones = (pinyin: string) => {
    if (!pinyin) return ""

    // Tone colors
    const toneColors: Record<string, string> = {
      '1': '#e05555',
      '2': '#e8d23e',
      '3': '#65df4d',
      '4': '#60a5fa',
      '0': '#7f8c8d',
    }

    // Map tone marks to tone numbers
    const toneFromMark: Record<string, string> = {
      'ā': '1', 'á': '2', 'ǎ': '3', 'à': '4',
      'ē': '1', 'é': '2', 'ě': '3', 'è': '4',
      'ī': '1', 'í': '2', 'ǐ': '3', 'ì': '4',
      'ō': '1', 'ó': '2', 'ǒ': '3', 'ò': '4',
      'ū': '1', 'ú': '2', 'ǔ': '3', 'ù': '4',
      'ǖ': '1', 'ǘ': '2', 'ǚ': '3', 'ǜ': '4',
    }

    // Split pinyin by space and process each syllable
    return pinyin.split(' ').map(syllable => {
      // Check if already has tone marks (hǎo, nǐ, etc.)
      if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(syllable)) {
        // Find the tone from the marked vowel
        let tone = '0'
        for (const [mark, t] of Object.entries(toneFromMark)) {
          if (syllable.includes(mark)) {
            tone = t
            break
          }
        }
        const color = toneColors[tone] || '#4b5563'
        return `<span style="color: ${color};">${syllable}</span>`
      }

      // Try numbered format (ha3, ni3, etc.)
      const match = syllable.match(/^(.*?)([0-4])$/)
      if (match) {
        const base = match[1]
        const tone = match[2]
        const color = toneColors[tone] || '#4b5563'

        // Find the vowel to add tone mark
        const vowelMatch = base.match(/[aeiouüv]/i)
        if (vowelMatch) {
          const vowel = vowelMatch[0].toLowerCase()
          const toneMarks: Record<string, Record<string, string>> = {
            'a': { '1': 'ā', '2': 'á', '3': 'ǎ', '4': 'à', '0': 'a' },
            'e': { '1': 'ē', '2': 'é', '3': 'ě', '4': 'è', '0': 'e' },
            'i': { '1': 'ī', '2': 'í', '3': 'ǐ', '4': 'ì', '0': 'i' },
            'o': { '1': 'ō', '2': 'ó', '3': 'ǒ', '4': 'ò', '0': 'o' },
            'u': { '1': 'ū', '2': 'ú', '3': 'ǔ', '4': 'ù', '0': 'u' },
            'ü': { '1': 'ǖ', '2': 'ǘ', '3': 'ǚ', '4': 'ǜ', '0': 'ü' },
            'v': { '1': 'ǖ', '2': 'ǘ', '3': 'ǚ', '4': 'ǜ', '0': 'ü' },
          }
          const marks = toneMarks[vowel]
          if (marks) {
            const markedVowel = marks[tone] || vowel
            const marked = base.replace(/[aeiouüv]/i, markedVowel)
            return `<span style="color: ${color};">${marked}</span>`
          }
        }

        return `<span style="color: ${color};">${base}</span>`
      }

      // No tone info, return as-is
      return syllable
    }).join(' ')
  }

  const handleDownloadPdf = async () => {
    if (words.length === 0) return

    setGeneratingPdf(true)
    try {
      const html2canvas = (await import("html2canvas-pro")).default
      const { jsPDF } = await import("jspdf")

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const totalPages = words.reduce((sum, word) => sum + [...word.hanzi].length, 0)

      // Generate pages sequentially (simpler, more reliable)
      let pageCount = 0
      for (const word of words) {
        const chars = [...word.hanzi]
        
        for (let charIndex = 0; charIndex < chars.length; charIndex++) {
          const char = chars[charIndex]
          const isFirstChar = charIndex === 0
          const strokes = strokeDataMap.get(char) || []

          // Create page HTML
          const pageDiv = document.createElement('div')
          pageDiv.style.cssText = `
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            background: white;
            position: fixed;
            top: -9999px;
            left: -9999px;
            display: flex;
            flex-direction: column;
          `

          // Header
          const headerHtml = `
            <div style="border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h2 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0;">Lembar 田字格</h2>
                  <p style="font-size: 10px; color: #6b7280; margin: 0;">Mandarin Journey</p>
                </div>
                <div style="text-align: right;">
                  <p style="font-size: 10px; color: #6b7280; margin: 0;">Tanggal: ${new Date().toLocaleDateString('id-ID')}</p>
                </div>
              </div>
            </div>
          `

          let pageHtml = headerHtml

          // Content
          let contentHtml = `
            <div style="flex: 1;">
          `

          // Word header only on first character of multi-character word
          if (isFirstChar || chars.length === 1) {
            contentHtml += `
              <div class="mb-8 pb-4" style="border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                  <h1 class="text-5xl font-hanzi" style="color: #111827; margin: 0;">${chars.length > 1 ? word.hanzi : char}</h1>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-size: 18px; color: #4b5563;">${renderPinyinWithTones(word.pinyin || "")}</div>
                    <p style="color: #4b5563; margin: 0;">${word.arti || ""}</p>
                  </div>
                </div>
              </div>
            `
          }

          // Stroke order
          const strokeBoxes = strokes.map((_, i) => `
            <div style="width: 48px; height: 48px; border: 1px solid #d1d5db; border-radius: 4px; background: #ffffff; display: inline-flex; align-items: center; justify-content: center; margin-right: 8px; margin-bottom: 8px;">
              <svg width="48" height="48" viewBox="0 0 1024 1024">
                <g transform="scale(1, -1) translate(0, -900)">
                  ${strokes.slice(0, i + 1).map((d, j) => `<path key="${j}" d="${d}" fill="${j === i ? '#059669' : '#9ca3af'}" />`).join('')}
                </g>
              </svg>
            </div>
          `).join('')

          contentHtml += `
            <div class="mb-8">
              <h3 class="text-sm font-semibold mb-3" style="color: #374151;">
                Urutan goresan · <span class="font-hanzi text-lg">${char}</span>
              </h3>
              <div class="flex flex-wrap" style="gap: 8px;">
                ${strokeBoxes}
              </div>
            </div>
          `

          // Practice grid
          const gridBoxes = Array.from({ length: 72 }).map((_, i) => {
            const showGuide = i % 9 === 0
            let guideSvg = ''
            if (showGuide && strokes.length > 0) {
              guideSvg = `
                <svg style="position: absolute; inset: 0; width: 100%; height: 100%;" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">
                  <g transform="scale(1, -1) translate(0, -900)">
                    ${strokes.map((d, j) => `<path key="${j}" d="${d}" fill="#e5e7eb" />`).join('')}
                  </g>
                </svg>
              `
            }
            return `
            <div style="position: relative; aspect-ratio: 1 / 1; border: 1.5px solid #1f2937; background: #ffffff;">
              <svg style="position: absolute; inset: 0; width: 100%; height: 100%;" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="50" y1="0" x2="50" y2="100" stroke="#9ca3af" stroke-width="0.6" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#9ca3af" stroke-width="0.6" />
                <line x1="0" y1="0" x2="100" y2="100" stroke="#d1d5db" stroke-width="0.6" stroke-dasharray="4 4" />
                <line x1="100" y1="0" x2="0" y2="100" stroke="#d1d5db" stroke-width="0.6" stroke-dasharray="4 4" />
              </svg>
              ${guideSvg}
            </div>
          `
          }).join('')

          contentHtml += `
            <div class="mb-8">
              <h3 class="text-sm font-semibold mb-3" style="color: #374151;">
                Latihan · <span class="font-hanzi text-lg">${char}</span>
              </h3>
              <div class="grid" style="grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 6px;">
                ${gridBoxes}
              </div>
            </div>
          </div>
          `

          pageHtml += contentHtml

          // Footer
          const footerHtml = `
            <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: auto;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <p style="font-size: 9px; color: #9ca3af; margin: 0;">© 2025 Mandarin Journey</p>
                <p style="font-size: 9px; color: #9ca3af; margin: 0;">Halaman ${pageCount + 1} dari ${totalPages}</p>
              </div>
            </div>
          `

          pageHtml += footerHtml

          pageDiv.innerHTML = pageHtml
          document.body.appendChild(pageDiv)

          // Render to canvas (reduced scale for speed)
          const canvas = await html2canvas(pageDiv, {
            scale: 1.5,
            useCORS: true,
            logging: false,
          })

          const imgData = canvas.toDataURL('image/jpeg', 0.95)
          
          if (pageCount > 0) {
            pdf.addPage()
          }
          pageCount++
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
          
          document.body.removeChild(pageDiv)
          
          // Show progress
          toast(`Memproses halaman ${pageCount} dari ${totalPages}`)
        }
      }

      pdf.save(`hanzi-practice-${Date.now()}.pdf`)
      toast.success("PDF berhasil diunduh!")
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Gagal mengunduh PDF")
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (!currentWord || !currentChar) {
    return (
      <Card className="min-h-[600px] flex items-center justify-center">
        <p className="text-muted-foreground">
          Pilih kata untuk melihat pratinjau lembar
        </p>
      </Card>
    )
  }

  return (
    <Card className="min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border no-print">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">Pratinjau lembar</h2>
            <p className="text-sm text-muted-foreground">
              {words.length} kata · {totalPages} halaman A4
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
            >
              <Download className="h-4 w-4 mr-2" />
              {generatingPdf ? "..." : "Unduh PDF"}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between no-print">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={selectedIndex === 0 && charIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {globalPageIndex} dari {totalPages} (Kata {selectedIndex + 1} dari {words.length})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            disabled={selectedIndex === words.length - 1 && charIndex === chars.length - 1}
          >
            Berikutnya
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-muted p-4 overflow-auto no-print">
        <div
          ref={containerRef}
          className="bg-white mx-auto w-full max-w-[210mm] min-h-[297mm] p-8 shadow-lg print-only"
          style={{ 
            backgroundColor: '#ffffff',
          } as React.CSSProperties}
        >
          <style dangerouslySetInnerHTML={{
            __html: `
              .tone1 { color: #e05555 !important; }
              .tone2 { color: #e8d23e !important; }
              .tone3 { color: #65df4d !important; }
              .tone4 { color: #60a5fa !important; }
              .tone0 { color: #7f8c8d !important; }
            `
          }} />
          {/* Word Header */}
          {charIndex === 0 && (
            <div className="mb-8 pb-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <h1 className="text-5xl font-hanzi" style={{ color: '#111827', margin: 0 }}>{chars.length > 1 ? currentWord.hanzi : currentChar}</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="text-xl">
                    <TonePinyin text={currentWord.pinyin || ""} />
                  </div>
                  <p style={{ color: '#4b5563', margin: 0 }}>{currentWord.arti || ""}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stroke Order for current character */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#374151' }}>
              Urutan goresan · <span className="font-hanzi text-lg">{currentChar}</span>
            </h3>
            <StrokeOrderDisplay char={currentChar} />
          </div>

          {/* Practice Grid for current character */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>
              Latihan · <span className="font-hanzi text-lg">{currentChar}</span>
            </h3>
            <PracticeGrid char={currentChar} showGuide={true} />
          </div>

          {/* Footer */}
          <div className="text-left pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>© 2025 Mandarin Journey</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground text-left no-print">
          Pratinjau menampilkan <strong>satu kata</strong> — klik berikutnya di atas untuk melihat yang lain. Yang tercetak adalah seluruh <strong>{words.length} kata</strong> ({totalPages} halaman). Pilih <strong>Unduh PDF</strong> kalau mau mengerjakannya.
        </div>
      </div>
    </Card>
  )
}
