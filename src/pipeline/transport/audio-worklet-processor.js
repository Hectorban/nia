// AudioWorkletProcessor — runs in a separate thread, processes 128-sample blocks.
// Resamples from the AudioContext sample rate (usually 48000) to 16000 Hz and
// converts stereo→mono, then emits Int16 PCM as a transferable ArrayBuffer.
//
// This is a plain .js file: AudioWorkletGlobalScope does not support TypeScript,
// and `sampleRate` / `registerProcessor` are globals injected by that scope. Do
// NOT add any imports here.

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    // Accumulated input samples (Float32 at the context sample rate).
    this._buffer = [];
    // Emit every ~20ms (320 samples at 16kHz) for low latency.
    this._chunkSamples = 320; // 20ms at 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // input[0] is channel 0 (mono — we request 1 channel in getUserMedia).
    const channelData = input[0];
    if (!channelData) return true;

    // Accumulate samples (Float32 at context sample rate, typically 48000).
    for (let i = 0; i < channelData.length; i++) {
      this._buffer.push(channelData[i]);
    }

    // When we have enough samples, downsample and emit.
    while (this._buffer.length >= this._chunkSamples * (sampleRate / this.targetSampleRate)) {
      this._emitChunk();
    }

    return true;
  }

  _emitChunk() {
    const ratio = sampleRate / this.targetSampleRate;
    const samplesNeeded = this._chunkSamples * ratio;

    // Downsample: take every Nth sample (simple decimation — adequate for voice).
    // For better quality, use linear interpolation, but decimation is fine for 48k→16k.
    const int16Data = new Int16Array(this._chunkSamples);
    for (let i = 0; i < this._chunkSamples; i++) {
      const sourceIndex = Math.floor(i * ratio);
      const sample = this._buffer[sourceIndex] || 0;
      // Clamp and convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767].
      const clamped = Math.max(-1, Math.min(1, sample));
      int16Data[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Remove consumed samples.
    this._buffer = this._buffer.slice(samplesNeeded);

    // Post message with transferable ArrayBuffer (zero-copy to main thread).
    const buffer = int16Data.buffer;
    this.port.postMessage(
      { audio: buffer, sampleRate: this.targetSampleRate },
      [buffer],
    );
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
