// Sound system using Web Audio API
class SoundManager {
  constructor() {
    this.audioContext = null
    this.masterVolume = 0.3
    this.init()
  }

  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('Web Audio API not supported')
    }
  }

  playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!this.audioContext) return

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.frequency.value = frequency
    oscillator.type = type

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(volume * this.masterVolume, this.audioContext.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + duration)
  }

  playThrust() {
    if (!this.audioContext) return
    const freq = 100 + Math.random() * 50
    this.playTone(freq, 0.1, 'sawtooth', 0.2)
  }

  playCollect() {
    if (!this.audioContext) return
    // Pleasant chime sound
    this.playTone(523.25, 0.1, 'sine', 0.4) // C5
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(659.25, 0.1, 'sine', 0.4) // E5
      }
    }, 50)
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(783.99, 0.15, 'sine', 0.4) // G5
      }
    }, 100)
  }

  playShieldActivate() {
    if (!this.audioContext) return
    // Magical power-up sound
    this.playTone(440, 0.1, 'sine', 0.5) // A4
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(554.37, 0.1, 'sine', 0.5) // C#5
      }
    }, 50)
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(659.25, 0.2, 'sine', 0.5) // E5
      }
    }, 100)
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(880, 0.3, 'sine', 0.4) // A5
      }
    }, 200)
  }

  playShieldHit() {
    if (!this.audioContext) return
    // Shield block sound
    this.playTone(200, 0.15, 'square', 0.3)
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(150, 0.15, 'square', 0.3)
      }
    }, 50)
  }

  playCrash() {
    if (!this.audioContext) return
    // Crash/explosion sound
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (this.audioContext) {
          const freq = 100 - i * 10
          this.playTone(freq, 0.2, 'sawtooth', 0.4)
        }
      }, i * 30)
    }
  }

  playStart() {
    if (!this.audioContext) return
    // Start game sound
    this.playTone(523.25, 0.1, 'sine', 0.5) // C5
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(659.25, 0.1, 'sine', 0.5) // E5
      }
    }, 100)
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(783.99, 0.2, 'sine', 0.5) // G5
      }
    }, 200)
  }

  playClick() {
    if (!this.audioContext) return
    // Button click sound - short, pleasant beep
    this.playTone(800, 0.05, 'sine', 0.3)
    setTimeout(() => {
      if (this.audioContext) {
        this.playTone(1000, 0.05, 'sine', 0.2)
      }
    }, 20)
  }
}

export default SoundManager

