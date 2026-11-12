# Pitch Control

A browser-based pitch trainer and monophonic melody transcriber. Audio is processed on the device. Settings, the latest completed pitch trace, recordings, and edited scores are saved under the page's origin in browser localStorage.

## Run locally

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. For a hosted copy, run `npm run build` and serve `dist/` over HTTPS so the browser can grant microphone permission. `npm test` runs the signal and score timing checks.

## Use

- **Pitch practice** plays a reference tone and shows live deviation from the target in cents. The accuracy figure covers the voiced frames in the displayed 10-second window. The last completed trace is kept without recording practice audio.
- **Melody to score** records or imports one voice and transcribes up to 20 seconds. Set the tempo or use the recording metronome, choose an eighth- or sixteenth-note grid, then play or edit the resulting 4/4 score. Use headphones if recording with the metronome. A pause or distinct attack helps separate repeated pitches.
- Each saved take includes a compact mono copy of the input. Storage capacity depends on the browser. When it fills, the page reports which changes remain in memory, and deleting old takes frees space. Clearing browser site data removes the takes.
