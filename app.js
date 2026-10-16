(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
  const DOUBLE_INLAYS = [12, 24];

  const LAYOUT = {
    width: 1400,
    left: 90,     // room for string labels and open-string notes
    right: 20,
    top: 34,
    stringGap: 40,
    bottom: 44,
    openNoteX: 62,
    maxRadius: 13,
  };

  const COLORS = {
    board: "#3b2a1e",
    fret: "#b8b8b8",
    nut: "#efe9dc",
    string: "#d8d2c4",
    inlay: "#e9e1cf",
    window: "rgba(46, 134, 171, 0.18)",
    rootRing: "#ffffff",
    label: "#ffffff",
    muted: "#9aa0a6",
  };

  // Keyed by octave number.
  const OCTAVE_COLORS = {
    1: "#6b7280",
    2: "#8e5bd6",
    3: "#2e86ab",
    4: "#3a9e5c",
    5: "#b8901c",
    6: "#c2569a",
    7: "#6b7280",
  };

  const $ = (id) => document.getElementById(id);
  const svg = $("fretboard");

  // Indexes into the tuning array (0 = lowest-pitched string).
  const selectedStrings = new Set([0, 1]);

  function fillSelect(select, values, selected) {
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = v;
      if (v === selected) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function el(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    svg.appendChild(node);
    return node;
  }

  function tspan(attrs, text) {
    const node = document.createElementNS(SVG_NS, "tspan");
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.textContent = text;
    return node;
  }

  // Don't write the clamped value back: that fights the user mid-typing.
  function clampInput(input, min, max) {
    return Math.min(max, Math.max(min, Math.round(Number(input.value) || 0)));
  }

  function readState() {
    const frets = Number($("frets").value);
    return {
      key: $("key").value,
      scale: $("scale").value,
      tuning: Theory.tuningStrings($("tuning").value),
      frets,
      map: $("map").value,
      labels: $("labels").value,
      showOctave: $("octave").checked,
      ghost: $("ghost").checked,
      startFret: clampInput($("start-fret"), 0, frets),
      span: clampInput($("span"), 1, frets + 1),
    };
  }

  function buildStringOptions() {
    const tuning = Theory.tuningStrings($("tuning").value);
    const container = $("string-options");
    container.replaceChildren();
    const caption = document.createElement("span");
    caption.textContent = "Strings:";
    caption.style.color = COLORS.muted;
    container.appendChild(caption);

    // List high string first, matching the diagram top-to-bottom.
    for (let s = tuning.length - 1; s >= 0; s--) {
      const label = document.createElement("label");
      label.className = "check";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = selectedStrings.has(s);
      box.addEventListener("change", () => {
        box.checked ? selectedStrings.add(s) : selectedStrings.delete(s);
        render();
      });
      label.append(box, ` ${tuning.length - s} (${tuning[s].name})`);
      container.appendChild(label);
    }
  }

  function render() {
    const st = readState();
    const n = st.frets;
    const numStrings = st.tuning.length;
    const { width, left, right, top, stringGap, bottom } = LAYOUT;
    const height = top + (numStrings - 1) * stringGap + bottom;

    $("position-options").hidden = st.map !== "position";
    $("string-options").hidden = st.map !== "strings";

    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // Equal-temperament fret spacing, scaled so fret n lands at the right edge.
    const boardLen = width - left - right;
    const scaleLen = boardLen / (1 - 2 ** (-n / 12));
    const fretX = (f) => left + scaleLen * (1 - 2 ** (-f / 12));
    const noteX = (f) => (f === 0 ? LAYOUT.openNoteX : (fretX(f - 1) + fretX(f)) / 2);
    const stringY = (s) => top + (numStrings - 1 - s) * stringGap;

    const boardTop = stringY(numStrings - 1) - stringGap / 2;
    const boardBottom = stringY(0) + stringGap / 2;
    const midY = (boardTop + boardBottom) / 2;

    el("rect", { x: left, y: boardTop, width: boardLen, height: boardBottom - boardTop, fill: COLORS.board });

    const windowEnd = Math.min(n, st.startFret + st.span - 1);
    const inMap = (s, f) => {
      if (st.map === "position") return f >= st.startFret && f <= windowEnd;
      if (st.map === "strings") return selectedStrings.has(s);
      return true;
    };

    if (st.map === "position") {
      const x1 = st.startFret === 0 ? LAYOUT.openNoteX - 20 : fretX(st.startFret - 1);
      el("rect", { x: x1, y: boardTop, width: fretX(windowEnd) - x1, height: boardBottom - boardTop, fill: COLORS.window });
    } else if (st.map === "strings") {
      for (const s of selectedStrings) {
        if (s >= numStrings) continue;
        el("rect", { x: LAYOUT.openNoteX - 20, y: stringY(s) - stringGap / 2, width: fretX(n) - LAYOUT.openNoteX + 20, height: stringGap, fill: COLORS.window });
      }
    }

    for (const f of SINGLE_INLAYS.filter((f) => f <= n)) {
      el("circle", { cx: noteX(f), cy: midY, r: 6, fill: COLORS.inlay, opacity: 0.6 });
    }
    for (const f of DOUBLE_INLAYS.filter((f) => f <= n)) {
      for (const dy of [-stringGap, stringGap]) {
        el("circle", { cx: noteX(f), cy: midY + dy, r: 6, fill: COLORS.inlay, opacity: 0.6 });
      }
    }

    el("line", { x1: left, x2: left, y1: boardTop, y2: boardBottom, stroke: COLORS.nut, "stroke-width": 6 });
    for (let f = 1; f <= n; f++) {
      el("line", { x1: fretX(f), x2: fretX(f), y1: boardTop, y2: boardBottom, stroke: COLORS.fret, "stroke-width": 2 });
      el("text", { x: noteX(f), y: boardBottom + 16, fill: COLORS.muted, "font-size": 12 }, f);
    }
    el("text", { x: LAYOUT.openNoteX, y: boardBottom + 16, fill: COLORS.muted, "font-size": 12 }, 0);

    for (let s = 0; s < numStrings; s++) {
      const y = stringY(s);
      el("line", { x1: LAYOUT.openNoteX - 20, x2: fretX(n), y1: y, y2: y, stroke: COLORS.string, "stroke-width": 3.2 - s * 0.4 });
      el("text", { x: 18, y, fill: COLORS.muted, "font-size": 13 }, st.tuning[s].name);
    }

    const scale = Theory.buildScale(st.key, st.scale);
    const octavesShown = new Set();
    for (let s = 0; s < numStrings; s++) {
      for (let f = 0; f <= n; f++) {
        const note = Theory.noteAt(scale, st.tuning[s].midi + f);
        if (!note) continue;
        const active = inMap(s, f);
        if (!active && !st.ghost) continue;

        const cx = noteX(f);
        const cy = stringY(s);
        const r = f === 0 ? LAYOUT.maxRadius : Math.min(LAYOUT.maxRadius, (fretX(f) - fretX(f - 1)) / 2 - 1.5);
        const opacity = active ? 1 : 0.2;
        const fill = OCTAVE_COLORS[note.octave];
        if (note.isRoot) {
          // Inset the ring so roots take up the same space as other notes.
          el("circle", { cx, cy, r: r - 1.5, fill, stroke: COLORS.rootRing, "stroke-width": 3, opacity });
        } else {
          el("circle", { cx, cy, r, fill, opacity });
        }
        if (active) octavesShown.add(note.octave);

        const label = st.labels === "note" ? note.name : st.labels === "degree" ? note.degree : "";
        if (label) {
          const sub = st.labels === "note" && st.showOctave ? String(note.octave) : "";
          const fontSize = [...label].length + sub.length > 2 ? 10 : 11.5;
          const text = el("text", { x: cx, y: cy, fill: COLORS.label, "font-size": fontSize, "font-weight": 600, opacity });
          text.appendChild(tspan({}, label));
          // dy rather than baseline-shift, which Firefox doesn't support.
          if (sub) text.appendChild(tspan({ dy: fontSize * 0.3, "font-size": fontSize * 0.7 }, sub));
        }
      }
    }

    renderLegend([...octavesShown].sort());
  }

  function renderLegend(octaves) {
    const legend = $("legend");
    legend.replaceChildren();
    const item = (color, text, ring) => {
      const span = document.createElement("span");
      const swatch = document.createElement("i");
      swatch.style.background = color;
      if (ring) swatch.style.boxShadow = `inset 0 0 0 2.5px ${COLORS.rootRing}`;
      span.append(swatch, text);
      legend.appendChild(span);
    };
    item(COLORS.muted, "Root", true);
    for (const o of octaves) item(OCTAVE_COLORS[o], `Octave ${o}`);
  }

  fillSelect($("key"), Theory.KEYS, "C");
  fillSelect($("scale"), Object.keys(Theory.SCALES), "Major (Ionian)");
  fillSelect($("tuning"), Object.keys(Theory.TUNINGS));
  buildStringOptions();

  $("tuning").addEventListener("change", buildStringOptions);
  for (const id of ["key", "scale", "tuning", "frets", "map", "labels", "octave", "ghost", "start-fret", "span"]) {
    $(id).addEventListener("input", render);
  }

  render();
})();
