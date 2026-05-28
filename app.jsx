// ============================================================================
// Darkroom — VSCO-meets-Lightroom dark pro shell.
//
// State lives in PhotofilmContext (PhotofilmProvider below). The shell reads
// it through usePhotofilm(); tab bodies in tabs.jsx do the same. Three tabs
// are wired to real functionality (Light/Color/HSL/Curves/Effects/LUT are
// visual stubs — see CLAUDE.md TODOs).
// ============================================================================

const PhotofilmContext = React.createContext(null);
const usePhotofilm = () => React.useContext(PhotofilmContext);

// ----------------------------------------------------------------------------
// PhotofilmProvider — owns app state. Starts empty;
// drag/paste/picker swap it out for the user's own image.
// ----------------------------------------------------------------------------
function PhotofilmProvider({ children }) {
  const [sourceCanvas, setSourceCanvas] = React.useState(null);
  const [sourceName, setSourceName]     = React.useState("DSCF_4821.RAF");
  const [activePreset, setActivePreset] = React.useState("classic-chrome");
  const [intensity, setIntensity]       = React.useState(85);
  const [selected, setSelected]         = React.useState(() => new Set());
  const [activeTab, setActiveTab]       = React.useState("light");
  const [status, setStatus]             = React.useState("");
  const [compare, setCompare]           = React.useState(false);

  // thumb/hero ImageData regenerate from sourceCanvas; both caches are keyed
  // by presetId and cleared when the source changes.
  const [thumb, setThumb] = React.useState(null);
  const [hero, setHero]   = React.useState(null);
  const thumbCacheRef     = React.useRef(new Map());
  const heroCacheRef      = React.useRef(new Map());
  // Version bump forces FilteredPhoto effects to re-run after a cache clear,
  // since the cache identity itself doesn't change.
  const [cacheGen, setCacheGen] = React.useState(0);

  // Pending non-destructive edits. Only one mode is active at a time — when
  // mode is non-null the hero shows a raw preview of that transform instead
  // of the filtered photo (matches viewer.html's edit-mode UX). applyPending
  // bakes the active transform into sourceCanvas; cancelPending discards it.
  //   "rotate":     ruler-driven angle (existing)
  //   "perspective": composite of vertical/horizontal keystone, rotate, scale,
  //                  and x/y offset — all bake together via bakeTransform.
  //   "crop":       interactive drag-handle crop with FREE aspect.
  const ZERO_TRANSFORM = { vertical: 0, horizontal: 0, rotateDeg: 0, scale: 0, offsetX: 0, offsetY: 0 };
  const ZERO_CROP = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  const [pending, setPending] = React.useState({
    mode: null,
    rotateAngle: 0,
    perspectiveAmount: 0,
    transform: { ...ZERO_TRANSFORM },
    crop: { ...ZERO_CROP },
  });

  // User adjustments by tab — applied after the active preset in the hero
  // render. Kept separate from the preset cache so changing a slider doesn't
  // invalidate the (expensive) preset rendering.
  const [lightAdjust,   setLightAdjust]   = React.useState(ZERO_LIGHT);
  const [colorAdjust,   setColorAdjust]   = React.useState(ZERO_COLOR);
  const [hslAdjust,     setHSLAdjust]     = React.useState(ZERO_HSL);
  const [curvesAdjust,  setCurvesAdjust]  = React.useState(ZERO_CURVES);
  const [effectsAdjust, setEffectsAdjust] = React.useState(ZERO_EFFECTS);

  const updateLight   = React.useCallback((key, value) => setLightAdjust  ((p) => ({ ...p, [key]: value })), []);
  const updateColor   = React.useCallback((key, value) => setColorAdjust  ((p) => ({ ...p, [key]: value })), []);
  const updateEffects = React.useCallback((key, value) => setEffectsAdjust((p) => ({ ...p, [key]: value })), []);
  const updateHSL = React.useCallback((colorKey, axis, value) => {
    setHSLAdjust((p) => ({ ...p, [colorKey]: { ...(p[colorKey] || { h: 0, s: 0, l: 0 }), [axis]: value } }));
  }, []);
  const updateCurves = React.useCallback((channel, points) => {
    setCurvesAdjust((p) => ({ ...p, [channel]: points }));
  }, []);
  const resetLight   = React.useCallback(() => setLightAdjust(ZERO_LIGHT),   []);
  const resetColor   = React.useCallback(() => setColorAdjust(ZERO_COLOR),   []);
  const resetHSL     = React.useCallback(() => setHSLAdjust(ZERO_HSL),       []);
  const resetCurves  = React.useCallback(() => setCurvesAdjust(ZERO_CURVES), []);
  const resetEffects = React.useCallback(() => setEffectsAdjust(ZERO_EFFECTS), []);

  // Composite passed down to FilteredPhoto. Memoized so the effect dep in
  // FilteredPhoto only fires when an actual slider changes.
  const userAdjust = React.useMemo(
    () => ({ light: lightAdjust, color: colorAdjust, hsl: hslAdjust, curves: curvesAdjust, effects: effectsAdjust }),
    [lightAdjust, colorAdjust, hslAdjust, curvesAdjust, effectsAdjust],
  );

  React.useEffect(() => {
    if (!sourceCanvas) return;
    const t = downscaleToImageData(sourceCanvas, THUMB_MAX);
    const h = downscaleToImageData(sourceCanvas, HERO_MAX);
    setThumb(t);
    setHero(h);
    thumbCacheRef.current = new Map();
    heroCacheRef.current  = new Map();
    setCacheGen((g) => g + 1);
  }, [sourceCanvas]);

  const loadFromFile = React.useCallback(async (file) => {
    if (!file || !isLoadableImage(file)) return;
    let decodable = file;
    try {
      if (RAW_EXT.test(file.name)) {
        setStatus("Extracting preview from RAW…");
        await new Promise((r) => setTimeout(r, 16));
        const jpeg = await extractEmbeddedJpeg(file);
        if (!jpeg) {
          setStatus("No JPEG preview in this RAW file");
          setTimeout(() => setStatus(""), 2400);
          return;
        }
        decodable = jpeg;
      } else {
        setStatus("Loading…");
      }
      const c = await loadOrientedCanvas(decodable);
      setSourceCanvas(c);
      setSourceName(file.name);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Couldn't decode this file");
      setTimeout(() => setStatus(""), 2400);
    }
  }, []);

  const toggleSelected = React.useCallback((id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const applyEdit = React.useCallback((mutator) => {
    setSourceCanvas((prev) => (prev ? mutator(prev) : prev));
  }, []);

  const setPendingRotate = React.useCallback((deg) => {
    const a = Math.max(-45, Math.min(45, deg));
    setPending((p) => ({ ...p, mode: "rotate", rotateAngle: a }));
  }, []);

  // Composite perspective/transform sliders. Vertical+horizontal are keystone
  // (-0.5..+0.5 normalized), rotate is degrees (-45..+45), scale/offset are
  // normalized factors; setting any field switches the hero into perspective
  // preview mode.
  const setPendingTransform = React.useCallback((key, value) => {
    setPending((p) => {
      const next = { ...(p.mode === "perspective" ? p.transform : { vertical: 0, horizontal: 0, rotateDeg: 0, scale: 0, offsetX: 0, offsetY: 0 }) };
      next[key] = value;
      // Keep the legacy single-knob field in sync so older callers still work.
      const perspAmt = next.vertical;
      return { ...p, mode: "perspective", transform: next, perspectiveAmount: perspAmt };
    });
  }, []);

  // Crop overlay: drag handles in TabCrop update this via setPendingCrop.
  const setPendingCrop = React.useCallback((crop) => {
    setPending((p) => ({ ...p, mode: "crop", crop }));
  }, []);

  const startPendingCrop = React.useCallback(() => {
    setPending((p) => ({ ...p, mode: "crop", crop: p.crop || { x: 0.05, y: 0.05, w: 0.9, h: 0.9 } }));
  }, []);

  const cancelPending = React.useCallback(() => {
    setPending({
      mode: null, rotateAngle: 0, perspectiveAmount: 0,
      transform: { vertical: 0, horizontal: 0, rotateDeg: 0, scale: 0, offsetX: 0, offsetY: 0 },
      crop: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
    });
  }, []);

  // Bake whichever pending transform is active. Pure: source → new source.
  // Called from the geo tab's Apply button.
  const applyPending = React.useCallback(() => {
    setSourceCanvas((prev) => {
      if (!prev) return prev;
      if (pending.mode === "rotate")      return bakeRotate(prev, pending.rotateAngle);
      if (pending.mode === "perspective") return bakeTransform(prev, pending.transform);
      if (pending.mode === "crop")        return bakeCrop(prev, pending.crop);
      return prev;
    });
    cancelPending();
  }, [pending, cancelPending]);

  // intensity is stored 0–100 (slider domain); render-time consumers divide.
  const value = {
    sourceCanvas, sourceName,
    activePreset, setActivePreset,
    intensity, setIntensity,
    selected, setSelected, toggleSelected,
    activeTab, setActiveTab,
    status, setStatus,
    compare, setCompare,
    thumb, hero, cacheGen,
    thumbCache: thumbCacheRef.current,
    heroCache:  heroCacheRef.current,
    loadFromFile, applyEdit,
    pending, setPendingRotate, setPendingTransform, setPendingCrop, startPendingCrop,
    applyPending, cancelPending,
    lightAdjust,   updateLight,   resetLight,
    colorAdjust,   updateColor,   resetColor,
    hslAdjust,     updateHSL,     resetHSL,
    curvesAdjust,  updateCurves,  resetCurves,
    effectsAdjust, updateEffects, resetEffects,
    userAdjust,
  };
  return <PhotofilmContext.Provider value={value}>{children}</PhotofilmContext.Provider>;
}

// ----------------------------------------------------------------------------
// Darkroom — the design shell. Reads state from PhotofilmContext.
// ----------------------------------------------------------------------------
function Darkroom({ tweaks }) {
  const t = tweaks || {};
  const accent = t.accent || "#e89b4a";
  const bg = "#0e0e10";
  const panel = "#161618";
  const panelHi = "#1c1c1f";
  const border = "rgba(255,255,255,0.06)";
  const text = "#e8e6e1";
  const muted = "rgba(232,230,225,0.5)";
  const ultraMuted = "rgba(232,230,225,0.3)";
  const mono = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace";
  const sans = t.fontFamily || "'Inter', system-ui, sans-serif";
  const density = t.density === "compact" ? 0.85 : 1;
  const railRight = t.railSide !== "left";

  const ph = usePhotofilm();
  const {
    sourceCanvas, sourceName,
    activePreset, setActivePreset,
    intensity, setIntensity,
    activeTab, setActiveTab,
    status, compare, setCompare,
    thumb, hero, thumbCache, heroCache,
    loadFromFile, cacheGen, pending,
    userAdjust, setPendingCrop,
  } = ph;

  const active = PRESETS[activePreset] || PRESETS_LIST[0];
  const renderedIntensity = compare ? 0 : intensity / 100;
  const thumbSize = (t.thumbSize || 96) * density;
  const showHist = t.histogram !== false;

  const TAB_DEFS = [
    { id: "light",  label: "LIGHT",   icon: "☀" },
    { id: "color",  label: "COLOR",   icon: "◐" },
    { id: "hsl",    label: "HSL",     icon: "▦" },
    { id: "curves", label: "CURVES",  icon: "∿" },
    { id: "fx",     label: "EFFECTS", icon: "✦" },
    { id: "geo",    label: "CROP",    icon: "⌗" },
    { id: "lut",    label: "LUT",     icon: "▣" },
    { id: "export", label: "EXPORT",  icon: "↗" },
  ];

  const headerH = 44;
  const railW   = 340 * density;
  const filmH   = thumbSize + 76;
  const railOrder = railRight ? { canvas: 1, rail: 2 } : { rail: 1, canvas: 2 };

  // File picker (hidden input triggered by the Open button in the toolbar).
  const filePickerRef = React.useRef(null);

  // Style bag passed to all tab bodies so they share the palette + helpers.
  const ctx = { accent, bg, panel, panelHi, border, text, muted, ultraMuted, mono, sans };

  return (
    <div style={{
      width: "100vw", height: "100vh", background: bg, color: text,
      fontFamily: sans, fontSize: 13, display: "flex", flexDirection: "column",
      overflow: "hidden", position: "relative",
    }}>
      {/* ── TOP TOOLBAR ──────────────────────────────────────────────────── */}
      <div style={{
        height: headerH, flexShrink: 0, background: panel,
        borderBottom: `1px solid ${border}`,
        display: "flex", alignItems: "center", padding: "0 14px", gap: 16,
      }}>
        <PhotofilmLogo size={20} color={text} font={sans} weight={500} />
        <div style={{ width: 1, height: 18, background: border }} />
        <span style={{ fontFamily: mono, fontSize: 11, color: muted, letterSpacing: "0.04em" }}>
          {sourceName}
        </span>
        <span style={{ fontFamily: mono, fontSize: 10, color: ultraMuted }}>
          {sourceCanvas ? `· ${sourceCanvas.width} × ${sourceCanvas.height}` : "· no photo loaded"}
        </span>
        {status && (
          <span style={{ fontFamily: mono, fontSize: 10, color: accent, letterSpacing: "0.06em" }}>
            · {status}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <ToolbarBtn onClick={() => filePickerRef.current?.click()}>↥ OPEN</ToolbarBtn>
        <div style={{ width: 1, height: 18, background: border, margin: "0 4px" }} />
        <ToolbarBtn
          onMouseDown={() => setCompare(true)}
          onMouseUp={() => setCompare(false)}
          onMouseLeave={() => setCompare(false)}
          active={compare}
          accent={accent}
        >◉ HOLD TO COMPARE</ToolbarBtn>
        <div style={{ width: 1, height: 18, background: border, margin: "0 4px" }} />
        <ToolbarBtn primary accent={accent} onClick={() => setActiveTab("export")}>↗ EXPORT</ToolbarBtn>
      </div>

      {/* Hidden file input for the Open button */}
      <input
        ref={filePickerRef}
        type="file"
        accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.pef,.srw"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFromFile(f);
          e.target.value = "";
        }}
      />

      {/* ── MAIN ROW ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* CANVAS COLUMN */}
        <div style={{
          flex: 1, position: "relative", display: "flex", flexDirection: "column",
          order: railOrder.canvas, minWidth: 0,
        }}>
          {/* photo viewport */}
          <div style={{ flex: 1, position: "relative", padding: "24px 28px", minHeight: 0, display: "flex", alignItems: "stretch", justifyContent: "center" }}>
            {hero && pending.mode && activeTab === "geo" ? (
              <EditPreview
                sourceCanvas={sourceCanvas}
                pending={pending}
                onCropChange={setPendingCrop}
                style={{
                  width: "100%", height: "100%",
                  borderRadius: 2,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}
              />
            ) : hero ? (
              <FilteredPhoto
                sourceData={hero.data}
                sourceW={hero.w}
                sourceH={hero.h}
                cache={heroCache}
                presetId={activePreset}
                intensity={renderedIntensity}
                userAdjust={userAdjust}
                key={`hero-${cacheGen}`}
                style={{
                  width: "100%", height: "100%",
                  borderRadius: 2,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                  background: "#000",
                }}
              />
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${border}`, color: muted, fontFamily: mono, fontSize: 11, letterSpacing: "0.1em" }}>
                DROP A PHOTO HERE · OR CLICK OPEN
              </div>
            )}

            {/* Histogram overlay (real, derived from hero ImageData) */}
            {showHist && hero && (
              <div style={{
                position: "absolute", top: 36, right: 40,
                background: "rgba(14,14,16,0.78)", backdropFilter: "blur(10px)",
                border: `1px solid ${border}`, padding: "8px 10px 6px", borderRadius: 2,
              }}>
                <div style={{ fontFamily: mono, fontSize: 9, color: muted, letterSpacing: "0.1em", marginBottom: 4 }}>
                  HISTOGRAM · RGB
                </div>
                <Histogram imageData={hero.data} width={180} height={48} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 9, color: ultraMuted, marginTop: 2 }}>
                  <span>0</span><span>64</span><span>128</span><span>192</span><span>255</span>
                </div>
              </div>
            )}

            {/* EXIF chip bottom-left */}
            {sourceCanvas && (
              <div style={{
                position: "absolute", bottom: 36, left: 40,
                background: "rgba(14,14,16,0.78)", backdropFilter: "blur(10px)",
                border: `1px solid ${border}`, padding: "8px 12px", borderRadius: 2,
                fontFamily: mono, fontSize: 10, color: muted, letterSpacing: "0.04em",
                display: "flex", gap: 16,
              }}>
                <span>{sourceCanvas.width} × {sourceCanvas.height}</span>
                <span>·</span>
                <span style={{ color: accent }}>{active.name}</span>
                <span>·</span>
                <span>{intensity}%</span>
              </div>
            )}
          </div>

          {/* ── FILM STRIP ─────────────────────────────────────────────── */}
          <div style={{
            height: filmH, flexShrink: 0, background: panel,
            borderTop: `1px solid ${border}`, padding: "12px 20px 14px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: muted, letterSpacing: "0.18em" }}>
                FILM SIMULATION
              </span>
              <span style={{ fontFamily: mono, fontSize: 10, color: ultraMuted }}>
                {PRESETS_LIST.length} PRESETS
              </span>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 240 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>STRENGTH</span>
                <div style={{ flex: 1 }}>
                  <Slider
                    label=""
                    value={intensity}
                    min={0} max={100}
                    unit="%"
                    color={accent}
                    labelStyle={{ display: "none" }}
                    onChange={setIntensity}
                  />
                </div>
                <span style={{ fontFamily: mono, fontSize: 10, color: text, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>{intensity}%</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {PRESETS_LIST.map((p) => {
                const isActive = p.id === activePreset;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActivePreset(p.id)}
                    title={p.blurb}
                    style={{ flexShrink: 0, width: thumbSize, position: "relative", cursor: "pointer" }}
                  >
                    {thumb ? (
                      <FilteredPhoto
                        sourceData={thumb.data}
                        sourceW={thumb.w}
                        sourceH={thumb.h}
                        cache={thumbCache}
                        presetId={p.id}
                        intensity={1}
                        objectFit="cover"
                        key={`thumb-${p.id}-${cacheGen}`}
                        style={{
                          width: thumbSize, height: thumbSize, borderRadius: 1,
                          outline: isActive ? `1.5px solid ${accent}` : `1px solid ${border}`,
                          outlineOffset: isActive ? 2 : 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: thumbSize, height: thumbSize,
                        background: "#222", borderRadius: 1,
                        outline: isActive ? `1.5px solid ${accent}` : `1px solid ${border}`,
                      }} />
                    )}
                    <div style={{
                      position: "absolute", left: 0, right: 0, bottom: 0,
                      padding: "10px 6px 4px",
                      background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
                      fontFamily: mono, fontSize: 8.5, letterSpacing: "0.08em",
                      color: isActive ? accent : "#fff", pointerEvents: "none",
                    }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                    </div>
                    {isActive && (
                      <div style={{
                        position: "absolute", top: 4, right: 4,
                        width: 6, height: 6, background: accent, borderRadius: "50%",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT RAIL ───────────────────────────────────────────────── */}
        <div style={{
          width: railW, flexShrink: 0, background: panel,
          borderLeft:  railRight ? `1px solid ${border}` : "none",
          borderRight: railRight ? "none" : `1px solid ${border}`,
          display: "flex", flexDirection: "column", order: railOrder.rail,
          minHeight: 0,
        }}>
          {/* tab strip */}
          <div style={{
            display: "flex", borderBottom: `1px solid ${border}`,
            background: panelHi, flexShrink: 0,
          }}>
            {TAB_DEFS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: "10px 0 9px", textAlign: "center", cursor: "pointer",
                    borderBottom: isActive ? `1.5px solid ${accent}` : "1.5px solid transparent",
                    color: isActive ? text : muted,
                    fontFamily: mono, fontSize: 9, letterSpacing: "0.1em",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              );
            })}
          </div>

          {/* tab body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", minHeight: 0 }}>
            {renderTabBody(activeTab, ctx)}
          </div>

          {/* footer keyboard hint */}
          <div style={{
            borderTop: `1px solid ${border}`, padding: "8px 14px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontFamily: mono, fontSize: 9, color: ultraMuted, letterSpacing: "0.08em",
            flexShrink: 0,
          }}>
            <span>HOLD <Kbd>\</Kbd> TO COMPARE</span>
            <span>← / → TO STEP PRESETS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTabBody(activeTab, ctx) {
  switch (activeTab) {
    case "light":  return <TabLight ctx={ctx} />;
    case "color":  return <TabColor ctx={ctx} />;
    case "hsl":    return <TabHSL ctx={ctx} />;
    case "curves": return <TabCurves ctx={ctx} />;
    case "fx":     return <TabEffects ctx={ctx} />;
    case "geo":    return <TabCrop ctx={ctx} />;
    case "lut":    return <TabLUT ctx={ctx} />;
    case "export": return <TabExport ctx={ctx} />;
    default:       return <TabLight ctx={ctx} />;
  }
}

// ─── EditPreview ──────────────────────────────────────────────────────────
// Renders an unfiltered preview of the source canvas with the active pending
// transform applied. Used while the user is dragging the straighten ruler,
// any perspective slider, or the interactive crop handles.
function EditPreview({ sourceCanvas, pending, onCropChange, style }) {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [fitRect, setFitRect] = React.useState(null);  // photo-in-viewport rect for crop overlay

  // Track the wrapper's on-screen size so the preview canvas matches it.
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!sourceCanvas || !size.w || !size.h) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size.w, size.h);

    if (pending.mode === "rotate") {
      const angle = pending.rotateAngle * Math.PI / 180;
      const ins = inscribedRect(sourceCanvas.width, sourceCanvas.height, angle);
      // Zoom so the inscribed rect fills the preview — matches what
      // bakeRotate will crop to, so the user sees the final result.
      const scale = Math.min(size.w / ins.w, size.h / ins.h);
      const dw = sourceCanvas.width  * scale;
      const dh = sourceCanvas.height * scale;
      ctx.save();
      ctx.translate(size.w / 2, size.h / 2);
      ctx.rotate(angle);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceCanvas, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      setFitRect(null);
    } else if (pending.mode === "perspective") {
      // Live preview of the composite transform. Bake to a temp canvas of
      // the source size, then draw fit-to-viewport.
      const baked = bakeTransform(sourceCanvas, pending.transform || {
        vertical: pending.perspectiveAmount || 0,
        horizontal: 0, rotateDeg: 0, scale: 0, offsetX: 0, offsetY: 0,
      });
      const fitScale = Math.min(size.w / baked.width, size.h / baked.height);
      const fitW = baked.width  * fitScale;
      const fitH = baked.height * fitScale;
      const offsetX = (size.w - fitW) / 2;
      const offsetY = (size.h - fitH) / 2;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(baked, offsetX, offsetY, fitW, fitH);
      setFitRect(null);
    } else if (pending.mode === "crop") {
      // For crop: draw the (unfiltered) source full-size and surface the
      // photo rect so the overlay knows where the handles sit.
      const fitScale = Math.min(size.w / sourceCanvas.width, size.h / sourceCanvas.height);
      const fitW = sourceCanvas.width  * fitScale;
      const fitH = sourceCanvas.height * fitScale;
      const ox = (size.w - fitW) / 2;
      const oy = (size.h - fitH) / 2;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceCanvas, ox, oy, fitW, fitH);
      setFitRect({ x: ox, y: oy, w: fitW, h: fitH });
    }
  }, [sourceCanvas, pending, size]);

  return (
    <div ref={wrapRef} style={{ ...style, position: "relative", background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {pending.mode === "crop" && fitRect && onCropChange && (
        <CropOverlay rect={fitRect} crop={pending.crop} onChange={onCropChange} />
      )}
    </div>
  );
}

// ─── CropOverlay ──────────────────────────────────────────────────────────
// Eight-handle drag-to-resize + drag-to-move crop frame. `rect` is the photo
// rect inside the wrapper in pixels; `crop` is the normalized {x,y,w,h} of
// the crop within the source. onChange is called with the new normalized
// crop on every drag tick.
function CropOverlay({ rect, crop, onChange }) {
  const MIN = 0.05;
  const startDrag = React.useCallback((e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const start = { ...crop };
    const move = (ev) => {
      const dx = (ev.clientX - startX) / rect.w;
      const dy = (ev.clientY - startY) / rect.h;
      let next = { ...start };
      if (handle === "move") {
        next.x = Math.max(0, Math.min(1 - start.w, start.x + dx));
        next.y = Math.max(0, Math.min(1 - start.h, start.y + dy));
      } else {
        let x1 = start.x, y1 = start.y, x2 = start.x + start.w, y2 = start.y + start.h;
        if (handle.includes("w")) x1 = Math.max(0, Math.min(x2 - MIN, x1 + dx));
        if (handle.includes("e")) x2 = Math.min(1, Math.max(x1 + MIN, x2 + dx));
        if (handle.includes("n")) y1 = Math.max(0, Math.min(y2 - MIN, y1 + dy));
        if (handle.includes("s")) y2 = Math.min(1, Math.max(y1 + MIN, y2 + dy));
        next = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      onChange(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [rect, crop, onChange]);

  const frameStyle = {
    position: "absolute",
    left:   rect.x + crop.x * rect.w,
    top:    rect.y + crop.y * rect.h,
    width:  crop.w * rect.w,
    height: crop.h * rect.h,
    border: "1px solid rgba(255,255,255,0.85)",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
    cursor: "move",
  };

  // Rule-of-thirds grid + 8 handles. Handle positions are relative to frame.
  const HANDLES = [
    { k: "nw", style: { top: -6, left: -6, cursor: "nwse-resize" } },
    { k: "n",  style: { top: -6, left: "50%", marginLeft: -6, cursor: "ns-resize" } },
    { k: "ne", style: { top: -6, right: -6, cursor: "nesw-resize" } },
    { k: "e",  style: { top: "50%", right: -6, marginTop: -6, cursor: "ew-resize" } },
    { k: "se", style: { bottom: -6, right: -6, cursor: "nwse-resize" } },
    { k: "s",  style: { bottom: -6, left: "50%", marginLeft: -6, cursor: "ns-resize" } },
    { k: "sw", style: { bottom: -6, left: -6, cursor: "nesw-resize" } },
    { k: "w",  style: { top: "50%", left: -6, marginTop: -6, cursor: "ew-resize" } },
  ];
  return (
    <div style={frameStyle} onMouseDown={(e) => startDrag(e, "move")}>
      {/* thirds grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.25)" }} />
        <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.25)" }} />
        <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.25)" }} />
        <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.25)" }} />
      </div>
      {HANDLES.map((h) => (
        <div
          key={h.k}
          onMouseDown={(e) => startDrag(e, h.k)}
          style={{
            position: "absolute", width: 12, height: 12, background: "#fff",
            border: "1px solid rgba(0,0,0,0.4)", borderRadius: 1, ...h.style,
          }}
        />
      ))}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────
function ToolbarBtn({ children, primary = false, accent = "#e89b4a", active = false, onClick, onMouseDown, onMouseUp, onMouseLeave }) {
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{
        background: primary ? accent : active ? "rgba(255,255,255,0.08)" : "transparent",
        color: primary ? "#1a1208" : "inherit",
        border: primary ? "none" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 2,
        padding: "5px 10px",
        fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        letterSpacing: "0.08em", cursor: "pointer",
        fontWeight: primary ? 600 : 500,
      }}
    >{children}</button>
  );
}

function Kbd({ children }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 5px",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 2,
      margin: "0 2px",
      fontSize: 9,
    }}>{children}</span>
  );
}

// ============================================================================
// PhotofilmRoot — top-level component. Mounts the provider, the shell, and
// global listeners for drag/paste/keyboard.
// ============================================================================
function PhotofilmRoot({ tweaks }) {
  return (
    <PhotofilmProvider>
      <GlobalInputs />
      <Darkroom tweaks={tweaks} />
      <DragOverlay />
    </PhotofilmProvider>
  );
}

function GlobalInputs() {
  const { loadFromFile, setActivePreset, activePreset, toggleSelected, selected } = usePhotofilm();

  // Drag-drop + paste at window level (matches viewer.html UX). The
  // DragOverlay just paints the UI; the actual file handler lives here.
  React.useEffect(() => {
    const onDrop = (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) loadFromFile(f);
    };
    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { loadFromFile(f); break; }
        }
      }
    };
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("paste", onPaste);
    };
  }, [loadFromFile]);

  // Keyboard: ←/→ to step through presets, Space to add the active preset to
  // the export selection. Ignore when typing in an input.
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      const idx = PRESET_IDS.indexOf(activePreset);
      if (e.key === "ArrowRight" && idx >= 0) {
        setActivePreset(PRESET_IDS[(idx + 1) % PRESET_IDS.length]);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && idx >= 0) {
        setActivePreset(PRESET_IDS[(idx - 1 + PRESET_IDS.length) % PRESET_IDS.length]);
        e.preventDefault();
      } else if (e.key === " " && activePreset) {
        toggleSelected(activePreset);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePreset, setActivePreset, toggleSelected]);

  return null;
}

function DragOverlay() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    let depth = 0;
    const enter = (e) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      depth++; setShow(true);
    };
    const leave = () => { depth = Math.max(0, depth - 1); if (depth === 0) setShow(false); };
    const drop = () => { depth = 0; setShow(false); };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(14,14,16,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      letterSpacing: "0.1em", color: "#e89b4a", fontSize: 14,
    }}>
      DROP TO LOAD PHOTO
    </div>
  );
}

Object.assign(window, { Darkroom, PhotofilmRoot, PhotofilmProvider, PhotofilmContext, usePhotofilm });
