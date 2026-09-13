export function playSuccessSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    
    // Create an oscillator for a cheerful "ping-ding" sound
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    osc.type = "sine"
    
    // Ping (C6)
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime)
    // Ding (E6)
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.1)
    
    // Envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.1)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {
    console.error("Audio playback failed", e)
  }
}

export function playErrorSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()

    const playBeep = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = "square"
      osc.frequency.setValueAtTime(freq, startTime)

      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.01)
      gain.gain.setValueAtTime(0.18, startTime + duration - 0.03)
      gain.gain.linearRampToValueAtTime(0, startTime + duration)

      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    // Two short descending tones — classic "wrong" retro sound
    playBeep(280, ctx.currentTime, 0.12)
    playBeep(180, ctx.currentTime + 0.15, 0.15)
  } catch (e) {
    console.error("Audio playback failed", e)
  }
}


class BGMPlayer {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  private intervalId: any = null
  private isPlaying = false

  // Snake theme (upbeat)
  private snakeNotes = [
    261.63, 329.63, 392.00, 523.25, 
    392.00, 329.63, 261.63, 196.00
  ]
  // Match theme (puzzle-like, slightly mysterious or relaxed)
  private matchNotes = [
    329.63, 440.00, 392.00, 329.63,
    261.63, 293.66, 329.63, 440.00
  ]
  private noteIdx = 0

  start(theme: "snake" | "match" = "snake") {
    if (this.isPlaying) return
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContext) return
      this.ctx = new AudioContext()
      
      this.osc = this.ctx.createOscillator()
      this.gain = this.ctx.createGain()
      
      this.osc.type = theme === "snake" ? "square" : "triangle"
      this.osc.connect(this.gain)
      this.gain.connect(this.ctx.destination)
      
      this.gain.gain.value = 0
      this.osc.start()
      this.isPlaying = true

      const activeNotes = theme === "snake" ? this.snakeNotes : this.matchNotes

      const playNextNote = () => {
        if (!this.ctx || !this.gain || !this.osc) return
        const now = this.ctx.currentTime
        const freq = activeNotes[this.noteIdx]
        
        // Portamento to next note
        this.osc.frequency.setValueAtTime(freq, now)
        
        // Pluck envelope
        this.gain.gain.cancelScheduledValues(now)
        this.gain.gain.setValueAtTime(0, now)
        this.gain.gain.linearRampToValueAtTime(0.05, now + 0.05)
        this.gain.gain.exponentialRampToValueAtTime(0.001, now + (theme === "snake" ? 0.25 : 0.4))
        
        this.noteIdx = (this.noteIdx + 1) % activeNotes.length
      }

      const speed = theme === "snake" ? 250 : 350
      this.intervalId = setInterval(playNextNote, speed) 
      playNextNote()
    } catch (e) {
      console.error("BGM failed", e)
    }
  }

  stop() {
    if (!this.isPlaying) return
    if (this.intervalId) clearInterval(this.intervalId)
    if (this.gain && this.ctx) {
      this.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1)
    }
    setTimeout(() => {
      if (this.osc) {
        this.osc.stop()
        this.osc.disconnect()
      }
      if (this.gain) this.gain.disconnect()
      if (this.ctx) this.ctx.close()
      this.osc = null
      this.gain = null
      this.ctx = null
    }, 150)
    this.isPlaying = false
    this.noteIdx = 0
  }
}

export const bgmController = new BGMPlayer()
