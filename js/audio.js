/* ============================================================
   audio.js — sons de synthèse (WebAudio), aucun fichier externe
   ============================================================ */

class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.last = {};
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (err) { this.ctx = null; }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  /**limitation du nombre de sons simultanés */
  gate(key, minGap) {
    const t = performance.now();
    if (this.last[key] && t - this.last[key] < minGap) return false;
    this.last[key] = t;
    return true;
  }

  noise(dur, vol, filterType, freq, q) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  boom(vol, freq) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(24, freq * 0.22), t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.5);
    this.noise(0.28, vol * 0.55, 'lowpass', 700);
  }

  cannon(x, y) {
    if (!this.ctx || this.muted || !this.gate('cannon', 55)) return;
    this.boom(0.55, 110);
  }

  impact(x, y) {
    if (!this.ctx || this.muted || !this.gate('impact', 45)) return;
    this.boom(0.4, 150);
  }

  crackle() {
    if (!this.ctx || this.muted || !this.gate('crackle', 70)) return;
    this.noise(0.1, 0.1, 'highpass', 1800);
  }

  musketeer(x, y) {
    if (!this.ctx || this.muted || !this.gate('musket', 110)) return;
    this.noise(0.09, 0.07, 'bandpass', 2200, 1.4);
  }

  blip() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(780, t + 0.07);
    const g = c.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.14);
  }

  fanfare(win) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const notes = win ? [392, 523, 659, 784] : [330, 294, 247, 196];
    notes.forEach((f, i) => {
      const t = c.currentTime + i * 0.16;
      const o = c.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.55);
    });
  }
}