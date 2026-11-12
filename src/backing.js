import { audioContext, tone } from './audio.js'
import { backingLoop, chordLengths, progressions, rhythms, TONIC_NAMES, tonicName } from './harmony.js'
import { clamp, frequency } from './music.js'
import { $, save, state } from './state.js'

const settings = {
  mode: 'chords', tonic: 57, bpm: 80, progression: 'minor-pop', lengths: '4',
  pattern: 'sustain', volume: 35, ...state.backing,
}
const toggle = $('toggle-backing')
const nowPlaying = $('backing-now')
const chordList = $('backing-chords')
const status = $('backing-status')
let plan
let session
let request = 0
let waiting = false

function populate(id, options, selected) {
  const input = $(id)
  for (const [value, label] of options) input.add(new Option(label, value))
  input.value = selected
}

populate('backing-note', TONIC_NAMES.map((name, index) => [index, name]), settings.tonic % 12)
populate('backing-octave', [2, 3, 4, 5].map(octave => [octave, octave]), Math.floor(settings.tonic / 12) - 1)
const progressionSelect = $('backing-progression')
for (const group of new Set(progressions.map(preset => preset.group))) {
  const optgroup = document.createElement('optgroup')
  optgroup.label = group
  for (const preset of progressions.filter(candidate => candidate.group === group)) {
    const formula = preset.symbols.length === 12 ? 'I7 · IV7 · V7' : preset.symbols.join('–')
    optgroup.append(new Option(preset.name + ' · ' + formula, preset.id))
  }
  progressionSelect.append(optgroup)
}
progressionSelect.value = settings.progression
populate('backing-lengths', chordLengths.map(preset => [preset.id, preset.name]), settings.lengths)
populate('backing-pattern', rhythms.map(preset => [preset.id, preset.name]), settings.pattern)
$('backing-mode').value = settings.mode
$('backing-bpm').value = settings.bpm
$('backing-volume').value = settings.volume

function renderSettings() {
  const drone = settings.mode === 'drone'
  $('backing-note').labels[0].firstChild.textContent = drone ? 'Drone note' : 'Tonic note'
  for (const id of ['backing-bpm', 'backing-progression', 'backing-lengths', 'backing-pattern']) {
    $(id).closest('label').hidden = drone
  }
  chordList.hidden = drone
  chordList.replaceChildren()
  if (drone) {
    $('backing-explanation').textContent = 'A drone is one sustained note. Sing another note over it and listen to the interval.'
    return
  }

  const progression = progressions.find(preset => preset.id === settings.progression)
  const lengths = chordLengths.find(preset => preset.id === settings.lengths)
  const pattern = rhythms.find(preset => preset.id === settings.pattern)
  plan = backingLoop(settings.tonic, progression, pattern, lengths)
  for (const chord of plan.chords) {
    const item = document.createElement('li')
    const heading = document.createElement('strong')
    const notes = document.createElement('span')
    heading.textContent = chord.symbol + ' · ' + chord.name
    notes.textContent = chord.notes.map(note => note.name).join(' ') + ' · ' + chord.length + (chord.length === 1 ? ' beat' : ' beats')
    item.append(heading, notes)
    chordList.append(item)
  }
  $('backing-explanation').textContent = progression.description + ' ' + pattern.description
}

function showPlaying(label, index = -1) {
  const next = label ? label + ' · Stop' : ''
  if (nowPlaying.textContent !== next) nowPlaying.textContent = next
  nowPlaying.hidden = !label
  if (session?.activeChord === index) return
  if (session) session.activeChord = index
  for (const [i, item] of Array.from(chordList.children).entries()) {
    if (i === index) item.setAttribute('aria-current', 'true')
    else item.removeAttribute('aria-current')
  }
}

export function stopBacking() {
  request++
  waiting = false
  toggle.textContent = '▷ Play backing'
  toggle.disabled = false
  if (session) {
    const { ctx, timer, output, voices } = session
    clearInterval(timer)
    const now = ctx.currentTime
    output.gain.setTargetAtTime(0, now, 0.007)
    for (const voice of voices) voice.stop(now + 0.035)
    setTimeout(() => output.disconnect(), 55)
    session = null
  }
  showPlaying('')
  status.textContent = ''
}

function scheduleVoice(run, midi, at, duration, options) {
  const voice = tone(run.ctx, frequency(midi), at, duration, { output: run.output, ...options })
  run.voices.add(voice)
  voice.addEventListener('ended', () => run.voices.delete(voice), { once: true })
}

function playLoop(run, sequence, bpm, sustain) {
  const secondsPerBeat = 60 / bpm
  const start = run.ctx.currentTime + 0.065
  const cycleSeconds = sequence.beats * secondsPerBeat
  let cycle = 0
  let index = 0
  function schedule() {
    const now = run.ctx.currentTime
    const elapsed = Math.max(0, now - start)
    const currentCycle = Math.floor(elapsed / cycleSeconds)
    if (cycle < currentCycle) {
      cycle = currentCycle
      index = 0
    }
    while (true) {
      const event = sequence.events[index]
      const at = start + cycle * cycleSeconds + event.beat * secondsPerBeat
      if (at > now + 0.1) break
      if (at >= now) {
        const volume = 0.12 / Math.sqrt(event.notes.length)
        for (const midi of event.notes) {
          scheduleVoice(run, midi, at, event.duration * secondsPerBeat, { volume, sustain })
        }
      }
      index++
      if (index === sequence.events.length) {
        index = 0
        cycle++
      }
    }

    if (now < start) return
    const beat = (elapsed / secondsPerBeat) % sequence.chordCycle
    const chordIndex = sequence.chords.findLastIndex(chord => chord.beat <= beat)
    const chord = sequence.chords[chordIndex]
    showPlaying(chord.name + ' · ' + (Math.floor(beat - chord.beat) + 1) + '/' + chord.length, chordIndex)
  }
  schedule()
  run.timer = setInterval(schedule, 25)
}

async function startBacking() {
  stopBacking()
  const activeRequest = request
  waiting = true
  toggle.disabled = true
  status.textContent = 'Starting audio…'
  try {
    const ctx = await audioContext()
    if (activeRequest !== request) return
    const output = ctx.createGain()
    output.gain.value = settings.volume / 100
    output.connect(ctx.destination)
    session = { ctx, output, voices: new Set() }
    if (settings.mode === 'drone') {
      scheduleVoice(session, settings.tonic, ctx.currentTime + 0.025, Infinity, { volume: 0.11, type: 'sine' })
      showPlaying(tonicName(settings.tonic) + ' drone')
    } else {
      playLoop(session, plan, settings.bpm, settings.pattern === 'sustain')
    }
    waiting = false
    toggle.disabled = false
    toggle.textContent = '■ Stop backing'
    status.textContent = 'Backing is playing.'
  } catch {
    if (activeRequest !== request) return
    stopBacking()
    status.textContent = 'Backing audio is unavailable in this browser.'
  }
}

function updateSettings() {
  const restart = Boolean(session) || waiting
  if (restart) stopBacking()
  settings.mode = $('backing-mode').value
  settings.tonic = (Number($('backing-octave').value) + 1) * 12 + Number($('backing-note').value)
  const bpm = $('backing-bpm').valueAsNumber
  if (Number.isFinite(bpm)) settings.bpm = clamp(Math.round(bpm), 40, 240)
  $('backing-bpm').value = settings.bpm
  settings.progression = progressionSelect.value
  settings.lengths = $('backing-lengths').value
  settings.pattern = $('backing-pattern').value
  state.backing = settings
  save()
  renderSettings()
  if (restart) startBacking()
}

for (const id of ['backing-mode', 'backing-note', 'backing-octave', 'backing-bpm', 'backing-progression', 'backing-lengths', 'backing-pattern']) {
  $(id).addEventListener('change', updateSettings)
}
$('backing-volume').addEventListener('input', event => {
  settings.volume = Number(event.target.value)
  if (session) session.output.gain.setTargetAtTime(settings.volume / 100, session.ctx.currentTime, 0.02)
})
$('backing-volume').addEventListener('change', () => {
  state.backing = settings
  save()
})
toggle.addEventListener('click', () => session ? stopBacking() : startBacking())
nowPlaying.setAttribute('aria-label', 'Stop practice backing')
nowPlaying.addEventListener('click', stopBacking)
renderSettings()
