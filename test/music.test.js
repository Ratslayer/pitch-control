import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectNotes, encodeWav, frequency, makePitchReader, quantize, SAMPLE_RATE, scoreBars,
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
