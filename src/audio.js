let context
export async function audioContext() {
  context ??= new AudioContext()
  if (context.state !== 'running') await context.resume()
  return context
}

export async function microphone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access requires a supported browser over HTTPS or localhost.')
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
}

export function microphoneError(error) {
  if (error.name === 'NotAllowedError') return 'Microphone permission was denied. Allow it in your browser and try again.'
  if (error.name === 'NotFoundError') return 'No microphone found.'
  if (error.name === 'NotReadableError') return 'The microphone is unavailable. Check whether another app is using it.'
  return error.message || 'Could not start the microphone.'
}

export function tone(ctx, hz, start, length, { volume = 0.16, type = 'triangle' } = {}) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = hz
  gain.gain.setValueAtTime(0.001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, start + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + length)
  return osc
}

export function startMetronome(ctx, bpm) {
  let next = ctx.currentTime + 0.04
  let beat = 0
  let click
  function schedule() {
    while (next < ctx.currentTime + 0.1) {
      if (next >= ctx.currentTime) {
        click = tone(ctx, beat % 4 === 0 ? 1200 : 850, next, 0.045, { volume: 0.09, type: 'sine' })
      }
      next += 60 / bpm
      beat++
    }
  }
  schedule()
  const timer = setInterval(schedule, 25)
  return () => {
    clearInterval(timer)
    click?.stop()
  }
}

export function blobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
