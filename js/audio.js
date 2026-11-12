/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Procedural Audio Engine
 * Technically Supported by IEEE PES DIU SBC
 * 
 * Features:
 * - 100% Offline Procedural Web Audio API Synthesis
 * - Voiceover / TTS completely turned OFF (per user requirement)
 * - Dramatic Cinematic Countdown Music
 * - Cherished, Uplifting Festival Victory Fanfare & Joyous Cheering
 * - Comedic Sad Trombone Game Over
 * - Raspy Wire Touch Buzzer
 * ============================================================================
 */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.sfxEnabled = true;
    this.ttsEnabled = false; // Voiceover turned off completely
    this.volume = 0.90;

    // Initialize Web Audio on first user interaction
    this.initAudioContext = this.initAudioContext.bind(this);
    window.addEventListener('click', this.initAudioContext, { once: true });
    window.addEventListener('keydown', this.initAudioContext, { once: true });
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // ========================== WEB AUDIO PROCEDURAL SYNTHESIS =================

  // 1. Harsh Wire Touch Buzzer (Mode 2 Touch pulse)
  playTouchBuzz(durationMs = 200) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(110, t + durationMs / 1000);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(this.volume * 0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + durationMs / 1000);
  }

  // 2. Cartoon Sad Trombone (Wah-Wah-Wah-Waaaaah on Game Over)
  playGameOverFail() {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const notes = [
      { freq: 233.08, dur: 0.28 }, // Bb3
      { freq: 220.00, dur: 0.28 }, // A3
      { freq: 207.65, dur: 0.28 }, // Ab3
      { freq: 196.00, dur: 0.90, slideTo: 155 } // G3 -> low slide with vibrato
    ];

    let startTime = this.audioCtx.currentTime + 0.05;

    notes.forEach((n) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, startTime);

      if (n.slideTo) {
        osc.frequency.linearRampToValueAtTime(n.slideTo, startTime + n.dur);
        const lfo = this.audioCtx.createOscillator();
        const lfoGain = this.audioCtx.createGain();
        lfo.frequency.setValueAtTime(6.0, startTime);
        lfoGain.gain.setValueAtTime(9.0, startTime);
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

  // 3. Dramatic Cinematic Countdown Beats (3.. 2.. 1.. GO!)
  // Creates intense dramatic rising tension for each count
  playCountdown(count) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;

    if (count === 3) {
      // 3: Deep dramatic impact + rising cinematic brass tension
      this.playDramaticImpact(t, 90, 0.6);
      this.playCinematicTensionTone(t, 220, 0.55);
    } else if (count === 2) {
      // 2: Higher dramatic impact + intense chord stab
      this.playDramaticImpact(t, 110, 0.6);
      this.playCinematicTensionTone(t, 330, 0.55);
    } else if (count === 1) {
      // 1: High-tension climax strike + rising suspense sweep
      this.playDramaticImpact(t, 130, 0.7);
      this.playCinematicTensionTone(t, 440, 0.65);
      this.playRisingSuspenseSweep(t, 300, 880, 0.8);
    } else if (count === 'GO' || count === 0) {
      // GO!: Massive triumphant release impact & celebratory high chime
      this.playTriumphantGoFanfare(t);
    }
  }

  playDramaticImpact(t, startFreq, duration) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + duration);

    gain.gain.setValueAtTime(this.volume * 0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  playCinematicTensionTone(t, freq, duration) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(this.volume * 0.65, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  playRisingSuspenseSweep(t, fromFreq, toFreq, duration) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(fromFreq, t);
    osc.frequency.exponentialRampToValueAtTime(toFreq, t + duration);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(this.volume * 0.5, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  playTriumphantGoFanfare(t) {
    // Powerful timpani punch
    this.playDramaticImpact(t, 180, 0.8);

    // High energetic bright chords
    const chordFreqs = [523.25, 659.25, 783.99, 1046.50]; // C5 Major chord
    chordFreqs.forEach(f => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(this.volume * 0.45, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(t);
      osc.stop(t + 0.65);
    });
  }

  // 4. Cherished Festival Victory Celebration Theme
  // Large stadium crowd cheering & applause of many people with uplifting fanfare
  playCelebrationClaps(durationSeconds = 6.0) {
    if (!this.sfxEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;

    // A. Warm Cherished Chime Melody (Harmonic, emotional, celebratory)
    // Melody: C5 -> E5 -> G5 -> B5 -> C6 -> E6 (Uplifting Festival Arpeggio)
    const melody = [
      { f: 523.25, time: 0.00, dur: 0.35, type: 'triangle' }, // C5
      { f: 659.25, time: 0.16, dur: 0.35, type: 'triangle' }, // E5
      { f: 783.99, time: 0.32, dur: 0.40, type: 'triangle' }, // G5
      { f: 987.77, time: 0.48, dur: 0.45, type: 'triangle' }, // B5
      { f: 1046.50, time: 0.64, dur: 0.90, type: 'sine' },    // C6
      { f: 1318.51, time: 0.88, dur: 1.40, type: 'sine' }     // E6 (Triumphant high shine!)
    ];

    melody.forEach(note => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = note.type;
      osc.frequency.setValueAtTime(note.f, t + note.time);

      gain.gain.setValueAtTime(0.001, t + note.time);
      gain.gain.linearRampToValueAtTime(this.volume * 0.70, t + note.time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.time + note.dur);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(t + note.time);
      osc.stop(t + note.time + note.dur);
    });

    // B. Warm Supporting Brass Pad (Rich, cherished chord harmony)
    const padFreqs = [261.63, 329.63, 392.00, 523.25, 659.25]; // C Major 9th harmonics
    padFreqs.forEach(f => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t + 0.6);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t + 0.6);
      filter.Q.setValueAtTime(1.8, t + 0.6);

      gain.gain.setValueAtTime(0.001, t + 0.6);
      gain.gain.linearRampToValueAtTime(this.volume * 0.30, t + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 3.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(t + 0.6);
      osc.stop(t + 3.8);
    });

    // C. Multi-Layer Realistic Crowd Cheering & Auditorium Roar
    const bufferSize = Math.floor(this.audioCtx.sampleRate * durationSeconds);
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // Crowd Layer 1: Vocal Cheer Roar (Mid range 800-1400Hz)
    const cheerSource1 = this.audioCtx.createBufferSource();
    cheerSource1.buffer = noiseBuffer;
    const filter1 = this.audioCtx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(1100, t);
    filter1.Q.setValueAtTime(1.6, t);

    const cheerGain1 = this.audioCtx.createGain();
    cheerGain1.gain.setValueAtTime(0.001, t);
    cheerGain1.gain.linearRampToValueAtTime(this.volume * 0.55, t + 0.4);
    cheerGain1.gain.setValueAtTime(this.volume * 0.55, t + durationSeconds - 1.2);
    cheerGain1.gain.exponentialRampToValueAtTime(0.001, t + durationSeconds);

    cheerSource1.connect(filter1);
    filter1.connect(cheerGain1);
    cheerGain1.connect(this.audioCtx.destination);
    cheerSource1.start(t);
    cheerSource1.stop(t + durationSeconds);

    // Crowd Layer 2: High Excitement Stadium Whistle & Ambiance (2200-3800Hz)
    const cheerSource2 = this.audioCtx.createBufferSource();
    cheerSource2.buffer = noiseBuffer;
    const filter2 = this.audioCtx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(2600, t);
    filter2.Q.setValueAtTime(2.2, t);

    const cheerGain2 = this.audioCtx.createGain();
    cheerGain2.gain.setValueAtTime(0.001, t);
    cheerGain2.gain.linearRampToValueAtTime(this.volume * 0.35, t + 0.6);
    cheerGain2.gain.setValueAtTime(this.volume * 0.35, t + durationSeconds - 1.5);
    cheerGain2.gain.exponentialRampToValueAtTime(0.001, t + durationSeconds);

    cheerSource2.connect(filter2);
    filter2.connect(cheerGain2);
    cheerGain2.connect(this.audioCtx.destination);
    cheerSource2.start(t);
    cheerSource2.stop(t + durationSeconds);

    // D. Dense Crowd Clapping of Many People (Auditorium Audience Clapping)
    const totalClaps = Math.floor(durationSeconds * 22); // Dense overlapping claps
    for (let c = 0; c < totalClaps; c++) {
      const clapTime = t + 0.2 + (c * 0.045) + (Math.random() * 0.03);
      this.synthesizeCrowdClap(clapTime);
    }
  }

  synthesizeCrowdClap(time) {
    if (!this.audioCtx) return;
    
    // Multi-person handclap simulation with random resonant burst
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600 + Math.random() * 800, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000 + Math.random() * 900, time);
    filter.Q.setValueAtTime(1.8 + Math.random() * 1.5, time);

    const clapVolume = this.volume * (0.18 + Math.random() * 0.22);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(clapVolume, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.065);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.07);
  }

  // ========================== SPEECH / TTS DISABLED ==========================
  // Completely disabled as per user instruction

  speak(text) {
    // Voiceover disabled completely
    return;
  }

  announceGameStart() { return; }
  announceGameOver() { return; }
  announceVictory() { return; }
  announceNextPlayer() { return; }
}

// Global Singleton
window.soundEngine = new SoundEngine();
