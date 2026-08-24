"use client"

import * as React from "react"
import { createWorker, Worker, PSM } from "tesseract.js"
import { Camera, X, Zap, RefreshCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SegmentedWord, segmentText } from "@/lib/hanzi-segmentation"
import { TonePinyin } from "@/components/tone-pinyin"

interface OCRScannerProps {
  onClose: () => void
  onWordClick: (hanzi: string) => void
}
type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean
  focusMode?: string[]
}
type CameraConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean
  focusMode?: string
}

export function OCRScanner({ onClose, onWordClick }: OCRScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const scanBoxRef = React.useRef<HTMLDivElement>(null)
  
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const [worker, setWorker] = React.useState<Worker | null>(null)
  const [status, setStatus] = React.useState("Menginisialisasi kamera...")
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isTorchOn, setIsTorchOn] = React.useState(false)
  const [torchAvailable, setTorchAvailable] = React.useState(false)
  const [mode, setMode] = React.useState<"camera" | "result">("camera")
  const [results, setResults] = React.useState<SegmentedWord[]>([])
  const [rawText, setRawText] = React.useState("")

  // Initialize Tesseract Worker
  React.useEffect(() => {
    let cancelled = false
    
    async function initWorker() {
      setStatus("Menginisialisasi AI...")
      try {
        const w = await createWorker("chi_sim", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              const pct = Math.round(m.progress * 100)
              if (!cancelled) setStatus(`Memindai ${pct}%...`)
            }
          }
        })
        
        await w.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        })
        
        if (!cancelled) {
          setWorker(w)
          setStatus("Siap memindai")
        }
      } catch (err) {
        console.error("Worker error:", err)
        if (!cancelled) setStatus("Gagal memuat AI")
      }
    }
    
    initWorker()
    
    return () => {
      cancelled = true
      if (worker) worker.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize Camera
  React.useEffect(() => {
    let currentStream: MediaStream | null = null

    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        })
        currentStream = s
        setStream(s)
        
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }

        const track = s.getVideoTracks()[0]
        const caps = track.getCapabilities() as CameraCapabilities
        
        if (caps.torch) {
          setTorchAvailable(true)
        }
        
        if (caps.focusMode?.includes("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as CameraConstraintSet] })
        }
      } catch (err) {
        console.error("Camera error:", err)
        setStatus("Gagal mengakses kamera.")
      }
    }

    if (mode === "camera") {
      startCamera()
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [mode])

  const toggleTorch = async () => {
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    
    try {
      const nextState = !isTorchOn
      await track.applyConstraints({ advanced: [{ torch: nextState } as CameraConstraintSet] })
      setIsTorchOn(nextState)
    } catch (err) {
      console.error("Torch error:", err)
    }
  }

  const captureAndProcess = async () => {
    if (isProcessing || !worker || !videoRef.current || !canvasRef.current || !scanBoxRef.current) return

    setIsProcessing(true)
    setStatus("Menangkap gambar...")

    const video = videoRef.current
    const canvas = canvasRef.current
    const scanBox = scanBoxRef.current
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) {
      setIsProcessing(false)
      return
    }

    const boxRect = scanBox.getBoundingClientRect()
    const videoRect = video.getBoundingClientRect()

    const vw = video.videoWidth
    const vh = video.videoHeight
    const cw = video.clientWidth
    const ch = video.clientHeight

    const videoAspect = vw / vh
    const containerAspect = cw / ch

    let renderW, renderH, offsetX, offsetY
    if (videoAspect > containerAspect) {
      renderH = ch
      renderW = ch * videoAspect
      offsetX = (renderW - cw) / 2
      offsetY = 0
    } else {
      renderW = cw
      renderH = cw / videoAspect
      offsetX = 0
      offsetY = (renderH - ch) / 2
    }

    const scaleX = vw / renderW
    const scaleY = vh / renderH

    const sx = (boxRect.left - videoRect.left + offsetX) * scaleX
    const sy = (boxRect.top - videoRect.top + offsetY) * scaleY
    const sw = boxRect.width * scaleX
    const sh = boxRect.height * scaleY

    const padding = 40
    canvas.width = (sw * 2) + (padding * 2)
    canvas.height = (sh * 2) + (padding * 2)

    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.filter = "grayscale(100%) contrast(220%) brightness(110%)"
    ctx.drawImage(video, sx, sy, sw, sh, padding, padding, sw * 2, sh * 2)

    // Binarization
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114)
      const val = gray < 128 ? 0 : 255
      data[i] = data[i+1] = data[i+2] = val
      data[i+3] = 255
    }
    ctx.putImageData(imageData, 0, 0)

    try {
      setStatus("Memulai pengenalan...")
      const { data: { text, confidence } } = await worker.recognize(canvas)
      
      if (confidence < 35) {
        setStatus("Hasil kurang yakin, coba fokuskan lagi")
        setIsProcessing(false)
        return
      }

      const scannedText = text.replace(/[^\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]/g, "")
      
      if (scannedText.length > 0) {
        setRawText(scannedText)
        setResults(segmentText(scannedText))
        setMode("result")
      } else {
        setStatus("Tidak terbaca, coba lagi")
      }
    } catch (err) {
      console.error("OCR process error:", err)
      setStatus("Error memproses")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={onClose}>
          <X className="h-6 w-6" />
        </Button>
        {torchAvailable && mode === "camera" && (
          <Button 
            variant="ghost" 
            size="icon" 
            className={`rounded-full ${isTorchOn ? "text-yellow-400 bg-yellow-400/20" : "text-white hover:bg-white/20"}`}
            onClick={toggleTorch}
          >
            <Zap className="h-6 w-6" />
          </Button>
        )}
      </div>

      {mode === "camera" ? (
        <div className="flex-1 relative overflow-hidden flex flex-col justify-end pb-12">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Scan Box Overlay */}
            <div className="relative w-[80%] h-[150px] border-2 border-white/50 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" ref={scanBoxRef}>
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl-lg -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr-lg -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl-lg -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br-lg -mb-1 -mr-1"></div>
            </div>
          </div>
          
          <div className="relative z-10 w-full flex flex-col items-center gap-6 px-6">
            <div className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
              {status}
            </div>
            
            <button 
              onClick={captureAndProcess}
              disabled={isProcessing || !worker}
              className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center p-1 hover:bg-white/30 transition-all disabled:opacity-50"
            >
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                {isProcessing ? <Loader2 className="w-8 h-8 text-black animate-spin" /> : <Camera className="w-8 h-8 text-black" />}
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-background flex flex-col">
          <div className="p-6 pt-20 bg-muted/30 border-b border-border/50">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Teks Dipindai</h3>
            <p className="font-hanzi text-lg">{rawText}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {results.map((word, i) => (
              word.found ? (
                <div 
                  key={i} 
                  className="p-4 rounded-xl border border-border/50 bg-card flex flex-col gap-1 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => {
                    onWordClick(word.hanzi)
                    onClose() // Auto close on select
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-hanzi text-2xl">{word.hanzi}</span>
                    {word.hsk && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase border border-primary/20">
                        HSK {word.hsk}
                      </span>
                    )}
                    {word.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase border border-orange-500/20">
                        {word.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold">
                    <TonePinyin text={word.pinyin || ""} />
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {word.arti}
                  </div>
                </div>
              ) : (
                word.isPunct ? (
                  <div key={i} className="p-3 text-center text-xl text-muted-foreground">
                    {word.hanzi}
                  </div>
                ) : (
                  <div key={i} className="p-4 rounded-xl border border-border/50 bg-muted/20 flex flex-col gap-1 opacity-70">
                    <span className="font-hanzi text-2xl">{word.hanzi}</span>
                    <span className="text-xs text-muted-foreground italic">Tidak ada di kamus</span>
                  </div>
                )
              )
            ))}
          </div>

          <div className="p-4 border-t border-border bg-background">
            <Button className="w-full gap-2 rounded-xl h-12" onClick={() => setMode("camera")}>
              <RefreshCcw className="w-4 h-4" /> Scan Ulang
            </Button>
          </div>
        </div>
      )}
      
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
