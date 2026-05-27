// ============================================================================
// V1 tab bodies — one component per side-rail tab.
//
// Functional: TabCrop (aspect/straighten/rotate/flip/perspective vertical),
// TabExport (format/quality/render+download).
//
// Visual stubs: TabLight, TabColor, TabHSL, TabCurves, TabEffects, TabLUT.
// These read no app state and ignore user input — they exist to show the
// design surface. See CLAUDE.md for the wiring TODOs.
// ============================================================================

// ─── shared utilities ─────────────────────────────────────────────────────
function SectionHeader({ children, mono, muted, accent, right, onRight }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 10, fontFamily: mono, fontSize: 10,
      letterSpacing: "0.14em", color: muted,
    }}>
      <span>{children}</span>
      {right !== false && (
        <span onClick={onRight} style={{ color: accent, cursor: onRight ? "pointer" : "default", fontSize: 10 }}>
          {right || "RESET"}
        </span>
      )}
    </div>
  );
}

function TabSlider({ label, value, unit = "", min = -100, max = 100, ctx, onChange, format }) {
  return (
    <Slider
      label={label} value={value} unit={unit} min={min} max={max}
      color={ctx.accent}
      labelStyle={{ color: ctx.text, fontSize: 11.5 }}
      valueStyle={{ fontFamily: ctx.mono, fontSize: 10.5 }}
      onChange={onChange}
      format={format}
    />
  );
}

// ─── LIGHT (functional) ───────────────────────────────────────────────────
// Sliders write into PhotofilmContext.lightAdjust; the hero FilteredPhoto
// re-runs applyLightAdjust on top of the cached preset output each time a
// value changes. Slider units match what the pipeline expects (exposure in
// tenths of an EV, everything else in [-100, +100]).
function TabLight({ ctx }) {
  const { lightAdjust, updateLight } = usePhotofilm();
  const L = lightAdjust || ZERO_LIGHT;
  const fmtEV = (v) => `${v > 0 ? "+" : ""}${(v / 10).toFixed(1)} EV`;
  const resetKeys = (keys) => keys.forEach((k) => updateLight(k, 0));
  return (
    <div style={{ overflow: "hidden" }}>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={() => resetKeys(["exposure", "contrast", "highlights", "shadows", "whites", "blacks"])}>TONE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TabSlider label="Exposure"   value={L.exposure}   min={-50} max={50} ctx={ctx} format={fmtEV} onChange={(v) => updateLight("exposure", v)} />
        <TabSlider label="Contrast"   value={L.contrast}   ctx={ctx} onChange={(v) => updateLight("contrast", v)} />
        <TabSlider label="Highlights" value={L.highlights} ctx={ctx} onChange={(v) => updateLight("highlights", v)} />
        <TabSlider label="Shadows"    value={L.shadows}    ctx={ctx} onChange={(v) => updateLight("shadows", v)} />
        <TabSlider label="Whites"     value={L.whites}     ctx={ctx} onChange={(v) => updateLight("whites", v)} />
        <TabSlider label="Blacks"     value={L.blacks}     ctx={ctx} onChange={(v) => updateLight("blacks", v)} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={() => resetKeys(["texture", "clarity", "dehaze"])}>PRESENCE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TabSlider label="Texture" value={L.texture} ctx={ctx} onChange={(v) => updateLight("texture", v)} />
        <TabSlider label="Clarity" value={L.clarity} ctx={ctx} onChange={(v) => updateLight("clarity", v)} />
        <TabSlider label="Dehaze"  value={L.dehaze}  ctx={ctx} onChange={(v) => updateLight("dehaze",  v)} />
      </div>
    </div>
  );
}

// ─── COLOR (functional) ───────────────────────────────────────────────────
// Sliders write into PhotofilmContext.colorAdjust. Temp/tint feed
// opWhiteBalance (which runs first in applyUserAdjustments); vibrance and
// saturation run after curves; split-toning is the last color op.
// Slider units match the pipeline's expectations (all in [-100, +100]).
const WB_PRESETS = {
  "As Shot":     { temp: 0,   tint: 0 },
  "Daylight":    { temp: 10,  tint: 4 },
  "Cloudy":      { temp: 25,  tint: 8 },
  "Shade":       { temp: 38,  tint: 12 },
  "Tungsten":    { temp: -55, tint: 6 },
  "Fluorescent": { temp: -35, tint: -8 },
  "Flash":       { temp: 18,  tint: 4 },
};

function TabColor({ ctx }) {
  const { colorAdjust, updateColor, resetColor } = usePhotofilm();
  const C = colorAdjust || ZERO_COLOR;
  // Display the warmth slider as a Kelvin-equivalent for familiarity.
  const fmtK = (v) => `${(5500 + v * 30).toFixed(0)} K`;

  const setWB = (presetName) => {
    const p = WB_PRESETS[presetName];
    if (!p) return;
    updateColor("temp", p.temp);
    updateColor("tint", p.tint);
  };

  const activeWBName = React.useMemo(() => {
    for (const [name, p] of Object.entries(WB_PRESETS)) {
      if (Math.abs(C.temp - p.temp) <= 1 && Math.abs(C.tint - p.tint) <= 1) return name;
    }
    return "Custom";
  }, [C.temp, C.tint]);

  return (
    <div style={{ overflow: "hidden" }}>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={resetColor}>WHITE BALANCE</SectionHeader>
      <div style={{ fontFamily: ctx.mono, fontSize: 10, color: ctx.muted, marginBottom: 8, letterSpacing: "0.04em" }}>
        {activeWBName.toUpperCase()}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
        {Object.keys(WB_PRESETS).map((p) => (
          <span key={p} onClick={() => setWB(p)} style={{ ...pill(ctx, activeWBName === p), cursor: "pointer" }}>
            {p.toUpperCase()}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TempSlider value={C.temp} ctx={ctx} onChange={(v) => updateColor("temp", v)} fmtK={fmtK} />
        <TintSlider value={C.tint} ctx={ctx} onChange={(v) => updateColor("tint", v)} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={() => { updateColor("vibrance", 0); updateColor("saturation", 0); }}>SATURATION</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TabSlider label="Vibrance"   value={C.vibrance}   ctx={ctx} onChange={(v) => updateColor("vibrance",   v)} />
        <TabSlider label="Saturation" value={C.saturation} ctx={ctx} onChange={(v) => updateColor("saturation", v)} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={() => {
          updateColor("shadowSat", 0); updateColor("highlightSat", 0); updateColor("balance", 0);
        }}>SPLIT TONING</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <ToneCard
          label="SHADOWS"
          hue={C.shadowHue} sat={C.shadowSat} ctx={ctx}
          onHue={(v) => updateColor("shadowHue", v)}
          onSat={(v) => updateColor("shadowSat", v)}
        />
        <ToneCard
          label="HIGHLIGHTS"
          hue={C.highlightHue} sat={C.highlightSat} ctx={ctx}
          onHue={(v) => updateColor("highlightHue", v)}
          onSat={(v) => updateColor("highlightSat", v)}
        />
      </div>
      <TabSlider label="Balance" value={C.balance} ctx={ctx} onChange={(v) => updateColor("balance", v)} />
    </div>
  );
}

function TempSlider({ value, ctx, onChange, fmtK }) {
  const trackRef = React.useRef(null);
  const pct = ((value + 100) / 200) * 100;
  const startDrag = (e) => {
    if (!onChange) return;
    e.preventDefault();
    const update = (clientX) => {
      const r = trackRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      onChange(Math.round(-100 + f * 200));
    };
    update(e.clientX);
    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: ctx.text }}>
        <span>Temperature</span>
        <span style={{ fontFamily: ctx.mono, fontSize: 10.5, color: ctx.muted }}>{fmtK ? fmtK(value) : value}</span>
      </div>
      <div ref={trackRef} onMouseDown={startDrag} style={{
        position: "relative", height: 6, borderRadius: 3,
        background: "linear-gradient(to right, #4b8de5 0%, #ffffff 50%, #f3c33f 100%)",
        opacity: 0.85, cursor: onChange ? "pointer" : "default",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: `${pct}%`,
          transform: "translate(-50%, -50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: ctx.text, border: `2px solid ${ctx.panel}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
        }} />
      </div>
    </div>
  );
}

function TintSlider({ value, ctx, onChange }) {
  const trackRef = React.useRef(null);
  const pct = ((value + 100) / 200) * 100;
  const startDrag = (e) => {
    if (!onChange) return;
    e.preventDefault();
    const update = (clientX) => {
      const r = trackRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      onChange(Math.round(-100 + f * 200));
    };
    update(e.clientX);
    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: ctx.text }}>
        <span>Tint</span>
        <span style={{ fontFamily: ctx.mono, fontSize: 10.5, color: ctx.muted }}>{value > 0 ? "+" : ""}{value}</span>
      </div>
      <div ref={trackRef} onMouseDown={startDrag} style={{
        position: "relative", height: 6, borderRadius: 3,
        background: "linear-gradient(to right, #4baf4b 0%, #888 50%, #d04bc2 100%)",
        opacity: 0.85, cursor: onChange ? "pointer" : "default",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: `${pct}%`,
          transform: "translate(-50%, -50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: ctx.text, border: `2px solid ${ctx.panel}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
        }} />
      </div>
    </div>
  );
}

// ToneCard: hue picker (0-360°) + saturation slider (-100..+100). Click the
// hue strip to set hue; drag the sat ribbon to set sat.
function ToneCard({ label, hue, sat, ctx, onHue, onSat }) {
  const hueRef = React.useRef(null);
  const satRef = React.useRef(null);
  const startHue = (e) => {
    if (!onHue) return;
    e.preventDefault();
    const update = (clientX) => {
      const r = hueRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      onHue(Math.round(f * 360));
    };
    update(e.clientX);
    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const startSat = (e) => {
    if (!onSat) return;
    e.preventDefault();
    const update = (clientX) => {
      const r = satRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      onSat(Math.round(f * 100));
    };
    update(e.clientX);
    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const satClamp = Math.max(0, Math.min(100, sat));
  return (
    <div style={{
      padding: 10, border: `1px solid ${ctx.border}`, borderRadius: 2,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: ctx.mono, fontSize: 9, color: ctx.muted, letterSpacing: "0.1em" }}>
          {label}
        </span>
        <span style={{
          width: 18, height: 18, borderRadius: "50%",
          background: `hsl(${hue}, ${satClamp}%, 50%)`,
          border: `1px solid ${ctx.border}`,
        }} />
      </div>
      <div
        ref={hueRef}
        onMouseDown={startHue}
        style={{
          height: 14, borderRadius: 1,
          background: "linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))",
          position: "relative", cursor: "pointer",
        }}
      >
        <span style={{
          position: "absolute", top: -2, bottom: -2, left: `${(hue/360)*100}%`,
          transform: "translateX(-50%)",
          width: 3, background: ctx.text, boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
        }} />
      </div>
      <div
        ref={satRef}
        onMouseDown={startSat}
        style={{
          height: 8, borderRadius: 1,
          background: `linear-gradient(to right, hsl(${hue},0%,50%), hsl(${hue},100%,50%))`,
          position: "relative", cursor: "pointer",
        }}
      >
        <span style={{
          position: "absolute", top: -3, bottom: -3, left: `${satClamp}%`,
          transform: "translateX(-50%)",
          width: 3, background: ctx.text, boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ctx.mono, fontSize: 9, color: ctx.muted }}>
        <span>H {hue}°</span>
        <span>S {sat}</span>
      </div>
    </div>
  );
}

// ─── HSL (functional) ─────────────────────────────────────────────────────
// 8 hue bands × (Hue, Saturation, Luminance). State key per row is one of
// HSL_HUE_KEYS (red/orange/.../magenta); each row holds {h, s, l} as slider
// units in [-100, +100], scaled by opHSL.
const HSL_ROWS = [
  { key: "red",     label: "Red",     swatchHue: 0,   sat: 80 },
  { key: "orange",  label: "Orange",  swatchHue: 28,  sat: 85 },
  { key: "yellow",  label: "Yellow",  swatchHue: 52,  sat: 85 },
  { key: "green",   label: "Green",   swatchHue: 130, sat: 70 },
  { key: "aqua",    label: "Aqua",    swatchHue: 180, sat: 70 },
  { key: "blue",    label: "Blue",    swatchHue: 215, sat: 75 },
  { key: "purple",  label: "Purple",  swatchHue: 280, sat: 65 },
  { key: "magenta", label: "Magenta", swatchHue: 320, sat: 70 },
];

function TabHSL({ ctx }) {
  const { hslAdjust, updateHSL, resetHSL } = usePhotofilm();
  const H = hslAdjust || ZERO_HSL;
  // The ALL/HUE/SAT/LUM pills filter which columns the user is editing — when
  // a single channel is selected the other two go semi-transparent.
  const [view, setView] = React.useState("ALL");
  const showH = view === "ALL" || view === "HUE";
  const showS = view === "ALL" || view === "SAT";
  const showL = view === "ALL" || view === "LUM";
  return (
    <div style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {["ALL", "HUE", "SAT", "LUM"].map((v) => (
          <span key={v} onClick={() => setView(v)} style={{ ...pill(ctx, view === v), cursor: "pointer" }}>{v}</span>
        ))}
        <div style={{ flex: 1 }} />
        <button title="Reset all" onClick={resetHSL} style={{ ...iconBtn(ctx), color: ctx.muted }}>↺</button>
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} onRight={resetHSL}>COLOR MIX</SectionHeader>
      <div style={{
        display: "grid",
        gridTemplateColumns: "12px 60px repeat(3, minmax(0,1fr))",
        rowGap: 9, columnGap: 10, alignItems: "center",
      }}>
        <span /><span />
        <span style={{ ...hslHdr(ctx), opacity: showH ? 1 : 0.3 }}>HUE</span>
        <span style={{ ...hslHdr(ctx), opacity: showS ? 1 : 0.3 }}>SAT</span>
        <span style={{ ...hslHdr(ctx), opacity: showL ? 1 : 0.3 }}>LUM</span>
        {HSL_ROWS.map((row) => {
          const v = H[row.key] || { h: 0, s: 0, l: 0 };
          return (
            <React.Fragment key={row.key}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: `hsl(${row.swatchHue}, ${row.sat}%, 55%)` }} />
              <span style={{ fontSize: 11, color: ctx.text }}>{row.label}</span>
              <HSLBar value={v.h} ctx={ctx} dim={!showH} onChange={(nv) => updateHSL(row.key, "h", nv)} />
              <HSLBar value={v.s} ctx={ctx} dim={!showS} onChange={(nv) => updateHSL(row.key, "s", nv)} />
              <HSLBar value={v.l} ctx={ctx} dim={!showL} onChange={(nv) => updateHSL(row.key, "l", nv)} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function HSLBar({ value, ctx, onChange, dim = false }) {
  const trackRef = React.useRef(null);
  const pct = ((value + 100) / 200) * 100;
  const startDrag = (e) => {
    if (!onChange || dim) return;
    e.preventDefault();
    const update = (clientX) => {
      const r = trackRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      onChange(Math.round(-100 + f * 200));
    };
    update(e.clientX);
    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div
      ref={trackRef}
      onMouseDown={startDrag}
      style={{
        position: "relative", height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 1,
        opacity: dim ? 0.3 : 1, cursor: dim ? "default" : "pointer",
      }}
    >
      <span style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,0.15)" }} />
      {value !== 0 && (
        <span style={{
          position: "absolute", top: 0, height: 4,
          left: value >= 0 ? "50%" : `${pct}%`,
          width: `${Math.abs(pct - 50)}%`,
          background: ctx.accent,
        }} />
      )}
      <span style={{
        position: "absolute", top: -3, left: `${pct}%`,
        transform: "translateX(-50%)",
        width: 10, height: 10, borderRadius: "50%", background: ctx.text,
        boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }} />
      <span style={{
        position: "absolute", right: 0, top: -16, fontSize: 9, fontFamily: ctx.mono, color: ctx.muted,
      }}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

function hslHdr(ctx) {
  return { fontFamily: ctx.mono, fontSize: 9, letterSpacing: "0.1em", color: ctx.muted };
}

// ─── CURVES (functional) ──────────────────────────────────────────────────
// Per-channel point-curve editor. Each channel holds an array of [x,y] in
// [0,1], min two points (the endpoints). Drag a point to move it (clamped
// against neighbors); click empty graph space to add; shift-click a point to
// remove. opToneCurve interpolates linearly between points (cheap; the LUT
// has 1024 buckets so the result is smooth enough for normal use).
const CURVE_CHANNELS = [
  { key: "rgb", label: "RGB",   color: "#e8e6e1" },
  { key: "r",   label: "Red",   color: "#e74c3c" },
  { key: "g",   label: "Green", color: "#27ae60" },
  { key: "b",   label: "Blue",  color: "#3498db" },
];

const CURVE_PRESETS = [
  { name: "Linear",          points: [[0, 0], [1, 1]] },
  { name: "Medium Contrast", points: [[0, 0.05], [0.25, 0.18], [0.75, 0.82], [1, 0.95]] },
  { name: "Strong Contrast", points: [[0, 0], [0.25, 0.12], [0.75, 0.88], [1, 1]] },
  { name: "Filmic",          points: [[0, 0.06], [0.3, 0.30], [0.7, 0.74], [1, 0.95]] },
  { name: "Crushed Blacks",  points: [[0, 0], [0.2, 0.04], [0.6, 0.62], [1, 1]] },
  { name: "Lifted Shadows",  points: [[0, 0.15], [0.4, 0.45], [1, 1]] },
];

function TabCurves({ ctx }) {
  const { curvesAdjust, updateCurves, resetCurves } = usePhotofilm();
  const Cu = curvesAdjust || ZERO_CURVES;
  const [channel, setChannel] = React.useState("rgb");
  const [selectedIdx, setSelectedIdx] = React.useState(null);
  const channelDef = CURVE_CHANNELS.find((c) => c.key === channel) || CURVE_CHANNELS[0];
  const points = Cu[channel] || [[0, 0], [1, 1]];

  const setPoints = (next) => updateCurves(channel, next);
  const movePoint = (i, x, y) => {
    const next = points.map((p) => [...p]);
    if (i === 0) {
      next[0][0] = 0;
      next[0][1] = Math.max(0, Math.min(1, y));
    } else if (i === next.length - 1) {
      next[next.length - 1][0] = 1;
      next[next.length - 1][1] = Math.max(0, Math.min(1, y));
    } else {
      const minX = next[i - 1][0] + 0.005;
      const maxX = next[i + 1][0] - 0.005;
      next[i][0] = Math.max(minX, Math.min(maxX, x));
      next[i][1] = Math.max(0, Math.min(1, y));
    }
    setPoints(next);
  };
  const addPoint = (x, y) => {
    let insertAt = points.findIndex((p) => p[0] > x);
    if (insertAt < 0) insertAt = points.length;
    const next = points.map((p) => [...p]);
    next.splice(insertAt, 0, [x, y]);
    setPoints(next);
    setSelectedIdx(insertAt);
  };
  const removePoint = (i) => {
    if (i === 0 || i === points.length - 1 || points.length <= 2) return;
    setPoints(points.filter((_, j) => j !== i));
    setSelectedIdx(null);
  };

  const sel = selectedIdx !== null ? points[selectedIdx] : null;
  const inVal  = sel ? Math.round(sel[0] * 255) : null;
  const outVal = sel ? Math.round(sel[1] * 255) : null;

  return (
    <div style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {CURVE_CHANNELS.map((c) => (
          <span
            key={c.key}
            onClick={() => { setChannel(c.key); setSelectedIdx(null); }}
            style={{ ...pill(ctx, channel === c.key), cursor: "pointer" }}
          >
            {c.label.toUpperCase()}
          </span>
        ))}
      </div>
      <CurveGraph
        ctx={ctx}
        points={points}
        channelColor={channelDef.color}
        selectedIdx={selectedIdx}
        onSelect={setSelectedIdx}
        onMove={movePoint}
        onAdd={addPoint}
        onRemove={removePoint}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: ctx.mono, fontSize: 10, color: ctx.muted, display: "flex", gap: 12 }}>
          <span>IN  <span style={{ color: ctx.text }}>{inVal  !== null ? inVal  : "—"}</span></span>
          <span>OUT <span style={{ color: ctx.text }}>{outVal !== null ? outVal : "—"}</span></span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => addPoint(0.5, 0.5)}
            title="Add a midpoint"
            style={iconBtn(ctx)}
          >＋</button>
          <button
            onClick={() => selectedIdx !== null && removePoint(selectedIdx)}
            title="Remove selected point"
            disabled={selectedIdx === null || selectedIdx === 0 || selectedIdx === points.length - 1}
            style={{ ...iconBtn(ctx), opacity: (selectedIdx === null || selectedIdx === 0 || selectedIdx === points.length - 1) ? 0.4 : 1 }}
          >−</button>
          <button onClick={() => setPoints([[0, 0], [1, 1]])} title="Reset this channel" style={iconBtn(ctx)}>↺</button>
          <button onClick={resetCurves} title="Reset all channels" style={iconBtn(ctx)}>↺↺</button>
        </div>
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={false}>CURVE PRESETS</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        {CURVE_PRESETS.map((p) => {
          const active = pointsEqual(points, p.points);
          return (
            <button
              key={p.name}
              onClick={() => { setPoints(p.points.map((q) => [...q])); setSelectedIdx(null); }}
              style={{
                ...iconBtn(ctx), padding: "8px 8px 4px", display: "flex", flexDirection: "column",
                alignItems: "stretch", gap: 4,
                borderColor: active ? ctx.accent : ctx.border,
                color: active ? ctx.accent : ctx.muted,
              }}
            >
              <svg viewBox="0 0 60 30" width="100%" height="22">
                <path
                  d={presetPath(p.points)}
                  fill="none"
                  stroke={active ? ctx.accent : "rgba(255,255,255,0.4)"}
                  strokeWidth="1.5"
                />
              </svg>
              <span style={{ fontFamily: ctx.mono, fontSize: 9, letterSpacing: "0.05em", textAlign: "left" }}>
                {p.name.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function pointsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i][0] - b[i][0]) > 1e-3 || Math.abs(a[i][1] - b[i][1]) > 1e-3) return false;
  }
  return true;
}

function presetPath(points) {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const x = points[i][0] * 60;
    const y = 30 - points[i][1] * 30;
    d += (i === 0 ? "M" : "L") + ` ${x} ${y} `;
  }
  return d;
}

function CurveGraph({ ctx, points, channelColor, selectedIdx, onSelect, onMove, onAdd, onRemove }) {
  const svgRef = React.useRef(null);
  const dragRef = React.useRef(null);

  const eventXY = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    return { x, y };
  };

  const onSurfaceDown = (e) => {
    // empty-area click → add a point at that location.
    if (e.target.tagName === "circle") return;
    const { x, y } = eventXY(e);
    onAdd(x, y);
  };

  const onPointDown = (e, i) => {
    e.stopPropagation();
    if (e.shiftKey) { onRemove(i); return; }
    onSelect(i);
    dragRef.current = i;
    const move = (ev) => {
      if (dragRef.current === null) return;
      const { x, y } = eventXY(ev);
      onMove(dragRef.current, x, y);
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // Build the curve polyline in SVG units (0..100 x, 0..100 y inverted).
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${(p[0] * 100).toFixed(2)} ${(100 - p[1] * 100).toFixed(2)}`).join(" ");

  return (
    <div style={{
      width: "100%", aspectRatio: "1 / 1", maxHeight: 240,
      background: ctx.bg, border: `1px solid ${ctx.border}`, position: "relative",
    }}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onMouseDown={onSurfaceDown}
        style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
      >
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
            <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
          </g>
        ))}
        <line x1={0} y1={100} x2={100} y2={0} stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" strokeDasharray="2 2" />
        <path d={path} stroke={channelColor || ctx.accent} strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p[0] * 100}
            cy={100 - p[1] * 100}
            r={selectedIdx === i ? 2.4 : 1.8}
            fill={selectedIdx === i ? ctx.accent : ctx.text}
            stroke={ctx.accent}
            strokeWidth="0.8"
            onMouseDown={(e) => onPointDown(e, i)}
            style={{ cursor: "move" }}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

// ─── EFFECTS (functional) ─────────────────────────────────────────────────
// Sliders write into PhotofilmContext.effectsAdjust. opSharpen runs first,
// then opVignette (post-crop look), then opGrain (so noise sits on top of
// every other tonal change). Vignette is the heaviest pixel-loop op on this
// tab — the radial mask iterates the whole image per slider tick.
function TabEffects({ ctx }) {
  const { effectsAdjust, updateEffects, resetEffects } = usePhotofilm();
  const E = effectsAdjust || ZERO_EFFECTS;
  const resetKeys = (keys) => keys.forEach((k) => updateEffects(k, ZERO_EFFECTS[k]));
  return (
    <div style={{ overflow: "hidden" }}>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={() => resetKeys(["grainAmount", "grainSize", "grainRoughness"])}>GRAIN</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <TabSlider label="Amount"    value={E.grainAmount}    min={0} max={100} ctx={ctx} onChange={(v) => updateEffects("grainAmount", v)} />
        <TabSlider label="Size"      value={E.grainSize}      min={0} max={100} ctx={ctx} onChange={(v) => updateEffects("grainSize", v)} />
        <TabSlider label="Roughness" value={E.grainRoughness} min={0} max={100} ctx={ctx} onChange={(v) => updateEffects("grainRoughness", v)} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={() => resetKeys(["vignetteAmount", "vignetteMidpoint", "vignetteRoundness", "vignetteFeather"])}>VIGNETTE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <TabSlider label="Amount"    value={E.vignetteAmount}                ctx={ctx} onChange={(v) => updateEffects("vignetteAmount", v)} />
        <TabSlider label="Midpoint"  value={E.vignetteMidpoint}  min={0} max={100} ctx={ctx} onChange={(v) => updateEffects("vignetteMidpoint", v)} />
        <TabSlider label="Roundness" value={E.vignetteRoundness}             ctx={ctx} onChange={(v) => updateEffects("vignetteRoundness", v)} />
        <TabSlider label="Feather"   value={E.vignetteFeather}   min={0} max={100} ctx={ctx} onChange={(v) => updateEffects("vignetteFeather", v)} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}
        onRight={() => resetKeys(["sharpenAmount", "sharpenRadius", "sharpenDetail", "sharpenMasking"])}>SHARPEN</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <TabSlider label="Amount"  value={E.sharpenAmount}  min={0} max={150} ctx={ctx} onChange={(v) => updateEffects("sharpenAmount", v)} />
        <TabSlider label="Radius"  value={E.sharpenRadius}  min={5} max={30}  ctx={ctx} onChange={(v) => updateEffects("sharpenRadius", v)} />
        <TabSlider label="Detail"  value={E.sharpenDetail}  min={0} max={100} ctx={ctx} onChange={(v) => updateEffects("sharpenDetail", v)} />
        <TabSlider label="Masking" value={E.sharpenMasking} min={0} max={100} ctx={ctx} onChange={(v) => updateEffects("sharpenMasking", v)} />
      </div>
    </div>
  );
}

// ─── CROP / PERSPECTIVE (functional) ──────────────────────────────────────
// Aspect buttons apply a centered crop immediately. 90°/flip apply
// immediately. Straighten and Perspective Vertical use pending state — the
// hero shows a raw preview while the user drags, then Apply bakes.
const ASPECT_RATIOS = {
  "1:1":  1.0,
  "4:5":  4 / 5,
  "5:4":  5 / 4,
  "3:2":  3 / 2,
  "2:3":  2 / 3,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

function TabCrop({ ctx }) {
  const ph = usePhotofilm();
  const {
    sourceCanvas, applyEdit,
    pending, setPendingRotate, setPendingTransform, startPendingCrop,
    applyPending, cancelPending,
  } = ph;

  const cropToAspect = React.useCallback((key) => {
    if (!sourceCanvas || !(key in ASPECT_RATIOS)) return;
    const target = ASPECT_RATIOS[key];
    const sw = sourceCanvas.width, sh = sourceCanvas.height;
    const sourceAspect = sw / sh;
    let cw, ch;
    // Inscribe the target aspect inside the source — whichever dimension is
    // the limiter fills, the other is the source's full extent.
    if (sourceAspect > target) {
      // source wider than target — limit by height
      ch = 1;
      cw = (target * sh) / sw;
    } else {
      cw = 1;
      ch = (sw / target) / sh;
    }
    const cx = (1 - cw) / 2;
    const cy = (1 - ch) / 2;
    applyEdit((prev) => bakeCrop(prev, { x: cx, y: cy, w: cw, h: ch }));
  }, [sourceCanvas, applyEdit]);

  const quarterTurn = React.useCallback((deg) => {
    applyEdit((prev) => bakeQuarterTurn(prev, deg));
  }, [applyEdit]);

  const flip = React.useCallback((axis) => {
    applyEdit((prev) => bakeFlip(prev, axis));
  }, [applyEdit]);

  const isAspect = (a) => a in ASPECT_RATIOS;
  const inCropMode  = pending.mode === "crop";
  const inPerspMode = pending.mode === "perspective";
  const T = inPerspMode ? pending.transform : { vertical: 0, horizontal: 0, rotateDeg: 0, scale: 0, offsetX: 0, offsetY: 0 };
  // Tracks whether any composite-transform slider is non-zero, so we know
  // when to surface the Apply/Cancel buttons.
  const hasTransform = (Math.abs(T.vertical) + Math.abs(T.horizontal) + Math.abs(T.rotateDeg) + Math.abs(T.scale) + Math.abs(T.offsetX) + Math.abs(T.offsetY)) > 0.001;

  return (
    <div style={{ overflow: "hidden" }}>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={inCropMode ? "RESET" : false} onRight={inCropMode ? cancelPending : undefined}>ASPECT</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: inCropMode ? 8 : 16 }}>
        <button
          key="ORIGINAL"
          onClick={() => cancelPending()}
          disabled={!sourceCanvas}
          title="Reset any pending crop / transform"
          style={{
            ...iconBtn(ctx), padding: "7px 0", textAlign: "center",
            color: sourceCanvas ? ctx.text : ctx.muted,
            fontFamily: ctx.mono, fontSize: 10, letterSpacing: "0.04em",
            opacity: sourceCanvas ? 1 : 0.5, cursor: sourceCanvas ? "pointer" : "not-allowed",
          }}
        >ORIGINAL</button>
        <button
          key="FREE"
          onClick={() => sourceCanvas && startPendingCrop()}
          disabled={!sourceCanvas}
          title={sourceCanvas ? "Drag handles on the photo to crop" : "Load a photo first"}
          style={{
            ...iconBtn(ctx), padding: "7px 0", textAlign: "center",
            color: inCropMode ? ctx.accent : (sourceCanvas ? ctx.text : ctx.muted),
            borderColor: inCropMode ? ctx.accent : ctx.border,
            fontFamily: ctx.mono, fontSize: 10, letterSpacing: "0.04em",
            opacity: sourceCanvas ? 1 : 0.5, cursor: sourceCanvas ? "pointer" : "not-allowed",
          }}
        >FREE</button>
        {Object.keys(ASPECT_RATIOS).map((a) => (
          <button
            key={a}
            onClick={() => sourceCanvas && cropToAspect(a)}
            disabled={!sourceCanvas}
            title={`Crop to ${a} (centered)`}
            style={{
              ...iconBtn(ctx), padding: "7px 0", textAlign: "center",
              color: sourceCanvas ? ctx.text : ctx.muted,
              fontFamily: ctx.mono, fontSize: 10, letterSpacing: "0.04em",
              opacity: sourceCanvas ? 1 : 0.5, cursor: sourceCanvas ? "pointer" : "not-allowed",
            }}
          >{a}</button>
        ))}
      </div>
      {inCropMode && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button style={applyBtn(ctx)} onClick={applyPending}>APPLY CROP</button>
          <button style={cancelBtn(ctx)} onClick={cancelPending}>CANCEL</button>
        </div>
      )}

      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={pending.mode === "rotate" ? "RESET" : false} onRight={pending.mode === "rotate" ? cancelPending : undefined}>STRAIGHTEN</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 8 }}>
        <RotateRuler value={pending.mode === "rotate" ? pending.rotateAngle : 0} ctx={ctx} onChange={setPendingRotate} disabled={!sourceCanvas} />
      </div>
      {pending.mode === "rotate" && Math.abs(pending.rotateAngle) > 0.01 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button style={applyBtn(ctx)} onClick={applyPending}>APPLY ROTATE</button>
          <button style={cancelBtn(ctx)} onClick={cancelPending}>CANCEL</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button style={{ ...iconBtn(ctx), flex: 1, padding: "7px 0", fontFamily: ctx.mono, fontSize: 10 }} onClick={() => quarterTurn(-90)} disabled={!sourceCanvas}>↺ 90°</button>
        <button style={{ ...iconBtn(ctx), flex: 1, padding: "7px 0", fontFamily: ctx.mono, fontSize: 10 }} onClick={() => quarterTurn(90)}  disabled={!sourceCanvas}>↻ 90°</button>
        <button style={{ ...iconBtn(ctx), flex: 1, padding: "7px 0", fontFamily: ctx.mono, fontSize: 10 }} onClick={() => flip("h")}        disabled={!sourceCanvas}>⇋ FLIP H</button>
        <button style={{ ...iconBtn(ctx), flex: 1, padding: "7px 0", fontFamily: ctx.mono, fontSize: 10 }} onClick={() => flip("v")}        disabled={!sourceCanvas}>⇅ FLIP V</button>
      </div>

      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={inPerspMode ? "RESET" : false} onRight={inPerspMode ? cancelPending : undefined}>PERSPECTIVE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 12 }}>
        {/* All perspective sliders feed a single composite transform that
            previews live in the hero and bakes together via bakeTransform.
            Slider units: keystone ±50 maps to ±0.5; rotate is degrees;
            scale ±100 → ±1 EV of zoom; offsets are in ±50 % of the frame. */}
        <TabSlider label="Vertical"   value={Math.round(T.vertical * 100)}   min={-50}  max={50}  ctx={ctx} onChange={(v) => setPendingTransform("vertical",   v / 100)} />
        <TabSlider label="Horizontal" value={Math.round(T.horizontal * 100)} min={-50}  max={50}  ctx={ctx} onChange={(v) => setPendingTransform("horizontal", v / 100)} />
        <TabSlider label="Rotate"     value={Math.round(T.rotateDeg)}        min={-45}  max={45}  ctx={ctx} onChange={(v) => setPendingTransform("rotateDeg",  v)} />
        <TabSlider label="Scale"      value={Math.round(T.scale * 100)}      min={-100} max={100} ctx={ctx} onChange={(v) => setPendingTransform("scale",      v / 100)} />
        <TabSlider label="X Offset"   value={Math.round(T.offsetX * 100)}    min={-50}  max={50}  ctx={ctx} onChange={(v) => setPendingTransform("offsetX",    v / 100)} />
        <TabSlider label="Y Offset"   value={Math.round(T.offsetY * 100)}    min={-50}  max={50}  ctx={ctx} onChange={(v) => setPendingTransform("offsetY",    v / 100)} />
      </div>
      {inPerspMode && hasTransform && (
        <div style={{ display: "flex", gap: 6 }}>
          <button style={applyBtn(ctx)} onClick={applyPending}>APPLY TRANSFORM</button>
          <button style={cancelBtn(ctx)} onClick={cancelPending}>CANCEL</button>
        </div>
      )}
    </div>
  );
}

function RotateRuler({ value, ctx, onChange, disabled }) {
  const trackRef = React.useRef(null);
  const start = (e) => {
    if (disabled) return;
    e.preventDefault();
    const update = (clientX) => {
      const r = trackRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      onChange(-45 + f * 90);
    };
    update(e.clientX);
    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const ticks = [];
  for (let i = -45; i <= 45; i += 5) ticks.push(i);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: ctx.text }}>
        <span>Rotate</span>
        <span style={{ fontFamily: ctx.mono, fontSize: 10.5, color: ctx.muted }}>
          {value > 0 ? "+" : ""}{value.toFixed(2)}°
        </span>
      </div>
      <div
        ref={trackRef}
        onMouseDown={start}
        style={{
          position: "relative", height: 22, background: "rgba(255,255,255,0.04)",
          border: `1px solid ${ctx.border}`, overflow: "hidden",
          cursor: disabled ? "not-allowed" : "ew-resize", opacity: disabled ? 0.5 : 1,
        }}
      >
        {ticks.map((t) => {
          const pct = ((t + 45) / 90) * 100;
          const major = t % 15 === 0;
          return (
            <span key={t} style={{
              position: "absolute", left: `${pct}%`, top: major ? 0 : 5, bottom: 0,
              width: 1, background: major ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)",
            }} />
          );
        })}
        <span style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${((value + 45) / 90) * 100}%`,
          width: 2, background: ctx.accent, transform: "translateX(-50%)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ctx.mono, fontSize: 9, color: ctx.ultraMuted }}>
        <span>-45°</span><span>-30°</span><span>-15°</span><span>0°</span><span>+15°</span><span>+30°</span><span>+45°</span>
      </div>
    </div>
  );
}

// ─── LUT (stub) ───────────────────────────────────────────────────────────
const INSTALLED_LUTS = [
  { name: "kodachrome-64.cube",     sub: "32³ · Kodak · 480 KB",  on: true  },
  { name: "portra-400.cube",        sub: "32³ · Kodak · 480 KB",  on: false },
  { name: "tri-x-push.cube",        sub: "32³ · Custom · 480 KB", on: false },
  { name: "moonrise-kingdom.cube",  sub: "64³ · Filmic · 3.8 MB", on: false },
  { name: "pacific-rim-bleach.cube",sub: "32³ · Cinema · 480 KB", on: false },
  { name: "blade-runner-2049.cube", sub: "64³ · Cinema · 3.8 MB", on: false },
];

function TabLUT({ ctx }) {
  return (
    <div style={{ overflow: "hidden" }}>
      <StubBanner ctx={ctx} message="Browser LUT loading — wiring TODO. Use the CLI for now: photofilm photo.jpg --lut FujiClassicChrome.cube" />
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right="BROWSE…">LOOKUP TABLE</SectionHeader>
      <div style={{
        border: `1.5px dashed ${ctx.border}`,
        background: "rgba(255,255,255,0.02)",
        padding: "18px 14px", textAlign: "center", marginBottom: 14, borderRadius: 2,
      }}>
        <div style={{ fontFamily: ctx.mono, fontSize: 22, color: ctx.accent, marginBottom: 4 }}>▣</div>
        <div style={{ fontSize: 12, color: ctx.text, marginBottom: 2 }}>Drop a .cube file</div>
        <div style={{ fontFamily: ctx.mono, fontSize: 9.5, color: ctx.muted, letterSpacing: "0.06em" }}>
          ADOBE 3D LUT · UP TO 64³ · OR PICK FROM SHELF
        </div>
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>STRENGTH</SectionHeader>
      <div style={{ marginBottom: 16 }}>
        <TabSlider label="Intensity" value={+75} min={0} max={100} ctx={ctx} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right="6 SHELVED">SHELF</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {INSTALLED_LUTS.map((l) => (
          <div key={l.name} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 8px", border: `1px solid ${l.on ? ctx.accent : ctx.border}`,
            background: l.on ? "rgba(184,52,31,0.08)" : "transparent",
            cursor: "default", opacity: 0.7,
          }}>
            <div style={{ width: 26, height: 26, flexShrink: 0, background: "#222", border: `1px solid ${ctx.border}` }} />
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontFamily: ctx.mono, fontSize: 10.5, color: ctx.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.on && "▸ "}{l.name}
              </div>
              <div style={{ fontFamily: ctx.mono, fontSize: 9, color: ctx.muted, letterSpacing: "0.02em" }}>
                {l.sub}
              </div>
            </div>
            {l.on && <span style={{ width: 6, height: 6, borderRadius: "50%", background: ctx.accent }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EXPORT (functional) ──────────────────────────────────────────────────
const EXPORT_FORMATS = {
  JPEG: { mime: "image/jpeg", ext: "jpg" },
  PNG:  { mime: "image/png",  ext: "png" },
  WEBP: { mime: "image/webp", ext: "webp" },
};

function TabExport({ ctx }) {
  const ph = usePhotofilm();
  const { sourceCanvas, sourceName, activePreset, intensity, selected, toggleSelected } = ph;
  const [format, setFormat]     = React.useState("JPEG");
  const [quality, setQuality]   = React.useState(92);
  const [longEdge, setLongEdge] = React.useState(0);   // 0 = full
  const [busy, setBusy]         = React.useState(false);
  const [progress, setProgress] = React.useState(null);

  // What's exported. If the user has explicitly added presets to the export
  // selection, use that list; else fall back to the currently active preset.
  const exportIds = selected.size > 0 ? Array.from(selected) : (activePreset ? [activePreset] : []);
  const baseName = sourceName.replace(/\.[^.]+$/, "") || "image";

  const doExport = React.useCallback(async () => {
    if (!sourceCanvas || exportIds.length === 0 || busy) return;
    setBusy(true);
    try {
      // Render once per preset at the source resolution (with optional
      // long-edge downscale). Intensity blends the filtered output over the
      // original via globalAlpha — matches viewer.html.
      const fmt = EXPORT_FORMATS[format] || EXPORT_FORMATS.JPEG;
      const intensityF = intensity / 100;

      // Optionally pre-scale the source for export — used for long-edge cap.
      let exportSrc = sourceCanvas;
      if (longEdge > 0 && Math.max(sourceCanvas.width, sourceCanvas.height) > longEdge) {
        const s = longEdge / Math.max(sourceCanvas.width, sourceCanvas.height);
        const w = Math.max(1, Math.round(sourceCanvas.width  * s));
        const h = Math.max(1, Math.round(sourceCanvas.height * s));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const cc = c.getContext("2d");
        cc.imageSmoothingQuality = "high";
        cc.drawImage(sourceCanvas, 0, 0, w, h);
        exportSrc = c;
      }
      const srcData = exportSrc.getContext("2d").getImageData(0, 0, exportSrc.width, exportSrc.height);

      for (let i = 0; i < exportIds.length; i++) {
        const id = exportIds[i];
        setProgress({ i: i + 1, total: exportIds.length, name: PRESETS[id]?.name || id });
        await new Promise((r) => setTimeout(r, 0));  // yield so progress paints
        const filtered = applyPreset(srcData, id, exportSrc.width, exportSrc.height);
        const out = document.createElement("canvas");
        out.width = exportSrc.width; out.height = exportSrc.height;
        const octx = out.getContext("2d");
        if (intensityF < 1) {
          octx.drawImage(exportSrc, 0, 0);
          const tmp = document.createElement("canvas");
          tmp.width = exportSrc.width; tmp.height = exportSrc.height;
          tmp.getContext("2d").putImageData(filtered, 0, 0);
          octx.globalAlpha = intensityF;
          octx.drawImage(tmp, 0, 0);
          octx.globalAlpha = 1;
        } else {
          octx.putImageData(filtered, 0, 0);
        }
        const blob = await new Promise((r) => out.toBlob(r, fmt.mime, quality / 100));
        triggerDownload(blob, `${baseName}_${id}.${fmt.ext}`);
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [sourceCanvas, exportIds, busy, format, quality, longEdge, intensity, baseName]);

  return (
    <div style={{ overflow: "hidden" }}>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={false}>FORMAT</SectionHeader>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {Object.keys(EXPORT_FORMATS).map((f) => (
          <span
            key={f}
            onClick={() => setFormat(f)}
            style={{ ...pill(ctx, format === f), flex: 1, textAlign: "center", cursor: "pointer" }}
          >{f}</span>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <TabSlider label="Quality" value={quality} min={1} max={100} unit="%" ctx={ctx} onChange={setQuality} />
      </div>

      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={false}>DIMENSIONS</SectionHeader>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <span onClick={() => setLongEdge(0)}    style={{ ...pill(ctx, longEdge === 0),    flex: 1, textAlign: "center", cursor: "pointer" }}>FULL</span>
        <span onClick={() => setLongEdge(2048)} style={{ ...pill(ctx, longEdge === 2048), flex: 1, textAlign: "center", cursor: "pointer" }}>2048</span>
        <span onClick={() => setLongEdge(1080)} style={{ ...pill(ctx, longEdge === 1080), flex: 1, textAlign: "center", cursor: "pointer" }}>1080</span>
        <span onClick={() => setLongEdge(720)}  style={{ ...pill(ctx, longEdge === 720),  flex: 1, textAlign: "center", cursor: "pointer" }}>720</span>
      </div>
      <div style={{ fontFamily: ctx.mono, fontSize: 9.5, color: ctx.ultraMuted, marginBottom: 16, letterSpacing: "0.04em" }}>
        {longEdge === 0 ? "FULL RESOLUTION" : `LONG EDGE · ${longEdge} px`}
      </div>

      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={false}>PRESETS TO EXPORT</SectionHeader>
      <div style={{ fontFamily: ctx.mono, fontSize: 10, color: ctx.muted, marginBottom: 10, letterSpacing: "0.04em" }}>
        {selected.size > 0
          ? `${selected.size} SELECTED · ADD MORE FROM THE FILM STRIP (SPACE OR CLICK BELOW)`
          : `EXPORTING ACTIVE PRESET ONLY · ${PRESETS[activePreset]?.name || ""}`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {PRESETS_LIST.map((p) => {
          const on = selected.has(p.id);
          return (
            <div
              key={p.id}
              onClick={() => toggleSelected(p.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 8px", border: `1px solid ${on ? ctx.accent : ctx.border}`,
                background: on ? "rgba(232,155,74,0.08)" : "transparent",
                cursor: "pointer",
              }}
            >
              <span style={{
                width: 12, height: 12, borderRadius: 2,
                border: `1.5px solid ${on ? ctx.accent : ctx.border}`,
                background: on ? ctx.accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: "#1a1208", flexShrink: 0,
              }}>{on ? "✓" : ""}</span>
              <span style={{ fontFamily: ctx.mono, fontSize: 10.5, color: ctx.text, flex: 1 }}>{p.name}</span>
              <span style={{ fontFamily: ctx.mono, fontSize: 9, color: ctx.muted }}>{p.sub}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={doExport}
        disabled={!sourceCanvas || exportIds.length === 0 || busy}
        style={{
          width: "100%", background: ctx.accent, color: "#1a1208", border: "none",
          padding: "10px 0", fontFamily: ctx.mono, fontSize: 10.5, fontWeight: 700,
          letterSpacing: "0.1em", cursor: (!sourceCanvas || busy) ? "not-allowed" : "pointer",
          borderRadius: 2, opacity: (!sourceCanvas || exportIds.length === 0 || busy) ? 0.5 : 1,
        }}
      >
        {busy && progress
          ? `RENDERING ${progress.i}/${progress.total} · ${progress.name}`
          : `↗ EXPORT ${exportIds.length} ${exportIds.length === 1 ? "PHOTO" : "PHOTOS"}`}
      </button>
    </div>
  );
}

function triggerDownload(blob, filename) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─── shared mini-helpers ──────────────────────────────────────────────────
function pill(ctx, active = false) {
  return {
    padding: "4px 9px", fontFamily: ctx.mono, fontSize: 9, letterSpacing: "0.08em",
    color: active ? "#0e0e10" : "rgba(232,230,225,0.65)",
    background: active ? "#e8e6e1" : "transparent",
    border: `1px solid ${active ? "#e8e6e1" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 2, cursor: "pointer", display: "inline-block",
  };
}

function iconBtn(ctx) {
  return {
    background: "transparent", border: `1px solid ${ctx.border}`,
    color: ctx.text, padding: "4px 8px", fontFamily: ctx.mono, fontSize: 11,
    borderRadius: 2, cursor: "pointer",
  };
}

function dropBtn(ctx) {
  return { ...iconBtn(ctx), padding: "6px 10px", fontSize: 11, fontFamily: ctx.sans };
}

function applyBtn(ctx) {
  return {
    background: ctx.accent, color: "#1a1208", border: "none",
    padding: "7px 14px", fontFamily: ctx.mono, fontSize: 10, fontWeight: 700,
    letterSpacing: "0.08em", cursor: "pointer", borderRadius: 2, flex: 1,
  };
}

function cancelBtn(ctx) {
  return {
    background: "transparent", color: ctx.text, border: `1px solid ${ctx.border}`,
    padding: "7px 14px", fontFamily: ctx.mono, fontSize: 10, fontWeight: 500,
    letterSpacing: "0.08em", cursor: "pointer", borderRadius: 2,
  };
}

function StubBanner({ ctx, message }) {
  return (
    <div style={{
      padding: "6px 8px", marginBottom: 12,
      border: `1px dashed ${ctx.border}`,
      background: "rgba(255,255,255,0.02)",
      fontFamily: ctx.mono, fontSize: 9, color: ctx.muted,
      letterSpacing: "0.04em", lineHeight: 1.5,
    }}>{message}</div>
  );
}

Object.assign(window, {
  TabLight, TabColor, TabHSL, TabCurves, TabEffects, TabCrop, TabLUT, TabExport,
});
