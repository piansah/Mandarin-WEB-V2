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
let currentText: string | null = null
let tapText: string | null = null
let tapCount = 0
let tapTimer: ReturnType<typeof setTimeout> | null = null
let badgeTimer: ReturnType<typeof setTimeout> | null = null
let lastSpeakAt = 0
let voicesListenerReady = false

function isSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

function loadVoices() {
  if (!isSupported()) return
  voices = window.speechSynthesis.getVoices()
}

function ensureVoiceListener() {
  if (!isSupported() || voicesListenerReady) return
  voicesListenerReady = true
  loadVoices()
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
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

  badge.textContent = `${label}`
  badge.dataset.visible = "true"
  if (badgeTimer) clearTimeout(badgeTimer)
  badgeTimer = setTimeout(() => {
    badge?.removeAttribute("data-visible")
  }, 1600)
}

export function speakMandarin(text: string, options: { silent?: boolean } = {}) {
  if (!isSupported() || !text.trim()) return

  const now = Date.now()
  if (now - lastSpeakAt < 300) return
  lastSpeakAt = now

  ensureVoiceListener()
  if (!voices.length) loadVoices()

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

  if (!options.silent) showSpeedBadge(speed.label)

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "zh-CN"
  utterance.rate = speed.rate
  utterance.pitch = 1
  utterance.volume = 1
  utterance.voice = voices.find(voice =>
    voice.lang === "zh-CN" ||
    voice.lang === "zh-TW" ||
    voice.lang.startsWith("zh") ||
    /mandarin|chinese/i.test(voice.name),
  ) ?? null
  utterance.onend = () => { currentText = null }
  utterance.onerror = () => { currentText = null }

  currentText = text
  window.speechSynthesis.speak(utterance)
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
