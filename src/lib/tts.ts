type TtsSpeed = {
  rate: number
  label: string
}

const speeds: TtsSpeed[] = [
  { rate: 1, label: "🔊 Normal" },
  { rate: 0.6, label: "🐢 Pelan" },
  { rate: 0.4, label: "🐌 Lambat" },
]

let voices: SpeechSynthesisVoice[] = []
let tapText: string | null = null
let tapCount = 0
let tapTimer: ReturnType<typeof setTimeout> | null = null
let badgeTimer: ReturnType<typeof setTimeout> | null = null
let lastSpeakAt = 0
let voicesListenerReady = false
let voicesLoadAttempted = false
let currentText: string | null = null
let badgePositionObserver: ResizeObserver | null = null
let badgePositionTarget: HTMLElement | null = null

function positionSpeedBadge(badge: HTMLElement) {
  const content = document.querySelector<HTMLElement>('[data-slot="sidebar-inset"]')
  if (!content) {
    badge.style.left = "50%"
    badgePositionObserver?.disconnect()
    badgePositionObserver = null
    badgePositionTarget = null
    return
  }

  const rect = content.getBoundingClientRect()
  badge.style.left = `${rect.left + rect.width / 2}px`

  if (badgePositionTarget !== content && typeof ResizeObserver !== "undefined") {
    badgePositionObserver?.disconnect()
    badgePositionTarget = content
    badgePositionObserver = new ResizeObserver(() => {
      const updatedRect = content.getBoundingClientRect()
      badge.style.left = `${updatedRect.left + updatedRect.width / 2}px`
    })
    badgePositionObserver.observe(content)
  }
}

function isSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

function loadVoices() {
  if (!isSupported()) return
  voices = window.speechSynthesis.getVoices()
  voicesLoadAttempted = true
}

function ensureVoiceListener() {
  if (!isSupported() || voicesListenerReady) return
  voicesListenerReady = true
  loadVoices()
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
}

// Pre-load voices immediately when module loads
if (isSupported()) {
  loadVoices()
  // Try again after a short delay (some browsers delay voice loading)
  setTimeout(loadVoices, 100)
  setTimeout(loadVoices, 500)
}

function showSpeedBadge(label: string) {
  if (typeof document === "undefined") return

  let badge = document.getElementById("tts-speed-badge")
  if (!badge) {
    badge = document.createElement("div")
    badge.id = "tts-speed-badge"
    badge.setAttribute("role", "status")
    badge.setAttribute("aria-live", "polite")
    badge.className = "tts-speed-badge"
    document.body.appendChild(badge)
  }

  positionSpeedBadge(badge)
  badge.textContent = `${label}`
  badge.dataset.visible = "true"
  if (badgeTimer) clearTimeout(badgeTimer)
  badgeTimer = setTimeout(() => {
    badge?.removeAttribute("data-visible")
    badgePositionObserver?.disconnect()
    badgePositionObserver = null
    badgePositionTarget = null
  }, 1600)
}

function selectTapSpeed(text: string): TtsSpeed {
  if (text !== tapText) {
    tapCount = 0
    tapText = text
  }

  const speed = speeds[tapCount % speeds.length]
  tapCount += 1
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = setTimeout(() => {
    tapCount = 0
    tapText = null
  }, 8000)
  return speed
}

function findBestMandarinVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) loadVoices()
  const zhVoices = voices.filter(voice =>
    voice.lang === "zh-CN" ||
    voice.lang === "zh-TW" ||
    voice.lang.startsWith("zh") ||
    /mandarin|chinese/i.test(voice.name),
  )
  if (!zhVoices.length) return null

  // Utamakan natural/online voices jika tersedia di sistem (mis. Xiaoxiao, Yunxi, Google)
  const natural = zhVoices.find(v => /natural|online|xiaoxiao|yunxi|google/i.test(v.name))
  if (natural) return natural

  const mainland = zhVoices.find(v => v.lang === "zh-CN")
  return mainland || zhVoices[0]
}

export function speakMandarin(text: string, options: { silent?: boolean; rate?: number } = {}) {
  if (!isSupported() || !text.trim()) return

  const now = Date.now()
  // Remove cooldown for first tap to make it more responsive
  if (now - lastSpeakAt < 100 && tapCount > 0) return
  lastSpeakAt = now

  ensureVoiceListener()
  if (!voices.length) loadVoices()

  const speed = selectTapSpeed(text)

  if (!options.silent) showSpeedBadge(speed.label)

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "zh-CN"
  utterance.rate = options.rate ?? speed.rate
  utterance.pitch = 1
  utterance.volume = 1
  utterance.voice = findBestMandarinVoice()
  utterance.onend = () => { currentText = null }
  utterance.onerror = () => { currentText = null }

  currentText = text
  window.speechSynthesis.speak(utterance)
}

export function speakParagraph(
  text: string,
  rate: number | undefined = undefined,
  onBoundary?: (charIndex: number) => void,
  onRate?: (rate: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    if (!isSupported() || !text.trim()) {
      resolve()
      return
    }
    ensureVoiceListener()
    if (!voices.length) loadVoices()

    const selectedSpeed = rate === undefined ? selectTapSpeed(text) : null
    const effectiveRate = rate ?? selectedSpeed?.rate ?? 1
    onRate?.(effectiveRate)
    if (selectedSpeed) showSpeedBadge(selectedSpeed.label)

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "zh-CN"
    utterance.rate = effectiveRate
    utterance.pitch = 1
    utterance.volume = 1
    utterance.voice = findBestMandarinVoice()

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      currentText = null
      resolve()
    }

    if (onBoundary) {
      utterance.onboundary = (e) => {
        if (typeof e.charIndex === "number") {
          onBoundary(e.charIndex)
        }
      }
    }

    // Safety timeout untuk mencegah macet jika browser tidak menembakkan event onend
    const maxDurationMs = Math.max(5000, Math.round((text.length / Math.max(effectiveRate, 0.3)) * 600) + 4000)
    const timer = setTimeout(finish, maxDurationMs)

    const wrappedFinish = () => {
      clearTimeout(timer)
      finish()
    }
    utterance.onend = wrappedFinish
    utterance.onerror = wrappedFinish

    currentText = text
    window.speechSynthesis.speak(utterance)
  })
}

export function cancelTTS() {
  if (!isSupported()) return
  currentText = null
  tapText = null
  tapCount = 0
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = null
  window.speechSynthesis.cancel()
}
