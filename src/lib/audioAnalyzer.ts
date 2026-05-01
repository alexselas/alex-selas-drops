/**
 * Audio Analyzer — detects BPM, key and duration from an audio file
 * Optimized for electronic / DJ music
 *
 * BPM:  Dual-engine: web-audio-beat-detector (primary) + custom multi-band autocorrelation (fallback)
 *       Cross-validates both results for maximum accuracy
 * Key:  Goertzel chroma extraction + Krumhansl-Schmuckler key profiles
 */

import { analyze as analyzeBeatDetector } from 'web-audio-beat-detector';

export interface AudioAnalysis {
  bpm: number;
  duration: number; // seconds (rounded)
  key: string;      // e.g. "Am", "C", "F#m"
}

// ═════════════════════════════════════════════════════════════════
//  KEY DETECTION
// ═════════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  let sXY = 0, sX = 0, sY = 0, sX2 = 0, sY2 = 0;
  for (let i = 0; i < n; i++) {
    sXY += x[i] * y[i]; sX += x[i]; sY += y[i];
    sX2 += x[i] * x[i]; sY2 += y[i] * y[i];
  }
  const den = Math.sqrt((n * sX2 - sX * sX) * (n * sY2 - sY * sY));
  return den === 0 ? 0 : (n * sXY - sX * sY) / den;
}

function rotateArray(arr: number[], shift: number): number[] {
  const s = ((shift % arr.length) + arr.length) % arr.length;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

async function detectKey(audioBuffer: AudioBuffer): Promise<string> {
  const sr = audioBuffer.sampleRate;
  const raw = audioBuffer.getChannelData(0);

  // Filter to melodic range (100–4000 Hz) — removes kick drum bass that skews results
  const maxLen = Math.min(raw.length, sr * 45);
  // Skip first 10 s (often just kick intro in electronic music)
  const skip = Math.min(Math.floor(sr * 10), Math.floor(maxLen * 0.2));
  const len = maxLen - skip;

  let data: Float32Array;
  if (len > sr * 5) {
    const ctx = new OfflineAudioContext(1, len, sr);
    const buf = ctx.createBuffer(1, len, sr);
    buf.getChannelData(0).set(raw.subarray(skip, skip + len));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 100; hp.Q.value = 0.707;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 4000; lp.Q.value = 0.707;
    src.connect(hp); hp.connect(lp); lp.connect(ctx.destination); src.start(0);
    data = (await ctx.startRendering()).getChannelData(0);
  } else {
    data = raw;
  }

  // Goertzel chroma extraction with Hanning window
  const chroma = new Float64Array(12).fill(0);
  const chunkSize = 8192;
  const totalChunks = Math.floor(data.length / chunkSize);
  const step = Math.max(1, Math.floor(totalChunks / 50));
  let processed = 0;

  for (let c = 0; c < totalChunks && processed < 50; c += step, processed++) {
    const offset = c * chunkSize;
    const end = Math.min(offset + chunkSize, data.length);
    const cLen = end - offset;

    // Pre-compute windowed samples
    const windowed = new Float32Array(cLen);
    for (let i = 0; i < cLen; i++) {
      windowed[i] = data[offset + i] * (0.5 * (1 - Math.cos(2 * Math.PI * i / (cLen - 1))));
    }

    for (let note = 0; note < 12; note++) {
      for (let octave = 2; octave <= 6; octave++) {
        const midi = 12 * (octave + 1) + note;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        if (freq >= sr / 2 || freq < 50) continue;

        const coeff = 2 * Math.cos((2 * Math.PI * freq) / sr);
        let s1 = 0, s2 = 0;
        for (let i = 0; i < cLen; i++) {
          const s0 = windowed[i] + coeff * s1 - s2;
          s2 = s1; s1 = s0;
        }
        chroma[note] += Math.abs(s1 * s1 + s2 * s2 - coeff * s1 * s2);
      }
    }
  }

  // Normalize & match key
  const maxVal = Math.max(...Array.from(chroma));
  if (maxVal > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxVal;

  const arr = Array.from(chroma);
  let bestKey = 'C';
  let bestCorr = -Infinity;
  for (let i = 0; i < 12; i++) {
    const maj = pearsonCorrelation(arr, rotateArray(MAJOR_PROFILE, i));
    if (maj > bestCorr) { bestCorr = maj; bestKey = NOTE_NAMES[i]; }
    const min = pearsonCorrelation(arr, rotateArray(MINOR_PROFILE, i));
    if (min > bestCorr) { bestCorr = min; bestKey = NOTE_NAMES[i] + 'm'; }
  }
  return bestKey;
}

// ═════════════════════════════════════════════════════════════════
//  BPM DETECTION
// ═════════════════════════════════════════════════════════════════

/** Band-pass filter via OfflineAudioContext */
async function filterBand(
  audioBuffer: AudioBuffer, low: number, high: number, maxLen: number,
): Promise<Float32Array> {
  const sr = audioBuffer.sampleRate;
  const raw = audioBuffer.getChannelData(0);
  const len = Math.min(raw.length, maxLen);

  const ctx = new OfflineAudioContext(1, len, sr);
  const buf = ctx.createBuffer(1, len, sr);
  buf.getChannelData(0).set(raw.subarray(0, len));
  const src = ctx.createBufferSource(); src.buffer = buf;

  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = low; hp.Q.value = 0.707;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = high; lp.Q.value = 0.707;
  src.connect(hp); hp.connect(lp); lp.connect(ctx.destination); src.start(0);

  return (await ctx.startRendering()).getChannelData(0);
}

async function detectBPM(audioBuffer: AudioBuffer): Promise<number> {
  const sr = audioBuffer.sampleRate;
  const maxLen = Math.min(audioBuffer.length, sr * 45);

  // ── 1. Multi-band filtering (parallel) ──
  const [bass, mid, high] = await Promise.all([
    filterBand(audioBuffer, 40, 200, maxLen),      // kick drum
    filterBand(audioBuffer, 200, 2000, maxLen),     // snare / toms
    filterBand(audioBuffer, 2000, 12000, maxLen),   // hi-hat / cymbals
  ]);

  // ── 2. Onset strength per band ──
  const hopMs = 10;                                  // 10 ms hop
  const winMs = 20;                                  // 20 ms window
  const hopN  = Math.floor(sr * hopMs / 1000);
  const winN  = Math.floor(sr * winMs / 1000);
  const nFrames = Math.floor((maxLen - winN) / hopN);

  function onsetEnvelope(band: Float32Array): Float64Array {
    const energy = new Float64Array(nFrames);
    for (let i = 0; i < nFrames; i++) {
      let sum = 0;
      const s = i * hopN;
      for (let j = 0; j < winN; j++) { const v = band[s + j]; sum += v * v; }
      energy[i] = sum;
    }
    // Onset = positive energy difference (half-wave rectification)
    const onset = new Float64Array(nFrames > 1 ? nFrames - 1 : 0);
    for (let i = 0; i < onset.length; i++) {
      onset[i] = Math.max(0, energy[i + 1] - energy[i]);
    }
    return onset;
  }

  const onsets = [onsetEnvelope(bass), onsetEnvelope(mid), onsetEnvelope(high)];
  const weights = [2.0, 1.0, 0.5];                  // bass is king for beat detection

  const N = onsets[0].length;
  if (N < 200) return 128;                           // audio too short

  // Combine (per-band normalization prevents one band from dominating)
  const combined = new Float64Array(N);
  for (let b = 0; b < 3; b++) {
    let peak = 0;
    for (let i = 0; i < N; i++) if (onsets[b][i] > peak) peak = onsets[b][i];
    if (peak > 0) {
      for (let i = 0; i < N; i++) combined[i] += (onsets[b][i] / peak) * weights[b];
    }
  }

  // ── 3. Autocorrelation ──
  const fps    = 1000 / hopMs;                       // 100 frames/s
  const lagMin = Math.floor(fps * 60 / 220);         // 220 BPM
  const lagMax = Math.ceil(fps * 60 / 60);           // 60 BPM
  const acfN   = Math.min(N, Math.floor(fps * 30));  // analyse first 30 s

  const acf = new Float64Array(lagMax + 1);
  for (let lag = lagMin; lag <= Math.min(lagMax, N - 1); lag++) {
    let sum = 0;
    const cnt = Math.min(acfN, N - lag);
    for (let i = 0; i < cnt; i++) sum += combined[i] * combined[i + lag];
    acf[lag] = sum / cnt;                             // normalise by count
  }

  // ── 4. Peak finding + parabolic interpolation ──
  interface Peak { lag: number; bpm: number; score: number }
  const peaks: Peak[] = [];
  for (let lag = lagMin + 1; lag < Math.min(lagMax, acf.length - 1); lag++) {
    if (acf[lag] > acf[lag - 1] && acf[lag] >= acf[lag + 1] && acf[lag] > 0) {
      const a = acf[lag - 1], b = acf[lag], c = acf[lag + 1];
      const d = 2 * (2 * b - a - c);
      const off = d !== 0 ? (a - c) / d : 0;
      const rLag = lag + off;
      peaks.push({ lag: rLag, bpm: fps * 60 / rLag, score: b });
    }
  }
  if (peaks.length === 0) return 128;
  peaks.sort((a, b) => b.score - a.score);

  // ── 5. Octave resolution ──
  // Electronic music tempos live in 100-160; pick the octave that fits best.
  const topBPM   = peaks[0].bpm;
  const topScore = peaks[0].score;

  const candidates: { bpm: number; score: number }[] = [];
  for (let mult = 0.25; mult <= 4; mult *= 2) {
    const cand = topBPM * mult;
    if (cand < 70 || cand > 200) continue;

    const cLag = Math.round(fps * 60 / cand);
    if (cLag < lagMin || cLag > lagMax || cLag >= acf.length) continue;

    // Best ACF near this lag (±3 frames)
    let best = 0;
    for (let l = Math.max(lagMin, cLag - 3); l <= Math.min(lagMax, cLag + 3); l++) {
      if (l < acf.length && acf[l] > best) best = acf[l];
    }

    // Perceptual weighting — prefer 128 BPM neighbourhood
    const tw = 1 + 0.4 * Math.exp(-((cand - 128) ** 2) / (2 * 25 * 25));
    candidates.push({ bpm: cand, score: best * tw });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return Math.round(candidates[0].bpm);
  }

  let bpm = topBPM;
  while (bpm > 200) bpm /= 2;
  while (bpm < 70)  bpm *= 2;
  return Math.round(bpm);
}

// ═════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═════════════════════════════════════════════════════════════════

/**
 * Dual-engine BPM detection for maximum accuracy
 * 1. web-audio-beat-detector (spectral energy + interval grouping) — primary
 * 2. Custom multi-band autocorrelation — fallback/validation
 * Cross-validates: if both agree within 3 BPM, use the average. Otherwise use primary.
 */
async function detectBPMDual(audioBuffer: AudioBuffer): Promise<number> {
  let primaryBPM = 0;
  let fallbackBPM = 0;

  // Primary: web-audio-beat-detector (high accuracy for electronic music)
  try {
    primaryBPM = await analyzeBeatDetector(audioBuffer);
  } catch {
    // Library might fail on very short or unusual audio
  }

  // Fallback: custom multi-band algorithm
  try {
    fallbackBPM = await detectBPM(audioBuffer);
  } catch {}

  // Cross-validate
  if (primaryBPM > 0 && fallbackBPM > 0) {
    // Check if they agree (within 3 BPM or octave relationship)
    const diff = Math.abs(primaryBPM - fallbackBPM);
    if (diff <= 3) {
      // Both agree — use rounded average
      return Math.round((primaryBPM + fallbackBPM) / 2);
    }
    // Check octave relationship (one might be double/half)
    const ratio = primaryBPM / fallbackBPM;
    if (Math.abs(ratio - 2) < 0.1 || Math.abs(ratio - 0.5) < 0.05) {
      // Prefer the one in the 70-180 range (common DJ range)
      const inRange = (b: number) => b >= 70 && b <= 180;
      if (inRange(primaryBPM) && !inRange(fallbackBPM)) return Math.round(primaryBPM);
      if (!inRange(primaryBPM) && inRange(fallbackBPM)) return Math.round(fallbackBPM);
    }
    // Trust primary (web-audio-beat-detector is generally more accurate)
    return Math.round(primaryBPM);
  }

  // Only one succeeded
  if (primaryBPM > 0) return Math.round(primaryBPM);
  if (fallbackBPM > 0) return Math.round(fallbackBPM);

  return 128; // ultimate fallback
}

export async function analyzeAudio(file: File): Promise<AudioAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const duration = Math.round(audioBuffer.duration);

    const [bpm, key] = await Promise.all([
      detectBPMDual(audioBuffer),
      detectKey(audioBuffer),
    ]);

    return { bpm: bpm > 162 ? Math.round(bpm / 2) : bpm, duration, key };
  } finally {
    await audioContext.close();
  }
}
