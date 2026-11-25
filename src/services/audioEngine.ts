// High-Fidelity Web Audio & Offline Voice Processing Engine
// Includes PCM WAV and LAME MP3 encoders + pitch analysis and offline synthesis

// @ts-ignore
import * as lamejsModule from 'lamejs';
import { cleanFileName, removeExtraSpaces } from '../utils/textCleaner';
import { BackgroundMusicMood } from '../types';

const lamejs = (lamejsModule as any).default || lamejsModule;
const Mp3Encoder = lamejs.Mp3Encoder;

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    try {
      sharedAudioContext = new AudioCtx();
    } catch (_e) {
      sharedAudioContext = new AudioCtx({ sampleRate: 44100 });
    }
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

// Convert AudioBuffer to MP3 Blob (or lossless 16-bit PCM WAV if lamejs is unavailable in strict ESM)
export function audioBufferToMp3(buffer: AudioBuffer, kbps = 128): Blob {
  try {
    if (!Mp3Encoder) {
      return audioBufferToWav(buffer);
    }
    const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
    const sampleRate = buffer.sampleRate;
    const encoder = new Mp3Encoder(channels, sampleRate, kbps);
    const mp3Data: any[] = [];

    const leftChannel = buffer.getChannelData(0);
    const leftInt16 = new Int16Array(leftChannel.length);
    for (let i = 0; i < leftChannel.length; i++) {
      const s = Math.max(-1, Math.min(1, leftChannel[i]));
      leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const sampleBlockSize = 1152;
    if (channels === 2) {
      const rightChannel = buffer.getChannelData(1);
      const rightInt16 = new Int16Array(rightChannel.length);
      for (let i = 0; i < rightChannel.length; i++) {
        const s = Math.max(-1, Math.min(1, rightChannel[i]));
        rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
        const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
        const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
        const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
    } else {
      for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
        const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
        const mp3buf = encoder.encodeBuffer(leftChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
    }

    const mp3End = encoder.flush();
    if (mp3End.length > 0) {
      mp3Data.push(mp3End);
    }

    if (mp3Data.length === 0) {
      return audioBufferToWav(buffer);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  } catch (_err) {
    // Fallback to standard 16-bit PCM WAV container so encoding never fails or distorts
    return audioBufferToWav(buffer);
  }
}

// Parse standard RIFF/WAVE container directly in JS (reads fmt + data chunks, skips trailing C2PA/metadata)
function parseWavArrayBufferToAudioBuffer(
  arrayBuffer: ArrayBuffer,
  ctx: AudioContext
): AudioBuffer | null {
  if (arrayBuffer.byteLength < 44) return null;
  const view = new DataView(arrayBuffer);
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  if (riff !== 'RIFF' || wave !== 'WAVE') return null;

  let offset = 12;
  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= arrayBuffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;

    if (chunkId === 'fmt ' && payloadOffset + 16 <= arrayBuffer.byteLength) {
      audioFormat = view.getUint16(payloadOffset, true);
      numChannels = Math.max(1, Math.min(2, view.getUint16(payloadOffset + 2, true)));
      sampleRate = view.getUint32(payloadOffset + 4, true) || 24000;
      bitsPerSample = view.getUint16(payloadOffset + 14, true) || 16;
    } else if (chunkId === 'data') {
      dataOffset = payloadOffset;
      dataSize = Math.min(chunkSize, arrayBuffer.byteLength - payloadOffset);
      break;
    }

    offset = payloadOffset + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || dataSize <= 0 || (audioFormat !== 1 && audioFormat !== 3)) {
    return null;
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameBytes = bytesPerSample * numChannels;
  if (frameBytes <= 0) return null;

  const numFrames = Math.max(1, Math.floor(dataSize / frameBytes));
  const audioBuffer = ctx.createBuffer(numChannels, numFrames, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < numFrames; i++) {
      const samplePos = dataOffset + i * frameBytes + ch * bytesPerSample;
      if (samplePos + bytesPerSample > arrayBuffer.byteLength) break;
      if (audioFormat === 3 && bitsPerSample === 32) {
        channelData[i] = Math.max(-1, Math.min(1, view.getFloat32(samplePos, true)));
      } else if (bitsPerSample === 16) {
        channelData[i] = view.getInt16(samplePos, true) / 32768;
      } else if (bitsPerSample === 8) {
        channelData[i] = (view.getUint8(samplePos) - 128) / 128;
      } else if (bitsPerSample === 24) {
        const b0 = view.getUint8(samplePos);
        const b1 = view.getUint8(samplePos + 1);
        const b2 = view.getInt8(samplePos + 2);
        const val = (b2 << 16) | (b1 << 8) | b0;
        channelData[i] = val / 8388608;
      }
    }
  }

  return audioBuffer;
}

// Detect compressed container headers (MP3/ID3, OGG, FLAC, M4A) so we NEVER treat compressed audio as raw PCM
function isCompressedAudioContainer(arrayBuffer: ArrayBuffer): boolean {
  if (arrayBuffer.byteLength < 4) return false;
  const bytes = new Uint8Array(arrayBuffer, 0, Math.min(12, arrayBuffer.byteLength));
  // ID3 tag (MP3)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  // MPEG ADTS/MP3 frame sync (0xFF 0xE0+)
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;
  // OggS
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true;
  // fLaC
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) return true;
  // MP4 / M4A ftyp
  if (
    arrayBuffer.byteLength >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return true;
  }
  return false;
}

// Universal Audio Decoder: decodes WAV (pure-JS chunk parser), MP3, OGG, or raw 24kHz 16-bit PCM into an AudioBuffer
export async function decodeAudioBlobOrUrl(audioBlobOrUrl: Blob | string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  let arrayBuffer: ArrayBuffer;
  if (typeof audioBlobOrUrl === 'string') {
    const res = await fetch(audioBlobOrUrl);
    arrayBuffer = await res.arrayBuffer();
  } else {
    arrayBuffer = await audioBlobOrUrl.arrayBuffer();
  }

  // 1. If RIFF/WAVE, parse deterministically in JS first (avoids mobile decodeAudioData C2PA/rate issues)
  const directWav = parseWavArrayBufferToAudioBuffer(arrayBuffer, ctx);
  if (directWav) {
    return directWav;
  }

  // 2. Decode compressed formats (MP3, OGG, M4A, WebM) via WebAudio decodeAudioData
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch (decodeErr) {
    // NEVER reinterpret compressed MP3/OGG/M4A bytes as raw PCM (that produces pure static noise!)
    if (isCompressedAudioContainer(arrayBuffer)) {
      throw decodeErr;
    }

    // 3. Only treat genuinely headerless buffers as raw 16-bit signed little-endian mono PCM at 24000 Hz
    const sampleRate = 24000;
    const numSamples = Math.max(1, Math.floor(arrayBuffer.byteLength / 2));
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(arrayBuffer, 0, numSamples * 2);

    for (let i = 0; i < numSamples; i++) {
      const int16 = view.getInt16(i * 2, true);
      channelData[i] = int16 / 32768;
    }

    return audioBuffer;
  }
}

// Convert any Audio Blob or URL into a playable/downloadable Audio Blob
export async function convertAudioToMp3Blob(audioBlobOrUrl: Blob | string, kbps = 128): Promise<Blob> {
  try {
    const audioBuffer = await decodeAudioBlobOrUrl(audioBlobOrUrl);
    return audioBufferToMp3(audioBuffer, kbps);
  } catch (err) {
    console.warn('Audio conversion fallback triggered:', err);
    if (typeof audioBlobOrUrl === 'string') {
      const res = await fetch(audioBlobOrUrl);
      return await res.blob();
    }
    return audioBlobOrUrl;
  }
}

// Non-destructive DSP Audio Extra Space / Silence Trimmer
// Removes leading/trailing dead air and compresses unnatural pauses between words/sentences
// while preserving breaths, soft consonants (s, f, th, h), and natural decay tails with cosine micro-fades.
export async function removeExtraAudioSpaces(
  audioBlobOrUrl: Blob | string,
  options: {
    maxPauseMs?: number; // Compress silent pauses longer than this (default 80ms)
    targetPauseMs?: number; // Down to a crisp natural bridge (default 30ms)
    prePadMs?: number; // Safety margin before voice onset (default 30ms)
    postPadMs?: number; // Safety margin after voice offset (default 40ms)
    kbps?: number;
  } = {}
): Promise<{
  audioBlob: Blob;
  audioUrl: string;
  originalDuration: number;
  newDuration: number;
  removedSeconds: number;
}> {
  const ctx = getAudioContext();
  const audioBuffer = await decodeAudioBlobOrUrl(audioBlobOrUrl);
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const originalDuration = audioBuffer.duration;

  // Analyze in 10ms frames for high-resolution speech/pause envelope tracking
  const frameMs = 10;
  const frameSamples = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const numFrames = Math.ceil(totalSamples / frameSamples);

  const rawRms = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSamples;
    const end = Math.min(totalSamples, start + frameSamples);
    let sumSq = 0;
    let count = 0;

    for (let ch = 0; ch < numChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = start; i < end; i++) {
        const val = data[i];
        sumSq += val * val;
        count++;
      }
    }

    rawRms[f] = count > 0 ? Math.sqrt(sumSq / count) : 0;
  }

  // Smooth RMS over a 3-frame (30ms) window to ignore isolated clicks
  const frameRms = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const prev = f > 0 ? rawRms[f - 1] : rawRms[f];
    const curr = rawRms[f];
    const next = f < numFrames - 1 ? rawRms[f + 1] : rawRms[f];
    frameRms[f] = (prev + curr * 2 + next) / 4;
  }

  // Compute percentile statistics for adaptive thresholding
  const sortedRms = Array.from(frameRms).filter((v) => v > 0.0005).sort((a, b) => a - b);
  const p90 = sortedRms.length > 0 ? sortedRms[Math.floor(sortedRms.length * 0.9)] : 0.1;
  const p15 = sortedRms.length > 0 ? sortedRms[Math.floor(sortedRms.length * 0.15)] : 0.005;

  // Helper to compute kept sample segments for a given RMS threshold & pause parameters
  const buildTrimmedSegments = (
    thresh: number,
    prePadMsVal: number,
    postPadMsVal: number,
    maxPauseMsVal: number,
    targetPauseMsVal: number
  ): { start: number; end: number }[] => {
    const active = new Uint8Array(numFrames);
    for (let f = 0; f < numFrames; f++) {
      if (frameRms[f] >= thresh) {
        active[f] = 1;
      }
    }

    // De-glitch isolated 1-2 frame noise spikes (< 25ms) surrounded by silence
    for (let f = 1; f < numFrames - 2; f++) {
      if (active[f] === 1 && active[f - 1] === 0 && active[f + 1] === 0) {
        active[f] = 0;
      }
      if (
        active[f] === 1 &&
        active[f + 1] === 1 &&
        active[f - 1] === 0 &&
        active[f + 2] === 0
      ) {
        active[f] = 0;
        active[f + 1] = 0;
      }
    }

    // Apply protective padding around active vocal frames so consonants & word endings are never clipped
    const prePadFrames = Math.ceil(prePadMsVal / frameMs);
    const postPadFrames = Math.ceil(postPadMsVal / frameMs);
    const padded = new Uint8Array(numFrames);

    for (let f = 0; f < numFrames; f++) {
      if (active[f] === 1) {
        const s = Math.max(0, f - prePadFrames);
        const e = Math.min(numFrames - 1, f + postPadFrames);
        for (let k = s; k <= e; k++) {
          padded[k] = 1;
        }
      }
    }

    interface Region {
      isSpeech: boolean;
      startSample: number;
      endSample: number;
    }
    const regions: Region[] = [];
    let currentType = padded[0] === 1;
    let regionStartFrame = 0;

    for (let f = 1; f < numFrames; f++) {
      const isSp = padded[f] === 1;
      if (isSp !== currentType) {
        regions.push({
          isSpeech: currentType,
          startSample: regionStartFrame * frameSamples,
          endSample: Math.min(totalSamples, f * frameSamples),
        });
        currentType = isSp;
        regionStartFrame = f;
      }
    }
    regions.push({
      isSpeech: currentType,
      startSample: regionStartFrame * frameSamples,
      endSample: totalSamples,
    });

    const maxPauseSamples = Math.floor((maxPauseMsVal / 1000) * sampleRate);
    const targetPauseSamples = Math.floor((targetPauseMsVal / 1000) * sampleRate);
    const leadInSamples = Math.floor(0.015 * sampleRate); // 15ms clean lead-in
    const tailOutSamples = Math.floor(0.02 * sampleRate); // 20ms clean tail-out

    const kept: { start: number; end: number }[] = [];

    regions.forEach((reg, idx) => {
      const len = reg.endSample - reg.startSample;
      if (reg.isSpeech) {
        kept.push({ start: reg.startSample, end: reg.endSample });
      } else {
        const isLeading = idx === 0;
        const isTrailing = idx === regions.length - 1;

        if (isLeading) {
          if (len > leadInSamples) {
            kept.push({
              start: reg.endSample - leadInSamples,
              end: reg.endSample,
            });
          } else {
            kept.push({ start: reg.startSample, end: reg.endSample });
          }
        } else if (isTrailing) {
          if (len > tailOutSamples) {
            kept.push({
              start: reg.startSample,
              end: reg.startSample + tailOutSamples,
            });
          } else {
            kept.push({ start: reg.startSample, end: reg.endSample });
          }
        } else {
          if (len > maxPauseSamples) {
            const halfPause = Math.floor(targetPauseSamples / 2);
            if (halfPause > 0) {
              kept.push({
                start: reg.startSample,
                end: reg.startSample + halfPause,
              });
              kept.push({
                start: reg.endSample - halfPause,
                end: reg.endSample,
              });
            }
          } else {
            kept.push({ start: reg.startSample, end: reg.endSample });
          }
        }
      }
    });

    // Merge contiguous segments
    const merged: { start: number; end: number }[] = [];
    for (const seg of kept) {
      if (seg.end <= seg.start) continue;
      if (merged.length > 0 && merged[merged.length - 1].end === seg.start) {
        merged[merged.length - 1].end = seg.end;
      } else {
        merged.push({ ...seg });
      }
    }

    return merged;
  };

  // Pass 1: Standard adaptive silence & pause threshold
  const baseThreshold = Math.max(0.008, Math.min(p90 * 0.14, Math.max(p15 * 1.5, p90 * 0.08)));
  let mergedSegments = buildTrimmedSegments(
    baseThreshold,
    options.prePadMs ?? 30,
    options.postPadMs ?? 40,
    options.maxPauseMs ?? 80,
    options.targetPauseMs ?? 30
  );

  let newTotalSamples = mergedSegments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);

  // Pass 2: If Pass 1 removed less than 60ms (e.g. audio has higher room tone or tighter valleys),
  // use a valley-aware threshold (p90 * 0.24) to trim inter-phrase dips cleanly without touching vocal peaks
  if (totalSamples - newTotalSamples < Math.floor(sampleRate * 0.06)) {
    const valleyThreshold = Math.max(baseThreshold * 1.35, p90 * 0.24);
    const valleySegments = buildTrimmedSegments(valleyThreshold, 22, 28, 60, 18);
    const valleyTotal = valleySegments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
    // Only use Pass 2 if it preserves at least 55% of the audio (so actual words are never lost)
    if (valleyTotal > totalSamples * 0.55 && valleyTotal < newTotalSamples) {
      mergedSegments = valleySegments;
      newTotalSamples = valleyTotal;
    }
  }

  if (newTotalSamples <= 0 || newTotalSamples >= totalSamples) {
    const outBlob =
      audioBuffer.duration > 150
        ? audioBufferToWav(audioBuffer)
        : audioBufferToMp3(audioBuffer, options.kbps || 128);
    return {
      audioBlob: outBlob,
      audioUrl: URL.createObjectURL(outBlob),
      originalDuration: Math.round(originalDuration * 100) / 100,
      newDuration: Math.round(originalDuration * 100) / 100,
      removedSeconds: 0,
    };
  }

  const cleanedBuffer = ctx.createBuffer(numChannels, newTotalSamples, sampleRate);
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.006), 144); // 6ms raised-cosine micro-fade at splice points

  for (let ch = 0; ch < numChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    const dst = cleanedBuffer.getChannelData(ch);
    let writePos = 0;

    for (let sIdx = 0; sIdx < mergedSegments.length; sIdx++) {
      const seg = mergedSegments[sIdx];
      const segLen = seg.end - seg.start;

      for (let i = 0; i < segLen; i++) {
        let sample = src[seg.start + i];

        // Smooth cosine micro-fade at cut boundaries to prevent any click/pop
        if (i < fadeSamples && (sIdx > 0 || seg.start > 0)) {
          const gain = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
          sample *= gain;
        } else if (
          i >= segLen - fadeSamples &&
          (sIdx < mergedSegments.length - 1 || seg.end < totalSamples)
        ) {
          const rem = segLen - 1 - i;
          const gain = 0.5 * (1 - Math.cos((Math.PI * rem) / fadeSamples));
          sample *= gain;
        }

        dst[writePos + i] = sample;
      }

      writePos += segLen;
    }
  }

  const outBlob =
    cleanedBuffer.duration > 150
      ? audioBufferToWav(cleanedBuffer)
      : audioBufferToMp3(cleanedBuffer, options.kbps || 128);
  const audioUrl = URL.createObjectURL(outBlob);
  const newDuration = cleanedBuffer.duration;
  const removedSeconds = Math.max(
    0.01,
    Math.round((originalDuration - newDuration) * 100) / 100
  );

  return {
    audioBlob: outBlob,
    audioUrl,
    originalDuration: Math.round(originalDuration * 100) / 100,
    newDuration: Math.round(newDuration * 100) / 100,
    removedSeconds,
  };
}

// Global high-quality MP3 Download Helper with clean, space-free filenames
export async function downloadSpeechAsMp3(
  audioBlobOrUrl: Blob | string,
  voiceName: string,
  textSnippet: string,
  kbps = 128
): Promise<void> {
  // Preserve already-clean WAV/MP3 streams when decoding isn't needed, or convert via WebAudio
  let outBlob: Blob;
  if (audioBlobOrUrl instanceof Blob && (audioBlobOrUrl.type.includes('wav') || audioBlobOrUrl.type.includes('mp3') || audioBlobOrUrl.type.includes('mpeg'))) {
    outBlob = audioBlobOrUrl;
  } else {
    outBlob = await convertAudioToMp3Blob(audioBlobOrUrl, kbps);
  }

  // Clean all spaces from voice name and text snippet before downloading
  const cleanVoice = cleanFileName(voiceName, 'voice');
  const cleanSnippet = cleanFileName(removeExtraSpaces(textSnippet), 'speech');
  const ext = outBlob.type.includes('wav') ? 'wav' : 'mp3';
  const fileName = `hbl-voicelab-${cleanVoice}-${cleanSnippet}.${ext}`;

  const url = URL.createObjectURL(outBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Convert AudioBuffer to WAV Blob for offline downloads & playback
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let result: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    result = new Float32Array(left.length + right.length);
    for (let i = 0; i < left.length; i++) {
      result[i * 2] = left[i];
      result[i * 2 + 1] = right[i];
    }
  } else {
    result = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = result.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length minus RIFF identifier & file length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Fast pure-JS WAV chunk parser for zero-overhead PCM extraction
function parseWavChunkBytes(arrayBuffer: ArrayBuffer): {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  pcmBytes: Uint8Array;
} | null {
  if (arrayBuffer.byteLength < 44) return null;
  const view = new DataView(arrayBuffer);
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  if (riff !== 'RIFF' || wave !== 'WAVE') return null;

  let offset = 12;
  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= arrayBuffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;

    if (chunkId === 'fmt ' && payloadOffset + 16 <= arrayBuffer.byteLength) {
      audioFormat = view.getUint16(payloadOffset, true);
      numChannels = Math.max(1, Math.min(2, view.getUint16(payloadOffset + 2, true)));
      sampleRate = view.getUint32(payloadOffset + 4, true) || 24000;
      bitsPerSample = view.getUint16(payloadOffset + 14, true) || 16;
    } else if (chunkId === 'data') {
      dataOffset = payloadOffset;
      dataSize = Math.min(chunkSize, arrayBuffer.byteLength - payloadOffset);
      break;
    }

    offset = payloadOffset + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || dataSize <= 0 || audioFormat !== 1 || bitsPerSample !== 16) {
    return null;
  }

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    pcmBytes: new Uint8Array(arrayBuffer, dataOffset, dataSize),
  };
}

// Seamlessly stitches any number of audio Blobs (e.g. 25+ chunks for a 50-minute voiceover)
// into a single valid, seekable 16-bit PCM WAV Blob with zero browser freeze or RAM bloat.
export async function stitchAudioBlobsAsWav(
  blobs: Blob[],
  gapMs = 80
): Promise<{ audioBlob: Blob; audioUrl: string; duration: number }> {
  const validBlobs = blobs.filter((b) => b && b.size > 0);
  if (validBlobs.length === 0) {
    const empty = createSilentWavBlob(1.0, 24000);
    return { audioBlob: empty, audioUrl: URL.createObjectURL(empty), duration: 1.0 };
  }
  if (validBlobs.length === 1) {
    const b = validBlobs[0];
    let dur = 2.0;
    try {
      const ab = await b.arrayBuffer();
      const parsed = parseWavChunkBytes(ab);
      if (parsed) {
        dur = parsed.pcmBytes.byteLength / (parsed.sampleRate * parsed.numChannels * 2);
      } else {
        const decoded = await decodeAudioBlobOrUrl(b);
        dur = decoded.duration;
      }
    } catch (_e) {}
    return {
      audioBlob: b,
      audioUrl: URL.createObjectURL(b),
      duration: Math.max(0.5, Math.round(dur * 10) / 10),
    };
  }

  // Inspect first chunk; for multi-chunk long scripts (>2 chunks, e.g. up to 3+ hours), canonicalize
  // to compact 24 kHz mono so RAM and output Blob size stay ~4x smaller (zero browser OOM crash).
  const firstBuf = await validBlobs[0].arrayBuffer();
  const firstParsed = parseWavChunkBytes(firstBuf);
  let targetSampleRate = firstParsed?.sampleRate || 24000;
  let targetChannels = firstParsed?.numChannels || 1;
  if (validBlobs.length > 2) {
    targetSampleRate = 24000;
    targetChannels = 1;
  } else if (!firstParsed) {
    const decoded0 = await decodeAudioBlobOrUrl(validBlobs[0]);
    targetSampleRate = decoded0.sampleRate || 24000;
    targetChannels = Math.min(2, Math.max(1, decoded0.numberOfChannels || 1));
  }

  const blockAlign = targetChannels * 2;
  const gapFrames = Math.max(0, Math.floor((targetSampleRate * gapMs) / 1000));
  const gapSilence: Uint8Array<ArrayBuffer> | null =
    gapFrames > 0 ? new Uint8Array(new ArrayBuffer(gapFrames * blockAlign)) : null;

  const pcmParts: BlobPart[] = [];
  let totalPcmBytes = 0;

  for (let idx = 0; idx < validBlobs.length; idx++) {
    const ab = idx === 0 ? firstBuf : await validBlobs[idx].arrayBuffer();
    const parsed = parseWavChunkBytes(ab);

    let chunkPcm: Uint8Array<ArrayBuffer>;
    if (
      parsed &&
      parsed.sampleRate === targetSampleRate &&
      parsed.numChannels === targetChannels
    ) {
      // Zero-decode fast path (used for 99.9% of Gemini WAV chunks!)
      chunkPcm = new Uint8Array(new ArrayBuffer(parsed.pcmBytes.byteLength));
      chunkPcm.set(parsed.pcmBytes);
    } else {
      // Decode MP3 or differing-rate WAV chunk and convert to canonical 16-bit PCM
      const decoded = await decodeAudioBlobOrUrl(validBlobs[idx]);
      const srcRate = decoded.sampleRate;
      const outFrames = Math.max(1, Math.round((decoded.length * targetSampleRate) / srcRate));
      const outBytes = new Uint8Array(new ArrayBuffer(outFrames * blockAlign));
      const outView = new DataView(outBytes.buffer);
      const ratio = srcRate / targetSampleRate;

      for (let ch = 0; ch < targetChannels; ch++) {
        const srcData = decoded.getChannelData(Math.min(ch, decoded.numberOfChannels - 1));
        for (let i = 0; i < outFrames; i++) {
          const srcPos = i * ratio;
          const s0 = Math.floor(srcPos);
          const s1 = Math.min(srcData.length - 1, s0 + 1);
          const frac = srcPos - s0;
          const val = (srcData[s0] || 0) * (1 - frac) + (srcData[s1] || 0) * frac;
          const clamped = Math.max(-1, Math.min(1, val));
          outView.setInt16(
            (i * targetChannels + ch) * 2,
            clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
            true
          );
        }
      }
      chunkPcm = outBytes;
    }

    // Apply tiny 3ms linear micro-fade at chunk edges to prevent boundary clicks
    const fadeFrames = Math.min(Math.floor(targetSampleRate * 0.003), Math.floor(chunkPcm.byteLength / blockAlign / 4));
    if (fadeFrames > 2) {
      const pcmView = new DataView(chunkPcm.buffer, chunkPcm.byteOffset, chunkPcm.byteLength);
      const totalFrames = Math.floor(chunkPcm.byteLength / blockAlign);
      for (let f = 0; f < fadeFrames; f++) {
        const gainIn = f / fadeFrames;
        const gainOut = f / fadeFrames;
        for (let ch = 0; ch < targetChannels; ch++) {
          const inOff = (f * targetChannels + ch) * 2;
          pcmView.setInt16(inOff, Math.round(pcmView.getInt16(inOff, true) * gainIn), true);

          const outFrame = totalFrames - 1 - f;
          const outOff = (outFrame * targetChannels + ch) * 2;
          pcmView.setInt16(outOff, Math.round(pcmView.getInt16(outOff, true) * gainOut), true);
        }
      }
    }

    pcmParts.push(chunkPcm);
    totalPcmBytes += chunkPcm.byteLength;

    if (gapSilence && idx < validBlobs.length - 1) {
      pcmParts.push(gapSilence);
      totalPcmBytes += gapSilence.byteLength;
    }
  }

  const header = new ArrayBuffer(44);
  const hView = new DataView(header);
  writeString(hView, 0, 'RIFF');
  hView.setUint32(4, 36 + totalPcmBytes, true);
  writeString(hView, 8, 'WAVE');
  writeString(hView, 12, 'fmt ');
  hView.setUint32(16, 16, true);
  hView.setUint16(20, 1, true);
  hView.setUint16(22, targetChannels, true);
  hView.setUint32(24, targetSampleRate, true);
  hView.setUint32(28, targetSampleRate * blockAlign, true);
  hView.setUint16(32, blockAlign, true);
  hView.setUint16(34, 16, true);
  writeString(hView, 36, 'data');
  hView.setUint32(40, totalPcmBytes, true);

  const combinedBlob = new Blob([header, ...pcmParts], { type: 'audio/wav' });
  const totalDuration = totalPcmBytes / (targetSampleRate * blockAlign);

  return {
    audioBlob: combinedBlob,
    audioUrl: URL.createObjectURL(combinedBlob),
    duration: Math.max(0.5, Math.round(totalDuration * 10) / 10),
  };
}

// Extract waveform peaks from an AudioBuffer or Audio element
export async function extractWaveformPeaks(audioBlobOrUrl: Blob | string, samplesCount = 64): Promise<number[]> {
  try {
    const audioBuffer = await decodeAudioBlobOrUrl(audioBlobOrUrl);
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / samplesCount));
    const peaks: number[] = [];

    for (let i = 0; i < samplesCount; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      const avg = sum / blockSize;
      peaks.push(Math.max(0.08, Math.min(1, avg * 3.8)));
    }

    return peaks;
  } catch (e) {
    // Return aesthetic simulated peaks on failure
    return Array.from({ length: samplesCount }, (_, i) => {
      const sin = Math.sin((i / samplesCount) * Math.PI * 4);
      return Math.max(0.15, Math.abs(sin) * 0.8 + Math.random() * 0.2);
    });
  }
}

// Acoustic Voice Analysis for Voice Cloning (pitch F0, formant centroids, clarity, rhythm, WPM)
export async function analyzeVoiceRecording(audioBlob: Blob): Promise<{
  estimatedPitchHz: number;
  pitchRegister: 'bass' | 'baritone' | 'tenor' | 'alto' | 'soprano';
  timbreDescription: string;
  energyEnvelope: number;
  durationSeconds: number;
  recommendedBaseVoice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  clarityScore: number;
  formantShift: number;
  pitchOffset: number;
  speakingRateWpm: number;
  waveformPeaks: number[];
}> {
  try {
    const audioBuffer = await decodeAudioBlobOrUrl(audioBlob);
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // 1. Calculate Average Pitch & Variance using Autocorrelation
    let sumPitch = 0;
    let pitchCount = 0;
    const detectedPitches: number[] = [];
    const windowSize = 2048;

    for (let i = 0; i < data.length - windowSize; i += Math.floor(windowSize * 1.5)) {
      const pitch = autoCorrelate(data.subarray(i, i + windowSize), sampleRate);
      if (pitch > 65 && pitch < 450) {
        sumPitch += pitch;
        pitchCount++;
        detectedPitches.push(pitch);
      }
    }

    const avgPitch = pitchCount > 0 ? Math.round(sumPitch / pitchCount) : 132;

    // 2. Classify Register & Closest Base Neural Voice
    let register: 'bass' | 'baritone' | 'tenor' | 'alto' | 'soprano';
    let recommendedBase: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
    let baseCenterHz = 130;

    if (avgPitch < 112) {
      register = 'bass';
      recommendedBase = 'Charon';
      baseCenterHz = 98;
    } else if (avgPitch < 146) {
      register = 'baritone';
      recommendedBase = 'Fenrir';
      baseCenterHz = 128;
    } else if (avgPitch < 185) {
      register = 'tenor';
      recommendedBase = 'Puck';
      baseCenterHz = 162;
    } else if (avgPitch < 235) {
      register = 'alto';
      recommendedBase = 'Kore';
      baseCenterHz = 208;
    } else {
      register = 'soprano';
      recommendedBase = 'Zephyr';
      baseCenterHz = 255;
    }

    // Fine-tune semitone offset from base neural voice center
    const semitoneDiff = 12 * Math.log2(avgPitch / baseCenterHz);
    const pitchOffset = Math.max(-4, Math.min(4, Math.round(semitoneDiff * 10) / 10));

    // 3. Calculate RMS Energy, Noise Floor, Clarity Score & Zero-Crossing Rate (Formant Warmth)
    let sumSq = 0;
    let zeroCrossings = 0;
    const frameSize = Math.max(1, Math.floor(sampleRate * 0.02));
    const frameRmsList: number[] = [];
    let syllablePeaks = 0;
    let prevRms = 0;

    for (let i = 0; i < data.length; i++) {
      sumSq += data[i] * data[i];
      if (i > 0 && ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0))) {
        zeroCrossings++;
      }
    }

    for (let f = 0; f < data.length - frameSize; f += frameSize) {
      let fSum = 0;
      for (let j = 0; j < frameSize; j++) {
        const s = data[f + j];
        fSum += s * s;
      }
      const fRms = Math.sqrt(fSum / frameSize);
      frameRmsList.push(fRms);
      if (fRms > 0.035 && prevRms <= 0.035) {
        syllablePeaks++;
      }
      prevRms = fRms;
    }

    const rms = Math.sqrt(sumSq / Math.max(1, data.length));
    const sortedFrames = [...frameRmsList].sort((a, b) => a - b);
    const p15Noise = sortedFrames[Math.floor(sortedFrames.length * 0.15)] || 0.002;
    const p90Signal = sortedFrames[Math.floor(sortedFrames.length * 0.9)] || 0.1;
    const snrRatio = p90Signal / Math.max(0.0005, p15Noise);
    const clarityScore = Math.max(74, Math.min(99, Math.round(68 + Math.log10(Math.max(1, snrRatio)) * 18)));

    // Zero crossing rate per second estimates spectral brightness vs chest warmth
    const zcrPerSec = zeroCrossings / Math.max(0.5, audioBuffer.duration);
    // Lower ZCR = warmer/chesty (-formantShift), Higher ZCR = brighter (+formantShift)
    const rawFormant = (zcrPerSec - 2200) / 600;
    const formantShift = Math.max(-4, Math.min(4, Math.round(rawFormant * 10) / 10));

    // Estimate speaking pace in WPM from syllable onsets
    const activeDurationMin = Math.max(0.05, audioBuffer.duration / 60);
    const rawWpm = Math.round((syllablePeaks / 1.45) / activeDurationMin);
    const speakingRateWpm = Math.max(95, Math.min(210, rawWpm || 142));

    const warmthWord = formantShift <= -1 ? 'warm chest-resonant' : formantShift >= 1 ? 'crisp high-presence' : 'balanced studio';
    const timbre =
      avgPitch < 125
        ? `Deep, ${warmthWord} baritone-bass resonance (${avgPitch} Hz) with rich lower harmonics`
        : avgPitch < 175
        ? `Natural, ${warmthWord} mid-register articulation (${avgPitch} Hz) with smooth vocal texture`
        : `Clear, ${warmthWord} expressive register (${avgPitch} Hz) with high vocal intelligibility`;

    const waveformPeaks = await extractWaveformPeaks(audioBlob, 48);

    return {
      estimatedPitchHz: avgPitch,
      pitchRegister: register,
      timbreDescription: timbre,
      energyEnvelope: Math.round(rms * 100) / 100,
      durationSeconds: Math.round(audioBuffer.duration * 10) / 10,
      recommendedBaseVoice: recommendedBase,
      clarityScore,
      formantShift,
      pitchOffset,
      speakingRateWpm,
      waveformPeaks,
    };
  } catch (err) {
    // Graceful fallback if browser audio blob is non-standard
    return {
      estimatedPitchHz: 134,
      pitchRegister: 'baritone',
      timbreDescription: 'Warm, balanced studio resonance with natural articulation',
      energyEnvelope: 0.18,
      durationSeconds: 6.5,
      recommendedBaseVoice: 'Fenrir',
      clarityScore: 92,
      formantShift: 0,
      pitchOffset: 0,
      speakingRateWpm: 140,
      waveformPeaks: Array.from({ length: 48 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 0.35))),
    };
  }
}

// DSP Voice Clone Matcher: Applies subtle pitch, chest warmth, formant presence, and studio compression
// to match a cloned speaker's acoustic profile on top of the synthesized audio
export async function applyVoiceCloneDsp(
  audioBlob: Blob,
  profile?: {
    pitchOffset?: number;
    formantShift?: number;
    reverbLevel?: number;
    tone?: string;
    asWav?: boolean;
    skipRateShift?: boolean;
  },
  kbps = 128
): Promise<{ audioBlob: Blob; audioUrl: string; duration: number }> {
  try {
    const srcBuffer = await decodeAudioBlobOrUrl(audioBlob);
    const pitchSemitones = Math.max(-4, Math.min(4, profile?.pitchOffset || 0));
    const formant = Math.max(-4, Math.min(4, profile?.formantShift || 0));
    const isDocumentaryDeep = profile?.tone === 'documentary_deep';
    const isPsychology = profile?.tone === 'psychology';
    const isHorror = profile?.tone === 'horror';

    // When WSOLA baritone conversion already shifted pitch, skip secondary rate resampling to prevent double-shift robotic artifacts
    const tonePitchBias = isPsychology ? -0.8 : isHorror ? -1.2 : 0;
    const rateRatio = profile?.skipRateShift
      ? 1.0
      : Math.pow(2, ((pitchSemitones + tonePitchBias) * 0.35) / 12);
    let targetSampleRate = srcBuffer.sampleRate;
    let outLength = Math.max(1, Math.floor(srcBuffer.length / rateRatio));
    let offlineCtx: OfflineAudioContext;

    try {
      offlineCtx = new OfflineAudioContext(
        srcBuffer.numberOfChannels,
        outLength,
        targetSampleRate
      );
    } catch (_srErr) {
      // Mobile browsers (e.g. iOS Safari) require >= 44100 Hz for OfflineAudioContext
      targetSampleRate = 44100;
      outLength = Math.max(1, Math.floor((srcBuffer.duration / rateRatio) * targetSampleRate));
      offlineCtx = new OfflineAudioContext(
        srcBuffer.numberOfChannels,
        outLength,
        targetSampleRate
      );
    }

    const source = offlineCtx.createBufferSource();
    source.buffer = srcBuffer;
    source.playbackRate.value = rateRatio;

    // 1. Sub-bass / Chest Warmth Low-Shelf Filter (185 Hz)
    const lowShelf = offlineCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 185;
    const toneLowBoost = isDocumentaryDeep ? 2.5 : isPsychology ? 2.0 : isHorror ? 2.2 : 0;
    lowShelf.gain.value = toneLowBoost - formant * 0.9 - pitchSemitones * 0.5;

    // 2. Vocal Formant Body & Analytical Diction Peaking Filter (1500 Hz - 2200 Hz)
    const formantFilter = offlineCtx.createBiquadFilter();
    formantFilter.type = 'peaking';
    formantFilter.frequency.value = isPsychology ? 2150 : 1500 + formant * 95;
    formantFilter.Q.value = 1.0;
    formantFilter.gain.value = isPsychology ? 1.6 : Math.abs(formant) * 0.9;

    // 3. Studio Air / Presence High-Shelf Filter (5200 Hz)
    const highShelf = offlineCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 5200;
    highShelf.gain.value = (isPsychology ? 1.2 : 1.0) + formant * 0.6;

    // 4. Gentle Studio Vocal Compressor for cohesive cloned timbre
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 2.2;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.15;

    source.connect(lowShelf);
    lowShelf.connect(formantFilter);
    formantFilter.connect(highShelf);
    highShelf.connect(compressor);
    compressor.connect(offlineCtx.destination);

    source.start(0);
    const rendered = await offlineCtx.startRendering();
    const outBlob =
      profile?.asWav || rendered.duration > 150
        ? audioBufferToWav(rendered)
        : audioBufferToMp3(rendered, kbps);
    return {
      audioBlob: outBlob,
      audioUrl: URL.createObjectURL(outBlob),
      duration: Math.round(rendered.duration * 100) / 100,
    };
  } catch (e) {
    // Fallback cleanly to original playable audio blob if DSP rendering is unsupported
    return {
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
      duration: 3.0,
    };
  }
}

// Autocorrelation algorithm for fundamental frequency detection
function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let sum = 0;
  for (let i = 0; i < SIZE; i++) {
    sum += buffer[i] * buffer[i];
  }
  const rootMeanSquare = Math.sqrt(sum / SIZE);
  if (rootMeanSquare < 0.01) return -1; // Not enough signal

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }

  const buf = buffer.subarray(r1, r2);
  const c = new Float32Array(buf.length).fill(0);
  for (let i = 0; i < buf.length; i++) {
    for (let j = 0; j < buf.length - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < buf.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  let T0 = maxpos;

  if (T0 === -1) return -1;
  return sampleRate / T0;
}

// Helper: build a clean zero-byte silent PCM WAV blob without needing AudioContext
function createSilentWavBlob(durationSec: number, sampleRate = 8000): Blob {
  const numSamples = Math.max(sampleRate, Math.floor(sampleRate * durationSec));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: 'audio/wav' });
}

export function stopBrowserVoice(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_e) {
      // Ignore
    }
  }
}

export function speakWithBrowserVoice(
  text: string,
  options: {
    voiceGender?: 'male' | 'female' | 'neutral';
    pitchOffset?: number;
    speed?: number;
    onEnd?: () => void;
  } = {}
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const cleanText = removeExtraSpaces(
    text
      .replace(/\[.*?\]/g, ' ')
      .replace(/<.*?>/g, ' ')
      .replace(/\|.*?\|/g, ' ')
  );
  if (!cleanText) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const femaleRegex = /female|woman|girl|samantha|zira|hazel|susan|victoria|karen|aria|jenny|ava|emma|michelle|libby|sonia|veena|lekha|heera|swara|kalpana|uzma|google us english|google uk english female/i;
    const maleRegex = /\bmale\b|man\b|guy|david|mark|daniel|alex|aaron|andrew|brian|christopher|ryan|matthew|james|george|arthur|oliver|fred|ravi|rishi|prabhat|madhur|asad|salman|hemant|google uk english male/i;

    let selectedVoice: SpeechSynthesisVoice | undefined;
    if (options.voiceGender === 'female') {
      selectedVoice =
        voices.find((v) => v.lang.startsWith('en') && femaleRegex.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];
    } else if (options.voiceGender === 'male') {
      selectedVoice =
        voices.find((v) => v.lang.startsWith('en') && maleRegex.test(v.name) && !femaleRegex.test(v.name)) ||
        voices.find((v) => maleRegex.test(v.name) && !femaleRegex.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en') && !femaleRegex.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];
    } else {
      selectedVoice = voices.find((v) => v.lang.startsWith('en')) || voices[0];
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    const matchedFemaleSystemForMale =
      options.voiceGender === 'male' && (!selectedVoice || femaleRegex.test(selectedVoice.name));
    const basePitch =
      options.voiceGender === 'female'
        ? 1.12
        : matchedFemaleSystemForMale
        ? 0.58
        : options.voiceGender === 'male'
        ? 0.8
        : 1.0;
    utterance.rate = Math.max(0.5, Math.min(2.0, options.speed || 1.0));
    utterance.pitch = Math.max(0.45, Math.min(1.6, basePitch + (options.pitchOffset || 0) * 0.06));
    if (options.onEnd) {
      utterance.onend = options.onEnd;
      utterance.onerror = options.onEnd;
    }
    window.speechSynthesis.speak(utterance);
  } catch (_err) {
    // Ignore speech synthesis errors
  }
}

// Tempo-preserving phase-locked WSOLA pitch + chest warmth converter:
// Transforms female fallback TTS (~205 Hz) into a natural smooth male baritone (~145 Hz, 1.0x speed)
// with unvoiced consonant preservation and zero octave-jump robotic warble.
export async function convertFemaleStreamToMaleBaritone(
  audioBlob: Blob,
  pitchFactor = 0.72
): Promise<{ audioBlob: Blob; audioUrl: string; duration: number }> {
  try {
    const srcBuffer = await decodeAudioBlobOrUrl(audioBlob);
    const sampleRate = srcBuffer.sampleRate;
    const numChannels = srcBuffer.numberOfChannels;
    const srcLen = srcBuffer.length;
    if (srcLen < 512) {
      return {
        audioBlob,
        audioUrl: URL.createObjectURL(audioBlob),
        duration: Math.round(srcBuffer.duration * 100) / 100,
      };
    }

    const safePitch = Math.max(0.62, Math.min(0.95, pitchFactor));
    const winSize = Math.max(256, Math.floor(sampleRate * 0.036) & ~1); // ~36ms even window
    const hop = winSize / 2; // Exact 50% Hann overlap -> unity sum
    // Tight ±6.5ms search locks cleanly onto a single pitch period (~5ms at 200Hz) without octave-jump warble
    const maxSeek = Math.max(16, Math.floor(sampleRate * 0.0065));
    const hann = new Float32Array(winSize);
    for (let i = 0; i < winSize; i++) {
      hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / winSize));
    }

    // Sample-rate invariant 1-pole low-pass for smooth chest warmth (~3600 Hz corner)
    const lpOmega = (2 * Math.PI * 3600) / sampleRate;
    const lpAlpha = Math.min(0.85, lpOmega / (1 + lpOmega));
    const voicedEnergyThreshold = 0.00018 * Math.max(1, Math.floor(hop / 8));

    const ctx = getAudioContext();
    const shiftedChannels: Float32Array[] = [];

    for (let ch = 0; ch < numChannels; ch++) {
      const src = srcBuffer.getChannelData(ch);

      // Step 1: Phase-locked WSOLA time-compression to exact length `n * safePitch`
      const compLen = Math.max(winSize + 4, Math.ceil(srcLen * safePitch) + winSize);
      const comp = new Float32Array(compLen);
      const compNorm = new Float32Array(compLen);
      for (let i = 0; i < Math.min(winSize, srcLen); i++) {
        comp[i] = src[i] * hann[i];
        compNorm[i] = hann[i];
      }
      for (let i = 0; i < Math.min(hop, srcLen); i++) {
        comp[i] = src[i];
        compNorm[i] = 1;
      }

      let prevInPos = 0;
      for (let outPos = hop; outPos + winSize < compLen; outPos += hop) {
        const nominalIn = Math.round(outPos / safePitch);
        const naturalCont = prevInPos + hop;
        const searchCenter = Math.max(0, Math.min(srcLen - winSize - 1, nominalIn));

        let bestOffset = searchCenter;
        const lo = Math.max(0, searchCenter - maxSeek);
        const hi = Math.min(srcLen - winSize - 1, searchCenter + maxSeek);
        const refStart = Math.max(0, Math.min(srcLen - hop - 1, naturalCont));

        // Unvoiced / silence energy gate: keep nominal alignment on sibilants/pauses so consonants stay crisp
        let refEnergy = 0;
        for (let i = 0; i < hop; i += 8) {
          const a = src[refStart + i];
          refEnergy += a * a;
        }

        if (refEnergy >= voicedEnergyThreshold) {
          // Stage 1: Fast coarse search (step 3, stride 8)
          let coarseBest = searchCenter;
          let coarseScore = -Infinity;
          for (let cand = lo; cand <= hi; cand += 3) {
            let dot = 0;
            let e1 = 0;
            let e2 = 0;
            for (let i = 0; i < hop; i += 8) {
              const a = src[refStart + i];
              const b = src[cand + i];
              dot += a * b;
              e1 += a * a;
              e2 += b * b;
            }
            const corr = dot / (Math.sqrt(e1 * e2) + 1e-8);
            if (corr > coarseScore) {
              coarseScore = corr;
              coarseBest = cand;
            }
          }

          // Stage 2: Exact 1-sample fine search around coarse peak
          let bestScore = -Infinity;
          const fineLo = Math.max(lo, coarseBest - 3);
          const fineHi = Math.min(hi, coarseBest + 3);
          for (let cand = fineLo; cand <= fineHi; cand++) {
            let dot = 0;
            let e1 = 0;
            let e2 = 0;
            for (let i = 0; i < hop; i += 4) {
              const a = src[refStart + i];
              const b = src[cand + i];
              dot += a * b;
              e1 += a * a;
              e2 += b * b;
            }
            const corr = dot / (Math.sqrt(e1 * e2) + 1e-8);
            if (corr > bestScore) {
              bestScore = corr;
              bestOffset = cand;
            }
          }

          // If correlation is weak (unvoiced consonant transition), avoid jumping away from nominal
          if (bestScore < 0.25) {
            bestOffset = searchCenter;
          }
        }

        for (let i = 0; i < winSize; i++) {
          if (bestOffset + i < srcLen) {
            comp[outPos + i] += src[bestOffset + i] * hann[i];
            compNorm[outPos + i] += hann[i];
          }
        }
        prevInPos = bestOffset;
      }

      for (let i = 0; i < compLen; i++) {
        if (compNorm[i] > 0.08) {
          comp[i] /= Math.max(0.25, compNorm[i]);
        } else {
          comp[i] = 0;
        }
      }

      // Step 2: Cubic Hermite interpolation back to original length `srcLen` (lowers F0 smoothly, keeps 1.0x speed)
      const out = new Float32Array(srcLen);
      let lp = 0;
      for (let i = 0; i < srcLen; i++) {
        const pos = i * safePitch;
        const idx = Math.floor(pos);
        const f = pos - idx;
        const y0 = comp[Math.max(0, idx - 1)] || 0;
        const y1 = comp[Math.min(compLen - 1, idx)] || 0;
        const y2 = comp[Math.min(compLen - 1, idx + 1)] || 0;
        const y3 = comp[Math.min(compLen - 1, idx + 2)] || 0;
        const c0 = y1;
        const c1 = 0.5 * (y2 - y0);
        const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
        const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
        const sample = ((c3 * f + c2) * f + c1) * f + c0;

        // Subtle warm chest presence normalized to sampleRate while preserving consonant clarity
        lp = lp + lpAlpha * (sample - lp);
        const warm = sample * 0.85 + lp * 0.18;
        out[i] = Math.max(-0.98, Math.min(0.98, warm));
      }
      shiftedChannels.push(out);
    }

    const outBuffer = ctx.createBuffer(numChannels, srcLen, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      outBuffer.getChannelData(ch).set(shiftedChannels[ch]);
    }

    const outBlob = audioBufferToWav(outBuffer);
    return {
      audioBlob: outBlob,
      audioUrl: URL.createObjectURL(outBlob),
      duration: Math.round(outBuffer.duration * 100) / 100,
    };
  } catch (_err) {
    return {
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
      duration: 3.0,
    };
  }
}

// OFFLINE SPEECH SYNTHESIS (Uses real browser SpeechSynthesis voice instead of sine-wave noise!)
export async function synthesizeOfflineSpeech(
  text: string,
  options: {
    voiceGender?: 'male' | 'female' | 'neutral';
    pitchOffset?: number; // -5 to +5
    speed?: number; // 0.5 - 2.0
    stability?: number;
    timbre?: string;
    autoSpeak?: boolean;
  } = {}
): Promise<{ audioBlob: Blob; audioUrl: string; duration: number; spokenText: string; isWebSpeechOnly: boolean }> {
  const cleanText = removeExtraSpaces(
    text
      .replace(/\[.*?\]/g, ' ')
      .replace(/<.*?>/g, ' ')
      .replace(/\|.*?\|/g, ' ')
  );

  if (!cleanText) {
    throw new Error('Please enter text to synthesize.');
  }

  const tokens = cleanText.split(/\s+/).filter(Boolean);
  const rate = Math.max(0.5, Math.min(2.0, options.speed || 1.0));
  const estSeconds = Math.max(1.2, Math.round(((tokens.length / 2.6) / rate) * 100) / 100);

  if (options.autoSpeak !== false) {
    speakWithBrowserVoice(cleanText, {
      voiceGender: options.voiceGender,
      pitchOffset: options.pitchOffset,
      speed: rate,
    });
  }

  // Create a clean silent WAV timeline placeholder (NO buzzing sine waves or white noise!)
  const wavBlob = createSilentWavBlob(estSeconds, 8000);
  const audioUrl = URL.createObjectURL(wavBlob);

  return {
    audioBlob: wavBlob,
    audioUrl,
    duration: estSeconds,
    spokenText: cleanText,
    isWebSpeechOnly: true,
  };
}

// ============================================================================
// 100% COPYRIGHT-FREE MOOD & VOICE ADAPTIVE BACKGROUND MUSIC ENGINE
// Procedurally synthesizes subtle ("dheema") yet deeply impactful cinematic
// background scores tailored to each voice, tone, and script mood with
// automatic vocal sidechain ducking.
// ============================================================================

export type ResolvedMusicMood = Exclude<BackgroundMusicMood, 'auto' | 'none'>;

// Deterministically hash text + voice so every script/voice combination gets a unique musical variation
function computeMusicSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

// Smart detector: Analyzes script text (English + Roman Urdu/Hindi), voice tone, and speaker profile
// to choose the most fitting background music mood when 'auto' is selected.
export function detectBestMusicMood(options: {
  text: string;
  tone?: string;
  voiceName?: string;
  voiceDescription?: string;
  voiceUseCase?: string;
}): ResolvedMusicMood {
  const {
    text = '',
    tone = 'natural',
    voiceName = '',
    voiceDescription = '',
    voiceUseCase = '',
  } = options;

  const lowerText = text.toLowerCase();
  const lowerVoice = `${voiceName} ${voiceDescription} ${voiceUseCase}`.toLowerCase();

  // 1. Explicit Tone Override if user chose a specific mood tone
  if (tone === 'psychology') return 'psychology';
  if (tone === 'horror') return 'horror';
  if (tone === 'motivational') return 'motivational';

  // 2. Script Keyword Scoring (Supports English + Roman Urdu/Hindi)
  const psychologyRegex =
    /\b(psychology|psychological|mind|brain|subconscious|unconscious|behavior|behaviour|human nature|manipulation|narcissist|iq|cognitive|intelligence|overthinking|thinking|thought|thoughts|trauma|attachment|dopamine|habit|habits|personality|introvert|extrovert|empathy|ego|persuasion|body language|attraction|respect|silence|mental|therapy|dimagh|nafsiyat|insani|soch|zehn|fitrat|aadat|khamoshi|ravaiya|shaksiyat|aqal|samajh)\b/g;
  const horrorRegex =
    /\b(horror|scary|creepy|ghost|haunted|dark|darkness|shadow|blood|scream|nightmare|demon|devil|monster|fear|terrifying|graveyard|dead|death|curse|witch|khauf|khaufnak|dar|darr|bhoot|chudail|jinn|jin|raat|andhera|qabristan|khoon|aatma|saaya|sannata|mout|maut|khatarnak|cheeख|cheekh)\b/g;
  const motivationalRegex =
    /\b(motivat|inspire|inspiring|success|successful|dream|believe|achieve|winner|hustle|grind|discipline|focus|unstoppable|champion|never give up|rise|strength|power|future|goal|ambition|courage|fearless|kamyabi|kamyab|mehnat|hausla|himmat|manzil|jeet|junoon|taqat|zindagi|sapne|khwab|umeed|koshish|bulandi|sikandar)\b/g;
  const emotionalRegex =
    /\b(sad|emotional|cry|crying|tears|heartbreak|broken|lonely|alone|pain|miss you|memory|memories|love|farewell|goodbye|grief|sorrow|dard|aansu|ansu|udaas|tanha|tanhai|mohabbat|ishq|pyar|dil|toota|yaad|yaadein|judai|bewafa|rona|zakhm|ehsaas)\b/g;
  const suspenseRegex =
    /\b(mystery|secret|crime|detective|investigation|case|murder|suspect|evidence|thriller|conspiracy|unknown|hidden|history|documentary|truth|reality|raaz|jurm|tahqeeqat|khoj|sach|haqeeqat|khabar|news|report|ancient)\b/g;
  const calmRegex =
    /\b(calm|peace|peaceful|relax|meditation|breathe|sleep|soothing|gentle|nature|ocean|breeze|zen|mindfulness|sukoon|shanti|neend|aram|khamoshi|subah|dua)\b/g;
  const epicRegex =
    /\b(epic|battle|war|warrior|empire|king|kingdom|legend|hero|heroic|trailer|cinematic|thunder|glory|victory|conquer|jang|badshah|saltanat|fateh|dastan|tareekh)\b/g;

  const scores: Record<ResolvedMusicMood, number> = {
    psychology: (lowerText.match(psychologyRegex) || []).length * 3.1,
    horror: (lowerText.match(horrorRegex) || []).length * 3,
    motivational: (lowerText.match(motivationalRegex) || []).length * 3,
    emotional: (lowerText.match(emotionalRegex) || []).length * 2.8,
    suspense: (lowerText.match(suspenseRegex) || []).length * 2.5,
    calm: (lowerText.match(calmRegex) || []).length * 2.5,
    epic: (lowerText.match(epicRegex) || []).length * 2.6,
    lofi: 0,
  };

  // 3. Factor in Voice Tone & Speaker Profile
  if (tone === 'energetic' || tone === 'authoritative') {
    scores.motivational += 2.5;
  } else if (tone === 'documentary_deep' || tone === 'serious') {
    scores.suspense += 2.5;
    scores.psychology += 1.5;
  } else if (tone === 'dramatic') {
    scores.epic += 2.5;
    scores.horror += 1.2;
  } else if (tone === 'calm' || tone === 'whispery') {
    scores.calm += 3.0;
  } else if (tone === 'warm' || tone === 'storytelling') {
    scores.emotional += 2.2;
  } else if (tone === 'conversational' || tone === 'cheerful') {
    scores.lofi += 2.5;
  }

  if (/psycholog|mind|philosophy|thinker|analytical|insight|wisdom/.test(lowerVoice)) {
    scores.psychology += 2.4;
  }
  if (/horror|thriller|creepy|dark|mystery/.test(lowerVoice)) scores.horror += 2.0;
  if (/motivat|coach|trainer|keynote|inspire|energetic/.test(lowerVoice)) scores.motivational += 2.2;
  if (/documentary|news|journalist|history|investigative|deep/.test(lowerVoice)) scores.suspense += 1.8;
  if (/meditation|asmr|sleep|calm|soothing|yoga/.test(lowerVoice)) scores.calm += 2.2;
  if (/story|audiobook|poet|drama|emotional/.test(lowerVoice)) scores.emotional += 1.8;
  if (/trailer|epic|cinema|movie|gaming/.test(lowerVoice)) scores.epic += 2.0;
  if (/podcast|casual|vlog|chat|conversational/.test(lowerVoice)) scores.lofi += 1.8;

  // Pick highest scoring mood
  let bestMood: ResolvedMusicMood = 'motivational';
  let bestScore = -1;
  (Object.keys(scores) as ResolvedMusicMood[]).forEach((m) => {
    if (scores[m] > bestScore) {
      bestScore = scores[m];
      bestMood = m;
    }
  });

  // If no strong signals, choose based on voice characteristics so different voices get distinct music
  if (bestScore <= 0.5) {
    const seed = computeMusicSeed(lowerVoice || lowerText || 'default');
    const fallbackMoods: ResolvedMusicMood[] = [
      'psychology',
      'motivational',
      'emotional',
      'suspense',
      'calm',
      'lofi',
    ];
    return fallbackMoods[seed % fallbackMoods.length];
  }

  return bestMood;
}

// Synthesizes a 100% copyright-free multi-layered background score into a Float32Array
// matched to the resolved mood, voice pitch/gender, and a unique seed so it never sounds repetitive.
function generateProceduralScoreSamples(options: {
  mood: ResolvedMusicMood;
  totalSamples: number;
  sampleRate: number;
  seed: number;
  voicePitchShift?: number;
  timeOffsetSec?: number;
}): Float32Array {
  const { mood, totalSamples, sampleRate, seed, timeOffsetSec = 0 } = options;
  const out = new Float32Array(totalSamples);

  // Use the seed to pick a unique musical root frequency (between C2=65.4Hz and G2=98Hz)
  // shifted slightly so every voice/script has its own harmonic signature
  const rootMidiOptions = [36, 38, 39, 40, 41, 43, 45]; // C2, D2, Eb2, E2, F2, G2, A2
  const baseMidi = rootMidiOptions[seed % rootMidiOptions.length];
  const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

  // Define mood-specific chord progressions (semitone offsets from root), tempo, and texture
  let chords: number[][] = [];
  let chordDurationSec = 4.0;
  let pulseBpm = 0;
  let shimmerLevel = 0.12;
  let subDroneLevel = 0.35;
  let padWarmth = 1.0;

  switch (mood) {
    case 'psychology': {
      // Deep cerebral minor-add9 & suspended-4th analytical progressions (hypnotic "human mind" documentary vibe)
      const psychProgressions = [
        [
          [0, 3, 7, 14], // i(add9)
          [-2, 2, 7, 12], // VII(sus4)
          [-4, 0, 7, 11], // VI(maj7)
          [0, 5, 7, 10], // i7(sus4)
        ],
        [
          [0, 3, 7, 10, 14], // m9
          [-5, -2, 2, 5, 9], // v9
          [-4, 0, 3, 7, 14], // VI(add9)
          [-2, 3, 7, 10, 12], // VII6
        ],
      ];
      chords = psychProgressions[seed % psychProgressions.length];
      chordDurationSec = 3.6 + (seed % 3) * 0.3;
      pulseBpm = 64 + (seed % 5); // Measured 64 BPM cognitive "thinking" pulse
      shimmerLevel = 0.21; // Soft marimba/kalimba-like synapse harmonic plucks
      subDroneLevel = 0.4; // Grounded warm sub-bass pedal
      padWarmth = 1.08;
      break;
    }
    case 'horror': {
      // Dark dissonant minor-second, tritone (devil's interval), and minor-sixth clusters
      const horrorProgressions = [
        [
          [0, 1, 6, 13],
          [0, 3, 6, 11],
          [-2, 1, 6, 12],
          [-1, 0, 6, 14],
        ],
        [
          [0, 6, 11, 13],
          [-3, 0, 6, 10],
          [1, 6, 12, 15],
          [0, 1, 7, 13],
        ],
      ];
      chords = horrorProgressions[seed % horrorProgressions.length];
      chordDurationSec = 4.6 + (seed % 3) * 0.5;
      pulseBpm = 52 + (seed % 7); // Slow, eerie heartbeat tension pulse
      shimmerLevel = 0.22; // Ghostly high eerie harmonic whisper
      subDroneLevel = 0.52; // Deep ominous sub-bass rumble
      padWarmth = 0.75;
      break;
    }
    case 'motivational': {
      // Uplifting cinematic minor-to-major progression (vi - IV - I - V or i - VI - III - VII)
      const motivProgressions = [
        [
          [0, 3, 7, 12, 15], // i
          [-4, 0, 3, 8, 12], // VI
          [3, 7, 10, 15, 19], // III
          [-2, 2, 5, 10, 14], // VII
        ],
        [
          [0, 3, 7, 10, 14], // i7
          [-4, 0, 3, 7, 12], // VI maj7
          [-2, 2, 5, 10, 14], // VII
          [0, 4, 7, 12, 16], // Picardy uplifting Major resolve
        ],
      ];
      chords = motivProgressions[seed % motivProgressions.length];
      chordDurationSec = 3.2 + (seed % 3) * 0.3;
      pulseBpm = 74 + (seed % 9); // Inspiring gentle cinematic heartbeat pulse
      shimmerLevel = 0.2;
      subDroneLevel = 0.42;
      padWarmth = 1.1;
      break;
    }
    case 'emotional': {
      // Warm, heartfelt melancholic minor-9th & major-7th chords with soft felt-piano plucks
      chords = [
        [0, 3, 7, 10, 14], // m9
        [-4, 0, 3, 7, 11], // maj9
        [-7, -4, 0, 3, 7], // iv7
        [-2, 2, 5, 9, 12], // VII6
      ];
      chordDurationSec = 3.8 + (seed % 3) * 0.4;
      pulseBpm = 60 + (seed % 6);
      shimmerLevel = 0.24;
      subDroneLevel = 0.34;
      padWarmth = 1.15;
      break;
    }
    case 'suspense': {
      // Investigative dark documentary minor pedal with tense pulsing bass
      chords = [
        [0, 3, 7, 12],
        [0, 2, 7, 10],
        [0, 3, 8, 12],
        [-2, 2, 7, 10],
      ];
      chordDurationSec = 3.5;
      pulseBpm = 84 + (seed % 8); // Steady investigative pulse
      shimmerLevel = 0.14;
      subDroneLevel = 0.46;
      padWarmth = 0.9;
      break;
    }
    case 'calm': {
      // Serene major-7th / sus2 ambient meditation pad
      chords = [
        [0, 2, 7, 11, 14],
        [-5, -1, 2, 7, 11],
        [-3, 0, 4, 7, 11],
        [0, 4, 7, 11, 14],
      ];
      chordDurationSec = 5.0;
      pulseBpm = 0; // Pure floating ambient pad without rhythmic beat
      shimmerLevel = 0.16;
      subDroneLevel = 0.3;
      padWarmth = 1.2;
      break;
    }
    case 'epic': {
      // Grand power fifths + octave brass/string swell
      chords = [
        [-12, 0, 7, 12, 15],
        [-16, -4, 3, 8, 12],
        [-14, -2, 5, 10, 14],
        [-12, 0, 7, 12, 16],
      ];
      chordDurationSec = 3.0;
      pulseBpm = 68 + (seed % 6);
      shimmerLevel = 0.18;
      subDroneLevel = 0.55;
      padWarmth = 1.05;
      break;
    }
    case 'lofi':
    default: {
      // Cozy warm Neo-soul / Rhodes 7th & 9th chords
      chords = [
        [0, 3, 7, 10, 14],
        [5, 8, 12, 15, 19],
        [3, 7, 10, 14, 17],
        [-2, 2, 5, 9, 12],
      ];
      chordDurationSec = 2.8;
      pulseBpm = 70 + (seed % 6);
      shimmerLevel = 0.15;
      subDroneLevel = 0.32;
      padWarmth = 1.1;
      break;
    }
  }

  const lfoRate1 = 0.14 + ((seed % 7) * 0.02);
  const lfoRate2 = 0.23 + ((seed % 5) * 0.03);
  const pulseIntervalSec = pulseBpm > 0 ? 60 / pulseBpm : 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = timeOffsetSec + i / sampleRate;

    // Smooth crossfade between chords in progression
    const chordFloatIdx = t / chordDurationSec;
    const cIdx1 = Math.floor(chordFloatIdx) % chords.length;
    const cIdx2 = (cIdx1 + 1) % chords.length;
    const chordPos = chordFloatIdx - Math.floor(chordFloatIdx);
    // Cosine crossfade during the last 25% of each chord bar
    const crossfade =
      chordPos > 0.75 ? 0.5 * (1 - Math.cos(((chordPos - 0.75) / 0.25) * Math.PI)) : 0;

    const activeChord1 = chords[cIdx1];
    const activeChord2 = chords[cIdx2];

    // 1. Deep Sub-Bass Drone Layer (warm foundation that never clashes with voice)
    const rootFreq1 = midiToFreq(baseMidi + activeChord1[0]);
    const rootFreq2 = midiToFreq(baseMidi + activeChord2[0]);
    const subSample1 = Math.sin(2 * Math.PI * rootFreq1 * t);
    const subSample2 = Math.sin(2 * Math.PI * rootFreq2 * t);
    let subLayer = (subSample1 * (1 - crossfade) + subSample2 * crossfade) * subDroneLevel;

    // For Horror: add a slow eerie pitch-bending tritone/minor-2nd sub-undertone
    if (mood === 'horror') {
      const eerieBend = Math.sin(2 * Math.PI * 0.18 * t) * 1.4;
      const tritoneFreq = midiToFreq(baseMidi + 6) + eerieBend;
      subLayer += Math.sin(2 * Math.PI * tritoneFreq * t) * 0.22;
    }

    // 2. Lush Warm Harmonic Pad Layer (Octave above root)
    let pad1 = 0;
    for (let n = 0; n < activeChord1.length; n++) {
      const freq = midiToFreq(baseMidi + 12 + activeChord1[n]);
      // Slight chorus detune for warm cinematic width
      const detune = 1 + (n - 1.5) * 0.0018;
      pad1 += Math.sin(2 * Math.PI * freq * detune * t);
    }
    pad1 /= Math.max(1, activeChord1.length);

    let pad2 = 0;
    for (let n = 0; n < activeChord2.length; n++) {
      const freq = midiToFreq(baseMidi + 12 + activeChord2[n]);
      const detune = 1 + (n - 1.5) * 0.0018;
      pad2 += Math.sin(2 * Math.PI * freq * detune * t);
    }
    pad2 /= Math.max(1, activeChord2.length);

    const breathingLfo = 0.78 + 0.22 * Math.sin(2 * Math.PI * lfoRate1 * t);
    const padLayer = (pad1 * (1 - crossfade) + pad2 * crossfade) * 0.36 * padWarmth * breathingLfo;

    // 3. Mood-Specific Melodic / Atmospheric Shimmer Layer
    let shimmerLayer = 0;
    if (mood === 'horror') {
      // Ghostly high-pitched bowed glass / eerie theremin-like harmonic with slow vibrato
      const ghostNote = activeChord1[(Math.floor(t / 1.8) + seed) % activeChord1.length];
      const ghostFreq =
        midiToFreq(baseMidi + 24 + ghostNote) + Math.sin(2 * Math.PI * 4.2 * t) * 3.5;
      const ghostEnv = 0.5 + 0.5 * Math.sin(2 * Math.PI * lfoRate2 * t);
      shimmerLayer = Math.sin(2 * Math.PI * ghostFreq * t) * shimmerLevel * ghostEnv;
    } else {
      // Gentle arpeggiated felt-piano / celesta bell note on each half-bar
      const arpStepDur = chordDurationSec / 4;
      const arpIdx = Math.floor(t / arpStepDur);
      const arpLocalT = t - arpIdx * arpStepDur;
      const noteOffset = activeChord1[(arpIdx + seed) % activeChord1.length];
      const bellFreq = midiToFreq(baseMidi + 24 + noteOffset);
      // Soft attack (25ms) + warm exponential decay
      const attack = Math.min(1, arpLocalT / 0.025);
      const decay = Math.exp(-arpLocalT * (mood === 'motivational' || mood === 'epic' ? 2.4 : 3.2));
      shimmerLayer =
        (Math.sin(2 * Math.PI * bellFreq * t) +
          0.25 * Math.sin(2 * Math.PI * bellFreq * 2 * t)) *
        attack *
        decay *
        shimmerLevel;
    }

    // 4. Soft Cinematic Heartbeat / Pulse Layer (for Motivational, Horror, Suspense, Epic, Lo-Fi)
    let pulseLayer = 0;
    if (pulseIntervalSec > 0) {
      const beatPhase = (t % pulseIntervalSec) / pulseIntervalSec;
      const beatSec = t % pulseIntervalSec;
      if (mood === 'horror') {
        // Double heartbeat thump (lub-dub)
        const lub = beatSec < 0.12 ? Math.sin(2 * Math.PI * 52 * beatSec) * Math.exp(-beatSec * 28) : 0;
        const dubSec = beatSec - 0.18;
        const dub =
          dubSec >= 0 && dubSec < 0.12
            ? Math.sin(2 * Math.PI * 46 * dubSec) * Math.exp(-dubSec * 32) * 0.75
            : 0;
        pulseLayer = (lub + dub) * 0.42;
      } else {
        // Soft deep cinematic tom/heartbeat pulse
        const sweepFreq = 68 - Math.min(28, beatSec * 110);
        const pulseEnv = Math.min(1, beatSec / 0.012) * Math.exp(-beatPhase * 5.5);
        pulseLayer = Math.sin(2 * Math.PI * sweepFreq * beatSec) * pulseEnv * 0.28;
      }
    }

    out[i] = (subLayer + padLayer + shimmerLayer + pulseLayer) * 0.75;
  }

  return out;
}

export interface BgmDialogueSegment {
  weight: number;
  mood: BackgroundMusicMood;
  text?: string;
  tone?: string;
  voiceName?: string;
  voiceDescription?: string;
  voiceUseCase?: string;
}

// Mixes 100% copyright-free mood-adaptive background music underneath generated speech.
// Supports per-voice / per-speaker-block BGM control (`segments`): only speaker blocks where
// the user explicitly enabled BGM (`mood !== 'none'`) receive background music; blocks with
// `mood === 'none'` play pure voiceover without BGM.
export async function mixBackgroundMusicWithSpeech(
  speechBlobOrUrl: Blob | string,
  options: {
    mood: BackgroundMusicMood;
    volume?: number; // 0.05 to 0.45, default 0.18
    text?: string;
    tone?: string;
    voiceName?: string;
    voiceDescription?: string;
    voiceUseCase?: string;
    kbps?: number;
    segments?: BgmDialogueSegment[];
    timeOffsetSec?: number;
    isFirstChunk?: boolean;
    isLastChunk?: boolean;
    asWav?: boolean;
  }
): Promise<{
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
  resolvedMood: ResolvedMusicMood | 'none';
}> {
  const speechBuffer = await decodeAudioBlobOrUrl(speechBlobOrUrl);
  const kbps = options.kbps || 128;
  const timeOffsetSec = options.timeOffsetSec || 0;
  const isFirstChunk = options.isFirstChunk !== false;
  const isLastChunk = options.isLastChunk !== false;

  const activeSegments =
    options.segments && options.segments.length > 0
      ? options.segments
      : [
          {
            weight: Math.max(1, (options.text || '').length),
            mood: options.mood || 'none',
            text: options.text,
            tone: options.tone,
            voiceName: options.voiceName,
            voiceDescription: options.voiceDescription,
            voiceUseCase: options.voiceUseCase,
          },
        ];

  const hasAnyActiveBgm = activeSegments.some((s) => s.mood && s.mood !== 'none');

  if (!hasAnyActiveBgm) {
    const outBlob =
      options.asWav || speechBuffer.duration > 150
        ? audioBufferToWav(speechBuffer)
        : audioBufferToMp3(speechBuffer, kbps);
    return {
      audioBlob: outBlob,
      audioUrl: URL.createObjectURL(outBlob),
      duration: Math.round(speechBuffer.duration * 100) / 100,
      resolvedMood: 'none',
    };
  }

  // Resolve mood for each segment ('none' stays 'none' so BGM is silenced for that speaker)
  const resolvedSegments: {
    weight: number;
    resolvedMood: ResolvedMusicMood | 'none';
    seed: number;
  }[] = activeSegments.map((seg) => {
    if (!seg.mood || seg.mood === 'none') {
      return { weight: Math.max(1, seg.weight), resolvedMood: 'none', seed: 1 };
    }
    const rMood: ResolvedMusicMood =
      seg.mood === 'auto'
        ? detectBestMusicMood({
            text: seg.text ?? options.text ?? '',
            tone: seg.tone ?? options.tone,
            voiceName: seg.voiceName ?? options.voiceName,
            voiceDescription: seg.voiceDescription ?? options.voiceDescription,
            voiceUseCase: seg.voiceUseCase ?? options.voiceUseCase,
          })
        : seg.mood;
    const segSeed = computeMusicSeed(
      `${seg.text || options.text || ''}|${seg.voiceName || options.voiceName || ''}|${seg.tone || options.tone || ''}|${rMood}`
    );
    return {
      weight: Math.max(1, seg.weight),
      resolvedMood: rMood,
      seed: segSeed,
    };
  });

  const primaryResolvedMood: ResolvedMusicMood =
    (resolvedSegments.find((s) => s.resolvedMood !== 'none')?.resolvedMood as ResolvedMusicMood) ||
    'motivational';

  const firstSegHasBgm = resolvedSegments[0]?.resolvedMood !== 'none';
  const lastSegHasBgm = resolvedSegments[resolvedSegments.length - 1]?.resolvedMood !== 'none';

  const sampleRate = speechBuffer.sampleRate;
  const numChannels = speechBuffer.numberOfChannels;
  // Add subtle atmospheric lead-in / tail-out only on outer track boundaries if enabled
  const leadInSamples = isFirstChunk && firstSegHasBgm ? Math.floor(sampleRate * 0.18) : 0;
  const tailOutSamples = isLastChunk && lastSegHasBgm ? Math.floor(sampleRate * 0.55) : 0;
  const totalSamples = leadInSamples + speechBuffer.length + tailOutSamples;

  // Build sample-accurate composite music buffer and per-sample segment gate
  // so speaker blocks with BGM OFF ('none') have zero background music
  const rawMusic = new Float32Array(totalSamples);
  const segmentGate = new Float32Array(totalSamples);
  const totalWeight = resolvedSegments.reduce((acc, s) => acc + s.weight, 0);

  let speechCursor = 0;
  for (let idx = 0; idx < resolvedSegments.length; idx++) {
    const seg = resolvedSegments[idx];
    const segSpeechSamples =
      idx === resolvedSegments.length - 1
        ? speechBuffer.length - speechCursor
        : Math.floor((seg.weight / totalWeight) * speechBuffer.length);

    const startSample = idx === 0 ? 0 : leadInSamples + speechCursor;
    const endSample =
      idx === resolvedSegments.length - 1
        ? totalSamples
        : leadInSamples + speechCursor + segSpeechSamples;
    const segTotalLen = Math.max(0, endSample - startSample);

    if (seg.resolvedMood !== 'none' && segTotalLen > 0) {
      const segSamples = generateProceduralScoreSamples({
        mood: seg.resolvedMood,
        totalSamples: segTotalLen,
        sampleRate,
        seed: seg.seed,
        timeOffsetSec: timeOffsetSec + startSample / sampleRate,
      });

      const fadeSamples = Math.min(Math.floor(sampleRate * 0.28), Math.floor(segTotalLen * 0.25));
      const prevHasBgm =
        (idx > 0 && resolvedSegments[idx - 1].resolvedMood !== 'none') ||
        (idx === 0 && !isFirstChunk);
      const nextHasBgm =
        (idx < resolvedSegments.length - 1 && resolvedSegments[idx + 1].resolvedMood !== 'none') ||
        (idx === resolvedSegments.length - 1 && !isLastChunk);

      for (let i = 0; i < segTotalLen; i++) {
        let gate = 1.0;
        if (!prevHasBgm && fadeSamples > 0 && i < fadeSamples) {
          gate = 0.5 * (1 - Math.cos((i / fadeSamples) * Math.PI));
        } else if (!nextHasBgm && fadeSamples > 0 && i > segTotalLen - fadeSamples) {
          gate = 0.5 * (1 - Math.cos(((segTotalLen - i) / fadeSamples) * Math.PI));
        }
        rawMusic[startSample + i] = segSamples[i];
        segmentGate[startSample + i] = gate;
      }
    }

    speechCursor += segSpeechSamples;
  }

  // Compute vocal envelope in 20ms windows for smooth automatic sidechain ducking
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.02));
  const numWindows = Math.ceil(totalSamples / windowSize);
  const vocalEnv = new Float32Array(numWindows);
  const speechChan0 = speechBuffer.getChannelData(0);

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    let sumSq = 0;
    let count = 0;
    for (let j = 0; j < windowSize; j++) {
      const sIdx = start + j - leadInSamples;
      if (sIdx >= 0 && sIdx < speechBuffer.length) {
        const v = speechChan0[sIdx];
        sumSq += v * v;
        count++;
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    vocalEnv[w] = rms > 0.018 ? 1.0 : rms / 0.018;
  }

  // Smooth the ducking envelope (attack ~40ms, release ~240ms) so volume transitions feel studio-grade
  const smoothedDuck = new Float32Array(numWindows);
  let envState = 0;
  for (let w = 0; w < numWindows; w++) {
    const target = vocalEnv[w];
    if (target > envState) {
      envState = envState * 0.65 + target * 0.35; // Fast duck when voice starts
    } else {
      envState = envState * 0.9 + target * 0.1; // Gentle swell in pauses
    }
    smoothedDuck[w] = envState;
  }

  const ctx = getAudioContext();
  const mixedBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate);
  const targetBgmVol = Math.max(0.04, Math.min(0.45, options.volume ?? 0.18));

  // Simple 1-pole lowpass state to keep BGM warm & velvety ("dheema") so it never masks vocal consonants
  const cutoffAlpha = primaryResolvedMood === 'horror' ? 0.22 : 0.18;

  for (let ch = 0; ch < numChannels; ch++) {
    const speechData = speechBuffer.getChannelData(ch);
    const dst = mixedBuffer.getChannelData(ch);
    let lpState = 0;

    for (let i = 0; i < totalSamples; i++) {
      const sIdx = i - leadInSamples;
      const vocalSample = sIdx >= 0 && sIdx < speechBuffer.length ? speechData[sIdx] : 0;

      // Filter music sample for warm studio backing
      lpState = lpState + cutoffAlpha * (rawMusic[i] - lpState);
      const warmMusicSample = lpState * 0.72 + rawMusic[i] * 0.28;

      // Apply sidechain vocal ducking: when voice is active, BGM ducks to 52% of targetBgmVol
      const wIdx = Math.min(numWindows - 1, Math.floor(i / windowSize));
      const duckFactor = 1.0 - smoothedDuck[wIdx] * 0.48;

      const bgmSample = warmMusicSample * targetBgmVol * duckFactor * segmentGate[i];

      // Soft studio limiter so combined signal never clips
      const combined = vocalSample + bgmSample;
      dst[i] = Math.tanh(combined * 1.05) / Math.tanh(1.05);
    }
  }

  const outBlob =
    options.asWav || mixedBuffer.duration > 150
      ? audioBufferToWav(mixedBuffer)
      : audioBufferToMp3(mixedBuffer, kbps);
  return {
    audioBlob: outBlob,
    audioUrl: URL.createObjectURL(outBlob),
    duration: Math.round(mixedBuffer.duration * 100) / 100,
    resolvedMood: primaryResolvedMood,
  };
}

// Live preview player for background music so users can audition any mood or Auto-Match instantly
let activePreviewSource: AudioBufferSourceNode | null = null;

export function stopBackgroundMusicPreview(): void {
  if (activePreviewSource) {
    try {
      activePreviewSource.stop();
      activePreviewSource.disconnect();
    } catch (_e) {
      // Ignore if already stopped
    }
    activePreviewSource = null;
  }
}

export async function previewBackgroundMusicSample(options: {
  mood: BackgroundMusicMood;
  volume?: number;
  text?: string;
  tone?: string;
  voiceName?: string;
  voiceDescription?: string;
  voiceUseCase?: string;
  onEnded?: () => void;
}): Promise<ResolvedMusicMood | 'none'> {
  stopBackgroundMusicPreview();

  if (options.mood === 'none') {
    options.onEnded?.();
    return 'none';
  }

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const resolvedMood: ResolvedMusicMood =
    options.mood === 'auto'
      ? detectBestMusicMood({
          text: options.text || '',
          tone: options.tone,
          voiceName: options.voiceName,
          voiceDescription: options.voiceDescription,
          voiceUseCase: options.voiceUseCase,
        })
      : options.mood;

  const durationSec = 5.5;
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const seed = computeMusicSeed(
    `${options.text || ''}|${options.voiceName || ''}|${options.tone || ''}|${resolvedMood}`
  );

  const rawSamples = generateProceduralScoreSamples({
    mood: resolvedMood,
    totalSamples,
    sampleRate,
    seed,
  });

  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);
  const fadeIn = Math.floor(sampleRate * 0.4);
  const fadeOut = Math.floor(sampleRate * 0.8);
  const previewGain = Math.min(0.65, Math.max(0.18, (options.volume ?? 0.18) * 1.9));

  let lp = 0;
  for (let i = 0; i < totalSamples; i++) {
    lp = lp + 0.2 * (rawSamples[i] - lp);
    let env = 1.0;
    if (i < fadeIn) env = i / fadeIn;
    else if (i > totalSamples - fadeOut) env = Math.max(0, (totalSamples - i) / fadeOut);
    data[i] = (lp * 0.7 + rawSamples[i] * 0.3) * previewGain * env;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  activePreviewSource = source;

  source.onended = () => {
    if (activePreviewSource === source) {
      activePreviewSource = null;
    }
    options.onEnded?.();
  };

  source.start(0);
  return resolvedMood;
}

