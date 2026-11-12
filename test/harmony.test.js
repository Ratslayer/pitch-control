import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backingLoop, chordFor, chordLengths, progressions, rhythms } from '../src/harmony.js'

const progression = id => progressions.find(preset => preset.id === id)
const rhythm = id => rhythms.find(preset => preset.id === id)
const lengths = id => chordLengths.find(preset => preset.id === id)

test('spells chords in the selected key, including minor dominants and flat roots', () => {
  const minorPop = progression('minor-pop').symbols.map(symbol => chordFor(57, symbol).name)
  assert.deepEqual(minorPop, ['Am', 'F', 'C', 'G'])
  assert.deepEqual(chordFor(57, 'V7').notes.map(note => note.name), ['E3', 'G♯3', 'B3', 'D4'])
  assert.deepEqual(chordFor(58, 'iiø7').notes.map(note => note.name), ['C4', 'E♭4', 'G♭4', 'B♭4'])
  assert.deepEqual(chordFor(61, 'I').notes.map(note => note.name), ['C♯4', 'E♯4', 'G♯4'])
})

test('all progression presets can be transposed into all twelve keys', () => {
  for (const preset of progressions) {
    for (let tonic = 48; tonic < 60; tonic++) {
      for (const symbol of preset.symbols) {
        const chord = chordFor(tonic, symbol)
        assert.ok(chord.name && chord.notes.every(note => Number.isInteger(note.midi) && note.name))
      }
    }
  }
})

test('harmonic rhythm distributes 1, 1, 2 beats over successive chords', () => {
  const loop = backingLoop(57, progression('minor-pop'), rhythm('sustain'), lengths('1-1-2'))
  assert.deepEqual(loop.chords.map(chord => [chord.beat, chord.length]), [[0, 1], [1, 1], [2, 2], [4, 1]])
  assert.equal(loop.beats, 5)
  assert.deepEqual(loop.events.map(event => event.duration), [1, 1, 2, 1])
})

test('tresillo keeps the 3–3–2 attack grid across chord changes', () => {
  const loop = backingLoop(57, progression('minor-pop'), rhythm('tresillo'), lengths('1-1-2'))
  assert.equal(loop.chordCycle, 5)
  assert.equal(loop.beats, 20)
  assert.deepEqual(loop.events.slice(0, 6).map(event => event.beat), [0, 1.5, 3, 4, 5.5, 7])
  assert.deepEqual(loop.events[1].notes, loop.chords[1].notes.map(note => note.midi))
  assert.equal(loop.events[1].duration, 0.5)
})

test('arpeggios play one chord tone at a time and all patterns schedule within the loop', () => {
  const loop = backingLoop(60, progression('pop'), rhythm('alberti'), lengths('4'))
  assert.deepEqual(loop.events.slice(0, 4).map(event => event.notes), [[60], [67], [64], [67]])
  for (const pattern of rhythms) {
    for (const duration of chordLengths) {
      const plan = backingLoop(57, progression('blues'), pattern, duration)
      assert.ok(plan.events.length)
      for (const event of plan.events) {
        assert.ok(event.duration > 0 && event.beat + event.duration <= plan.beats + 1e-9)
      }
    }
  }
})
