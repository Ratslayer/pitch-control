export const $ = id => document.getElementById(id)
const key = 'pitch-control-v1'
const defaults = {
  mode: 'practice', target: 57, practiceRange: 12, referenceNote: null, tempo: 90, grid: 2, metronome: false,
  practice: null, takes: [], selected: null,
}

export const state = { ...defaults }
try {
  const saved = JSON.parse(localStorage.getItem(key))
  if (saved) Object.assign(state, saved)
} catch {
  showStorageNotice('Saved data could not be read in this browser.')
}

function showStorageNotice(message) {
  const notice = $('storage-status')
  notice.textContent = message
  notice.hidden = !message
}

export function save() {
  try {
    localStorage.setItem(key, JSON.stringify(state))
    showStorageNotice('')
    return true
  } catch (error) {
    const quota = error.name === 'QuotaExceededError'
    showStorageNotice(quota
      ? 'Local storage is full. Delete a saved melody to make room. Recent changes are only in this tab until they fit.'
      : 'This browser is blocking local storage. Recent changes are only in this tab.')
    return false
  }
}
