import { audioContext, microphone, microphoneError, tone } from './audio.js'
import { frequency, makePitchReader, noteName, PITCH_NAMES } from './music.js'
import { $, save, state } from './state.js'

const traceSeconds = 10
const canvas = $('pitch-chart')
const context = canvas.getContext('2d')
const status = $('practice-status')
let trace = state.practice?.target === state.target ? state.practice.trace : []
let elapsed = trace.at(-1)?.time ?? 0
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
  const left = 42, right = width - 7, top = 12, bottom = height - 23
  const centsRange = Math.max(100, Math.ceil(Math.max(0, ...trace.map(p => Math.abs(p.cents))) / 100) * 100)
  const y = cents => top + (centsRange - cents) * (bottom - top) / (2 * centsRange)
  const start = Math.max(0, elapsed - traceSeconds)
  const x = time => left + (time - start) * (right - left) / traceSeconds
  const label = (text, x, y, align = 'right') => {
    context.fillStyle = '#a7abb8'
    context.font = '10px ui-monospace, monospace'
    context.textAlign = align
    context.fillText(text, x, y)
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
  context.fillStyle = '#baf88116'
  context.fillRect(left, y(15), right - left, y(-15) - y(15))
  for (let i = -2; i <= 2; i++) {
    const cents = i * centsRange / 2
    line(left, y(cents), right, y(cents), cents ? '#2f333d' : '#91a381', cents === 0)
    label((cents > 0 ? '+' : '') + cents, left - 7, y(cents) + 3)
  }
  for (let seconds = 0; seconds <= traceSeconds; seconds += 2) {
    const time = start + seconds
    const axisX = x(time)
    line(axisX, top, axisX, bottom, '#2f333d')
    label(Math.round(time) + 's', axisX, height - 5, seconds === traceSeconds ? 'right' : 'center')
  }
  context.strokeStyle = '#baf881'
  context.fillStyle = '#baf881'
  context.lineWidth = 2
  context.beginPath()
  let previous
  for (const point of trace) {
    if (point.cents === null || point.time < start) {
      previous = null
      continue
    }
    const pointX = x(point.time)
    const pointY = y(point.cents)
    if (previous !== null && previous !== undefined && point.time - previous < 0.18) {
      context.lineTo(pointX, pointY)
    } else {
      context.moveTo(pointX, pointY)
      context.lineTo(pointX + 0.4, pointY)
    }
    previous = point.time
  }
  context.stroke()
  $('chart-empty').hidden = Boolean(stream) || trace.some(point => point.cents !== null)
}

function updateStats() {
  const current = trace.at(-1)
  const cents = current?.cents
  const valid = trace.filter(point => point.cents !== null)
  $('detected-note').textContent = cents == null ? '—' : noteName(Math.round(state.target + cents / 100))
  $('pitch-error').textContent = cents == null ? '—' : (cents > 0 ? '+' : '') + cents + ' ¢'
  $('pitch-accuracy').textContent = valid.length
    ? Math.round(100 * valid.filter(point => Math.abs(point.cents) <= 15).length / valid.length) + '%'
    : '—'
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
    analyser.fftSize = ctx.sampleRate > 48000 ? 4096 : 2048
    samples = new Float32Array(analyser.fftSize)
    readPitch = makePitchReader(samples.length, ctx.sampleRate)
    source.connect(analyser)
    stream = acquired
    acquired.getAudioTracks()[0]?.addEventListener('ended', stopPractice, { once: true })
    starting = false
    trace = []
    elapsed = 0
    started = performance.now()
    previousFrame = started
    updateStats()
    updateControls('Listening', 'Sing a steady note and follow the green trace.')
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
    ignoreUntil = performance.now() + 950
    reference = tone(ctx, frequency(state.target), ctx.currentTime + 0.01, 0.8)
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
    setTarget()
    updateStats()
    draw()
    save()
  })
}

setTarget()
updateStats()
if (trace.length) updateControls('Previous take', 'Showing your last saved pitch trace for this note.')
new ResizeObserver(draw).observe(canvas)
