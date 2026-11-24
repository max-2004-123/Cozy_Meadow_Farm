import { AnimalSpecies } from '../types';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private pondGain: GainNode | null = null;

  public muted = false;
  public musicEnabled = true;
  private started = false;

  private musicTimer = 0;
  private musicStep = 0;
  private birdTimer = 2.5;
  private cricketTimer = 1.5;

  // Warm F-major pentatonic countryside notes (Hz)
  private readonly melodyNotes = [
    349.23, // F4
    392.0,  // G4
    440.0,  // A4
    523.25, // C5
    587.33, // D5
    698.46, // F5
    783.99, // G5
  ];

  private readonly chordRoots = [174.61, 146.83, 233.08, 196.0]; // F3, D3, Bb3, G3
  private readonly melodyPattern = [0, 2, 3, 5, 4, 3, 2, 1, 0, 3, 4, 6, 5, 3, 2, 0];

  public init(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.started = true;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.72;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicEnabled ? 0.24 : 0;
    this.musicGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.32;
    this.ambientGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.62;
    this.sfxGain.connect(this.masterGain);

    this.setupContinuousAmbience();
  }

  private createNoiseBuffer(seconds = 3): AudioBuffer {
    const ctx = this.ctx!;
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Warm pink-ish noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.018) * 1.4;
    }
    return buffer;
  }

  private setupContinuousAmbience(): void {
    if (!this.ctx || !this.ambientGain) return;
    const noiseBuf = this.createNoiseBuffer(3);

    // 1. Soft breathing meadow wind
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 1.6;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.14;

    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ambientGain);
    windSrc.start();

    // 2. Soft sparkling pond ripple murmur (volume scales by distance to pond)
    const pondSrc = this.ctx.createBufferSource();
    pondSrc.buffer = noiseBuf;
    pondSrc.loop = true;

    const pondFilter = this.ctx.createBiquadFilter();
    pondFilter.type = 'bandpass';
    pondFilter.frequency.value = 1150;
    pondFilter.Q.value = 2.4;

    this.pondGain = this.ctx.createGain();
    this.pondGain.gain.value = 0.0;

    pondSrc.connect(pondFilter);
    pondFilter.connect(this.pondGain);
    this.pondGain.connect(this.ambientGain);
    pondSrc.start();
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.72, this.ctx.currentTime, 0.08);
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(enabled ? 0.24 : 0, this.ctx.currentTime, 0.12);
    }
  }

  public update(dt: number, elapsed: number, nightFactor: number, distToPond: number): void {
    if (!this.started || !this.ctx || this.ctx.state !== 'running') return;

    // Gentle wind swell modulation
    if (this.windFilter && this.windGain) {
      const breeze = 0.5 + 0.5 * Math.sin(elapsed * 0.28);
      this.windFilter.frequency.setTargetAtTime(340 + breeze * 260, this.ctx.currentTime, 0.2);
      this.windGain.gain.setTargetAtTime(0.08 + breeze * 0.09, this.ctx.currentTime, 0.2);
    }

    // Pond proximity ambience
    if (this.pondGain) {
      const proximity = Math.max(0, 1 - distToPond / 16);
      this.pondGain.gain.setTargetAtTime(proximity * 0.18, this.ctx.currentTime, 0.18);
    }

    // Relaxing generative acoustic kalimba & cozy pad music
    if (this.musicEnabled) {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        const tempo = nightFactor > 0.5 ? 0.92 : 0.68;
        this.musicTimer = tempo + (this.musicStep % 4 === 3 ? 0.35 : 0);
        this.playMusicBeat(nightFactor);
        this.musicStep = (this.musicStep + 1) % 32;
      }
    }

    // Daytime birdsong chirps vs nighttime peaceful crickets
    if (nightFactor < 0.55) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 3.6 + Math.random() * 5.2;
        this.playBirdChirp();
      }
    } else {
      this.cricketTimer -= dt;
      if (this.cricketTimer <= 0) {
        this.cricketTimer = 2.4 + Math.random() * 3.8;
        this.playNightCricket();
      }
    }
  }

  private playMusicBeat(nightFactor: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    // Soft warm sustained chord every 4 steps
    if (this.musicStep % 4 === 0) {
      const chordIdx = Math.floor(this.musicStep / 4) % this.chordRoots.length;
      const root = this.chordRoots[chordIdx];
      const triad = [root, root * 1.25, root * 1.5];
      for (const freq of triad) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.065, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.8);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 2.9);
      }
    }

    // Gentle plucked kalimba / folk harp melody note (leave occasional calm breath rests!)
    if (this.musicStep % 7 !== 5) {
      const noteIdx = this.melodyPattern[this.musicStep % this.melodyPattern.length];
      let freq = this.melodyNotes[noteIdx];
      if (nightFactor > 0.5) freq *= 0.5; // Lullaby lower octave at night

      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      overtone.type = 'sine';
      overtone.frequency.value = freq * 2;

      const overGain = this.ctx.createGain();
      overGain.gain.value = 0.16;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.45);

      osc.connect(gain);
      overtone.connect(overGain);
      overGain.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 1.5);
      overtone.stop(now + 1.5);
    }
  }

  private playBirdChirp(): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const baseFreq = 1900 + Math.random() * 1100;
    const chirps = 2 + Math.floor(Math.random() * 2);

    for (let i = 0; i < chirps; i++) {
      const t = now + i * 0.13;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.28 + Math.random() * 0.2), t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.94, t + 0.11);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.065, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.115);

      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  private playNightCricket(): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 3950 + i * 40;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.028, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0004, t + 0.065);
      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  public playFootstep(sprinting: boolean): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const pitch = sprinting ? 145 : 115;
    osc.frequency.setValueAtTime(pitch + Math.random() * 22, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(sprinting ? 0.11 : 0.075, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playTill(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    // Soft earthy thump + crisp rustle
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playPlant(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [440, 587.33];
    notes.forEach((f, i) => {
      const t = now + i * 0.055;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playWater(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    // Sparkling water droplets + soft filtered pour hiss
    const buf = this.createNoiseBuffer(0.45);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.linearRampToValueAtTime(1550, now + 0.35);
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.44);

    // Cute bubbly droplet blips
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      const dg = this.ctx.createGain();
      osc.type = 'sine';
      const f = 620 + Math.random() * 480;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.06);
      dg.gain.setValueAtTime(0.09, t);
      dg.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc.connect(dg);
      dg.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  public playCropRipe(): void {
    this.playArpeggio([523.25, 659.25, 783.99], 0.07, 0.14);
  }

  public playHarvest(): void {
    this.playArpeggio([440, 554.37, 659.25, 880], 0.055, 0.18);
  }

  public playCollectProduct(): void {
    this.playArpeggio([587.33, 739.99, 880, 1174.66], 0.055, 0.16);
  }

  public playHappyChime(): void {
    this.playArpeggio([523.25, 659.25, 783.99, 1046.5], 0.06, 0.15);
  }

  public playTaskComplete(): void {
    this.playArpeggio([523.25, 659.25, 783.99, 987.77, 1046.5], 0.085, 0.22);
  }

  private playArpeggio(notes: number[], spacing: number, volume: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    notes.forEach((f, idx) => {
      const t = now + idx * spacing;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playAnimalSound(species: AnimalSpecies, volumeScale = 1.0): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const vol = 0.22 * volumeScale;

    if (species === 'chicken') {
      // Cute cheerful double-cluck!
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.11;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(640 + i * 90, t);
        osc.frequency.exponentialRampToValueAtTime(980 + i * 70, t + 0.045);
        osc.frequency.exponentialRampToValueAtTime(520, t + 0.09);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(vol * 0.85, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.1);
      }
    } else if (species === 'cow') {
      // Gentle warm low "Moooo"
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(142, now);
      osc.frequency.linearRampToValueAtTime(168, now + 0.16);
      osc.frequency.linearRampToValueAtTime(126, now + 0.56);

      filter.type = 'lowpass';
      filter.frequency.value = 460;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol * 0.72, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.64);
    } else if (species === 'sheep') {
      // Soft vibrato "Baaa"
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.linearRampToValueAtTime(310, now + 0.42);

      lfo.frequency.value = 18;
      lfoGain.gain.value = 16;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      filter.type = 'bandpass';
      filter.frequency.value = 780;
      filter.Q.value = 1.4;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol * 0.8, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.46);
      lfo.stop(now + 0.46);
    } else if (species === 'pig') {
      // Cute bubbly double "Oink-Oink"
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.14;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(210, t);
        osc.frequency.exponentialRampToValueAtTime(340, t + 0.065);
        osc.frequency.exponentialRampToValueAtTime(195, t + 0.11);

        filter.type = 'lowpass';
        filter.frequency.value = 650;

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(vol * 0.82, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.125);
      }
    }
  }

  public playPop(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.065);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.095);
  }
}
