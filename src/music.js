import { PitchDetector } from 'pitchy'

export const SAMPLE_RATE = 16000
export const MAX_SECONDS = 20
export const MIN_MIDI = 36
export const MAX_MIDI = 88
export const TICKS_PER_BEAT = 4
export const TICKS_PER_BAR = 16
export const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export const frequency = midi => 440 * 2 ** ((midi - 69) / 12)
export const midiPitch = hz => 69 + 12 * Math.log2(hz / 440)
export const noteName = midi => PITCH_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function makePitchReader(length, sampleRate) {
  const detector = PitchDetector.forFloat32Array(length)
  detector.minVolumeDecibels = -55
  return samples => {
    const [hz, clarity] = detector.findPitch(samples, sampleRate)
    return clarity >= 0.86 && hz >= 60 && hz <= 1300 ? midiPitch(hz) : null
  }
}

export function compactMono(buffer) {
  const length = Math.min(buffer.length, Math.round(buffer.sampleRate * MAX_SECONDS))
  const ratio = buffer.sampleRate / SAMPLE_RATE
  const result = new Float32Array(Math.floor(length / ratio))
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
  for (let i = 0; i < result.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio))
    let sum = 0
    for (const samples of channels) {
      for (let j = start; j < end; j++) sum += samples[j]
    }
    result[i] = sum / ((end - start) * channels.length)
  }
  return result
}

export function encodeWav(samples) {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const tag = (offset, value) => bytes.set(new TextEncoder().encode(value), offset)
  tag(0, 'RIFF')
  view.setUint32(4, bytes.length - 8, true)
  tag(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  tag(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, Math.round(clamp(samples[i], -1, 1) * 32767), true)
  }
  return new Blob([bytes], { type: 'audio/wav' })
}

export function detectNotes(samples) {
  const length = 960
  const hop = 160
  const readPitch = makePitchReader(length, SAMPLE_RATE)
  const segments = []
  let current
  for (let start = 0; start + length <= samples.length; start += hop) {
    const pitch = readPitch(samples.subarray(start, start + length))
    const candidate = pitch === null ? null : Math.round(pitch)
    const midi = candidate >= MIN_MIDI && candidate <= MAX_MIDI ? candidate : null
    const time = (start + (start === 0 ? 0 : length / 2)) / SAMPLE_RATE
    if (current?.midi !== midi) {
      if (current) current.end = time
      current = { midi, start: time, end: time }
      segments.push(current)
    }
  }
  if (current) current.end = samples.length / SAMPLE_RATE

  // Bridge a one- or two-frame dropout inside a sustained note.
  for (let i = 1; i < segments.length - 1; i++) {
    const [before, gap, after] = segments.slice(i - 1, i + 2)
    if (before.midi !== null && before.midi === after.midi && gap.end - gap.start < 0.026) {
      before.end = after.end
      segments.splice(i, 2)
      i--
    }
  }
  return segments.filter(note => note.midi !== null && note.end - note.start >= 0.075)
}

export function quantize(rawNotes, bpm, step, alignFirstNote) {
  const ticksPerSecond = (bpm / 60) * TICKS_PER_BEAT
  const offset = alignFirstNote ? (rawNotes[0]?.start ?? 0) : 0
  const snap = time => Math.round(((time - offset) * ticksPerSecond) / step) * step
  const notes = []
  for (const raw of rawNotes) {
    const start = Math.max(0, snap(raw.start))
    const end = Math.max(start + step, snap(raw.end))
    const previous = notes.at(-1)
    if (previous?.start === start) {
      if (previous.weight >= raw.end - raw.start) continue
      notes.pop()
    }
    const prior = notes.at(-1)
    if (prior && prior.start + prior.duration > start) prior.duration = start - prior.start
    notes.push({ midi: raw.midi, start, duration: end - start, weight: raw.end - raw.start })
  }
  return notes.map(({ midi, start, duration }) => ({ midi, start, duration }))
}

export function scoreBars(notes) {
  const total = Math.max(TICKS_PER_BAR, Math.ceil((notes.at(-1)?.start + notes.at(-1)?.duration || 0) / TICKS_PER_BAR) * TICKS_PER_BAR)
  const spans = []
  let cursor = 0
  for (const note of notes) {
    if (note.start > cursor) spans.push({ start: cursor, end: note.start, midi: null })
    cursor = note.start + note.duration
    spans.push({ start: note.start, end: cursor, midi: note.midi })
  }
  if (cursor < total) spans.push({ start: cursor, end: total, midi: null })

  const bars = Array.from({ length: total / TICKS_PER_BAR }, () => [])
  for (const span of spans) {
    let start = span.start
    while (start < span.end) {
      const withinBar = start % TICKS_PER_BAR
      const available = Math.min(span.end - start, TICKS_PER_BAR - withinBar)
      const duration = [16, 8, 4, 2, 1].find(ticks => ticks <= available && withinBar % ticks === 0)
      bars[Math.floor(start / TICKS_PER_BAR)].push({
        midi: span.midi, duration,
        tiedToNext: span.midi !== null && start + duration < span.end,
      })
      start += duration
    }
  }
  return bars
}
