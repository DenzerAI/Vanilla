import { PCMResampler } from './dictation-audio.mjs';
class Capture extends AudioWorkletProcessor {
  constructor() {
    super(); this.resampler = new PCMResampler(sampleRate); this.buffer = new Int16Array(4096); this.used = 0; this.paused = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'pause' || data === 'stop') { this.flush(); this.paused = true; }
      if (data === 'resume') this.paused = false;
      if (data === 'stop') this.port.postMessage({ stopped: true });
    };
  }
  flush() {
    if (!this.used) return;
    const pcm = this.buffer.slice(0, this.used);
    let sum = 0; for (const v of pcm) sum += (v / 32768) ** 2;
    this.port.postMessage({ pcm: pcm.buffer, level: Math.sqrt(sum / pcm.length) }, [pcm.buffer]); this.used = 0;
  }
  process(inputs) {
    if (!this.paused && inputs[0]?.[0]) this.resampler.push(inputs[0][0], sample => {
      this.buffer[this.used++] = sample;
      if (this.used === this.buffer.length) this.flush();
    });
    return true;
  }
}
registerProcessor('dictation-capture', Capture);
