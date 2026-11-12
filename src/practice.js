import { audioContext, microphone, microphoneError, tone } from './audio.js'
import {
  clamp, formatCents, frequency, IN_TUNE_CENTS, isPracticePitchInTune, makePitchReader,
  MAX_PRACTICE_MIDI, MAX_PRACTICE_RANGE,
  MIN_PRACTICE_MIDI, nearestPracticeNote, noteName, PITCH_NAMES, practiceBounds,
} from './music.js'
import { $, save, state } from './state.js'

const traceSeconds = 10
const readoutHoldSeconds = 0.18
const canvas = $('pitch-chart')
const context = canvas.getContext('2d')
const chartStyle = getComputedStyle(canvas)
const traceColors = ['--accent', '--in-tune'].map(color => chartStyle.getPropertyValue(color).trim())
const status = $('practice-status')
let trace = state.practice?.target === state.target ? state.practice.trace : []
let elapsed = trace.at(-1)?.time ?? 0
let { low, high } = practiceBounds(state.target, state.practiceRange)
let stream, source, analyser, samples, readPitch
let starting = false
let request = 0
let frame = 0
let started = 0
let previousFrame = 0
let ignoreUntil = 0
let reference
let referenceRequest = 0

function appendOption(select, value, label) {
  select.add(new Option(label, value))
}

PITCH_NAMES.forEach((name, pitch) => appendOption($('target-note'), pitch, name))
for (let octave = 2; octave <= 5; octave++) appendOption($('target-octave'), octave, octave)

function setTarget() {
  $('target-note').value = state.target % 12
  $('target-octave').value = Math.floor(state.target / 12) - 1
  $('target-display').textContent = noteName(state.target)
  $('target-frequency').textContent = frequency(state.target).toFixed(1) + ' Hz'
}

function setRange() {
  const bounds = practiceBounds(state.target, state.practiceRange)
  low = bounds.low
  high = bounds.high
  $('practice-range').value = state.practiceRange
  $('range-endpoints').textContent = low === high ? noteName(low) + ' only' : noteName(low) + ' to ' + noteName(high)
  canvas.setAttribute('aria-label', 'Sung notes from ' + noteName(low) + ' to ' + noteName(high) + ' over the last ten seconds')
  canvas.parentElement.style.setProperty('--pitch-chart-height', clamp((high - low + 1) * 14 + 35, 248, 465) + 'px')

  const select = $('reference-note')
  select.replaceChildren()
  for (let midi = low; midi <= high; midi++) appendOption(select, midi, noteName(midi))
  if (state.referenceNote !== null && (state.referenceNote < low || state.referenceNote > high)) state.referenceNote = null
  select.value = state.referenceNote ?? state.target
}

function configureReader(sampleRate) {
  const lowestHz = frequency(low - 0.5)
  const length = Math.max(2048, 2 ** Math.ceil(Math.log2(3 * sampleRate / lowestHz)))
  if (analyser.fftSize === length && samples && readPitch) return
  analyser.fftSize = length
  samples = new Float32Array(length)
  readPitch = makePitchReader(length, sampleRate, frequency(MIN_PRACTICE_MIDI - 0.5), frequency(MAX_PRACTICE_MIDI + 0.5))
}

function draw() {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) return
  const scale = window.devicePixelRatio || 1
  const pixelWidth = Math.round(width * scale)
  const pixelHeight = Math.round(height * scale)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, width, height)
  const labelGutter = 42
  const left = labelGutter, right = width - labelGutter, top = 12, bottom = height - 23
  const bottomCents = (low - state.target) * 100 - 50
  const topCents = (high - state.target) * 100 + 50
  const y = cents => top + (topCents - cents) * (bottom - top) / (topCents - bottomCents)
  const start = Math.max(0, elapsed - traceSeconds)
  const x = time => left + (time - start) * (right - left) / traceSeconds
  const label = (text, x, y, align = 'right', color = '#a7abb8') => {
    context.fillStyle = color
    context.font = '10px ui-monospace, monospace'
    context.textAlign = align
    context.fillText(text, x, y)
  }
  const labelPitch = (text, cents, color) => {
    const baseline = y(cents) + 3
    label(text, left - 7, baseline, 'right', color)
    label(text, right + 7, baseline, 'left', color)
  }
  const line = (x1, y1, x2, y2, color, dashed = false) => {
    context.strokeStyle = color
    context.lineWidth = 1
    context.setLineDash(dashed ? [4, 4] : [])
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
  }
  const rowHeight = (bottom - top) / (high - low + 1)
  for (let midi = low; midi <= high; midi++) {
    const cents = (midi - state.target) * 100
    const center = midi === state.target
    context.fillStyle = center ? '#baf88122' : '#baf8810b'
    const bandTop = y(cents + IN_TUNE_CENTS)
    const bandBottom = y(cents - IN_TUNE_CENTS)
    context.fillRect(left, bandTop, right - left, bandBottom - bandTop)
    line(left, y(cents), right, y(cents), center ? '#91a381' : '#333741', center)
    const enoughSpace = rowHeight >= 11
    const spacedLabel = Math.abs(midi - state.target) % Math.ceil(13 / rowHeight) === 0
    if (enoughSpace || spacedLabel) {
      labelPitch(noteName(midi), cents, center ? '#baf881' : undefined)
    }
  }
  if (low === high) {
    for (const cents of [-50, -25, 25, 50]) {
      line(left, y(cents), right, y(cents), '#2f333d')
      labelPitch((cents > 0 ? '+' : '') + cents + '¢', cents)
    }
  }
  for (let seconds = 0; seconds <= traceSeconds; seconds += 2) {
    const time = start + seconds
    const axisX = x(time)
    line(axisX, top, axisX, bottom, '#2f333d')
    label(Math.round(time) + 's', axisX, height - 5, seconds === traceSeconds ? 'right' : 'center')
  }
  context.save()
  context.beginPath()
  context.rect(left, top, right - left, bottom - top)
  context.clip()
  context.lineWidth = 2
  context.lineCap = 'round'
  const paths = [new Path2D(), new Path2D()]
  let previous
  for (const point of trace) {
    if (point.cents === null || point.time < start || point.cents < bottomCents || point.cents >= topCents) {
      previous = null
      continue
    }
    const px = x(point.time)
    const py = y(point.cents)
    const color = Number(isPracticePitchInTune(state.target, point.cents, low, high))
    const path = paths[color]
    // Keep an abrupt note change from painting a continuous in-tune line across the gap.
    if (!previous || point.time - previous.time >= 0.18 || Math.abs(point.cents - previous.cents) >= 50) {
      path.moveTo(px, py)
      path.lineTo(px + 0.4, py)
    } else if (color === previous.color) {
      path.moveTo(previous.x, previous.y)
      path.lineTo(px, py)
    } else {
      const midX = (previous.x + px) / 2
      const midY = (previous.y + py) / 2
      paths[previous.color].moveTo(previous.x, previous.y)
      paths[previous.color].lineTo(midX, midY)
      path.moveTo(midX, midY)
      path.lineTo(px, py)
    }
    previous = { x: px, y: py, time: point.time, cents: point.cents, color }
  }
  paths.forEach((path, index) => {
    context.strokeStyle = traceColors[index]
    context.stroke(path)
  })
  context.restore()
  $('chart-empty').hidden = Boolean(stream) || trace.some(point => point.cents !== null)
}

function updateStats() {
  const valid = trace.filter(point => point.cents !== null)
  const latest = valid.at(-1)
  const current = latest && elapsed - latest.time <= readoutHoldSeconds
    ? nearestPracticeNote(state.target, latest.cents)
    : null
  const inTune = valid.filter(point => isPracticePitchInTune(state.target, point.cents, low, high))
  $('detected-note').textContent = current ? noteName(current.midi) : '—'
  const pitchError = $('pitch-error')
  const formattedError = formatCents(current?.error)
  if (pitchError.textContent !== formattedError) pitchError.textContent = formattedError
  $('pitch-accuracy').textContent = valid.length ? Math.round(100 * inTune.length / valid.length) + '%' : '—'
}

function updateControls(label, message) {
  const button = $('practice-mic')
  button.lastElementChild.textContent = stream ? 'Stop listening' : 'Start listening'
  button.classList.toggle('recording', Boolean(stream))
  button.disabled = starting
  $('practice-state').textContent = label
  $('practice-state').classList.toggle('active', Boolean(stream))
  status.textContent = message
  draw()
}

function tick(now) {
  if (!stream) return
  if (now - previousFrame >= 35) {
    previousFrame = now
    elapsed = (now - started) / 1000
    analyser.getFloatTimeDomainData(samples)
    const pitch = now < ignoreUntil ? null : readPitch(samples)
    trace.push({ time: Math.round(elapsed * 1000) / 1000, cents: pitch === null ? null : Math.round((pitch - state.target) * 100) })
    trace = trace.filter(point => point.time >= elapsed - traceSeconds)
    updateStats()
    draw()
  }
  frame = requestAnimationFrame(tick)
}

export function stopPractice() {
  request++
  referenceRequest++
  reference?.stop()
  reference = null
  const wasListening = Boolean(stream)
  const wasStarting = starting
  starting = false
  cancelAnimationFrame(frame)
  source?.disconnect()
  stream?.getTracks().forEach(track => track.stop())
  source = null
  stream = null
  if (!wasListening && !wasStarting) return
  if (wasListening && trace.some(point => point.cents !== null)) {
    state.practice = { target: state.target, trace }
    const saved = save()
    updateControls('Take complete', saved ? 'Last pitch trace saved on this device.' : 'Last pitch trace is still available in this tab.')
  } else {
    updateControls('Ready', 'Start listening and hold a note.')
  }
}

async function startPractice() {
  const activeRequest = ++request
  starting = true
  updateControls('Waiting', 'Waiting for microphone permission…')
  let acquired
  try {
    const ctx = await audioContext()
    acquired = await microphone()
    if (activeRequest !== request) {
      acquired.getTracks().forEach(track => track.stop())
      return
    }
    source = ctx.createMediaStreamSource(acquired)
    analyser = ctx.createAnalyser()
    samples = null
    configureReader(ctx.sampleRate)
    source.connect(analyser)
    stream = acquired
    acquired.getAudioTracks()[0]?.addEventListener('ended', stopPractice, { once: true })
    starting = false
    trace = []
    elapsed = 0
    started = performance.now()
    previousFrame = started
    updateStats()
    updateControls('Listening', 'Sing any note in range and follow the green trace.')
    frame = requestAnimationFrame(tick)
  } catch (error) {
    acquired?.getTracks().forEach(track => track.stop())
    if (activeRequest !== request) return
    stopPractice()
    updateControls('Ready', microphoneError(error))
  }
}

$('practice-mic').addEventListener('click', () => stream ? stopPractice() : startPractice())
$('play-target').addEventListener('click', async () => {
  const activeRequest = ++referenceRequest
  try {
    const ctx = await audioContext()
    if (activeRequest !== referenceRequest) return
    reference?.stop()
    ignoreUntil = performance.now() + 850 + (samples?.length ?? 0) / ctx.sampleRate * 1000
    reference = tone(ctx, frequency(state.referenceNote ?? state.target), ctx.currentTime + 0.01, 0.8)
  } catch {
    status.textContent = 'Reference playback is unavailable in this browser.'
  }
})
for (const id of ['target-note', 'target-octave']) {
  $(id).addEventListener('change', () => {
    state.target = Number($('target-note').value) + (Number($('target-octave').value) + 1) * 12
    trace = []
    elapsed = 0
    started = performance.now()
    state.referenceNote = null
    setTarget()
    applyRange()
  })
}

function applyRange() {
  setRange()
  if (stream) configureReader(source.context.sampleRate)
  updateStats()
  draw()
  save()
}

$('practice-range').addEventListener('change', () => {
  const value = $('practice-range').valueAsNumber
  if (Number.isFinite(value)) state.practiceRange = clamp(Math.round(value), 0, MAX_PRACTICE_RANGE)
  applyRange()
})
$('reference-note').addEventListener('change', () => {
  state.referenceNote = Number($('reference-note').value)
  save()
})

setTarget()
setRange()
updateStats()
if (trace.length) updateControls('Previous take', 'Showing your last saved pitch trace for this center note.')
new ResizeObserver(draw).observe(canvas)
