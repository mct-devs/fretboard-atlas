const Theory = (() => {
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];

  const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];

  // Scales are defined by degree labels so note spelling falls out of the
  // degree number (each degree maps to a distinct letter name).
  const SCALES = {
    "Major (Ionian)":       ["1", "2", "3", "4", "5", "6", "7"],
    "Natural Minor (Aeolian)": ["1", "2", "b3", "4", "5", "b6", "b7"],
    "Dorian":               ["1", "2", "b3", "4", "5", "6", "b7"],
    "Phrygian":             ["1", "b2", "b3", "4", "5", "b6", "b7"],
    "Lydian":               ["1", "2", "3", "#4", "5", "6", "7"],
    "Mixolydian":           ["1", "2", "3", "4", "5", "6", "b7"],
    "Locrian":              ["1", "b2", "b3", "4", "b5", "b6", "b7"],
    "Harmonic Minor":       ["1", "2", "b3", "4", "5", "b6", "7"],
    "Melodic Minor":        ["1", "2", "b3", "4", "5", "6", "7"],
    "Major Pentatonic":     ["1", "2", "3", "5", "6"],
    "Minor Pentatonic":     ["1", "b3", "4", "5", "b7"],
    "Blues":                ["1", "b3", "4", "b5", "5", "b7"],
    "Chromatic":            null,  // degrees chosen per key, see chromaticDegrees()
  };

  const FLAT_KEYS = new Set(["F", "Db", "Eb", "Gb", "Ab", "Bb"]);
  const CHROMATIC_LABELS = new Set(["1", "#1", "b2", "2", "#2", "b3", "3", "4", "#4", "b5", "5", "#5", "b6", "6", "#6", "b7", "7"]);

  // Lowest string first.
  const TUNINGS = {
    "Standard (E A D G B E)": ["E2", "A2", "D3", "G3", "B3", "E4"],
    "Drop D (D A D G B E)":   ["D2", "A2", "D3", "G3", "B3", "E4"],
    "Half-step down":         ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
    "DADGAD":                 ["D2", "A2", "D3", "G3", "A3", "D4"],
    "Open G (D G D G B D)":   ["D2", "G2", "D3", "G3", "B3", "D4"],
  };

  const mod = (n, m) => ((n % m) + m) % m;

  function parseAccidental(s) {
    let acc = 0;
    for (const ch of s) acc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
    return acc;
  }

  function parseNote(name) {
    const letterIdx = LETTERS.indexOf(name[0]);
    const acc = parseAccidental(name.slice(1));
    return { letterIdx, pc: mod(LETTER_PC[letterIdx] + acc, 12) };
  }

  function parseDegree(deg) {
    const m = deg.match(/^([b#]*)(\d+)$/);
    const num = Number(m[2]);
    return { num, semis: MAJOR_SEMIS[num - 1] + parseAccidental(m[1]) };
  }

  function accidentalSymbol(acc) {
    return { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" }[acc] ?? "";
  }

  // Fixed degree lists can't spell the chromatic scale well in every key
  // (1 b2 2 ... gives E𝄫 in D♭), so pick each note's spelling individually:
  // prefer naturals, then the key's accidental direction, rejecting any
  // spelling whose degree would read oddly (♭1, ♯3, ♭4, ♯7). In C♯ that picks
  // E♯ and B♯ over F and C; in G♭ it picks C♭ over B.
  function chromaticDegrees(root, preferFlats) {
    const preferred = preferFlats ? -1 : 1;
    const degrees = [];
    for (let semis = 0; semis < 12; semis++) {
      const pc = mod(root.pc + semis, 12);
      const candidates = LETTERS.map((_, letterIdx) => ({
        letterIdx,
        acc: mod(pc - LETTER_PC[letterIdx] + 6, 12) - 6,
      }))
        .filter((c) => Math.abs(c.acc) <= 1)
        .sort((a, b) => (a.acc === 0 ? -1 : b.acc === 0 ? 1 : a.acc === preferred ? -1 : 1));
      for (const { letterIdx } of candidates) {
        const num = mod(letterIdx - root.letterIdx, 7) + 1;
        const offset = mod(semis - MAJOR_SEMIS[num - 1] + 6, 12) - 6;
        const label = (offset < 0 ? "b" : "#").repeat(Math.abs(offset)) + num;
        if (CHROMATIC_LABELS.has(label)) {
          degrees.push(label);
          break;
        }
      }
    }
    return degrees;
  }

  // Returns a map from semitones-above-root (0..11) to the spelled note.
  function buildScale(keyName, scaleName) {
    const root = parseNote(keyName);
    const byInterval = new Map();
    const degrees = SCALES[scaleName] ?? chromaticDegrees(root, FLAT_KEYS.has(keyName));
    for (const deg of degrees) {
      const { num, semis } = parseDegree(deg);
      const letterIdx = (root.letterIdx + num - 1) % 7;
      const pc = mod(root.pc + semis, 12);
      const acc = mod(pc - LETTER_PC[letterIdx] + 6, 12) - 6;
      byInterval.set(mod(semis, 12), {
        degree: deg.replace("b", "♭").replace("#", "♯"),
        letter: LETTERS[letterIdx],
        acc,
        name: LETTERS[letterIdx] + accidentalSymbol(acc),
      });
    }
    return { rootPc: root.pc, byInterval };
  }

  // Octave follows the letter name (scientific pitch notation): B♯3 sounds
  // as C4 and C♭4 sounds as B3.
  function noteAt(scale, midi) {
    const info = scale.byInterval.get(mod(midi - scale.rootPc, 12));
    if (!info) return null;
    const octave = Math.floor((midi - info.acc) / 12) - 1;
    return { ...info, midi, octave, isRoot: info.degree === "1" };
  }

  // Parses names like "Eb2" into the open-string pitch and its display name.
  function tuningStrings(tuningName) {
    return TUNINGS[tuningName].map((pitch) => {
      const m = pitch.match(/^([A-G])([b#]*)(-?\d+)$/);
      const letterIdx = LETTERS.indexOf(m[1]);
      const acc = parseAccidental(m[2]);
      return {
        midi: (Number(m[3]) + 1) * 12 + LETTER_PC[letterIdx] + acc,
        name: m[1] + accidentalSymbol(acc),
      };
    });
  }

  return { KEYS, SCALES, TUNINGS, buildScale, noteAt, tuningStrings };
})();

if (typeof module !== "undefined") module.exports = Theory;
