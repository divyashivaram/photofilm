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

function TabSlider({ label, value, unit = "", min = -100, max = 100, ctx, onChange }) {
  return (
    <Slider
      label={label} value={value} unit={unit} min={min} max={max}
      color={ctx.accent}
      labelStyle={{ color: ctx.text, fontSize: 11.5 }}
      valueStyle={{ fontFamily: ctx.mono, fontSize: 10.5 }}
      onChange={onChange}
    />
  );
}

// ─── LIGHT (stub) ─────────────────────────────────────────────────────────
function TabLight({ ctx }) {
  return (
    <div style={{ overflow: "hidden" }}>
      <StubBanner ctx={ctx} message="Visual preview — wiring TODO" />
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>TONE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TabSlider label="Exposure"   value={+0.3} unit=" EV" min={-5} max={5} ctx={ctx} />
        <TabSlider label="Contrast"   value={+12}  ctx={ctx} />
        <TabSlider label="Highlights" value={-32}  ctx={ctx} />
        <TabSlider label="Shadows"    value={+24}  ctx={ctx} />
        <TabSlider label="Whites"     value={+8}   ctx={ctx} />
        <TabSlider label="Blacks"     value={-14}  ctx={ctx} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>PRESENCE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TabSlider label="Texture" value={+15} ctx={ctx} />
        <TabSlider label="Clarity" value={+8}  ctx={ctx} />
        <TabSlider label="Dehaze"  value={0}   ctx={ctx} />
      </div>
    </div>
  );
}

// ─── COLOR (stub) ─────────────────────────────────────────────────────────
function TabColor({ ctx }) {
  const WB_PRESETS = ["As Shot", "Auto", "Daylight", "Cloudy", "Shade", "Tungsten", "Fluorescent", "Flash"];
  return (
    <div style={{ overflow: "hidden" }}>
      <StubBanner ctx={ctx} message="Visual preview — wiring TODO" />
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>WHITE BALANCE</SectionHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <button style={dropBtn(ctx)}>
          As Shot <span style={{ color: ctx.muted, marginLeft: 6 }}>▾</span>
        </button>
        <button style={{ ...iconBtn(ctx), color: ctx.accent }} title="Eyedropper">⌖</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
        {WB_PRESETS.map((p, i) => (
          <span key={p} style={pill(ctx, i === 0)}>{p.toUpperCase()}</span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TempSlider value={5400} ctx={ctx} />
        <TintSlider value={-6} ctx={ctx} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>SATURATION</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
        <TabSlider label="Vibrance"   value={+10} ctx={ctx} />
        <TabSlider label="Saturation" value={0}   ctx={ctx} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>SPLIT TONING</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
        <ToneCard label="SHADOWS"    hue={210} sat={28} ctx={ctx} />
        <ToneCard label="HIGHLIGHTS" hue={38}  sat={20} ctx={ctx} />
      </div>
      <TabSlider label="Balance" value={-12} ctx={ctx} />
    </div>
  );
}

function TempSlider({ value, ctx }) {
  const pct = ((value - 2000) / 8000) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: ctx.text }}>
        <span>Temperature</span>
        <span style={{ fontFamily: ctx.mono, fontSize: 10.5, color: ctx.muted }}>{value} K</span>
      </div>
      <div style={{
        position: "relative", height: 6, borderRadius: 3,
        background: "linear-gradient(to right, #4b8de5 0%, #ffffff 50%, #f3c33f 100%)",
        opacity: 0.7,
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

function TintSlider({ value, ctx }) {
  const pct = ((value + 100) / 200) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: ctx.text }}>
        <span>Tint</span>
        <span style={{ fontFamily: ctx.mono, fontSize: 10.5, color: ctx.muted }}>{value > 0 ? "+" : ""}{value}</span>
      </div>
      <div style={{
        position: "relative", height: 6, borderRadius: 3,
        background: "linear-gradient(to right, #4baf4b 0%, #888 50%, #d04bc2 100%)",
        opacity: 0.7,
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

function ToneCard({ label, hue, sat, ctx }) {
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
          background: `hsl(${hue}, ${sat * 2.5}%, 50%)`,
          border: `1px solid ${ctx.border}`,
        }} />
      </div>
      <div style={{
        height: 18, borderRadius: 1,
        background: `linear-gradient(to right, hsl(0,${sat * 2.5}%,50%), hsl(60,${sat * 2.5}%,50%), hsl(120,${sat * 2.5}%,50%), hsl(180,${sat * 2.5}%,50%), hsl(240,${sat * 2.5}%,50%), hsl(300,${sat * 2.5}%,50%), hsl(360,${sat * 2.5}%,50%))`,
        position: "relative",
      }}>
        <span style={{
          position: "absolute", top: -2, bottom: -2, left: `${(hue/360)*100}%`,
          width: 2, background: ctx.text,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ctx.mono, fontSize: 9, color: ctx.muted }}>
        <span>H {hue}°</span>
        <span>S {sat}</span>
      </div>
    </div>
  );
}

// ─── HSL (stub) ───────────────────────────────────────────────────────────
const HSL_COLORS = [
  { name: "Red",     hue: 0,   sat: 80 },
  { name: "Orange",  hue: 28,  sat: 85 },
  { name: "Yellow",  hue: 52,  sat: 85 },
  { name: "Green",   hue: 130, sat: 70 },
  { name: "Aqua",    hue: 180, sat: 70 },
  { name: "Blue",    hue: 215, sat: 75 },
  { name: "Purple",  hue: 270, sat: 65 },
  { name: "Magenta", hue: 310, sat: 70 },
];

const HSL_VALUES = {
  Red:     { h: -8,  s: -12, l: -5  },
  Orange:  { h: +4,  s: +15, l: +10 },
  Yellow:  { h: -10, s: -20, l: -5  },
  Green:   { h: +5,  s: -18, l: -2  },
  Aqua:    { h: -3,  s: +8,  l: 0   },
  Blue:    { h: +12, s: -22, l: -15 },
  Purple:  { h: 0,   s: 0,   l: 0   },
  Magenta: { h: 0,   s: -5,  l: 0   },
};

function TabHSL({ ctx }) {
  return (
    <div style={{ overflow: "hidden" }}>
      <StubBanner ctx={ctx} message="Visual preview — wiring TODO" />
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        <span style={pill(ctx, true)}>ALL</span>
        <span style={pill(ctx)}>HUE</span>
        <span style={pill(ctx)}>SAT</span>
        <span style={pill(ctx)}>LUM</span>
        <div style={{ flex: 1 }} />
        <button title="Target Adjust" style={{ ...iconBtn(ctx), color: ctx.accent, borderColor: ctx.accent }}>⌖</button>
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>COLOR MIX</SectionHeader>
      <div style={{
        display: "grid",
        gridTemplateColumns: "12px minmax(0,1fr) repeat(3, minmax(0,1fr))",
        rowGap: 7, columnGap: 8, alignItems: "center",
      }}>
        <span /><span />
        <span style={hslHdr(ctx)}>HUE</span>
        <span style={hslHdr(ctx)}>SAT</span>
        <span style={hslHdr(ctx)}>LUM</span>
        {HSL_COLORS.map((c) => {
          const v = HSL_VALUES[c.name] || { h: 0, s: 0, l: 0 };
          return (
            <React.Fragment key={c.name}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: `hsl(${c.hue}, ${c.sat}%, 55%)` }} />
              <span style={{ fontSize: 11, color: ctx.text }}>{c.name}</span>
              <HSLBar value={v.h} ctx={ctx} />
              <HSLBar value={v.s} ctx={ctx} />
              <HSLBar value={v.l} ctx={ctx} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function HSLBar({ value, ctx }) {
  const pct = ((value + 100) / 200) * 100;
  return (
    <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 1 }}>
      <span style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,0.15)" }} />
      {value !== 0 && (
        <span style={{
          position: "absolute", top: 0, height: 3,
          left: value >= 0 ? "50%" : `${pct}%`,
          width: `${Math.abs(pct - 50)}%`,
          background: ctx.accent,
        }} />
      )}
      <span style={{
        position: "absolute", top: -3, left: `${pct}%`,
        transform: "translateX(-50%)",
        width: 8, height: 8, borderRadius: "50%", background: ctx.text,
      }} />
      <span style={{ position: "absolute", right: -28, top: -7, fontSize: 9, fontFamily: ctx.mono, color: ctx.muted }}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

function hslHdr(ctx) {
  return { fontFamily: ctx.mono, fontSize: 9, letterSpacing: "0.1em", color: ctx.muted, paddingRight: 28 };
}

// ─── CURVES (stub) ────────────────────────────────────────────────────────
function TabCurves({ ctx }) {
  const CH = ["RGB", "Red", "Green", "Blue", "Luma"];
  return (
    <div style={{ overflow: "hidden" }}>
      <StubBanner ctx={ctx} message="Visual preview — wiring TODO" />
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {CH.map((c, i) => (
          <span key={c} style={pill(ctx, i === 0)}>{c.toUpperCase()}</span>
        ))}
      </div>
      <CurveGraph ctx={ctx} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: ctx.mono, fontSize: 10, color: ctx.muted, display: "flex", gap: 12 }}>
          <span>IN <span style={{ color: ctx.text }}>128</span></span>
          <span>OUT <span style={{ color: ctx.text }}>142</span></span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={iconBtn(ctx)}>＋</button>
          <button style={iconBtn(ctx)}>−</button>
          <button style={iconBtn(ctx)} title="Reset">↺</button>
        </div>
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>CURVE PRESETS</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        {[
          { name: "Linear",          on: false, p: "M 0 30 L 60 0" },
          { name: "Medium Contrast", on: true,  p: "M 0 30 C 15 28 25 16 30 15 C 35 14 45 2 60 0" },
          { name: "Strong Contrast", on: false, p: "M 0 30 C 12 30 22 18 30 15 C 38 12 48 0 60 0" },
          { name: "Filmic",          on: false, p: "M 0 28 C 10 26 20 18 30 13 C 40 8 52 4 60 2" },
          { name: "Crushed Blacks",  on: false, p: "M 0 30 C 8 30 18 20 30 15 C 38 12 50 5 60 4" },
          { name: "Lifted Shadows",  on: false, p: "M 0 24 C 12 20 22 14 30 12 C 40 10 50 4 60 0" },
        ].map((p) => (
          <button key={p.name} style={{
            ...iconBtn(ctx), padding: "8px 8px 4px", display: "flex", flexDirection: "column",
            alignItems: "stretch", gap: 4,
            borderColor: p.on ? ctx.accent : ctx.border,
            color: p.on ? ctx.accent : ctx.muted,
          }}>
            <svg viewBox="0 0 60 30" width="100%" height="22">
              <path d={p.p} fill="none" stroke={p.on ? ctx.accent : "rgba(255,255,255,0.4)"} strokeWidth="1.5" />
            </svg>
            <span style={{ fontFamily: ctx.mono, fontSize: 9, letterSpacing: "0.05em", textAlign: "left" }}>
              {p.name.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CurveGraph({ ctx }) {
  return (
    <div style={{
      width: "100%", aspectRatio: "1 / 1", maxHeight: 240,
      background: ctx.bg, border: `1px solid ${ctx.border}`, position: "relative",
    }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
            <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
          </g>
        ))}
        <line x1={0} y1={100} x2={100} y2={0} stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" strokeDasharray="2 2" />
        <path d="M 0 100 L 5 94 L 12 86 L 22 70 L 35 50 L 48 38 L 60 44 L 72 56 L 82 72 L 92 86 L 100 94 L 100 100 Z" fill="rgba(255,255,255,0.05)" />
        <path d="M 0 88 C 18 82 30 60 50 50 C 70 40 84 22 100 12" stroke={ctx.accent} strokeWidth="1.4" fill="none" />
        {[[0, 88], [25, 70], [50, 50], [75, 28], [100, 12]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill={ctx.text} stroke={ctx.accent} strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
}

// ─── EFFECTS (stub) ───────────────────────────────────────────────────────
function TabEffects({ ctx }) {
  return (
    <div style={{ overflow: "hidden" }}>
      <StubBanner ctx={ctx} message="Visual preview — wiring TODO" />
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>GRAIN</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <TabSlider label="Amount"    value={+18} min={0} max={100} ctx={ctx} />
        <TabSlider label="Size"      value={+50} min={0} max={100} ctx={ctx} />
        <TabSlider label="Roughness" value={+30} min={0} max={100} ctx={ctx} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>VIGNETTE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <TabSlider label="Amount"     value={-22} ctx={ctx} />
        <TabSlider label="Midpoint"   value={+44} min={0} max={100} ctx={ctx} />
        <TabSlider label="Roundness"  value={-8}  ctx={ctx} />
        <TabSlider label="Feather"    value={+62} min={0} max={100} ctx={ctx} />
      </div>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent}>SHARPEN</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <TabSlider label="Amount"  value={+38} min={0} max={150} ctx={ctx} />
        <TabSlider label="Radius"  value={+8}  min={5} max={30} ctx={ctx} />
        <TabSlider label="Detail"  value={+24} min={0} max={100} ctx={ctx} />
        <TabSlider label="Masking" value={+50} min={0} max={100} ctx={ctx} />
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
  const { sourceCanvas, applyEdit, pending, setPendingRotate, setPendingPerspective, applyPending, cancelPending } = ph;

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

  const ASPECTS = ["ORIGINAL", "FREE", "1:1", "4:5", "5:4", "3:2", "16:9", "9:16"];
  const isAspect = (a) => a in ASPECT_RATIOS;

  return (
    <div style={{ overflow: "hidden" }}>
      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={false}>ASPECT</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: 16 }}>
        {ASPECTS.map((a) => {
          const enabled = isAspect(a) && !!sourceCanvas;
          return (
            <button
              key={a}
              onClick={() => enabled && cropToAspect(a)}
              disabled={!enabled}
              title={enabled ? `Crop to ${a} (centered)` : (sourceCanvas ? "Drag-to-crop coming soon" : "Load a photo first")}
              style={{
                ...iconBtn(ctx), padding: "7px 0", textAlign: "center",
                color: enabled ? ctx.text : ctx.muted,
                borderColor: ctx.border,
                fontFamily: ctx.mono, fontSize: 10, letterSpacing: "0.04em",
                opacity: enabled ? 1 : 0.5, cursor: enabled ? "pointer" : "not-allowed",
              }}
            >{a}</button>
          );
        })}
      </div>

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

      <SectionHeader mono={ctx.mono} muted={ctx.muted} accent={ctx.accent} right={pending.mode === "perspective" ? "RESET" : false} onRight={pending.mode === "perspective" ? cancelPending : undefined}>PERSPECTIVE</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 12 }}>
        <TabSlider
          label="Vertical"
          value={pending.mode === "perspective" ? Math.round(pending.perspectiveAmount * 100) : 0}
          ctx={ctx}
          onChange={(v) => setPendingPerspective(v / 100)}
        />
        {/* The rest of the perspective controls are visual stubs — vertical
            keystone is the only one the existing pipeline supports. */}
        <TabSlider label="Horizontal" value={0} ctx={ctx} />
        <TabSlider label="Rotate"     value={0} ctx={ctx} />
        <TabSlider label="Scale"      value={0} ctx={ctx} />
        <TabSlider label="X Offset"   value={0} ctx={ctx} />
        <TabSlider label="Y Offset"   value={0} ctx={ctx} />
      </div>
      {pending.mode === "perspective" && Math.abs(pending.perspectiveAmount) > 0.01 && (
        <div style={{ display: "flex", gap: 6 }}>
          <button style={applyBtn(ctx)} onClick={applyPending}>APPLY PERSPECTIVE</button>
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
