# Fretboard Atlas

An interactive guitar fretboard for learning scales. Pick a key and scale, choose how much of the neck to show, and see every note laid out with correct spelling, octave numbers, and colour-coded octaves.

**Live site:** https://mct-devs.github.io/fretboard-atlas/

## Features

- **Keys and scales:** 14 keys and 13 scales, including the major modes, harmonic and melodic minor, major and minor pentatonic, blues, and chromatic.
- **Map types** for focused practice:
  - **Entire fretboard:** every scale note on the whole neck.
  - **Across:** a fret window (start fret and span) across all strings, for practising a position.
  - **Along:** selected strings across all frets, for moving up and down the neck.
- **Dim notes outside map:** keeps the rest of the neck visible for context.
- **Octave colours:** each octave has its own colour, so you can see where a scale crosses into the next octave. Root notes are marked with a white ring.
- **Labels:** note names, scale degrees (1, ♭3, 5…), or none for self-testing. With note names, you can optionally add octave numbers as subscripts in scientific pitch notation (middle C = C₄).
- **Correct spelling:** notes are spelled for the key (B♭ in F major, E♯ in C♯ major), and octave numbers follow the letter name (B♯₃ sounds as C₄).
- **Tunings:** Standard, Drop D, Half-step down, DADGAD, and Open G.
- **Fret count:** 21, 22, or 24 frets, with realistic fret spacing.

## Running locally

There's no build step or server. Open `index.html` in a browser.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page layout and controls |
| `style.css` | Styling |
| `app.js` | Fretboard rendering (SVG) and UI wiring |
| `theory.js` | Music theory: scales, note spelling, octaves, tunings |

`theory.js` has no DOM dependencies and can be loaded in Node for testing:

```sh
node -e 'const T = require("./theory.js"); console.log([...T.buildScale("F", "Major (Ionian)").byInterval.values()].map(n => n.name).join(" "))'
# F G A B♭ C D E
```
