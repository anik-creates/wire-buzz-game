/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Audio & TTS Engine
 * Web Audio API Procedural Synthesizer + Web Speech API (100% Offline)
 * ============================================================================
 */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.sfxEnabled = true;
    this.ttsEnabled = true;
    this.volume = 0.85;
    this.speechRate = 1.05;
    this.speechPitch = 1.0;
    this.selectedVoice = null;

    // Initialize Web Audio on first user interaction
    this.initAudioContext = this.initAudioContext.bind(this);
    window.addEventListener('click', this.initAudioContext, { once: true });
    window.addEventListener('keydown', this.initAudioContext, { once: true });

    // Load available speech voices
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      this.loadVoices();
    }
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  loadVoices() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prefer clear English voices (e.g. Google US English, Microsoft David/Mark/Zira)
    this.selectedVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('English'))) || voices[0];
  }

  // ========================== WEB AUDIO SYNTHESIS ===========================

  // 1. Harsh Wire Touch Buzzer
  playTouchBuzz(durationMs = 250) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(120, t + durationMs / 1000);

    // Filter to make it raspy and electric
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(this.volume * 0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + durationMs / 1000);
  }

  // 2. Funny Cartoon "Sad Trombone" Game Over Sound
  // Wah-Wah-Wah-Waaaaah (descending pitch bend with comedic vibrato)
  playGameOverFail() {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const notes = [
      { freq: 233.08, dur: 0.28 }, // Bb3
      { freq: 220.00, dur: 0.28 }, // A3
      { freq: 207.65, dur: 0.28 }, // Ab3
      { freq: 196.00, dur: 0.90, slideTo: 160 } // G3 -> low slide with vibrato
    ];

    let startTime = this.audioCtx.currentTime + 0.05;

    notes.forEach((n, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, startTime);

      if (n.slideTo) {
        osc.frequency.linearRampToValueAtTime(n.slideTo, startTime + n.dur);
        // Add comedic vibrato LFO on last note
        const lfo = this.audioCtx.createOscillator();
        const lfoGain = this.audioCtx.createGain();
        lfo.frequency.setValueAtTime(6.5, startTime);
        lfoGain.gain.setValueAtTime(8.0, startTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(startTime);
        lfo.stop(startTime + n.dur);
      }

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, startTime);
      filter.Q.setValueAtTime(4.0, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.75, startTime + 0.03);
      gain.gain.setValueAtTime(this.volume * 0.75, startTime + n.dur - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + n.dur);

      startTime += n.dur + 0.04;
    });
  }

  // 3. Realistic Crowd Cheering & Rhythmic Clapping Synthesis
  playCelebrationClaps(durationSeconds = 4.0) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;

    // A. Generate Crowd Cheering (Filtered white noise swell)
    const bufferSize = this.audioCtx.sampleRate * durationSeconds;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.5, t);

    const cheerGain = this.audioCtx.createGain();
    cheerGain.gain.setValueAtTime(0.001, t);
    cheerGain.gain.linearRampToValueAtTime(this.volume * 0.55, t + 0.4);
    cheerGain.gain.setValueAtTime(this.volume * 0.55, t + durationSeconds - 0.8);
    cheerGain.gain.exponentialRampToValueAtTime(0.001, t + durationSeconds);

    whiteNoise.connect(filter);
    filter.connect(cheerGain);
    cheerGain.connect(this.audioCtx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + durationSeconds);

    // B. Generate Staggered Clapping Impulses
    const clapCount = Math.floor(durationSeconds * 9);
    for (let c = 0; c < clapCount; c++) {
      const clapTime = t + (c * 0.11) + (Math.random() * 0.04);
      this.synthesizeSingleClap(clapTime);
    }

    // C. Victorious Chime on top of applause
    this.playVictoryFanfare(t);
  }

  synthesizeSingleClap(time) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000 + Math.random() * 500, time);
    filter.Q.setValueAtTime(2.0, time);

    gain.gain.setValueAtTime(this.volume * (0.3 + Math.random() * 0.3), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  // 4. Uplifting Victory Fanfare
  playVictoryFanfare(startTime = null) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = startTime || this.audioCtx.currentTime;
    const chords = [
      { f: 523.25, time: 0.00, dur: 0.15 }, // C5
      { f: 659.25, time: 0.15, dur: 0.15 }, // E5
      { f: 783.99, time: 0.30, dur: 0.20 }, // G5
      { f: 1046.50, time: 0.50, dur: 0.70 } // C6
    ];

    chords.forEach(c => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(c.f, t + c.time);

      gain.gain.setValueAtTime(0.001, t + c.time);
      gain.gain.linearRampToValueAtTime(this.volume * 0.6, t + c.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + c.time + c.dur);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t + c.time);
      osc.stop(t + c.time + c.dur);
    });
  }

  // 5. 3-2-1 Countdown Beeps
  playCountdown(count) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    const isGo = (count === 'GO' || count === 0);
    const freq = isGo ? 880 : 440;
    const dur = isGo ? 0.4 : 0.18;

    osc.type = isGo ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(this.volume * (isGo ? 0.8 : 0.6), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  // ========================== TEXT-TO-SPEECH (TTS) ==========================

  speak(text, priority = false) {
    if (!this.ttsEnabled || !('speechSynthesis' in window)) return;

    if (priority) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.volume = this.volume;
    utterance.rate = this.speechRate;
    utterance.pitch = this.speechPitch;

    window.speechSynthesis.speak(utterance);
  }

  // High-level Game Announcements
  announceGameStart(playerName, mode) {
    const modeName = mode === 1 ? "Sudden Death" : "Touch Master";
    this.speak(`Get ready, ${playerName}! Mode: ${modeName}!`, true);
  }

  announceGameOver(playerName, elapsedSeconds, mode) {
    const funnyLines = [
      `Buzzz! Game over, ${playerName}! Nice try!`,
      `Ouch! You hit the line, ${playerName}! Better luck next time!`,
      `Game over, ${playerName}! That wire is sharp today!`,
      `Shocking! Down goes ${playerName} in ${elapsedSeconds} seconds!`
    ];
    const picked = funnyLines[Math.floor(Math.random() * funnyLines.length)];
    this.speak(picked, true);
  }

  announceVictory(playerName, score, touches, elapsedSec) {
    this.speak(`Spectacular run, ${playerName}! Finished in ${elapsedSec} seconds with ${touches} touches! Final score: ${score} points!`, true);
  }

  announceNextPlayer(playerName, studentId) {
    this.speak(`Next player up: ${playerName}! Please take the wand!`);
  }
}

// Global Singleton
window.soundEngine = new SoundEngine();
