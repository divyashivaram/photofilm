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
const CUSTOM_FILTERS_KEY = "photofilm.customFilters.v1";
const INITIAL_ACTIVE_PRESET = "classic-chrome";
const INITIAL_SNAPSHOT = presetSnapshot(PRESETS[INITIAL_ACTIVE_PRESET]);

function loadCustomFilters() {
  try {
    const raw = localStorage.getItem(CUSTOM_FILTERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function PhotofilmProvider({ children }) {
  const [sourceCanvas, setSourceCanvas] = React.useState(null);
  const [sourceName, setSourceName]     = React.useState("DSCF_4821.RAF");
  // `activePreset` controls which tile is highlighted in the strip and the
  // shown filter name. `baseFilterId` tracks which underlying ops chain is
  // applied by applyPreset — they only differ when activePreset is CUSTOM, in
  // which case baseFilterId stays at the filter the user forked from. This is
  // what keeps monochrome/bloom/channel_saturation/grain present after the
  // user starts editing — those ops live on the base, not in the panels.
  const [activePreset, setActivePreset] = React.useState(INITIAL_ACTIVE_PRESET);
  const [baseFilterId, setBaseFilterId] = React.useState(INITIAL_ACTIVE_PRESET);
  const [intensity, setIntensity]       = React.useState(85);
  const [selected, setSelected]         = React.useState(() => new Set());
  const [activeTab, setActiveTab]       = React.useState("light");
  const [status, setStatus]             = React.useState("");
  const [compare, setCompare]           = React.useState(false);
  const [savedFilters, setSavedFilters] = React.useState(loadCustomFilters);

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
  //
  // Boot state matches the initial active preset's userAdjust snapshot so the
  // hero shows the full filter look (not just the trimmed ops remainder) the
  // first time a photo loads.
  const [lightAdjust,   setLightAdjust]   = React.useState(INITIAL_SNAPSHOT.light);
  const [colorAdjust,   setColorAdjust]   = React.useState(INITIAL_SNAPSHOT.color);
  const [hslAdjust,     setHSLAdjust]     = React.useState(INITIAL_SNAPSHOT.hsl);
  const [curvesAdjust,  setCurvesAdjust]  = React.useState(INITIAL_SNAPSHOT.curves);
  const [effectsAdjust, setEffectsAdjust] = React.useState(INITIAL_SNAPSHOT.effects);

  // Any user-driven slider/pill edit forks the active filter into CUSTOM.
  // Programmatic snapshot loads (selectFilter) bypass this by writing the
  // adjustment slices directly via the raw setters below.
  const forkToCustom = React.useCallback(() => setActivePreset(CUSTOM_ID), []);

  const updateLight   = React.useCallback((key, value) => { setLightAdjust  ((p) => ({ ...p, [key]: value })); forkToCustom(); }, [forkToCustom]);
  const updateColor   = React.useCallback((key, value) => { setColorAdjust  ((p) => ({ ...p, [key]: value })); forkToCustom(); }, [forkToCustom]);
  const updateEffects = React.useCallback((key, value) => { setEffectsAdjust((p) => ({ ...p, [key]: value })); forkToCustom(); }, [forkToCustom]);
  const updateHSL = React.useCallback((colorKey, axis, value) => {
    setHSLAdjust((p) => ({ ...p, [colorKey]: { ...(p[colorKey] || { h: 0, s: 0, l: 0 }), [axis]: value } }));
    forkToCustom();
  }, [forkToCustom]);
  const updateCurves = React.useCallback((channel, points) => {
    setCurvesAdjust((p) => ({ ...p, [channel]: points }));
    forkToCustom();
  }, [forkToCustom]);
  const resetLight   = React.useCallback(() => { setLightAdjust(ZERO_LIGHT);     forkToCustom(); }, [forkToCustom]);
  const resetColor   = React.useCallback(() => { setColorAdjust(ZERO_COLOR);     forkToCustom(); }, [forkToCustom]);
  const resetHSL     = React.useCallback(() => { setHSLAdjust(ZERO_HSL);         forkToCustom(); }, [forkToCustom]);
  const resetCurves  = React.useCallback(() => { setCurvesAdjust(ZERO_CURVES);   forkToCustom(); }, [forkToCustom]);
  const resetEffects = React.useCallback(() => { setEffectsAdjust(ZERO_EFFECTS); forkToCustom(); }, [forkToCustom]);

  // Drops every panel adjustment back to its zero state, clears the active
  // filter, and discards any pending (un-baked) crop / rotate / perspective
  // edit. Baked transforms already written into sourceCanvas can't be undone
  // here — they require re-loading the photo.
  const resetAllAdjustments = React.useCallback(() => {
    setLightAdjust(ZERO_LIGHT);
    setColorAdjust(ZERO_COLOR);
    setHSLAdjust(ZERO_HSL);
    setCurvesAdjust(ZERO_CURVES);
    setEffectsAdjust(ZERO_EFFECTS);
    setActivePreset(ORIGINAL_ID);
    setBaseFilterId(ORIGINAL_ID);
    setPending({
      mode: null,
      rotateAngle: 0,
      perspectiveAmount: 0,
      transform: { ...ZERO_TRANSFORM },
      crop: { ...ZERO_CROP },
    });
  }, []);

  // Click handler for filter tiles. Sets active id, sets baseFilterId (the
  // underlying ops chain to render), and loads the filter's snapshot into the
  // five adjustment slices via the *raw* setters (bypassing the auto-fork
  // wrappers, since this is a programmatic load, not a user edit).
  //   ORIGINAL: base = ORIGINAL (no ops); sliders stay where they were.
  //   CUSTOM:   base stays at whatever the user previously forked from, so
  //             the ops chain (monochrome/bloom/etc.) carries forward.
  //   built-in: base = the preset id.
  //   saved:    base = the saved entry's baseFilterId (which may be a
  //             built-in or ORIGINAL).
  const selectFilter = React.useCallback((id) => {
    setActivePreset(id);
    if (id === CUSTOM_ID) return;  // base stays put; sliders stay put
    if (id === ORIGINAL_ID) {
      setBaseFilterId(ORIGINAL_ID);
      return;
    }
    const builtin = PRESETS[id];
    const saved   = !builtin && savedFilters.find((s) => s.id === id);
    const filter  = builtin || saved;
    if (!filter) return;
    setBaseFilterId(builtin ? id : (saved.baseFilterId || ORIGINAL_ID));
    const snap = presetSnapshot(filter);
    setLightAdjust(snap.light);
    setColorAdjust(snap.color);
    setHSLAdjust(snap.hsl);
    setCurvesAdjust(snap.curves);
    setEffectsAdjust(snap.effects);
  }, [savedFilters]);

  // Persist a named copy of the current userAdjust as a custom filter tile.
  // Returns the new filter's id, or null if the name was invalid.
  const saveAsCustomFilter = React.useCallback((rawName) => {
    const name = (rawName || "").trim();
    if (!name) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
    let id = `saved-${slug}`;
    let n = 2;
    const taken = (candidate) =>
      PRESETS[candidate] != null || savedFilters.some((s) => s.id === candidate);
    while (taken(id)) { id = `saved-${slug}-${n++}`; }
    const entry = {
      id,
      name: name.toUpperCase(),
      sub: "CUSTOM",
      blurb: `Saved ${new Date().toLocaleDateString()}`,
      baseFilterId,
      userAdjust: {
        light:   lightAdjust,
        color:   colorAdjust,
        hsl:     hslAdjust,
        curves:  curvesAdjust,
        effects: effectsAdjust,
      },
      savedAt: new Date().toISOString(),
    };
    setSavedFilters((prev) => {
      const next = [...prev, entry];
      try { localStorage.setItem(CUSTOM_FILTERS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setActivePreset(id);
    return id;
  }, [lightAdjust, colorAdjust, hslAdjust, curvesAdjust, effectsAdjust, savedFilters, baseFilterId]);

  const deleteCustomFilter = React.useCallback((id) => {
    setSavedFilters((prev) => {
      const next = prev.filter((s) => s.id !== id);
      try { localStorage.setItem(CUSTOM_FILTERS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setActivePreset((cur) => {
      if (cur !== id) return cur;
      setBaseFilterId(ORIGINAL_ID);
      return ORIGINAL_ID;
    });
  }, []);

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
    let orientation = null;
    try {
      if (RAW_EXT.test(file.name)) {
        setStatus("Extracting preview from RAW…");
        await new Promise((r) => setTimeout(r, 16));
        const preview = await extractEmbeddedJpeg(file);
        if (!preview) {
          setStatus("No JPEG preview in this RAW file");
          setTimeout(() => setStatus(""), 2400);
          return;
        }
        decodable = preview.jpeg;
        orientation = preview.orientation;
      } else {
        setStatus("Loading…");
      }
      const c = await loadOrientedCanvas(decodable, orientation);
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
    activePreset, setActivePreset, selectFilter, baseFilterId,
    savedFilters, saveAsCustomFilter, deleteCustomFilter,
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
    resetAllAdjustments,
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
    activePreset, selectFilter, baseFilterId,
    savedFilters, saveAsCustomFilter, deleteCustomFilter,
    intensity, setIntensity,
    activeTab, setActiveTab,
    status, compare, setCompare,
    thumb, hero, thumbCache, heroCache,
    loadFromFile, cacheGen, pending,
    userAdjust, setPendingCrop,
    resetAllAdjustments,
  } = ph;

  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);
  const hasAdjustments = isUserAdjustActive(userAdjust) || pending.mode != null;
  const confirmReset = React.useCallback(() => {
    resetAllAdjustments();
    setResetConfirmOpen(false);
  }, [resetAllAdjustments]);

  const active =
    PRESETS[activePreset]
    || savedFilters.find((s) => s.id === activePreset)
    || (activePreset === ORIGINAL_ID ? { name: "ORIGINAL", sub: "SOURCE" } : null)
    || (activePreset === CUSTOM_ID   ? { name: "CUSTOM",   sub: "EDITED" } : null)
    || PRESETS_LIST[0];

  const handleSaveCustom = React.useCallback(() => {
    const name = window.prompt("Save current edits as a filter. Name:");
    if (name == null) return;
    const id = saveAsCustomFilter(name);
    if (!id) window.alert("Please enter a filter name.");
  }, [saveAsCustomFilter]);
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
        <ToolbarBtn
          onClick={() => hasAdjustments && setResetConfirmOpen(true)}
          disabled={!hasAdjustments}
        >↺ RESET</ToolbarBtn>
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
                presetId={baseFilterId}
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
                {PRESETS_LIST.length} PRESETS{savedFilters.length ? ` · ${savedFilters.length} SAVED` : ""}
              </span>
              <ToolbarBtn
                onClick={handleSaveCustom}
                disabled={!sourceCanvas}
              >+ SAVE CUSTOM</ToolbarBtn>
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
              <FilterTile
                id={ORIGINAL_ID}
                name="ORIGINAL"
                blurb="Source photo, no filter applied."
                isActive={activePreset === ORIGINAL_ID}
                thumb={thumb}
                thumbCache={thumbCache}
                cacheGen={cacheGen}
                presetId={ORIGINAL_ID}
                thumbUserAdjust={null}
                onClick={() => selectFilter(ORIGINAL_ID)}
                thumbSize={thumbSize}
                accent={accent}
                border={border}
                mono={mono}
              />
              {PRESETS_LIST.map((p) => (
                <FilterTile
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  blurb={p.blurb}
                  isActive={p.id === activePreset}
                  thumb={thumb}
                  thumbCache={thumbCache}
                  cacheGen={cacheGen}
                  presetId={p.id}
                  thumbUserAdjust={p.userAdjust}
                  onClick={() => selectFilter(p.id)}
                  thumbSize={thumbSize}
                  accent={accent}
                  border={border}
                  mono={mono}
                />
              ))}
              <FilterTile
                id={CUSTOM_ID}
                name="CUSTOM"
                blurb="Your current edits on top of whichever filter you forked from. Modifying a slider on a filter switches here automatically."
                isActive={activePreset === CUSTOM_ID}
                thumb={thumb}
                thumbCache={thumbCache}
                cacheGen={cacheGen}
                presetId={baseFilterId}
                thumbUserAdjust={userAdjust}
                onClick={() => selectFilter(CUSTOM_ID)}
                thumbSize={thumbSize}
                accent={accent}
                border={border}
                mono={mono}
              />
              {savedFilters.map((s) => (
                <FilterTile
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  blurb={s.blurb}
                  isActive={s.id === activePreset}
                  thumb={thumb}
                  thumbCache={thumbCache}
                  cacheGen={cacheGen}
                  presetId={s.baseFilterId || ORIGINAL_ID}
                  thumbUserAdjust={s.userAdjust}
                  onClick={() => selectFilter(s.id)}
                  onDelete={() => {
                    if (window.confirm(`Delete saved filter "${s.name}"?`)) deleteCustomFilter(s.id);
                  }}
                  thumbSize={thumbSize}
                  accent={accent}
                  border={border}
                  mono={mono}
                />
              ))}
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

      {resetConfirmOpen && (
        <ResetConfirmModal
          ctx={ctx}
          onCancel={() => setResetConfirmOpen(false)}
          onConfirm={confirmReset}
          hasPendingEdit={pending.mode != null}
        />
      )}
    </div>
  );
}

function ResetConfirmModal({ ctx, onCancel, onConfirm, hasPendingEdit }) {
  const { panel, border, text, muted, mono, sans } = ctx;
  const danger = "#e15a4a";

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: "rgba(8,8,10,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, background: panel, color: text,
          border: `1px solid ${border}`, borderRadius: 4,
          fontFamily: sans, padding: "20px 22px 18px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          fontFamily: mono, fontSize: 10, letterSpacing: "0.12em",
          color: danger, marginBottom: 14,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>RESET ALL ADJUSTMENTS</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>
          This will clear every slider in <strong>Light</strong>, <strong>Color</strong>,{" "}
          <strong>HSL</strong>, <strong>Curves</strong>, and <strong>Effects</strong>, and
          switch the active filter to <strong>ORIGINAL</strong>.
        </div>
        {hasPendingEdit && (
          <div style={{ fontSize: 12, color: muted, lineHeight: 1.5, marginBottom: 8 }}>
            Your pending crop / rotate / perspective edit will also be discarded.
          </div>
        )}
        <div style={{ fontSize: 12, color: muted, lineHeight: 1.5, marginBottom: 18 }}>
          This can't be undone. Any already-applied crop or rotation will stay.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent", color: text,
              border: `1px solid ${border}`, borderRadius: 2,
              padding: "7px 14px", fontSize: 10, fontFamily: mono,
              letterSpacing: "0.08em", cursor: "pointer",
            }}
          >CANCEL</button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{
              background: danger, color: "#fff",
              border: "none", borderRadius: 2,
              padding: "7px 14px", fontSize: 10, fontFamily: mono,
              letterSpacing: "0.08em", cursor: "pointer", fontWeight: 600,
            }}
          >↺ RESET</button>
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

// ─── FilterTile ───────────────────────────────────────────────────────────
// One tile in the film strip. Renders the active source thumb through the
// given preset id and userAdjust snapshot so the tile previews what selecting
// it would do. ORIGINAL passes a null userAdjust to skip the userAdjust pass;
// CUSTOM passes the live userAdjust; built-ins/saved pass their snapshot.
function FilterTile({
  id, name, blurb, isActive,
  thumb, thumbCache, cacheGen, presetId, thumbUserAdjust,
  onClick, onDelete,
  thumbSize, accent, border, mono,
}) {
  return (
    <div
      onClick={onClick}
      title={blurb}
      style={{ flexShrink: 0, width: thumbSize, position: "relative", cursor: "pointer" }}
    >
      {thumb ? (
        <FilteredPhoto
          sourceData={thumb.data}
          sourceW={thumb.w}
          sourceH={thumb.h}
          cache={thumbCache}
          presetId={presetId}
          userAdjust={thumbUserAdjust || undefined}
          intensity={1}
          objectFit="cover"
          key={`thumb-${id}-${cacheGen}`}
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
        <div style={{ fontWeight: 600 }}>{name}</div>
      </div>
      {isActive && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          width: 6, height: 6, background: accent, borderRadius: "50%",
        }} />
      )}
      {onDelete && (
        <div
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete saved filter"
          style={{
            position: "absolute", top: 4, left: 4,
            width: 16, height: 16, borderRadius: 1,
            background: "rgba(0,0,0,0.55)", color: "#fff",
            fontFamily: mono, fontSize: 11, lineHeight: "16px",
            textAlign: "center", cursor: "pointer",
          }}
        >×</div>
      )}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────
function ToolbarBtn({ children, primary = false, accent = "#e89b4a", active = false, disabled = false, onClick, onMouseDown, onMouseUp, onMouseLeave }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={disabled ? undefined : onMouseDown}
      onMouseUp={disabled ? undefined : onMouseUp}
      onMouseLeave={disabled ? undefined : onMouseLeave}
      disabled={disabled}
      style={{
        background: primary ? accent : active ? "rgba(255,255,255,0.08)" : "transparent",
        color: primary ? "#1a1208" : "inherit",
        border: primary ? "none" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 2,
        padding: "5px 10px",
        fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        letterSpacing: "0.08em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
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
  const { loadFromFile, selectFilter, activePreset, toggleSelected, savedFilters } = usePhotofilm();

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

  // Keyboard: ←/→ steps through the strip (ORIGINAL + built-ins + saved
  // customs; CUSTOM is contextual and skipped). Space adds the active filter
  // to the export selection. Ignore when typing in an input.
  React.useEffect(() => {
    const cycleIds = [ORIGINAL_ID, ...PRESET_IDS, ...savedFilters.map((s) => s.id)];
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      let idx = cycleIds.indexOf(activePreset);
      if (idx < 0) idx = 0;  // CUSTOM or unknown -> arrow jumps to ORIGINAL first
      if (e.key === "ArrowRight") {
        selectFilter(cycleIds[(idx + 1) % cycleIds.length]);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        selectFilter(cycleIds[(idx - 1 + cycleIds.length) % cycleIds.length]);
        e.preventDefault();
      } else if (e.key === " " && activePreset) {
        toggleSelected(activePreset);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePreset, selectFilter, toggleSelected, savedFilters]);

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
