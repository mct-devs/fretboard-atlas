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

  // Chords offered for scales that aren't seven notes (pentatonic, blues), and
  // for seven-note scales at the "All that fit" depth: every one whose tones
  // all fall in the scale. Tones are intervals above the chord root, written
  // like scale degrees.
  const FIT_CHORDS = [
    { suffix: "",     tones: ["1", "3", "5"] },
    { suffix: "m",    tones: ["1", "b3", "5"] },
    { suffix: "dim",  tones: ["1", "b3", "b5"] },
    { suffix: "aug",  tones: ["1", "3", "#5"] },
    { suffix: "sus2", tones: ["1", "2", "5"] },
    { suffix: "sus4", tones: ["1", "4", "5"] },
    { suffix: "6",    tones: ["1", "3", "5", "6"] },
    { suffix: "m6",   tones: ["1", "b3", "5", "6"] },
    { suffix: "7",    tones: ["1", "3", "5", "b7"] },
    { suffix: "maj7", tones: ["1", "3", "5", "7"] },
    { suffix: "m7",   tones: ["1", "b3", "5", "b7"] },
    { suffix: "m7♭5", tones: ["1", "b3", "b5", "b7"] },
    { suffix: "dim7", tones: ["1", "b3", "b5", "bb7"] },
    { suffix: "7♯5",  tones: ["1", "3", "#5", "b7"] },
  ];

  // Seven-note scales build one chord per degree by stacking thirds from the
  // scale. Intervals here are those of a major 9th chord.
  const STACK = [{ num: 1, semis: 0 }, { num: 3, semis: 4 }, { num: 5, semis: 7 }, { num: 7, semis: 11 }, { num: 9, semis: 14 }];
  const TRIAD_SUFFIX = { "3 5": "", "b3 5": "m", "b3 b5": "dim", "3 #5": "aug" };
  const SEVENTH_SUFFIX = {
    "3 5 7": "maj7", "3 5 b7": "7", "b3 5 b7": "m7", "b3 b5 b7": "m7♭5",
    "b3 b5 bb7": "dim7", "b3 5 7": "m(maj7)", "3 #5 7": "maj7♯5", "3 #5 b7": "7♯5",
  };
  const NINTH_SUFFIX = { "maj7": "maj9", "7": "9", "m7": "m9", "m(maj7)": "m(maj9)", "m7♭5": "m9♭5" };
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

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

  function prettyDegree(deg) {
    return deg.replaceAll("b", "♭").replaceAll("#", "♯");
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
    const hz = 440 * 2 ** ((midi - 69) / 12);
    return { ...info, midi, octave, hz, isRoot: info.degree === "1" };
  }

  // "stacked" for seven-note scales, "fit" for the others, null when no
  // chords are offered (chromatic).
  function chordStyle(scaleName) {
    const degrees = SCALES[scaleName];
    if (!degrees) return null;
    return degrees.length === 7 ? "stacked" : "fit";
  }

  function stackedSuffix(labels) {
    const fallback = `(${labels.slice(1).map(prettyDegree).join(" ")})`;
    const triad = TRIAD_SUFFIX[labels.slice(1, 3).join(" ")];
    if (labels.length === 3) return triad ?? fallback;
    const seventh = SEVENTH_SUFFIX[labels.slice(1, 4).join(" ")];
    if (seventh === undefined) return fallback;
    if (labels.length === 4) return seventh;
    return (labels[4] === "9" && NINTH_SUFFIX[seventh]) || `${seventh}(${prettyDegree(labels[4])})`;
  }

  // Each chord's tones are keyed by semitones above the key root, like
  // scale.byInterval. depth only applies to seven-note scales: the number of
  // stacked thirds (3 = triad, 4 = 7th, 5 = 9th), or "fit" for every chord
  // type that fits. Fitted chords carry a group (their root) for display.
  function chordsForScale(scaleName, scale, depth) {
    const notes = [...scale.byInterval].sort((a, b) => a[0] - b[0]);
    const style = chordStyle(scaleName);

    if (style === "stacked" && depth !== "fit") {
      return notes.map(([rootSemis, root], i) => {
        const tones = new Map();
        const labels = [];
        for (let k = 0; k < Number(depth); k++) {
          const semis = notes[(i + 2 * k) % notes.length][0];
          const offset = mod(semis - rootSemis - STACK[k].semis + 6, 12) - 6;
          const label = (offset < 0 ? "b" : "#").repeat(Math.abs(offset)) + STACK[k].num;
          labels.push(label);
          // A 9th chord has more tones than a hand comfortably covers, so its
          // shapes may leave out the natural 5th.
          tones.set(semis, { label: prettyDegree(label), optional: depth > 4 && label === "5" });
        }
        const name = root.name + stackedSuffix(labels);
        const [, acc, num] = root.degree.match(/^(\D*)(\d+)$/);
        const numeral = labels[1] === "b3" ? ROMAN[num - 1].toLowerCase() : ROMAN[num - 1];
        return { name, label: `${acc}${numeral} · ${name}`, tones };
      });
    }

    if (style) {
      const chords = [];
      for (const [rootSemis, root] of notes) {
        for (const { suffix, tones: degrees } of FIT_CHORDS) {
          const tones = new Map();
          for (const deg of degrees) {
            const semis = mod(rootSemis + parseDegree(deg).semis, 12);
            if (!scale.byInterval.has(semis)) break;
            tones.set(semis, { label: prettyDegree(deg), optional: false });
          }
          if (tones.size === degrees.length) {
            chords.push({ name: root.name + suffix, label: root.name + suffix, group: `${root.degree} · ${root.name}`, tones });
          }
        }
      }
      return chords;
    }

    return [];
  }

  // Playable shapes for a chord as { frets, position }. frets has one entry
  // per string (lowest first): a fret number, or null for a string that isn't
  // played. position is the lowest fretted fret, or 0 for open shapes. Strings are only left
  // unplayed on the bass side so every shape can be strummed, and the lowest
  // played note is the root. Keeps the fullest shape at each neck position,
  // ordered up the neck.
  function chordShapes(chord, scale, tuning, numFrets) {
    const MAX_SPAN = 3;            // frets between lowest and highest fretted notes
    const MAX_OPEN_POSITION = 4;   // open strings only combine with low shapes
    const tones = [...chord.tones.values()];
    const root = tones.find((t) => t.label === "1");
    const toneAt = (s, f) => chord.tones.get(mod(tuning[s].midi + f - scale.rootPc, 12));
    const best = new Map();
    const frets = [];

    function consider(lo, open) {
      const played = frets.flatMap((f, s) => (f === null ? [] : [{ f, tone: toneAt(s, f) }]));
      if (played.length < 3) return;
      const present = new Set(played.map((p) => p.tone));
      const missing = tones.filter((t) => !present.has(t));
      if (missing.some((t) => !t.optional)) return;
      if (played[0].tone !== root) return;
      // Fingers beyond four mean the index finger barres the lowest fret.
      if (played.filter((p) => p.f > lo).length > 3) return;

      const position = open ? 0 : lo;
      const fretted = played.filter((p) => p.f > 0).length;
      const score = played.length * 2 - missing.length * 3 - fretted * 0.1;
      if (!best.has(position) || score > best.get(position).score) {
        best.set(position, { frets: [...frets], score });
      }
    }

    function search(s, lo, hi, open) {
      if (s === tuning.length) return consider(lo, open);
      if (s === 0 || frets[s - 1] === null) {
        frets[s] = null;
        search(s + 1, lo, hi, open);
      }
      for (let f = 0; f <= numFrets; f++) {
        if (!toneAt(s, f)) continue;
        const nlo = f > 0 ? Math.min(lo, f) : lo;
        const nhi = f > 0 ? Math.max(hi, f) : hi;
        const nopen = open || f === 0;
        if (nhi - nlo > MAX_SPAN || (nopen && nhi > MAX_OPEN_POSITION)) continue;
        frets[s] = f;
        search(s + 1, nlo, nhi, nopen);
      }
    }

    search(0, Infinity, -Infinity, false);
    return [...best].sort((a, b) => a[0] - b[0]).map(([position, v]) => ({ frets: v.frets, position }));
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

  return { KEYS, SCALES, TUNINGS, buildScale, noteAt, chordStyle, chordsForScale, chordShapes, tuningStrings };
})();

if (typeof module !== "undefined") module.exports = Theory;
