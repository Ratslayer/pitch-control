import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectNotes, encodeWav, formatCents, frequency, isPracticePitchInTune, makePitchReader, nearestPracticeNote, practiceBounds,
  quantize, SAMPLE_RATE, scoreBars,
} from '../src/music.js'

function phrase(parts) {
  return Float32Array.from(parts.flatMap(([midi, seconds]) =>
    Array.from({ length: Math.round(seconds * SAMPLE_RATE) }, (_, i) =>
      midi === null ? 0 : 0.3 * Math.sin(i * 2 * Math.PI * frequency(midi) / SAMPLE_RATE))))
}

test('tracks fractional pitch for practice and ignores silence', () => {
  const readPitch = makePitchReader(1024, SAMPLE_RATE)
  assert.equal(readPitch(new Float32Array(1024)), null)
  const sung = readPitch(phrase([[57.23, 1024 / SAMPLE_RATE]]))
  assert.ok(Math.abs(sung - 57.23) < 0.03)
})

test('covers the octave above and below each center, with supported pitch limits', () => {
  assert.deepEqual(practiceBounds(57, 12), { low: 45, high: 69 })
  assert.deepEqual(practiceBounds(36, 12), { low: 24, high: 48 })
  assert.deepEqual(practiceBounds(83, 12), { low: 71, high: 95 })
  assert.deepEqual(practiceBounds(57, 0), { low: 57, high: 57 })
  assert.deepEqual(practiceBounds(83, 24), { low: 59, high: 95 })
})

test('reports pitch error relative to the note sung, including notes an octave away', () => {
  assert.deepEqual(nearestPracticeNote(57, -1188), { midi: 45, error: 12 })
  assert.deepEqual(nearestPracticeNote(57, 1185), { midi: 69, error: -15 })
  assert.deepEqual(nearestPracticeNote(57, -50), { midi: 57, error: -50 })
})

test('includes both ±15-cent edges for any note in range', () => {
  for (const cents of [-115, -85, -15, 0, 15, 85, 115]) {
    assert.equal(isPracticePitchInTune(57, cents, 56, 58), true)
  }
  for (const cents of [-116, -84, 16, 116, 200]) {
    assert.equal(isPracticePitchInTune(57, cents, 56, 58), false)
  }
})

test('keeps the cents readout the same width, including at zero and without pitch', () => {
  assert.equal(formatCents(0), '+00 ¢')
  assert.equal(formatCents(4), '+04 ¢')
  assert.equal(formatCents(-7), '−07 ¢')
  assert.equal(formatCents(-50), '−50 ¢')
  assert.equal(formatCents(null), '±-- ¢')
})

test('the practice detector can read the low and high limits', () => {
  const size = 2048
  const reader = makePitchReader(size, SAMPLE_RATE, frequency(23.5), frequency(95.5))
  for (const midi of [24, 95]) {
    assert.ok(Math.abs(reader(phrase([[midi, size / SAMPLE_RATE]])) - midi) < 0.1)
  }
})

test('transcribes a melody with a rest and a repeated note', () => {
  const samples = phrase([[null, 0.12], [57, 0.5], [null, 0.25], [57, 0.25], [60, 0.5]])
  const raw = detectNotes(samples)
  assert.deepEqual(quantize(raw, 120, 2, true), [
    { midi: 57, start: 0, duration: 4 },
    { midi: 57, start: 6, duration: 2 },
    { midi: 60, start: 8, duration: 4 },
  ])
})

test('resolves collisions on a coarse grid without overlapping notes', () => {
  assert.deepEqual(quantize([
    { midi: 57, start: 0, end: 0.1 },
    { midi: 58, start: 0.1, end: 0.48 },
    { midi: 60, start: 0.47, end: 0.75 },
  ], 120, 2, false), [
    { midi: 58, start: 0, duration: 4 },
    { midi: 60, start: 4, duration: 2 },
  ])
})

test('fills bars with rests and ties notes over bar lines', () => {
  const bars = scoreBars([{ midi: 60, start: 12, duration: 8 }])
  assert.equal(bars.length, 2)
  assert.deepEqual(bars.map(bar => bar.reduce((sum, n) => sum + n.duration, 0)), [16, 16])
  assert.deepEqual(bars[0].at(-1), { midi: 60, duration: 4, tiedToNext: true })
  assert.deepEqual(bars[1][0], { midi: 60, duration: 4, tiedToNext: false })
})

test('produces a playable mono PCM WAV', async () => {
  const wav = encodeWav(new Float32Array([0, 0.5, -0.5]))
  const data = new DataView(await wav.arrayBuffer())
  assert.equal(wav.type, 'audio/wav')
  assert.equal(data.byteLength, 50)
  assert.equal(data.getUint32(24, true), SAMPLE_RATE)
  assert.equal(data.getInt16(46, true), 16384)
})
