import { audioContext, blobAsDataUrl, microphone, microphoneError, startMetronome, tone } from './audio.js'
import {
  clamp, compactMono, detectNotes, encodeWav, frequency, MAX_MIDI, MAX_SECONDS, MIN_MIDI,
  noteName, quantize, SAMPLE_RATE, TICKS_PER_BEAT,
} from './music.js'
import { $, save, state } from './state.js'

const status = $('melody-status')
const original = $('original-audio')
const maxImportBytes = 30 * 1024 * 1024
const maximumTicks = MAX_SECONDS * 4 * TICKS_PER_BEAT + 2
let phase = 'idle'
let recording
let playing = []
let playbackTimer
let playbackRequest = 0
let loadedOriginal
let scoreRender = 0

function selectedTake() {
  return state.takes.find(take => take.id === state.selected)
}

function stopPlayback() {
  playbackRequest++
  clearTimeout(playbackTimer)
  playing.forEach(oscillator => oscillator.stop())
  playing = []
  $('play-score').textContent = '▷ Play score'
}

export function stopMelodyPlayback() {
  stopPlayback()
  original.pause()
}

export function melodyIsBusy() {
  return phase !== 'idle'
}

function setPhase(next, message) {
  phase = next
  const busy = melodyIsBusy()
  const active = phase === 'recording'
  const record = $('record-melody')
  record.disabled = busy && !active
  record.classList.toggle('recording', active)
  record.lastElementChild.textContent = active ? 'Stop recording' : 'Record melody'
  $('score-content').inert = busy
  $('saved-melodies').inert = busy
  for (const id of ['tempo', 'grid', 'metronome', 'import-audio', 'practice-tab']) $(id).disabled = busy
  status.textContent = message
}

function button(label, onClick, className = 'secondary') {
  const result = document.createElement('button')
  result.className = className
  result.textContent = label
  result.addEventListener('click', onClick)
  return result
}

function selectTake(id) {
  stopMelodyPlayback()
  state.selected = id
  save()
  renderMelody()
}

function renderLibrary() {
  const list = $('saved-melodies')
  list.replaceChildren()
  $('saved-count').textContent = state.takes.length + (state.takes.length === 1 ? ' take' : ' takes')
  $('saved-empty').hidden = Boolean(state.takes.length)
  for (const take of state.takes) {
    const item = document.createElement('li')
    const label = take.title + ' · ' + take.length.toFixed(1) + ' s'
    const select = button(label, () => selectTake(take.id), 'secondary saved-take')
    select.setAttribute('aria-current', String(take.id === state.selected))
    const remove = button('Delete', () => {
      if (!window.confirm('Delete this take and its score from this device?')) return
      if (state.selected === take.id) stopMelodyPlayback()
      state.takes = state.takes.filter(candidate => candidate.id !== take.id)
      if (state.selected === take.id) state.selected = state.takes[0]?.id ?? null
      save()
      renderMelody()
    }, 'secondary icon-button')
    remove.setAttribute('aria-label', 'Delete ' + take.title)
    item.append(select, remove)
    list.append(item)
  }
}

function commitEdits(take) {
  take.edited = true
  stopMelodyPlayback()
  save()
  renderMelody()
}

function numberInput(label, value, onChange) {
  const input = document.createElement('input')
  input.type = 'number'
  input.step = '0.25'
  input.min = '0'
  input.max = maximumTicks / TICKS_PER_BEAT
  input.value = value
  input.setAttribute('aria-label', label)
  input.addEventListener('change', () => {
    const ticks = Math.round(Number(input.value) * TICKS_PER_BEAT)
    if (input.value === '' || !onChange(ticks)) {
      input.value = value
      status.textContent = 'Use a valid start and length. Notes cannot overlap.'
    }
  })
  return input
}

function renderNoteEditor(take) {
  const body = $('note-editor')
  body.replaceChildren()
  $('note-count').textContent = '(' + take.notes.length + ')'
  take.notes.forEach((note, index) => {
    const row = body.insertRow()
    const label = 'Note ' + (index + 1)
    row.insertCell().textContent = index + 1
    const pitch = document.createElement('select')
    pitch.setAttribute('aria-label', label + ' pitch')
    for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) pitch.add(new Option(noteName(midi), midi))
    pitch.value = note.midi
    pitch.addEventListener('change', () => {
      note.midi = Number(pitch.value)
      commitEdits(take)
    })
    const editTiming = (start, duration) => {
      if (start < 0 || duration < 1 || start + duration > maximumTicks ||
          take.notes.some(other => other !== note && start < other.start + other.duration && other.start < start + duration)) return false
      Object.assign(note, { start, duration })
      take.notes.sort((a, b) => a.start - b.start)
      commitEdits(take)
      return true
    }
    const start = numberInput(label + ' start in beats', note.start / TICKS_PER_BEAT, value => editTiming(value, note.duration))
    const duration = numberInput(label + ' length in beats', note.duration / TICKS_PER_BEAT, value => editTiming(note.start, value))
    duration.min = '0.25'
    const remove = button('Remove', () => {
      take.notes.splice(index, 1)
      commitEdits(take)
    }, 'secondary icon-button')
    remove.setAttribute('aria-label', 'Remove ' + label)
    for (const element of [pitch, start, duration, remove]) row.insertCell().append(element)
  })
}

async function showScore(take) {
  const active = ++scoreRender
  const element = $('score')
  element.textContent = 'Preparing sheet music…'
  try {
    const { renderScore } = await import('./score.js')
    await document.fonts.ready
    if (active === scoreRender && selectedTake() === take) renderScore(element, take.notes)
  } catch (error) {
    if (active !== scoreRender || selectedTake() !== take) return
    console.error(error)
    element.textContent = 'The staff could not be displayed. You can still edit and play the notes.'
  }
}

function renderMelody() {
  const take = selectedTake()
  $('score-content').hidden = !take
  $('score-empty').hidden = Boolean(take)
  $('score-title').textContent = take?.title ?? 'Sheet music'
  $('score-meta').textContent = take ? take.bpm + ' BPM · 4/4' : '4/4 time'
  if (take) {
    showScore(take)
    if (loadedOriginal !== take.id) {
      original.src = take.audio
      loadedOriginal = take.id
    }
    $('score-tempo').value = take.bpm
    $('score-grid').value = take.grid
    $('play-score').disabled = !take.notes.length
    renderNoteEditor(take)
  } else {
    original.removeAttribute('src')
    original.load()
    loadedOriginal = null
  }
  renderLibrary()
}

async function playScore() {
  if (playing.length) {
    stopPlayback()
    return
  }
  const take = selectedTake()
  if (!take?.notes.length) return
  original.pause()
  const activeRequest = ++playbackRequest
  try {
    const ctx = await audioContext()
    if (activeRequest !== playbackRequest) return
    const start = ctx.currentTime + 0.04
    const tick = 60 / take.bpm / TICKS_PER_BEAT
    playing = take.notes.map(note => tone(ctx, frequency(note.midi), start + note.start * tick, note.duration * tick * 0.92))
    const last = take.notes.at(-1)
    playbackTimer = setTimeout(stopPlayback, ((last.start + last.duration) * tick + 0.05) * 1000)
    $('play-score').textContent = '■ Stop score'
  } catch {
    status.textContent = 'Score playback is unavailable in this browser.'
  }
}

function tempoValue(element, previous) {
  const value = element.value === '' ? previous : clamp(Math.round(Number(element.value)), 40, 240)
  element.value = value
  return value
}

function readNewSettings() {
  state.tempo = tempoValue($('tempo'), state.tempo)
  state.grid = Number($('grid').value)
  state.metronome = $('metronome').checked
  save()
  return { bpm: state.tempo, grid: state.grid, metronome: state.metronome }
}

async function storeTake(blob, title, settings, alignFirstNote) {
  const ctx = await audioContext()
  let decoded
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } catch {
    throw new Error('This audio could not be decoded. Try a WAV, MP3, or M4A file.')
  }
  const samples = compactMono(decoded)
  if (samples.length < SAMPLE_RATE * 0.15) throw new Error('Record or import at least a short phrase.')
  const rawNotes = detectNotes(samples)
  const notes = quantize(rawNotes, settings.bpm, settings.grid, alignFirstNote)
  const audio = await blobAsDataUrl(encodeWav(samples))
  const take = {
    id: crypto.randomUUID(), title, length: samples.length / SAMPLE_RATE, audio, rawNotes, notes,
    bpm: settings.bpm, grid: settings.grid, alignFirstNote, edited: false,
  }
  state.takes.unshift(take)
  state.selected = take.id
  const saved = save()
  renderMelody()
  const summary = notes.length
    ? notes.length + (notes.length === 1 ? ' note detected.' : ' notes detected.')
    : 'No clear notes detected. Try a steady hum in a quiet room.'
  const trim = decoded.duration > MAX_SECONDS + 0.1 ? ' Used the first 20 seconds.' : ''
  return summary + trim + (saved ? ' Take saved on this device.' : ' Take is only available in this tab.')
}

function stopRecording() {
  if (!recording || recording.recorder.state === 'inactive') return
  setPhase('processing', 'Analyzing your melody…')
  recording.recorder.stop()
  recording.stopClick?.()
  recording.stopClick = null
  recording.stream.getTracks().forEach(track => track.stop())
}

async function startRecording() {
  const settings = readNewSettings()
  stopMelodyPlayback()
  setPhase('waiting', 'Waiting for microphone permission…')
  let stream
  try {
    if (typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable in this browser. You can import audio instead.')
    const ctx = await audioContext()
    stream = await microphone()
    const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 64000 })
    const chunks = []
    recording = { recorder, stream }
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size) chunks.push(event.data)
    })
    recorder.addEventListener('stop', async () => {
      clearInterval(timer)
      setPhase('processing', 'Analyzing your melody…')
      stream.getTracks().forEach(track => track.stop())
      recording.stopClick?.()
      recording = null
      try {
        const title = 'Take · ' + new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
        const message = await storeTake(new Blob(chunks, { type: recorder.mimeType }), title, settings, !settings.metronome)
        setPhase('idle', message)
      } catch (error) {
        setPhase('idle', error.message)
      }
    }, { once: true })
    stream.getAudioTracks()[0]?.addEventListener('ended', stopRecording, { once: true })
    recorder.start()
    if (settings.metronome) recording.stopClick = startMetronome(ctx, settings.bpm)
    const start = performance.now()
    setPhase('recording', 'Recording · 0 / 20 s')
    const timer = setInterval(() => {
      const seconds = Math.floor((performance.now() - start) / 1000)
      if (seconds >= MAX_SECONDS) stopRecording()
      else if (phase === 'recording') status.textContent = 'Recording · ' + seconds + ' / 20 s'
    }, 100)
  } catch (error) {
    recording = null
    stream?.getTracks().forEach(track => track.stop())
    setPhase('idle', microphoneError(error))
  }
}

for (const id of ['tempo', 'grid', 'metronome']) $(id).addEventListener('change', readNewSettings)
$('record-melody').addEventListener('click', () => phase === 'recording' ? stopRecording() : startRecording())
$('import-audio').addEventListener('click', () => $('audio-file').click())
$('audio-file').addEventListener('change', async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file || melodyIsBusy()) return
  if (file.size > maxImportBytes) {
    status.textContent = 'Choose an audio file under 30 MB. The first 20 seconds will be used.'
    return
  }
  stopMelodyPlayback()
  const settings = readNewSettings()
  setPhase('processing', 'Analyzing your melody…')
  try {
    const message = await storeTake(file, file.name, settings, true)
    setPhase('idle', message)
  } catch (error) {
    setPhase('idle', error.message)
  }
})
$('play-score').addEventListener('click', playScore)
original.addEventListener('play', stopPlayback)
$('requantize').addEventListener('click', () => {
  const take = selectedTake()
  if (!take) return
  if (take.edited && !window.confirm('Rebuild this score from the original pitch detection and replace your edits?')) return
  take.bpm = tempoValue($('score-tempo'), take.bpm)
  take.grid = Number($('score-grid').value)
  take.notes = quantize(take.rawNotes, take.bpm, take.grid, take.alignFirstNote)
  take.edited = false
  stopMelodyPlayback()
  save()
  renderMelody()
  status.textContent = 'Score rebuilt at ' + take.bpm + ' BPM.'
})

$('tempo').value = state.tempo
$('grid').value = state.grid
$('metronome').checked = state.metronome
renderMelody()
