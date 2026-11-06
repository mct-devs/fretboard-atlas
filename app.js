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
    markerX: 38,  // open/unplayed string markers in chord shapes
    maxRadius: 13,
  };

  const COLORS = {
    board: "#3b2a1e",
    fret: "#b8b8b8",
    nut: "#efe9dc",
    string: "#d8d2c4",
    inlay: "#e9e1cf",
    window: "rgba(46, 134, 171, 0.18)",
    noodle: "rgba(245, 185, 66, 0.4)",
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

  // "Several chords" overlay: one color per chord in list order, offered for
  // lists this short, showing shapes within this many frets of the position.
  const OVERLAY_COLORS = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc", "#f783ac"];
  const MAX_OVERLAY_CHORDS = OVERLAY_COLORS.length;
  const OVERLAY_REACH = 2;

  const $ = (id) => document.getElementById(id);
  const svg = $("fretboard");

  // Indexes into the tuning array (0 = lowest-pitched string).
  const selectedStrings = new Set([0, 1]);

  // Which chord shape is showing. Goes back to the first shape whenever the
  // chord or anything that changes its shapes changes.
  let shapeIndex = 0;
  let shapeCount = 0;
  let shapeSource = "";
  let overlayStops = [];

  // Indexes into the chord list for "Several chords". Starts as I, IV, V.
  const overlaySelected = new Set([0, 3, 4]);

  function fillSelect(select, values, selected) {
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = v;
      if (v === selected) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function svgNode(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function el(tag, attrs, text) {
    return svg.appendChild(svgNode(tag, attrs, text));
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
      chord: $("chord").value,
      depth: $("depth").value,
      tuningName: $("tuning").value,
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

  // Option values are indexes into the chord list, or "all". Keeps the same
  // position in the list (e.g. the ii chord) when the key, scale or depth
  // changes.
  function buildChordOptions() {
    const scaleName = $("scale").value;
    const select = $("chord");
    const previous = select.value;
    const scale = Theory.buildScale($("key").value, scaleName);
    const chords = Theory.chordsForScale(scaleName, scale, $("depth").value);
    select.replaceChildren();
    const canOverlay = chords.length > 1 && chords.length <= MAX_OVERLAY_CHORDS;
    if (canOverlay) select.appendChild(new Option("Several chords", "all"));
    let group = select;
    chords.forEach((c, i) => {
      if (c.group && c.group !== group.label) {
        group = select.appendChild(document.createElement("optgroup"));
        group.label = c.group;
      }
      group.appendChild(new Option(c.label, i));
    });
    if (!chords.length) select.appendChild(new Option("None for this scale", ""));
    select.disabled = !chords.length;
    select.value = previous;
    if (select.selectedIndex < 0) select.value = chords.length ? "0" : "";
    $("depth-label").hidden = Theory.chordStyle(scaleName) !== "stacked";

    const picks = $("overlay-picks");
    picks.replaceChildren();
    if (!canOverlay) return;
    chords.forEach((c, i) => {
      const label = document.createElement("label");
      label.className = "check";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = overlaySelected.has(i);
      box.addEventListener("change", () => {
        box.checked ? overlaySelected.add(i) : overlaySelected.delete(i);
        render();
      });
      const swatch = document.createElement("i");
      swatch.style.background = OVERLAY_COLORS[i];
      label.append(box, swatch, c.label);
      picks.appendChild(label);
    });
  }

  // Shapes to draw as [{ name, frets, color }], where frets has one entry per
  // string (null = not played). A single chord steps through its own shapes.
  // "Several chords" steps through neck positions instead, showing each
  // checked chord's shape near that position; chords with nothing nearby are
  // left out.
  function currentShapes(st, scale) {
    const chords = Theory.chordsForScale(st.scale, scale, st.depth);
    const all = st.chord === "all";
    $("overlay-picks").hidden = !all;
    const picked = all
      ? chords.map((c, i) => ({ ...c, color: OVERLAY_COLORS[i] })).filter((_, i) => overlaySelected.has(i))
      : [chords[Number(st.chord)]].filter(Boolean).map((c) => ({ ...c, color: COLORS.noodle }));
    const shapesPer = picked.map((c) => Theory.chordShapes(c, scale, st.tuning, st.frets));
    const stops = all ? [...new Set(shapesPer.flat().map((sh) => sh.position))].sort((a, b) => a - b) : shapesPer[0] ?? [];

    const source = [st.key, st.scale, st.chord, st.depth, st.tuningName, st.frets].join("|");
    if (source !== shapeSource) {
      shapeSource = source;
      shapeIndex = 0;
    } else if (all && overlayStops[shapeIndex] !== undefined) {
      // Checking or unchecking a chord changes the stops; stay near the same fret.
      const was = overlayStops[shapeIndex];
      shapeIndex = stops.reduce((best, pos, i) => (Math.abs(pos - was) < Math.abs(stops[best] - was) ? i : best), 0);
    }
    if (all) overlayStops = stops;
    shapeCount = stops.length;
    $("prev-shape").disabled = $("next-shape").disabled = stops.length < 2;

    const info = $("shape-info");
    if (all && !picked.length) info.textContent = "Check chords to show";
    else if (!picked.length) info.textContent = "";
    else if (!stops.length) info.textContent = "No playable shapes";
    else if (!all) info.textContent = `Shape ${shapeIndex + 1} of ${stops.length}`;
    else {
      const pos = stops[shapeIndex];
      info.textContent = `${pos === 0 ? "Open position" : `Fret ${pos}`} (${shapeIndex + 1} of ${stops.length})`;
    }
    if (!stops.length) return [];

    if (!all) return [{ name: picked[0].name, frets: stops[shapeIndex].frets, color: picked[0].color }];
    const pos = stops[shapeIndex];
    return picked.flatMap((c, i) => {
      const near = shapesPer[i]
        .filter((sh) => Math.abs(sh.position - pos) <= OVERLAY_REACH)
        .sort((a, b) => Math.abs(a.position - pos) - Math.abs(b.position - pos))[0];
      return near ? [{ name: c.name, frets: near.frets, color: c.color }] : [];
    });
  }

  // Smooth curve through the points (Catmull-Rom converted to cubic Béziers).
  function smoothPath(points) {
    let d = `M ${points[0]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const [p1, p2] = [points[i], points[i + 1]];
      const p3 = points[i + 2] ?? p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1} ${c2} ${p2}`;
    }
    return d;
  }

  function render() {
    const st = readState();
    const n = st.frets;
    const numStrings = st.tuning.length;
    const { width, left, right, top, stringGap, bottom } = LAYOUT;
    const height = top + (numStrings - 1) * stringGap + bottom;

    $("position-options").hidden = st.map !== "position";
    $("string-options").hidden = st.map !== "strings";
    $("chord-options").hidden = st.map !== "chord";

    const scale = Theory.buildScale(st.key, st.scale);
    const shapes = st.map === "chord" ? currentShapes(st, scale) : [];
    const overlay = st.chord === "all";

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
      if (st.map === "chord") return shapes.some((sh) => sh.frets[s] === f);
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

    // Overlaid noodles are thin and nudged sideways from each other so ones
    // sharing a note stay distinguishable.
    shapes.forEach((sh, i) => {
      const dx = overlay ? (i - (shapes.length - 1) / 2) * 3 : 0;
      const points = sh.frets.flatMap((f, s) => (f === null ? [] : [[noteX(f) + dx, stringY(s)]]));
      el("path", {
        d: smoothPath(points), fill: "none", stroke: sh.color,
        "stroke-width": overlay ? 4 : LAYOUT.maxRadius * 2 + 8, "stroke-linecap": "round", "stroke-linejoin": "round",
      });
    });
    // Open/unplayed markers would contradict each other across overlaid chords.
    if (shapes.length === 1) {
      shapes[0].frets.forEach((f, s) => {
        if (f === null) el("text", { x: LAYOUT.markerX, y: stringY(s), fill: COLORS.label, "font-size": 15 }, "×");
        else if (f === 0) el("text", { x: LAYOUT.markerX, y: stringY(s), fill: COLORS.label, "font-size": 13 }, "o");
      });
    }

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
        // Inset the root ring so roots take up the same space as other notes.
        const dot = note.isRoot
          ? el("circle", { cx, cy, r: r - 1.5, fill, stroke: COLORS.rootRing, "stroke-width": 3, opacity })
          : el("circle", { cx, cy, r, fill, opacity });
        dot.appendChild(svgNode("title", {}, `${note.name}${note.octave} · ${note.degree} · ${note.hz.toFixed(2)} Hz`));
        if (active) octavesShown.add(note.octave);

        const label = { note: note.name, degree: note.degree, hz: String(Math.round(note.hz)) }[st.labels] ?? "";
        if (label) {
          const sub = st.labels === "note" && st.showOctave ? String(note.octave) : "";
          const chars = [...label].length + sub.length;
          const fontSize = chars <= 2 ? 11.5 : chars === 3 ? 10 : 8.5;
          const text = el("text", { x: cx, y: cy, fill: COLORS.label, "font-size": fontSize, "font-weight": 600, opacity });
          text.appendChild(svgNode("tspan", {}, label));
          // dy rather than baseline-shift, which Firefox doesn't support.
          if (sub) text.appendChild(svgNode("tspan", { dy: fontSize * 0.3, "font-size": fontSize * 0.7 }, sub));
        }
      }
    }

    renderLegend([...octavesShown].sort(), overlay ? shapes : []);
  }

  function renderLegend(octaves, overlaid) {
    const legend = $("legend");
    legend.replaceChildren();
    const item = (color, text, ring, line) => {
      const span = document.createElement("span");
      const swatch = document.createElement("i");
      swatch.style.background = color;
      if (ring) swatch.style.boxShadow = `inset 0 0 0 2.5px ${COLORS.rootRing}`;
      if (line) swatch.className = "line";
      span.append(swatch, text);
      legend.appendChild(span);
    };
    item(COLORS.muted, "Root", true);
    for (const o of octaves) item(OCTAVE_COLORS[o], `Octave ${o}`);
    for (const sh of overlaid) item(sh.color, sh.name, false, true);
  }

  fillSelect($("key"), Theory.KEYS, "C");
  fillSelect($("scale"), Object.keys(Theory.SCALES), "Major (Ionian)");
  fillSelect($("tuning"), Object.keys(Theory.TUNINGS));
  buildStringOptions();
  buildChordOptions();

  $("tuning").addEventListener("change", buildStringOptions);
  // Registered before the render listeners so the chord list is current when render runs.
  for (const id of ["key", "scale", "depth"]) $(id).addEventListener("input", buildChordOptions);
  for (const [id, step] of [["prev-shape", -1], ["next-shape", 1]]) {
    $(id).addEventListener("click", () => {
      shapeIndex = (shapeIndex + step + shapeCount) % shapeCount;
      render();
    });
  }
  for (const id of ["key", "scale", "chord", "depth", "tuning", "frets", "map", "labels", "octave", "ghost", "start-fret", "span"]) {
    $(id).addEventListener("input", render);
  }

  render();
})();
