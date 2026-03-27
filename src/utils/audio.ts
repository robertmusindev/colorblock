class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicInterval: number | null = null;
  private bpm: number = 120;
  private isPlayingMusic = false;
  private _muted = false;
  private machinegunBuffer: AudioBuffer | null = null;
  private machinegunLoading = false;
  private machinegunSource: AudioBufferSourceNode | null = null;
  private machinegunGainNode: GainNode | null = null;

  get muted() { return this._muted; }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx!.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  init() {
    this.getContext();
  }

  private getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private get dest() {
    const ctx = this.getContext();
    return this.masterGain ?? ctx.destination;
  }

  startMusic() {
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.playBeat();
  }

  setMusicSpeed(multiplier: number) {
    this.bpm = 120 * multiplier;
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private playBeat = () => {
    if (!this.isPlayingMusic) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(this.dest);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
    
    const beatDuration = 60000 / this.bpm;
    this.musicInterval = window.setTimeout(this.playBeat, beatDuration);
  }

  playJumpSound() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(this.dest);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playFootstepSound() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(this.dest);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playEliminationSound() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.dest);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playRoundStartSound() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.dest);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playGameOverSound() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(250, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.4);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.6);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      
      osc.connect(gain);
      gain.connect(this.dest);
      
      osc.start();
      osc.stop(ctx.currentTime + 1);
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playCoinSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      // Festive "ding-ding" sequence
      [880, 1318].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
        
        osc.connect(gain);
        gain.connect(this.dest);
        
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
      });
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playGadgetCollectSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      // Rising fanfare: 3 tones
      [600, 900, 1400].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + i * 0.1 + 0.12);
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.14, now + i * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(this.dest);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.35);
      });
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playCoinCollectSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // High-pitched "bling" - two quick ascending tones
      [1200, 1800].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.8, now + i * 0.07);
        osc.frequency.exponentialRampToValueAtTime(freq, now + i * 0.07 + 0.05);

        gain.gain.setValueAtTime(0, now + i * 0.07);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.2);

        osc.connect(gain);
        gain.connect(this.dest);

        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.2);
      });
    } catch (e) {
      console.error('Audio error', e);
    }
  }

  playLargeCoinShower() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const duration = 2.5;
      
      // Create a sequence of coin dings over duration
      for (let i = 0; i < 20; i++) {
        const startTime = now + Math.random() * duration;
        const freq = 800 + Math.random() * 1200;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.05, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
        
        osc.connect(gain);
        gain.connect(this.dest);
        
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      }
    } catch (e) {
      console.error('Audio error', e);
    }
  }
  // ── Ghetto mode sounds ────────────────────────────────────────────────────

  playGunshot() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const bufLen = Math.floor(ctx.sampleRate * 0.10);
      const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3.5);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = 180;
      bpf.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      src.connect(bpf);
      bpf.connect(gain);
      gain.connect(this.dest);
      src.start(now);
      src.stop(now + 0.12);
    } catch (e) { console.error('Audio error', e); }
  }

  playEnemyDeath() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280 + i * 5, now);
        osc.frequency.exponentialRampToValueAtTime(58 + i * 5, now + 0.38);
        gain.gain.setValueAtTime(0.09 - i * 0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(this.dest);
        osc.start(now);
        osc.stop(now + 0.38);
      }
    } catch (e) { console.error('Audio error', e); }
  }

  playEmptyGun() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.028);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(gain);
      gain.connect(this.dest);
      osc.start(now);
      osc.stop(now + 0.028);
    } catch (e) { console.error('Audio error', e); }
  }

  playWaveStart() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [300, 450, 650].forEach((freq, i) => {
        const offset = i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + offset);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.55, now + offset + 0.14);
        gain.gain.setValueAtTime(0.0, now + offset);
        gain.gain.linearRampToValueAtTime(0.07, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
        osc.connect(gain);
        gain.connect(this.dest);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch (e) { console.error('Audio error', e); }
  }

  playAmmoPickup() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [440, 660, 880].forEach((freq, i) => {
        const offset = i * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.07, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
        osc.connect(gain);
        gain.connect(this.dest);
        osc.start(now + offset);
        osc.stop(now + offset + 0.09);
      });
    } catch (e) { console.error('Audio error', e); }
  }

  playBulletImpact() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      // Low thud — flesh/body impact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(this.dest);
      osc.start(now);
      osc.stop(now + 0.13);
      // Short noise burst — wet smack
      const bufSize = Math.floor(ctx.sampleRate * 0.045);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = 900;
      bpf.Q.value = 0.6;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      src.connect(bpf);
      bpf.connect(nGain);
      nGain.connect(this.dest);
      src.start(now);
      src.stop(now + 0.045);
    } catch (e) { console.error('Audio error', e); }
  }

  async preloadMachinegunSfx(url: string) {
    if (this.machinegunBuffer || this.machinegunLoading) return;
    this.machinegunLoading = true;
    try {
      const ctx = this.getContext();
      const resp = await fetch(url);
      const arrayBuf = await resp.arrayBuffer();
      this.machinegunBuffer = await ctx.decodeAudioData(arrayBuf);
    } catch (e) {
      console.error('Failed to load machinegun sfx', e);
    } finally {
      this.machinegunLoading = false;
    }
  }

  startMachinegunLoop() {
    if (!this.machinegunBuffer || this.machinegunSource) return;
    try {
      const ctx = this.getContext();
      const src = ctx.createBufferSource();
      src.buffer = this.machinegunBuffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.18;
      src.connect(gain);
      gain.connect(this.dest);
      src.start();
      this.machinegunSource = src;
      this.machinegunGainNode = gain;
    } catch (e) { console.error('Audio error', e); }
  }

  stopMachinegunLoop() {
    try {
      this.machinegunSource?.stop();
    } catch (_) {}
    this.machinegunSource?.disconnect();
    this.machinegunGainNode?.disconnect();
    this.machinegunSource = null;
    this.machinegunGainNode = null;
  }

  playExplosion() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      // Deep boom: sawtooth oscillator sweeping 90→18Hz
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(18, now + 0.55);
      oscGain.gain.setValueAtTime(2.2, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(oscGain);
      oscGain.connect(this.dest);
      osc.start(now);
      osc.stop(now + 0.55);
      // Crackle: filtered noise burst
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 800;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(1.6, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      src.connect(lpf);
      lpf.connect(nGain);
      nGain.connect(this.dest);
      src.start(now);
      src.stop(now + 0.3);
    } catch (e) { console.error('Audio error', e); }
  }
}

export const audio = new AudioController();
