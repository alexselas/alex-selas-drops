/**
 * Audio Analyzer — detects BPM, key and duration from an audio file
 * Uses Web Audio API (Goertzel algorithm for key, autocorrelation for BPM)
 */

export interface AudioAnalysis {
  bpm: number;
  duration: number; // seconds (rounded)
  key: string;      // e.g. "Am", "C", "F#m"
}

// ─── Key Detection ──────────────────────────────────────────────

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumXY += x[i] * y[i];
    sumX += x[i];
    sumY += y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

function rotateArray(arr: number[], shift: number): number[] {
  const n = arr.length;
  const s = ((shift % n) + n) % n;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

function detectKey(audioBuffer: AudioBuffer): string {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const chroma = new Float64Array(12).fill(0);

  const chunkSize = 8192;
  const totalChunks = Math.floor(data.length / chunkSize);
  // Spread chunks evenly across the audio, max 40
  const step = Math.max(1, Math.floor(totalChunks / 40));
  let processed = 0;

  for (let c = 0; c < totalChunks && processed < 40; c += step, processed++) {
    const offset = c * chunkSize;

    for (let note = 0; note < 12; note++) {
      for (let octave = 2; octave <= 6; octave++) {
        const midi = 12 * (octave + 1) + note;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        if (freq >= sampleRate / 2 || freq < 30) continue;

        // Goertzel algorithm for this frequency
        const w = (2 * Math.PI * freq) / sampleRate;
        const coeff = 2 * Math.cos(w);
        let s1 = 0, s2 = 0;

        const end = Math.min(offset + chunkSize, data.length);
        for (let i = offset; i < end; i++) {
          const s0 = data[i] + coeff * s1 - s2;
          s2 = s1;
          s1 = s0;
        }
        chroma[note] += Math.abs(s1 * s1 + s2 * s2 - coeff * s1 * s2);
      }
    }
  }

  // Normalize
  const maxVal = Math.max(...Array.from(chroma));
  if (maxVal > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxVal;

  const chromaArr = Array.from(chroma);
  let bestKey = 'C';
  let bestCorr = -Infinity;

  for (let i = 0; i < 12; i++) {
    const majorCorr = pearsonCorrelation(chromaArr, rotateArray(MAJOR_PROFILE, i));
    if (majorCorr > bestCorr) { bestCorr = majorCorr; bestKey = NOTE_NAMES[i]; }

    const minorCorr = pearsonCorrelation(chromaArr, rotateArray(MINOR_PROFILE, i));
    if (minorCorr > bestCorr) { bestCorr = minorCorr; bestKey = NOTE_NAMES[i] + 'm'; }
  }

  return bestKey;
}

// ─── BPM Detection ──────────────────────────────────────────────

async function detectBPM(audioBuffer: AudioBuffer): Promise<number> {
  const sampleRate = audioBuffer.sampleRate;

  // Low-pass filter to isolate bass / kick
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  const filter = offlineCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 150;
  filter.Q.value = 1;

  source.connect(filter);
  filter.connect(offlineCtx.destination);
  source.start(0);

  const filtered = await offlineCtx.startRendering();
  const data = filtered.getChannelData(0);

  // Compute energy in 10 ms windows
  const windowMs = 0.01;
  const windowSamples = Math.floor(sampleRate * windowMs);
  const numWindows = Math.floor(data.length / windowSamples);
  const energy = new Float32Array(numWindows);

  for (let i = 0; i < numWindows; i++) {
    let sum = 0;
    const start = i * windowSamples;
    for (let j = 0; j < windowSamples; j++) {
      sum += data[start + j] * data[start + j];
    }
    energy[i] = sum;
  }

  // Autocorrelation — BPM range 60-200
  const minLag = Math.floor(60 / 200 / windowMs);
  const maxLag = Math.floor(60 / 60 / windowMs);
  const limit = Math.min(numWindows, 3000); // first ~30 s

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, numWindows - 1); lag++) {
    let corr = 0;
    const n = Math.min(limit, numWindows - lag);
    for (let i = 0; i < n; i++) corr += energy[i] * energy[i + lag];
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  return Math.round(60 / (bestLag * windowMs));
}

// ─── Public API ─────────────────────────────────────────────────

export async function analyzeAudio(file: File): Promise<AudioAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const duration = Math.round(audioBuffer.duration);
    const [bpm, key] = await Promise.all([
      detectBPM(audioBuffer),
      Promise.resolve(detectKey(audioBuffer)),
    ]);

    return { bpm, duration, key };
  } finally {
    await audioContext.close();
  }
}
