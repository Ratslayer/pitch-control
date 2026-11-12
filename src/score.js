import {
  Accidental, Barline, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice,
} from 'vexflow/bravura'
import { noteName, scoreBars } from './music.js'

const durations = { 16: 'w', 8: 'h', 4: 'q', 2: '8', 1: '16' }

export function renderScore(element, notes) {
  element.replaceChildren()
  if (!notes.length) {
    element.textContent = 'No notes in this score.'
    return
  }
  const sortedPitches = notes.map(note => note.midi).sort((a, b) => a - b)
  const clef = sortedPitches[Math.floor(sortedPitches.length / 2)] < 60 ? 'bass' : 'treble'
  const bars = scoreBars(notes)
  const barWidths = bars.map((bar, index) => Math.max(120, 40 + bar.length * 25) + (index === 0 ? 42 : 0))
  const renderer = new Renderer(element, Renderer.Backends.SVG)
  const context = renderer.resize(24 + barWidths.reduce((a, b) => a + b, 0), 128).getContext()
  context.setFillStyle('#20232b').setStrokeStyle('#20232b')

  const drawn = []
  let x = 12
  bars.forEach((bar, index) => {
    const width = barWidths[index]
    const stave = new Stave(x, 20, width).setContext(context)
    if (index === 0) stave.addClef(clef).addTimeSignature('4/4')
    if (index === bars.length - 1) stave.setEndBarType(Barline.type.END)
    stave.draw()

    const voice = new Voice({ numBeats: 4, beatValue: 4 })
    const accidentals = new Map()
    const tickables = bar.map(event => {
      const rest = event.midi === null
      const name = rest ? (clef === 'bass' ? 'd/3' : 'b/4') : noteName(event.midi)
      const letter = name[0].toLowerCase()
      const octave = name.at(-1)
      const sharp = name.includes('♯')
      const key = rest ? name : letter + (sharp ? '#' : '') + '/' + octave
      const duration = durations[event.duration] + (rest ? 'r' : '')
      const note = new StaveNote({ clef, keys: [key], duration, autoStem: true })
      if (!rest) {
        const slot = letter + octave
        const previous = accidentals.get(slot) ?? false
        if (sharp !== previous) note.addModifier(new Accidental(sharp ? '#' : 'n'), 0)
        accidentals.set(slot, sharp)
      }
      drawn.push({ note, tiedToNext: event.tiedToNext })
      return note
    })
    voice.addTickables(tickables)
    new Formatter().joinVoices([voice]).formatToStave([voice], stave)
    voice.draw(context, stave)
    x += width
  })
  drawn.forEach(({ note, tiedToNext }, index) => {
    if (tiedToNext) {
      new StaveTie({
        firstNote: note, lastNote: drawn[index + 1].note, firstIndexes: [0], lastIndexes: [0],
      }).setContext(context).draw()
    }
  })
}
