import './style.css'
import { $, save, state } from './state.js'
import { stopPractice } from './practice.js'
import { melodyIsBusy, stopMelodyPlayback } from './melody.js'

function showMode(mode, persist = true) {
  if (melodyIsBusy() && mode === 'practice') return
  if (mode === 'melody') stopPractice()
  else stopMelodyPlayback()
  state.mode = mode
  for (const name of ['practice', 'melody']) {
    $(name).hidden = name !== mode
    $(name + '-tab').setAttribute('aria-pressed', String(name === mode))
  }
  if (persist) save()
}

$('practice-tab').addEventListener('click', () => showMode('practice'))
$('melody-tab').addEventListener('click', () => showMode('melody'))
window.addEventListener('pagehide', () => {
  stopPractice()
  stopMelodyPlayback()
})
showMode(state.mode, false)
