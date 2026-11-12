# Pitch Control

A browser-based pitch trainer and monophonic melody transcriber. Audio is processed on the device. Settings, the latest completed pitch trace, recordings, and edited scores are saved under the page's origin in browser localStorage.

## Run locally

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. For a hosted copy, run `npm run build` and serve `dist/` over HTTPS so the browser can grant microphone permission. `npm test` runs the signal and score timing checks.

## Use

- **Pitch practice** shows a chromatic pitch trace around a center note, with an adjustable range that defaults to ±12 semitones. Pick any visible note for reference playback. The cents readout is relative to the nearest note, and accuracy is the share of voiced frames within 15 cents of a note in range. The last completed trace is kept without recording practice audio.
- **Melody to score** records or imports one voice and transcribes up to 20 seconds. Set the tempo or use the recording metronome, choose an eighth- or sixteenth-note grid, then play or edit the resulting 4/4 score. Use headphones if recording with the metronome. A pause or distinct attack helps separate repeated pitches.
- Each saved take includes a compact mono copy of the input. Storage capacity depends on the browser. When it fills, the page reports which changes remain in memory, and deleting old takes frees space. Clearing browser site data removes the takes.

## Practice backing

Pitch practice includes a warm synthesized reference tone. Play a single-note drone or choose one of 20 chord progressions and transpose it by changing the tonic. The chord cards show each Roman numeral, chord name, voicing, and duration. **Harmonic rhythm** controls the beats per chord. **Playing pattern** controls when the chord tones sound and can run across chord changes. A short chord may fall entirely on a rest in a syncopated pattern. With **12-bar blues**, four beats per step gives the standard form in 4/4.

Use headphones when singing over the backing. The pitch detector listens for one pitch at a time, and speaker bleed can interfere with it. Backing audio is synthesized in the browser and the settings are saved locally.

Preset terminology and patterns draw on [Open Music Theory on pop harmony](https://openmusictheory.github.io/popRockHarmony.html), [Open Music Theory on rhythm and meter](https://viva.pressbooks.pub/openmusictheory/chapter/rhythm-and-meter-in-pop-music/), and [Berklee's chord progression guide](https://online.berklee.edu/takenote/common-chord-progressions-and-how-to-make-them-your-own/).
