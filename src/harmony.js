export const TONIC_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

export const progressions = [
  ['pop', 'Four-chord pop', 'Major', 'I V vi IV', 'The tonic and dominant lead into the relative minor, then back through IV.'],
  ['pop-vi', 'Pop loop from vi', 'Major', 'vi IV I V', 'The same four chords as the pop loop, starting on the relative minor.'],
  ['pop-iv', 'Pop loop from IV', 'Major', 'IV I V vi', 'Starts away from the tonic and ends on the relative minor.'],
  ['three-chord', 'Folk and rock cadence', 'Major', 'I IV V I', 'Hear tonic, subdominant, dominant, and the return home.'],
  ['folk-loop', 'Three-chord loop', 'Major', 'I IV V', 'The loop itself provides the V to I resolution.'],
  ['doo-wop', '’50s doo-wop', 'Major', 'I vi IV V', 'The relative minor is followed by IV and V.'],
  ['turnaround', 'Doo-wop turnaround', 'Major', 'I vi ii V', 'Uses ii in place of IV before the dominant.'],
  ['pachelbel', 'Pachelbel sequence', 'Major', 'I V vi iii IV I IV V', 'Eight chords with a descending sequence at the start, played in root position here.'],
  ['plagal', 'Plagal vamp', 'Major', 'I IV', 'The loop returns from IV to I without using V.'],
  ['double-plagal', 'Double-plagal rock', 'Mixed', 'I ♭VII IV I', 'The lowered seventh leads to IV, then to I.'],
  ['rock-turnaround', 'Rock turnaround', 'Mixed', '♭VI ♭III ♭VII IV I', 'Borrowed major chords lead back to the major tonic.'],
  ['jazz-major', 'Major jazz cadence', 'Major', 'ii7 V7 Imaj7', 'Three seventh chords resolve through predominant, dominant, and tonic.'],
  ['blues', '12-bar blues form', 'Blues', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'Four beats per step gives the usual 12 bars in 4/4, with V7 as the turnaround.'],
  ['blues-quick', 'Quick-change blues', 'Blues', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'IV7 arrives early, in bar two when you use four beats per step.'],
  ['minor-pop', 'Minor pop loop', 'Minor', 'i ♭VI ♭III ♭VII', 'In A minor this gives Am, F, C, and G.'],
  ['minor-circle', 'Minor circle of fifths', 'Minor', 'i iv ♭VII ♭III', 'The roots move down a fifth or up a fourth at each step.'],
  ['andalusian', 'Andalusian cadence', 'Minor', 'i ♭VII ♭VI V', 'A descending bass leads to a major dominant.'],
  ['minor-cadence', 'Minor tonic cadence', 'Minor', 'i iv V i', 'The major V raises the seventh scale degree and pulls back to i.'],
  ['minor-vamp', 'Natural minor vamp', 'Minor', 'i iv v', 'The minor v keeps the lowered seventh of natural minor.'],
  ['jazz-minor', 'Minor jazz cadence', 'Minor', 'iiø7 V7 i', 'A half-diminished iiø7 leads through V7 to the minor tonic.'],
].map(([id, name, group, symbols, description]) => ({ id, name, group, symbols: symbols.split(' '), description }))

// Each value is the number of quarter-note beats assigned to successive chords.
export const chordLengths = [
  ['1', '1 beat each', [1]],
  ['2', '2 beats each', [2]],
  ['3', '3 beats each', [3]],
  ['4', '4 beats each (one bar of 4/4)', [4]],
  ['8', '8 beats each (two bars of 4/4)', [8]],
  ['1-1-2', '1 · 1 · 2 beats', [1, 1, 2]],
  ['2-2-4', '2 · 2 · 4 beats', [2, 2, 4]],
  ['2-2-4-4', '2 · 2 · 4 · 4 beats', [2, 2, 4, 4]],
].map(([id, name, beats]) => ({ id, name, beats }))

// Pattern steps contain the beat offset and the chord voicing to play.
export const rhythms = [
  ['sustain', 'Sustained chords', 'Play the notes together and hold them until the next chord.', 0, [[0, 'all']]],
  ['half', 'Half-note chords', 'Play once every two beats.', 2, [[0, 'all']]],
  ['quarter', 'Quarter-note chords', 'Play on every beat: 1, 2, 3, 4.', 1, [[0, 'all']]],
  ['eighth', 'Straight eighth-note chords', 'Play on each beat and its “and”: 1 & 2 &.', 1, [[0, 'all'], [0.5, 'all']]],
  ['offbeat', 'Offbeat eighth-note chords', 'Play only on the “and” between beats.', 1, [[0.5, 'all']]],
  ['backbeat', 'Backbeat chords', 'Play on beats 2 and 4 of a four-beat pattern.', 4, [[1, 'all'], [3, 'all']]],
  ['tresillo', 'Tresillo (3–3–2)', 'Split eight eighth notes into 3 + 3 + 2. Attack on 1, the “and” of 2, and 4.', 4, [[0, 'all'], [1.5, 'all'], [3, 'all']]],
  ['charleston', 'Charleston', 'Play on beat 1 and the “and” of beat 2 in a four-beat pattern.', 4, [[0, 'all'], [1.5, 'all']]],
  ['bass-chord', 'Alternating bass and chords', 'Play a low root on 1 and 3, and chords on 2 and 4.', 4, [[0, 'bass'], [1, 'all'], [2, 'bass'], [3, 'all']]],
  ['waltz', 'Waltz bass and chords', 'A three-beat pattern: bass, chord, chord. Try it with three beats per chord.', 3, [[0, 'bass'], [1, 'all'], [2, 'all']]],
  ['arp-up', 'Ascending eighth-note arpeggio', 'Play the chord tones one at a time, from low to high.', 2, [[0, 0], [0.5, 1], [1, 2], [1.5, 3]]],
  ['arp-down', 'Descending eighth-note arpeggio', 'Play the chord tones one at a time, from high to low.', 2, [[0, 3], [0.5, 2], [1, 1], [1.5, 0]]],
  ['arp-pendulum', 'Up-and-down arpeggio', 'Climb through the chord tones and come back down in eighth notes.', 3, [[0, 0], [0.5, 1], [1, 2], [1.5, 3], [2, 2], [2.5, 1]]],
  ['alberti', 'Alberti bass', 'A broken-chord pattern in eighth notes: root, fifth, third, fifth.', 2, [[0, 0], [0.5, 2], [1, 1], [1.5, 2]]],
  ['triplets', 'Triplet arpeggio', 'Fit three evenly spaced chord tones into each beat.', 1, [[0, 0], [1 / 3, 1], [2 / 3, 2]]],
].map(([id, name, description, period, steps]) => ({ id, name, description, period, steps }))

const scale = [0, 2, 4, 5, 7, 9, 11]
const letters = 'CDEFGAB'
const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const chordTypes = {
  major: { intervals: [0, 4, 7], suffix: '' },
  minor: { intervals: [0, 3, 7], suffix: 'm' },
  '7': { intervals: [0, 4, 7, 10], suffix: '7' },
  m7: { intervals: [0, 3, 7, 10], suffix: 'm7' },
  maj7: { intervals: [0, 4, 7, 11], suffix: 'maj7' },
  'ø7': { intervals: [0, 3, 6, 10], suffix: 'ø7' },
}

function spell(midi, letter) {
  const natural = scale[letter]
  const accidental = ((midi - natural + 6) % 12 + 12) % 12 - 6
  const pitchClass = letters[letter] + (accidental < 0 ? '♭'.repeat(-accidental) : '♯'.repeat(accidental))
  return { pitchClass, name: pitchClass + ((midi - natural - accidental) / 12 - 1) }
}

export function chordFor(tonic, symbol) {
  const [, flat, numeral, extension] = symbol.match(/^(♭?)([IV]+|[iv]+)(maj7|ø7|7)?$/)
  const degree = numerals.indexOf(numeral.toUpperCase())
  const minor = numeral === numeral.toLowerCase()
  const type = extension === '7' && minor ? 'm7' : extension ?? (minor ? 'minor' : 'major')
  const { intervals, suffix } = chordTypes[type]
  const offset = scale[degree] - Number(Boolean(flat))
  const root = tonic + (offset > 6 ? offset - 12 : offset)
  const rootLetter = (letters.indexOf(TONIC_NAMES[tonic % 12][0]) + degree) % 7
  return {
    symbol,
    name: spell(root, rootLetter).pitchClass + suffix,
    notes: intervals.map((interval, i) => {
      const midi = root + interval
      return { midi, name: spell(midi, (rootLetter + i * 2) % 7).name }
    }),
  }
}

export function tonicName(midi) {
  return TONIC_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
}

export function backingLoop(tonic, progression, rhythm, lengths) {
  const chords = []
  let chordCycle = 0
  progression.symbols.forEach((symbol, index) => {
    const chord = chordFor(tonic, symbol)
    const length = lengths.beats[index % lengths.beats.length]
    chords.push({ ...chord, beat: chordCycle, length })
    chordCycle += length
  })
  if (!rhythm.period) {
    const events = chords.map(chord => ({
      beat: chord.beat, duration: chord.length, notes: chord.notes.map(note => note.midi),
    }))
    return { chords, events, chordCycle, beats: chordCycle }
  }

  // Repeat the chords until the rhythmic pattern also returns to its first beat.
  let beats = chordCycle
  while (beats % rhythm.period) beats += chordCycle
  const events = []
  for (let start = 0; start < beats; start += rhythm.period) {
    rhythm.steps.forEach(([offset, voicing], index) => {
      const beat = start + offset
      const chordBeat = beat % chordCycle
      const chord = chords.findLast(candidate => candidate.beat <= chordBeat)
      const tones = chord.notes.map(note => note.midi)
      const arpeggio = tones.length === 4 ? tones : [...tones, tones[0] + 12]
      const next = rhythm.steps[index + 1]?.[0] ?? rhythm.period + rhythm.steps[0][0]
      const duration = Math.min((next - offset) * 0.8, chord.beat + chord.length - chordBeat)
      const notes = voicing === 'all' ? tones : [voicing === 'bass' ? tones[0] - 12 : arpeggio[voicing]]
      events.push({ beat, duration, notes })
    })
  }
  return { chords, events, chordCycle, beats }
}
