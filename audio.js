export class GoalAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.click = new Audio("./assets/sfx/click1.ogg");
    this.click.preload = "auto";
  }

  async unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  tap() {
    if (!this.enabled) return;
    this.click.currentTime = 0;
    void this.click.play().catch(() => {});
  }

  kick() {
    this.tone(105, 0.08, "triangle", 0.13);
    this.noise(0.055, 0.08);
  }

  goal(combo = 1) {
    const lift = Math.min(combo, 5) * 28;
    [520, 700, 940].forEach((frequency, index) => {
      this.tone(frequency + lift, 0.16, "square", 0.07, index * 0.075);
    });
  }

  save() {
    this.tone(190, 0.15, "sawtooth", 0.08);
    this.tone(135, 0.2, "sawtooth", 0.06, 0.1);
  }

  end() {
    [392, 523, 659, 784].forEach((frequency, index) => {
      this.tone(frequency, 0.2, "square", 0.065, index * 0.12);
    });
  }

  tone(frequency, duration, type, volume, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  noise(duration, volume) {
    if (!this.enabled || !this.ctx) return;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }
}
