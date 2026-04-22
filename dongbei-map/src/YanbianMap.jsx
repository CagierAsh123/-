import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { countyFills, countyBorders, outerBorder } from "./data/yanbian/paths";
import { mapData } from "./data/yanbian/mapData";
import { DEFAULT_STAMPS, DEFAULT_CUSTOM_MARKERS } from "./data/yanbian/userData";

/* ═══════ constants ═══════ */
const SVG_W = 878;
const SVG_H = 470;
const MAX_ZOOM = 6;
const CONTENT_VB = { x: 180, y: -10, w: 530, h: 480 };

/* ═══════ calibration ═══════ */
// 最北端: 44°30′42″N, 127°27′43″E  (敦化北部)
// 最东端: 42°30′N,    131°18′33″E  (珲春东部)
const NORTH_GEO = [127.4619, 44.5117];
const EAST_GEO  = [131.3092, 42.50];
const DEFAULT_ANCHORS = { north: [317.0, 9.3], east: [669.7, 179.6] };

// 8-county centroid least-squares fit (best interior accuracy)
const LS_PJ = { a: 144.53, b: -18263, c: -195.93, d: 8676 };

// manually placed SVG positions (from edit mode)
const MANUAL_POS = {
  "yb-1": [296.5, 211.6],
  "yb-2": [578.4, 338.4],
  "yb-3": [454.3, 275.7],
  "yb-4": [456.5, 276.2],
  "yb-5": [298.5, 407.6],
  "yb-6": [456, 273.4],
  "yb-7": [395.2, 345.7],
  "yb-8": [350.5, 145.9],
  "yb-9": [498, 264.8],
  "yb-10": [450.4, 271.6],
  "yb-11": [438.2, 310.4],
};

function loadSaved() {
  try {
    const s = localStorage.getItem("yanbian_calib_v5");
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return null;
}

function loadManualPos() {
  try {
    const s = localStorage.getItem("yanbian_manual_pos_v1");
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return {};
}

function computeCoeffs(anchors) {
  const a = (anchors.east[0] - anchors.north[0]) / (EAST_GEO[0] - NORTH_GEO[0]);
  const b = anchors.north[0] - a * NORTH_GEO[0];
  const c = (anchors.east[1] - anchors.north[1]) / (EAST_GEO[1] - NORTH_GEO[1]);
  const d = anchors.north[1] - c * NORTH_GEO[1];
  return { a, b, c, d };
}

const LANGS = ["zh", "en", "ja", "ru", "ko"];
const LANG_LABELS = { zh: "中文", en: "ENG", ja: "日本語", ru: "РУС", ko: "한국어" };

const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/* ═══════ emoji palette ═══════ */
const EMOJI_CATS = [
  { label: "山岳", items: ["⛰️", "🏔️", "🗻", "🌋", "🏕️"] },
  { label: "森林", items: ["🌲", "🌳", "🎋", "🎄", "🌿", "🍀", "🍃", "🌾"] },
  { label: "水系", items: ["🌊", "💧", "🏞️", "🐟", "🐠", "🦈", "🦢", "🐸"] },
  { label: "动物", items: ["🦌", "🐻", "🐯", "🦅", "🐿️", "🦊", "🐺", "🐗", "🦇"] },
  { label: "花草", items: ["🌸", "🌺", "🌻", "🌹", "💐", "🌷", "🍁", "🍂"] },
  { label: "天气", items: ["☀️", "🌙", "⭐", "❄️", "🌨️", "🌧️", "🌈", "☁️"] },
  { label: "建筑", items: ["🏛️", "🛕", "⛩️", "🏯", "🏠", "⛪", "🕌", "🗼"] },
  { label: "其他", items: ["🚂", "🚗", "🛤️", "🌉", "⛵", "🎎", "🏮", "🔥", "💎", "🎯"] },
];

let _stampId = Date.now();
function nextStampId() { return `s${_stampId++}`; }

function loadStamps() {
  try {
    const s = localStorage.getItem("yanbian_stamps_v1");
    if (s) {
      const arr = JSON.parse(s);
      if (arr.length) _stampId = Math.max(_stampId, ...arr.map(s => parseInt(s.id.slice(1)) || 0)) + 1;
      return arr;
    }
  } catch { /* ignore */ }
  // fallback to hardcoded defaults
  if (DEFAULT_STAMPS.length) {
    _stampId = Math.max(_stampId, ...DEFAULT_STAMPS.map(s => parseInt(s.id.slice(1)) || 0)) + 1;
    return [...DEFAULT_STAMPS];
  }
  return [];
}

function saveStamps(stamps) {
  localStorage.setItem("yanbian_stamps_v1", JSON.stringify(stamps));
}

let _cmId = Date.now();
function nextCmId() { return `cm-${_cmId++}`; }

function loadCustomMarkers() {
  try {
    const s = localStorage.getItem("yanbian_cm_v1");
    if (s) {
      const arr = JSON.parse(s);
      if (arr.length) _cmId = Math.max(_cmId, ...arr.map(m => parseInt(m.id.slice(3)) || 0)) + 1;
      return arr;
    }
  } catch { /* ignore */ }
  if (DEFAULT_CUSTOM_MARKERS.length) {
    _cmId = Math.max(_cmId, ...DEFAULT_CUSTOM_MARKERS.map(m => parseInt(m.id.slice(3)) || 0)) + 1;
    return [...DEFAULT_CUSTOM_MARKERS];
  }
  return [];
}

function saveCustomMarkers(markers) {
  localStorage.setItem("yanbian_cm_v1", JSON.stringify(markers));
}

const DEFAULT_VIS = { brightness: 100, contrast: 100, saturation: 100, hue: 0, glowIntensity: 100 };

function loadVisualSettings() {
  try {
    const s = localStorage.getItem("yanbian_vis_v1");
    if (s) return { ...DEFAULT_VIS, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VIS };
}

function saveVisualSettings(v) {
  localStorage.setItem("yanbian_vis_v1", JSON.stringify(v));
}

const VIS_SLIDERS = [
  { key: "brightness", label: "亮度", min: 30, max: 200, unit: "%" },
  { key: "contrast", label: "对比度", min: 30, max: 200, unit: "%" },
  { key: "saturation", label: "饱和度", min: 0, max: 300, unit: "%" },
  { key: "hue", label: "色相偏移", min: -180, max: 180, unit: "°" },
  { key: "glowIntensity", label: "光晕强度", min: 0, max: 200, unit: "%" },
];

const EMPTY_CONTENT = () => ({
  zh: { title: "", desc: "" },
  en: { title: "", desc: "" },
  ja: { title: "", desc: "" },
  ru: { title: "", desc: "" },
  ko: { title: "", desc: "" },
});

/* ═══════ zoom / pan hook ═══════ */

function useZoomPan(initVB) {
  const [viewBox, setViewBox] = useState(initVB);
  const svgRef = useRef(null);
  const dragState = useRef(null);
  const isDragging = useRef(false);
  const isDraggingAnchor = useRef(false);
  const baseVB = useRef(initVB);

  const screenToSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const vb = viewBox;
    return [
      vb.x + ((clientX - rect.left) / rect.width) * vb.w,
      vb.y + ((clientY - rect.top) / rect.height) * vb.h,
    ];
  }, [viewBox]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setViewBox((prev) => {
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const minW = baseVB.current.w / MAX_ZOOM;
      const minH = baseVB.current.h / MAX_ZOOM;
      const newW = Math.min(SVG_W, Math.max(minW, prev.w * factor));
      const newH = Math.min(SVG_H, Math.max(minH, prev.h * factor));
      const svg = svgRef.current;
      if (!svg) return { ...prev, w: newW, h: newH };
      const rect = svg.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      let nx = prev.x + rx * prev.w - rx * newW;
      let ny = prev.y + ry * prev.h - ry * newH;
      nx = Math.max(0, Math.min(SVG_W - newW, nx));
      ny = Math.max(0, Math.min(SVG_H - newH, ny));
      return { x: nx, y: ny, w: newW, h: newH };
    });
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0 || isDraggingAnchor.current) return;
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startVB: { ...viewBox },
        pointerId: e.pointerId,
        captured: false,
      };
    },
    [viewBox],
  );

  const onPointerMove = useCallback((e) => {
    if (!dragState.current || isDraggingAnchor.current) return;
    const { startX, startY } = dragState.current;
    // only start dragging after 3px movement threshold
    if (!isDragging.current) {
      const dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
      if (dist < 3) return;
      isDragging.current = true;
      if (!dragState.current.captured) {
        svgRef.current?.setPointerCapture(dragState.current.pointerId);
        dragState.current.captured = true;
      }
    }
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const { startVB } = dragState.current;
    const dx = ((e.clientX - startX) / rect.width) * startVB.w;
    const dy = ((e.clientY - startY) / rect.height) * startVB.h;
    let nx = startVB.x - dx;
    let ny = startVB.y - dy;
    nx = Math.max(0, Math.min(SVG_W - startVB.w, nx));
    ny = Math.max(0, Math.min(SVG_H - startVB.h, ny));
    setViewBox({ x: nx, y: ny, w: startVB.w, h: startVB.h });
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current = null;
    setTimeout(() => (isDragging.current = false), 50);
  }, []);

  const resetView = useCallback((vb) => {
    baseVB.current = vb;
    setViewBox(vb);
  }, []);

  const zoom = baseVB.current.w / viewBox.w;
  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return {
    svgRef,
    viewBoxStr,
    zoom,
    isDragging,
    isDraggingAnchor,
    screenToSvg,
    resetView,
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onDoubleClick: () => {
        baseVB.current = initVB;
        setViewBox(initVB);
      },
    },
  };
}

/* ═══════ grid background ═══════ */

const GridBg = memo(function GridBg() {
  const cols = 20,
    rows = 14;
  const cw = SVG_W / cols,
    rh = SVG_H / rows;
  return (
    <g opacity={0.04}>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={`c${i}`} x1={i * cw} y1={0} x2={i * cw} y2={SVG_H} stroke="#00f3ff" strokeWidth={0.3} />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`r${i}`} x1={0} y1={i * rh} x2={SVG_W} y2={i * rh} stroke="#00f3ff" strokeWidth={0.3} />
      ))}
      {Array.from({ length: cols + 1 }, (_, ci) =>
        Array.from({ length: rows + 1 }, (_, ri) => (
          <circle key={`d${ci}-${ri}`} cx={ci * cw} cy={ri * rh} r={0.6} fill="#00f3ff" opacity={0.35} />
        )),
      )}
    </g>
  );
});

/* ═══════ geographic grid (real lat/lng lines) ═══════ */

function GeoGrid({ project, show }) {
  if (!show) return null;
  // draw lines every 0.5°, labels every 1°
  const lngMin = 127, lngMax = 132, latMin = 41.5, latMax = 45;
  const step = 0.5;
  const lngs = [];
  for (let v = lngMin; v <= lngMax; v += step) lngs.push(v);
  const lats = [];
  for (let v = latMin; v <= latMax; v += step) lats.push(v);

  // project bounds for line endpoints
  const [, yTop] = project(lngMin, latMax);
  const [, yBot] = project(lngMin, latMin);
  const [xLeft] = project(lngMin, latMin);
  const [xRight] = project(lngMax, latMin);

  return (
    <g>
      {/* longitude lines (vertical) */}
      {lngs.map((lng) => {
        const [x] = project(lng, latMin);
        const isFull = lng % 1 === 0;
        return (
          <g key={`gln${lng}`}>
            <line
              x1={x} y1={yTop} x2={x} y2={yBot}
              stroke="#00f3ff" strokeWidth={isFull ? 0.4 : 0.2}
              opacity={isFull ? 0.12 : 0.05}
              strokeDasharray={isFull ? "none" : "2 2"}
            />
            {isFull && (
              <text x={x} y={yBot + 8} textAnchor="middle" fontSize={4} fill="#00f3ff" opacity={0.25} fontFamily="monospace">
                {lng}°E
              </text>
            )}
          </g>
        );
      })}
      {/* latitude lines (horizontal) */}
      {lats.map((lat) => {
        const [, y] = project(lngMin, lat);
        const isFull = lat % 1 === 0;
        return (
          <g key={`glt${lat}`}>
            <line
              x1={xLeft} y1={y} x2={xRight} y2={y}
              stroke="#00f3ff" strokeWidth={isFull ? 0.4 : 0.2}
              opacity={isFull ? 0.12 : 0.05}
              strokeDasharray={isFull ? "none" : "2 2"}
            />
            {isFull && (
              <text x={xRight + 6} y={y} textAnchor="start" dominantBaseline="middle" fontSize={4} fill="#00f3ff" opacity={0.25} fontFamily="monospace">
                {lat}°N
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ═══════ light beam ═══════ */

function LightBeam({ x, y, zoom }) {
  const s = 1 / zoom;
  const beamH = 120 * s;
  const beamW = 18 * s;
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <motion.ellipse
        cx={x} cy={y} rx={12 * s} ry={3 * s}
        fill="none" stroke="#00f3ff" strokeWidth={0.6 * s}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.rect
        x={x - beamW / 2} y={y - beamH} width={beamW} height={beamH} rx={beamW / 2}
        fill="url(#lightBeamGrad)" opacity={0.5}
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ transformOrigin: `${x}px ${y}px` }}
      />
      {[0.2, 0.45, 0.7].map((t, i) => (
        <motion.circle
          key={i} cx={x + (i - 1) * 3 * s} cy={y - beamH * t} r={1 * s} fill="#00f3ff"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0], y: [0, -8 * s, -16 * s] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
        />
      ))}
    </motion.g>
  );
}

/* ═══════ glassmorphism card (HTML overlay) ═══════ */

function InfoCard({ spot, lang, setLang, onClose }) {
  const c = spot.content[lang] || spot.content.zh;
  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.92 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="w-[400px] max-w-[92vw] pointer-events-auto"
        style={{
          background: "rgba(20, 20, 20, 0.6)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 16,
        padding: "24px 28px 20px",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 80px rgba(0,243,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 10, right: 14, background: "none",
          border: "none", color: "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer", lineHeight: 1,
        }}
      >
        ×
      </button>

      <div className="flex items-center gap-3 mb-3">
        <span style={{ fontSize: 36, fontFamily: EMOJI_FONT, filter: "drop-shadow(0 2px 6px rgba(0,243,255,0.4))" }}>
          {spot.emoji}
        </span>
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${lang}`}
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              style={{ fontSize: 18, fontWeight: 700, color: "#00f3ff" }}
            >
              {c.title}
            </motion.div>
          </AnimatePresence>
          <div style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.35, marginTop: 2 }}>
            {spot.svgPos
              ? `SVG(${spot.svgPos[0]}, ${spot.svgPos[1]})`
              : `${spot.coords[0].toFixed(4)}°E, ${spot.coords[1].toFixed(4)}°N`}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={`desc-${lang}`}
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.75, margin: "0 0 16px" }}
        >
          {c.desc}
        </motion.p>
      </AnimatePresence>

      <div className="flex gap-2 flex-wrap">
        {LANGS.map((l) => (
          <button
            key={l} onClick={() => setLang(l)}
            style={{
              padding: "4px 12px", fontSize: 11,
              fontWeight: lang === l ? 700 : 400, borderRadius: 8,
              border: lang === l ? "1px solid rgba(0,243,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
              background: lang === l ? "rgba(0,243,255,0.12)" : "rgba(255,255,255,0.04)",
              color: lang === l ? "#00f3ff" : "rgba(255,255,255,0.5)",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>
    </motion.div>
    </div>
  );
}

/* ═══════ marker ═══════ */

function Marker({ spot, index, active, zoom, onClick, project, manualPos }) {
  const projected = project(spot.coords[0], spot.coords[1]);
  const [svgX, svgY] = manualPos?.[spot.id] || MANUAL_POS[spot.id] || projected;
  const s = 1 / zoom;
  const r = 2.5 * s;
  const glowR = 6 * s;
  const emojiSize = (active ? 14 : 10) * s;
  const emojiY = svgY - 6 * s;

  return (
    <g onClick={(e) => { e.stopPropagation(); onClick(spot.id); }} style={{ cursor: "pointer" }}>
      {/* invisible hit area */}
      <circle cx={svgX} cy={svgY - 3 * s} r={12 * s} fill="transparent" />
      <circle
        cx={svgX} cy={svgY} r={glowR} fill="none" stroke="#00f3ff" strokeWidth={0.6 * s}
        className="mk-breathe" style={{ animationDelay: `${index * 0.12}s` }}
      />
      {/* gold halo behind emoji */}
      <circle
        cx={svgX} cy={emojiY} r={8 * s} fill="rgba(250,204,21,0.06)"
        className="mk-halo" style={{ animationDelay: `${index * 0.12}s` }}
      />
      <circle cx={svgX} cy={svgY} r={r} fill="#00f3ff" opacity={active ? 1 : 0.7} />
      <text
        x={svgX} y={emojiY} textAnchor="middle" dominantBaseline="central" fontSize={emojiSize}
        style={{ fontFamily: EMOJI_FONT, filter: "url(#emojiGold)", pointerEvents: "none" }}
      >
        {spot.emoji}
      </text>
      {active && (
        <text
          x={svgX} y={svgY + 6 * s} textAnchor="middle" fontSize={3.5 * s}
          fill="#00f3ff" opacity={0.7} fontFamily="'Inter', system-ui, sans-serif"
          style={{ pointerEvents: "none" }}
        >
          {spot.content.zh.title}
        </text>
      )}
      <AnimatePresence>
        {active && <LightBeam x={svgX} y={svgY} zoom={zoom} />}
      </AnimatePresence>
    </g>
  );
}

/* ═══════ scan line effect ═══════ */

function ScanLine() {
  return (
    <motion.line
      x1={0} y1={0} x2={SVG_W} y2={0}
      stroke="#00f3ff" strokeWidth={0.8} opacity={0.08}
      initial={{ y1: 0, y2: 0 }} animate={{ y1: SVG_H, y2: SVG_H }}
      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
    />
  );
}

/* ═══════ debug: drag anchor ═══════ */

function DragAnchor({ pos, geo, color, label, screenToSvg, isDraggingAnchor, onMove }) {
  const dragging = useRef(false);
  const onPtrDown = useCallback((e) => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = true;
    isDraggingAnchor.current = true;
    e.target.setPointerCapture(e.pointerId);
  }, [isDraggingAnchor]);
  const onPtrMove = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const [sx, sy] = screenToSvg(e.clientX, e.clientY);
    onMove([Math.round(sx * 10) / 10, Math.round(sy * 10) / 10]);
  }, [screenToSvg, onMove]);
  const onPtrUp = useCallback((e) => {
    e.stopPropagation();
    dragging.current = false;
    isDraggingAnchor.current = false;
  }, [isDraggingAnchor]);

  return (
    <g style={{ cursor: "move" }} onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp}>
      <circle cx={pos[0]} cy={pos[1]} r={12} fill="transparent" />
      <line x1={pos[0] - 10} y1={pos[1]} x2={pos[0] + 10} y2={pos[1]} stroke={color} strokeWidth={0.6} opacity={0.7} />
      <line x1={pos[0]} y1={pos[1] - 10} x2={pos[0]} y2={pos[1] + 10} stroke={color} strokeWidth={0.6} opacity={0.7} />
      <circle cx={pos[0]} cy={pos[1]} r={5} fill={color} opacity={0.9} stroke="#fff" strokeWidth={0.5} />
      <text x={pos[0] + 9} y={pos[1] - 9} fill={color} fontSize={5.5} fontFamily="monospace" fontWeight={700}>{label}</text>
      <text x={pos[0] + 9} y={pos[1] + 1} fill={color} fontSize={3.8} fontFamily="monospace" opacity={0.7}>
        {geo[0].toFixed(4)}°E, {geo[1].toFixed(4)}°N
      </text>
      <text x={pos[0] + 9} y={pos[1] + 8} fill={color} fontSize={3.8} fontFamily="monospace" opacity={0.5}>
        SVG ({pos[0].toFixed(1)}, {pos[1].toFixed(1)})
      </text>
    </g>
  );
}

/* ═══════ debug panel ═══════ */

function DebugPanel({ coeffs, anchors, onReset, onSave, onExitNoSave }) {
  const btnBase = {
    borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 10, border: "none",
  };
  return (
    <div style={{
      position: "fixed", top: 12, right: 12, zIndex: 50,
      background: "rgba(16,24,20,0.92)", backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,100,100,0.3)", borderRadius: 10, padding: "14px 18px",
      color: "#f0f0f0", fontFamily: "monospace", fontSize: 11, minWidth: 300,
    }}>
      <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
        🔧 调试模式
      </div>
      <div style={{ opacity: 0.4, marginBottom: 4, fontSize: 9 }}>
        拖动红/蓝锚点校准投影 · 退出调试默认使用最小二乘拟合
      </div>

      <div style={{ opacity: 0.5, marginBottom: 3, fontSize: 9, marginTop: 10 }}>投影系数 (锚点实时)</div>
      <div style={{ opacity: 0.7, marginBottom: 2, fontSize: 10 }}>
        svgX = <span style={{ color: "#fbbf24" }}>{coeffs.a.toFixed(4)}</span> × lng
        + <span style={{ color: "#fbbf24" }}>{coeffs.b.toFixed(2)}</span>
      </div>
      <div style={{ opacity: 0.7, marginBottom: 8, fontSize: 10 }}>
        svgY = <span style={{ color: "#fbbf24" }}>{coeffs.c.toFixed(4)}</span> × lat
        + <span style={{ color: "#fbbf24" }}>{coeffs.d.toFixed(2)}</span>
      </div>

      <div style={{ opacity: 0.5, marginBottom: 3, fontSize: 9 }}>锚点位置</div>
      <div style={{ opacity: 0.7, marginBottom: 2, fontSize: 10, color: "#f87171" }}>
        北 SVG({anchors.north[0].toFixed(1)}, {anchors.north[1].toFixed(1)})
      </div>
      <div style={{ opacity: 0.7, marginBottom: 10, fontSize: 10, color: "#60a5fa" }}>
        东 SVG({anchors.east[0].toFixed(1)}, {anchors.east[1].toFixed(1)})
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onReset} style={{
          ...btnBase, background: "rgba(255,255,255,0.08)", color: "#e2e8f0",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>重置锚点</button>
        <button onClick={onSave} style={{
          ...btnBase, background: "rgba(0,243,255,0.15)", color: "#00f3ff", fontWeight: 700,
          border: "1px solid rgba(0,243,255,0.4)",
        }}>保存校准并退出</button>
        <button onClick={onExitNoSave} style={{
          ...btnBase, background: "rgba(110,231,183,0.1)", color: "#6ee7b7",
          border: "1px solid rgba(110,231,183,0.3)",
        }}>退出(用默认拟合)</button>
      </div>
    </div>
  );
}

/* ═══════ custom marker panel ═══════ */

const CM_EMOJI_PICKS = ["📍", "⭐", "🏠", "🏕️", "🎯", "💎", "🔥", "🌟", "🏮", "🎪", "🗿", "🪨"];

function CustomMarkerPanel({ customMarkers, editingCm, setEditingCm, placingCm, setPlacingCm, onSaveCm, onDeleteCm, onExportCm, onExit }) {
  const [form, setForm] = useState(null);
  const [formLang, setFormLang] = useState("zh");

  // sync form when editingCm changes
  useEffect(() => {
    if (editingCm) {
      setForm({ emoji: editingCm.emoji, content: JSON.parse(JSON.stringify(editingCm.content)) });
    } else {
      setForm(null);
    }
  }, [editingCm]);

  const updateField = (lang, field, val) => {
    setForm((f) => {
      const next = { ...f, content: { ...f.content, [lang]: { ...f.content[lang], [field]: val } } };
      return next;
    });
  };

  const handleSave = () => {
    if (!form || !form.content.zh.title.trim()) return;
    onSaveCm({ ...editingCm, emoji: form.emoji, content: form.content });
    setEditingCm(null);
  };

  const inputStyle = {
    width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 6,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    color: "#e2e8f0", outline: "none", fontFamily: "'Inter', system-ui, sans-serif",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", top: 12, left: 12, zIndex: 50, width: 300,
      background: "rgba(16,20,24,0.94)", backdropFilter: "blur(10px)",
      border: "1px solid rgba(56,189,248,0.35)", borderRadius: 10, padding: "14px 16px",
      color: "#f0f0f0", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11,
      maxHeight: "calc(100vh - 80px)", overflowY: "auto",
    }}>
      <div style={{ color: "#38bdf8", fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
        自定义标点
      </div>
      <div style={{ opacity: 0.4, marginBottom: 10, fontSize: 9 }}>
        {placingCm ? "点击地图放置标点..." : form ? "编辑标点信息" : `共 ${customMarkers.length} 个自定义标点`}
      </div>

      {/* marker list (when not editing) */}
      {!form && !placingCm && (
        <>
          {customMarkers.map((cm) => (
            <div
              key={cm.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px", marginBottom: 3, borderRadius: 6,
                background: "rgba(255,255,255,0.03)", border: "1px solid transparent",
              }}
            >
              <span style={{ fontSize: 16, fontFamily: EMOJI_FONT, flexShrink: 0 }}>{cm.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {cm.content.zh.title || "(未命名)"}
                </div>
                <div style={{ fontSize: 9, opacity: 0.35, fontFamily: "monospace" }}>
                  SVG({cm.svgPos[0]}, {cm.svgPos[1]})
                </div>
              </div>
              <button onClick={() => setEditingCm(cm)} style={{
                background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 10, padding: "2px 4px",
              }}>编辑</button>
              <button onClick={() => onDeleteCm(cm.id)} style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 12, padding: "0 2px",
              }}>×</button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <button onClick={() => setPlacingCm(true)} style={{
              borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: "rgba(56,189,248,0.15)", color: "#38bdf8",
              border: "1px solid rgba(56,189,248,0.4)",
            }}>+ 新标点</button>
            <button onClick={onExportCm} style={{
              borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
              background: "rgba(0,243,255,0.15)", color: "#00f3ff",
              border: "1px solid rgba(0,243,255,0.4)",
            }}>导出</button>
            <button onClick={onExit} style={{
              borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
              background: "rgba(110,231,183,0.1)", color: "#6ee7b7",
              border: "1px solid rgba(110,231,183,0.3)",
            }}>退出</button>
          </div>
        </>
      )}

      {/* placing hint */}
      {placingCm && !form && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#38bdf8", fontSize: 13 }}>
          点击地图上任意位置放置标点
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setPlacingCm(false)} style={{
              borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 10,
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}>取消</button>
          </div>
        </div>
      )}

      {/* edit form */}
      {form && (
        <div>
          {/* emoji picker */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 4 }}>图标</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {CM_EMOJI_PICKS.map((em) => (
                <button
                  key={em} onClick={() => setForm((f) => ({ ...f, emoji: em }))}
                  style={{
                    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 17, fontFamily: EMOJI_FONT, cursor: "pointer", borderRadius: 5,
                    background: form.emoji === em ? "rgba(56,189,248,0.2)" : "transparent",
                    border: form.emoji === em ? "1px solid rgba(56,189,248,0.5)" : "1px solid transparent",
                  }}
                >{em}</button>
              ))}
            </div>
          </div>

          {/* lang tabs */}
          <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
            {LANGS.map((l) => (
              <button
                key={l} onClick={() => setFormLang(l)}
                style={{
                  padding: "3px 8px", fontSize: 10, borderRadius: 5, cursor: "pointer",
                  background: formLang === l ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)",
                  border: formLang === l ? "1px solid rgba(56,189,248,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  color: formLang === l ? "#38bdf8" : "rgba(255,255,255,0.4)",
                  fontWeight: formLang === l ? 700 : 400,
                }}
              >{LANG_LABELS[l]}</button>
            ))}
          </div>

          {/* title + desc for current lang */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 3 }}>标题 ({formLang})</div>
            <input
              value={form.content[formLang].title}
              onChange={(e) => updateField(formLang, "title", e.target.value)}
              placeholder={formLang === "zh" ? "景点名称" : "Title"}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 3 }}>描述 ({formLang})</div>
            <textarea
              value={form.content[formLang].desc}
              onChange={(e) => updateField(formLang, "desc", e.target.value)}
              placeholder={formLang === "zh" ? "一句话描述..." : "Description..."}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* fill status */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {LANGS.map((l) => {
              const filled = form.content[l].title.trim().length > 0;
              return (
                <span key={l} style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 4,
                  background: filled ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.03)",
                  color: filled ? "#4ade80" : "rgba(255,255,255,0.2)",
                  border: `1px solid ${filled ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)"}`,
                }}>{LANG_LABELS[l]} {filled ? "✓" : "○"}</span>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleSave} style={{
              flex: 1, borderRadius: 6, padding: "6px 0", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: "rgba(56,189,248,0.15)", color: "#38bdf8",
              border: "1px solid rgba(56,189,248,0.4)",
            }}>保存</button>
            <button onClick={() => { setEditingCm(null); setForm(null); }} style={{
              flex: 1, borderRadius: 6, padding: "6px 0", cursor: "pointer", fontSize: 11,
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════ paint mode panel ═══════ */

function PaintPanel({ brush, setBrush, brushSize, setBrushSize, eraseMode, setEraseMode, stamps, onUndo, onClearAll, onExport, onExit }) {
  const [customEmoji, setCustomEmoji] = useState("");
  return (
    <div style={{
      position: "fixed", top: 12, left: 12, zIndex: 50, width: 270,
      background: "rgba(16,20,24,0.94)", backdropFilter: "blur(10px)",
      border: "1px solid rgba(168,85,247,0.35)", borderRadius: 10, padding: "14px 16px",
      color: "#f0f0f0", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11,
      maxHeight: "calc(100vh - 80px)", overflowY: "auto",
    }}>
      <div style={{ color: "#a855f7", fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
        Emoji 画笔
      </div>
      <div style={{ opacity: 0.4, marginBottom: 10, fontSize: 9 }}>
        选 emoji → 点地图放置 · 已画 {stamps.length} 个
      </div>

      {/* eraser toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setEraseMode(false)}
          style={{
            flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer", fontSize: 11,
            background: !eraseMode ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)",
            border: !eraseMode ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.1)",
            color: !eraseMode ? "#c084fc" : "rgba(255,255,255,0.4)", fontWeight: !eraseMode ? 700 : 400,
          }}
        >画笔</button>
        <button
          onClick={() => setEraseMode(true)}
          style={{
            flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer", fontSize: 11,
            background: eraseMode ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
            border: eraseMode ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)",
            color: eraseMode ? "#f87171" : "rgba(255,255,255,0.4)", fontWeight: eraseMode ? 700 : 400,
          }}
        >橡皮擦</button>
      </div>

      {/* size slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ opacity: 0.5, fontSize: 9 }}>大小</span>
          <span style={{ fontFamily: "monospace", opacity: 0.6, fontSize: 10 }}>{brushSize}px</span>
        </div>
        <input
          type="range" min={4} max={28} value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#a855f7" }}
        />
      </div>

      {/* current brush preview */}
      {!eraseMode && brush && (
        <div style={{
          textAlign: "center", marginBottom: 10, padding: "6px 0",
          background: "rgba(255,255,255,0.03)", borderRadius: 6,
        }}>
          <span style={{ fontSize: brushSize * 1.5, fontFamily: EMOJI_FONT }}>{brush}</span>
        </div>
      )}

      {/* emoji categories */}
      {!eraseMode && EMOJI_CATS.map((cat) => (
        <div key={cat.label} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, opacity: 0.35, marginBottom: 3 }}>{cat.label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {cat.items.map((em) => (
              <button
                key={em}
                onClick={() => setBrush(em)}
                style={{
                  width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, fontFamily: EMOJI_FONT, cursor: "pointer", borderRadius: 5,
                  background: brush === em ? "rgba(168,85,247,0.2)" : "transparent",
                  border: brush === em ? "1px solid rgba(168,85,247,0.5)" : "1px solid transparent",
                  transition: "all 0.1s",
                }}
              >{em}</button>
            ))}
          </div>
        </div>
      ))}

      {/* custom emoji input */}
      {!eraseMode && (
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          <input
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value)}
            placeholder="自定义 emoji..."
            style={{
              flex: 1, padding: "4px 8px", fontSize: 13, borderRadius: 6,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0", outline: "none", fontFamily: EMOJI_FONT,
            }}
          />
          <button
            onClick={() => { if (customEmoji.trim()) { setBrush(customEmoji.trim()); setCustomEmoji(""); } }}
            style={{
              padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 10,
              background: "rgba(168,85,247,0.15)", color: "#c084fc",
              border: "1px solid rgba(168,85,247,0.3)",
            }}
          >用</button>
        </div>
      )}

      {/* action buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onUndo} style={{
          borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
          background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>撤销</button>
        <button onClick={onExport} style={{
          borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
          background: "rgba(0,243,255,0.15)", color: "#00f3ff", fontWeight: 700,
          border: "1px solid rgba(0,243,255,0.4)",
        }}>导出</button>
        <button onClick={onClearAll} style={{
          borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
          background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}>全清</button>
        <button onClick={onExit} style={{
          borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
          background: "rgba(110,231,183,0.1)", color: "#6ee7b7",
          border: "1px solid rgba(110,231,183,0.3)",
        }}>退出</button>
      </div>
    </div>
  );
}

/* ═══════ edit mode panel ═══════ */

function EditPanel({ editingId, setEditingId, manualPos, onClear, onClearAll, onExport, onExit }) {
  const placed = Object.keys(manualPos).length;
  return (
    <div style={{
      position: "fixed", top: 12, left: 12, zIndex: 50, width: 260,
      background: "rgba(16,20,24,0.94)", backdropFilter: "blur(10px)",
      border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: "14px 16px",
      color: "#f0f0f0", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11,
      maxHeight: "calc(100vh - 80px)", overflowY: "auto",
    }}>
      <div style={{ color: "#facc15", fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
        编辑模式
      </div>
      <div style={{ opacity: 0.4, marginBottom: 10, fontSize: 9 }}>
        选中地标 → 点击地图放置 · 已放置 {placed}/{mapData.length}
      </div>

      {mapData.map((spot) => {
        const isSelected = editingId === spot.id;
        const hasPos = !!manualPos[spot.id];
        return (
          <div
            key={spot.id}
            onClick={() => setEditingId(isSelected ? null : spot.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", marginBottom: 3, borderRadius: 6, cursor: "pointer",
              background: isSelected ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.03)",
              border: isSelected ? "1px solid rgba(250,204,21,0.5)" : "1px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 16, fontFamily: EMOJI_FONT, flexShrink: 0 }}>{spot.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: isSelected ? 700 : 400,
                color: isSelected ? "#facc15" : "#e2e8f0",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {spot.content.zh.title}
              </div>
              {hasPos && (
                <div style={{ fontSize: 9, opacity: 0.4, fontFamily: "monospace" }}>
                  SVG({manualPos[spot.id][0].toFixed(1)}, {manualPos[spot.id][1].toFixed(1)})
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
              {hasPos && (
                <span style={{ fontSize: 8, color: "#4ade80", opacity: 0.7 }}>●</span>
              )}
              {hasPos && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClear(spot.id); }}
                  style={{
                    background: "none", border: "none", color: "rgba(255,255,255,0.2)",
                    cursor: "pointer", fontSize: 12, padding: "0 2px", lineHeight: 1,
                  }}
                  title="清除此点"
                >×</button>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={onExport} style={{
          borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10, border: "none",
          background: "rgba(0,243,255,0.15)", color: "#00f3ff", fontWeight: 700,
          border: "1px solid rgba(0,243,255,0.4)",
        }}>导出到控制台</button>
        <button onClick={onClearAll} style={{
          borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
          background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>全部清除</button>
        <button onClick={onExit} style={{
          borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 10,
          background: "rgba(110,231,183,0.1)", color: "#6ee7b7",
          border: "1px solid rgba(110,231,183,0.3)",
        }}>退出编辑</button>
      </div>
    </div>
  );
}

/* ═══════ title header ═══════ */

function TitleHeader() {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center pt-4 pb-2 pointer-events-none select-none"
      style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.9) 0%, transparent 100%)" }}
    >
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }} className="text-center">
        <h1 style={{
          fontSize: 22, fontWeight: 300, color: "rgba(0,243,255,0.7)", letterSpacing: 10,
          fontFamily: "'Inter', system-ui, sans-serif", margin: 0, textShadow: "0 0 30px rgba(0,243,255,0.3)",
        }}>
          延边朝鲜族自治州
        </h1>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "rgba(0,243,255,0.25)", marginTop: 4, fontFamily: "monospace" }}>
          YANBIAN · DATA VISUALIZATION MAP
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════ bottom bar ═══════ */

function SettingsPanel({ vis, setVis, onClose }) {
  const update = (key, val) => {
    const next = { ...vis, [key]: Number(val) };
    setVis(next);
    saveVisualSettings(next);
  };
  const reset = () => { setVis({ ...DEFAULT_VIS }); saveVisualSettings(DEFAULT_VIS); };
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      style={{
        position: "absolute", top: 60, right: 16, zIndex: 30, width: 220,
        background: "rgba(5,5,15,0.92)", border: "1px solid rgba(0,243,255,0.15)",
        borderRadius: 10, padding: "12px 14px", backdropFilter: "blur(12px)",
        fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.7)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: "#00f3ff", fontSize: 11 }}>画面设置</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={reset} style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 4, padding: "1px 6px", color: "#f87171", cursor: "pointer", fontSize: 9 }}>重置</button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 6px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 9 }}>✕</button>
        </div>
      </div>
      {VIS_SLIDERS.map(({ key, label, min, max, unit }) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span>{label}</span>
            <span style={{ color: "#facc15" }}>{vis[key]}{unit}</span>
          </div>
          <input type="range" min={min} max={max} value={vis[key]} onChange={e => update(key, e.target.value)}
            style={{ width: "100%", accentColor: "#00f3ff", height: 4 }} />
        </div>
      ))}
    </motion.div>
  );
}

function BottomBar({ zoom, debugMode, editMode, paintMode, cmMode, showGrid, onEnterDebug, onEnterEdit, onEnterPaint, onEnterCm, onToggleGrid, onExportAll, onImportAll, onToggleSettings, showSettings }) {
  const noMode = !debugMode && !editMode && !paintMode && !cmMode;
  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-6 pb-3 pt-8 select-none"
      style={{
        background: "linear-gradient(to top, rgba(5,5,5,0.9) 0%, transparent 100%)",
        fontFamily: "monospace", fontSize: 10, color: "rgba(0,243,255,0.3)",
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
    >
      <div className="flex gap-4 items-center pointer-events-none">
        <span>127°27′E — 131°18′E</span>
        <span>41°59′N — 44°30′N</span>
      </div>
      <div className="flex gap-4 items-center">
        <span className="pointer-events-none">共 {mapData.length} 处景点</span>
        <span className="pointer-events-none">
          {zoom > 1.05 ? `${zoom.toFixed(1)}× · 双击重置` : "滚轮缩放 · 拖拽平移 · 点击景点"}
        </span>
        {noMode && (
          <button onClick={onToggleGrid} style={{
            background: showGrid ? "rgba(0,243,255,0.12)" : "rgba(255,255,255,0.05)",
            border: showGrid ? "1px solid rgba(0,243,255,0.3)" : "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6, padding: "2px 10px", color: showGrid ? "#00f3ff" : "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: 10, pointerEvents: "auto",
          }}>经纬网</button>
        )}
        {noMode && (
          <button onClick={onEnterPaint} style={{
            background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: 6, padding: "2px 10px", color: "#a855f7", cursor: "pointer",
            fontSize: 10, pointerEvents: "auto",
          }}>画笔</button>
        )}
        {noMode && (
          <button onClick={onEnterCm} style={{
            background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)",
            borderRadius: 6, padding: "2px 10px", color: "#38bdf8", cursor: "pointer",
            fontSize: 10, pointerEvents: "auto",
          }}>标点</button>
        )}
        {noMode && (
          <button onClick={onEnterEdit} style={{
            background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)",
            borderRadius: 6, padding: "2px 10px", color: "#facc15", cursor: "pointer",
            fontSize: 10, pointerEvents: "auto",
          }}>编辑</button>
        )}
        {noMode && (
          <button onClick={onEnterDebug} style={{
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 6, padding: "2px 10px", color: "#f87171", cursor: "pointer",
            fontSize: 10, marginLeft: 4, pointerEvents: "auto",
          }}>调试</button>
        )}
        {noMode && (
          <button onClick={onToggleSettings} style={{
            background: showSettings ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.05)",
            border: showSettings ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6, padding: "2px 10px", color: showSettings ? "#a855f7" : "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: 10, pointerEvents: "auto",
          }}>设置</button>
        )}
        {noMode && (
          <button onClick={onExportAll} style={{
            background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 6, padding: "2px 10px", color: "#4ade80", cursor: "pointer",
            fontSize: 10, pointerEvents: "auto",
          }}>导出数据</button>
        )}
        {noMode && (
          <button onClick={onImportAll} style={{
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 6, padding: "2px 10px", color: "#fbbf24", cursor: "pointer",
            fontSize: 10, pointerEvents: "auto",
          }}>导入数据</button>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════ main component ═══════ */

export default function YanbianMap() {
  const saved = useMemo(() => loadSaved(), []);
  const [activeId, setActiveId] = useState(null);
  const [lang, setLang] = useState("zh");
  const [debugMode, setDebugMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [manualPos, setManualPos] = useState(() => loadManualPos());
  const [paintMode, setPaintMode] = useState(false);
  const [brush, setBrush] = useState("🌲");
  const [brushSize, setBrushSize] = useState(10);
  const [eraseMode, setEraseMode] = useState(false);
  const [stamps, setStamps] = useState(() => loadStamps());
  const [customMarkers, setCustomMarkers] = useState(() => loadCustomMarkers());
  const [vis, setVis] = useState(() => loadVisualSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [cmMode, setCmMode] = useState(false);
  const [placingCm, setPlacingCm] = useState(false);
  const [editingCm, setEditingCm] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [anchors, setAnchors] = useState(saved?.anchors || DEFAULT_ANCHORS);

  const { svgRef, viewBoxStr, zoom, isDragging, isDraggingAnchor, screenToSvg, resetView, handlers } =
    useZoomPan(debugMode || editMode || paintMode || cmMode ? { x: 0, y: 0, w: SVG_W, h: SVG_H } : CONTENT_VB);

  // Use saved calibration if available, otherwise LS fit; in debug mode always use anchor-derived
  const coeffs = useMemo(() => {
    if (debugMode) return computeCoeffs(anchors);
    if (saved?.pj) return saved.pj;
    return LS_PJ;
  }, [debugMode, anchors, saved]);
  const project = useCallback((lng, lat) => [coeffs.a * lng + coeffs.b, coeffs.c * lat + coeffs.d], [coeffs]);

  const handleMarkerClick = useCallback((id) => {
    if (isDragging.current) return;
    setActiveId((prev) => (prev === id ? null : id));
  }, [isDragging]);

  const handleSvgClick = useCallback((e) => {
    if (isDragging.current) return;
    // custom marker placing
    if (cmMode && placingCm) {
      const [sx, sy] = screenToSvg(e.clientX, e.clientY);
      const pos = [Math.round(sx * 10) / 10, Math.round(sy * 10) / 10];
      const newCm = {
        id: nextCmId(), emoji: "📍", svgPos: pos, coords: [0, 0],
        content: EMPTY_CONTENT(),
      };
      setCustomMarkers((prev) => { const next = [...prev, newCm]; saveCustomMarkers(next); return next; });
      setPlacingCm(false);
      setEditingCm(newCm);
      return;
    }
    // paint mode
    if (paintMode) {
      const [sx, sy] = screenToSvg(e.clientX, e.clientY);
      if (eraseMode) {
        // find nearest stamp within 15 SVG units and delete it
        setStamps((prev) => {
          let minD = Infinity, minIdx = -1;
          prev.forEach((s, i) => {
            const d = Math.hypot(s.x - sx, s.y - sy);
            if (d < minD) { minD = d; minIdx = i; }
          });
          if (minIdx >= 0 && minD < 15) {
            const next = prev.filter((_, i) => i !== minIdx);
            saveStamps(next);
            return next;
          }
          return prev;
        });
      } else if (brush) {
        const stamp = { id: nextStampId(), emoji: brush, x: Math.round(sx * 10) / 10, y: Math.round(sy * 10) / 10, size: brushSize };
        setStamps((prev) => { const next = [...prev, stamp]; saveStamps(next); return next; });
      }
      return;
    }
    // edit mode: place selected marker at click position
    if (editMode && editingId) {
      const [sx, sy] = screenToSvg(e.clientX, e.clientY);
      const pos = [Math.round(sx * 10) / 10, Math.round(sy * 10) / 10];
      setManualPos((prev) => {
        const next = { ...prev, [editingId]: pos };
        localStorage.setItem("yanbian_manual_pos_v1", JSON.stringify(next));
        return next;
      });
      const currentIdx = mapData.findIndex((s) => s.id === editingId);
      const nextUnplaced = mapData.find((s, i) => i > currentIdx && !manualPos[s.id] && s.id !== editingId);
      setEditingId(nextUnplaced?.id || null);
      return;
    }
    if (e.target.tagName === "svg" || e.target.tagName === "rect" || e.target.tagName === "path") {
      setActiveId(null);
    }
  }, [isDragging, cmMode, placingCm, paintMode, eraseMode, brush, brushSize, editMode, editingId, screenToSvg, manualPos]);

  const enterDebug = useCallback(() => {
    setDebugMode(true);
    setActiveId(null);
    resetView({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  }, [resetView]);

  const handleSaveDebug = useCallback(() => {
    const pj = computeCoeffs(anchors);
    localStorage.setItem("yanbian_calib_v5", JSON.stringify({ anchors, pj }));
    console.log(`[已保存] anchors:`, JSON.stringify(anchors));
    console.log(`[已保存] svgX = ${pj.a.toFixed(4)} * lng + ${pj.b.toFixed(2)}`);
    console.log(`[已保存] svgY = ${pj.c.toFixed(4)} * lat + ${pj.d.toFixed(2)}`);
    setDebugMode(false);
    resetView(CONTENT_VB);
  }, [anchors, resetView]);

  const handleResetDebug = useCallback(() => {
    setAnchors(DEFAULT_ANCHORS);
    localStorage.removeItem("yanbian_calib_v5");
  }, []);

  const handleExitNoSave = useCallback(() => {
    localStorage.removeItem("yanbian_calib_v5");
    setDebugMode(false);
    resetView(CONTENT_VB);
  }, [resetView]);

  // edit mode handlers
  const enterEdit = useCallback(() => {
    setEditMode(true);
    setActiveId(null);
    resetView({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  }, [resetView]);

  const exitEdit = useCallback(() => {
    setEditMode(false);
    setEditingId(null);
    resetView(CONTENT_VB);
  }, [resetView]);

  const clearManualPos = useCallback((id) => {
    setManualPos((prev) => {
      const next = { ...prev };
      delete next[id];
      localStorage.setItem("yanbian_manual_pos_v1", JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAllManualPos = useCallback(() => {
    setManualPos({});
    localStorage.removeItem("yanbian_manual_pos_v1");
  }, []);

  const exportManualPos = useCallback(() => {
    console.log("═══ 手动定位坐标 ═══");
    console.log(JSON.stringify(manualPos, null, 2));
    mapData.forEach((spot) => {
      const p = manualPos[spot.id];
      if (p) {
        console.log(`  "${spot.id}": [${p[0]}, ${p[1]}],  // ${spot.content.zh.title}`);
      } else {
        console.log(`  "${spot.id}": null,  // ${spot.content.zh.title} (未放置)`);
      }
    });
  }, [manualPos]);

  // paint mode handlers
  const enterPaint = useCallback(() => {
    setPaintMode(true);
    setActiveId(null);
    resetView({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  }, [resetView]);

  const exitPaint = useCallback(() => {
    setPaintMode(false);
    setEraseMode(false);
    resetView(CONTENT_VB);
  }, [resetView]);

  const undoStamp = useCallback(() => {
    setStamps((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice(0, -1);
      saveStamps(next);
      return next;
    });
  }, []);

  const clearAllStamps = useCallback(() => {
    setStamps([]);
    localStorage.removeItem("yanbian_stamps_v1");
  }, []);

  const exportStamps = useCallback(() => {
    console.log("═══ Emoji 画笔数据 ═══");
    console.log(JSON.stringify(stamps, null, 2));
    console.log(`共 ${stamps.length} 个 stamp`);
  }, [stamps]);

  // custom marker mode handlers
  const enterCm = useCallback(() => {
    setCmMode(true);
    setActiveId(null);
    resetView({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  }, [resetView]);

  const exitCm = useCallback(() => {
    setCmMode(false);
    setPlacingCm(false);
    setEditingCm(null);
    resetView(CONTENT_VB);
  }, [resetView]);

  const saveCm = useCallback((updated) => {
    setCustomMarkers((prev) => {
      const next = prev.map((m) => m.id === updated.id ? updated : m);
      saveCustomMarkers(next);
      return next;
    });
  }, []);

  const deleteCm = useCallback((id) => {
    setCustomMarkers((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveCustomMarkers(next);
      return next;
    });
  }, []);

  const exportCm = useCallback(() => {
    console.log("═══ 自定义标点数据 ═══");
    console.log(JSON.stringify(customMarkers, null, 2));
    console.log(`共 ${customMarkers.length} 个自定义标点`);
  }, [customMarkers]);

  // export all user data (stamps + custom markers) for hardcoding into userData.js
  const exportAll = useCallback(() => {
    const data = { stamps, customMarkers, visualSettings: vis };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yanbian-map-data-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stamps, customMarkers, vis]);

  const importAll = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data.stamps)) {
            setStamps(data.stamps);
            localStorage.setItem("yanbian_stamps_v1", JSON.stringify(data.stamps));
          }
          if (Array.isArray(data.customMarkers)) {
            setCustomMarkers(data.customMarkers);
            localStorage.setItem("yanbian_cm_v1", JSON.stringify(data.customMarkers));
          }
          if (data.visualSettings) {
            const v = { ...DEFAULT_VIS, ...data.visualSettings };
            setVis(v);
            saveVisualSettings(v);
          }
          alert(`导入成功！\n${data.stamps?.length || 0} 个画笔 + ${data.customMarkers?.length || 0} 个标点`);
        } catch { alert("JSON 格式错误"); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // find active spot from both mapData and customMarkers
  const activeSpot = useMemo(() => {
    return mapData.find((s) => s.id === activeId) || customMarkers.find((s) => s.id === activeId) || null;
  }, [activeId, customMarkers]);

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#050505" }}>
      <TitleHeader />

      <svg
        ref={svgRef}
        viewBox={viewBoxStr}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: "none", cursor: (cmMode && placingCm) ? "crosshair" : paintMode ? (eraseMode ? "not-allowed" : "crosshair") : editMode && editingId ? "crosshair" : zoom > 1.05 ? "grab" : "default", filter: `brightness(${vis.brightness}%) contrast(${vis.contrast}%) saturate(${vis.saturation}%) hue-rotate(${vis.hue}deg)` }}
        onClick={handleSvgClick}
        {...handlers}
      >
        <defs>
          <style>{`
            @keyframes breathe { 0%,100% { opacity:0.15; transform:scale(0.7); } 50% { opacity:0.5; transform:scale(1.4); } }
            @keyframes halo { 0%,100% { opacity:0.4; transform:scale(0.9); } 50% { opacity:0.8; transform:scale(1.1); } }
            .mk-breathe { animation: breathe 2.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            .mk-halo { animation: halo 3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          `}</style>
          <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowCyanStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="emojiGold" x="-120%" y="-120%" width="340%" height="340%">
            {/* outer soft glow */}
            <feGaussianBlur in="SourceGraphic" stdDeviation={5 * vis.glowIntensity / 100} result="blur1" />
            <feColorMatrix in="blur1" type="matrix" result="gold1"
              values={`1.2 0 0 0 0.15  0.1 0.85 0 0 0.08  0 0 0.15 0 0  0 0 0 ${0.35 * vis.glowIntensity / 100} 0`} />
            {/* mid glow */}
            <feGaussianBlur in="SourceGraphic" stdDeviation={2.5 * vis.glowIntensity / 100} result="blur2" />
            <feColorMatrix in="blur2" type="matrix" result="gold2"
              values={`1.3 0 0 0 0.2  0.1 0.9 0 0 0.1  0 0 0.1 0 0  0 0 0 ${0.55 * vis.glowIntensity / 100} 0`} />
            {/* inner bright core */}
            <feGaussianBlur in="SourceGraphic" stdDeviation={1 * vis.glowIntensity / 100} result="blur3" />
            <feColorMatrix in="blur3" type="matrix" result="gold3"
              values={`1.5 0 0 0 0.3  0.2 1.0 0 0 0.15  0 0 0.05 0 0  0 0 0 ${0.7 * vis.glowIntensity / 100} 0`} />
            {/* stack layers */}
            <feMerge>
              <feMergeNode in="gold1" />
              <feMergeNode in="gold2" />
              <feMergeNode in="gold3" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="stampGold" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={3 * vis.glowIntensity / 100} result="sb1" />
            <feColorMatrix in="sb1" type="matrix" result="sg1"
              values={`1.2 0 0 0 0.15  0.1 0.85 0 0 0.08  0 0 0.15 0 0  0 0 0 ${0.3 * vis.glowIntensity / 100} 0`} />
            <feGaussianBlur in="SourceGraphic" stdDeviation={1.2 * vis.glowIntensity / 100} result="sb2" />
            <feColorMatrix in="sb2" type="matrix" result="sg2"
              values={`1.4 0 0 0 0.25  0.15 0.95 0 0 0.12  0 0 0.08 0 0  0 0 0 ${0.5 * vis.glowIntensity / 100} 0`} />
            <feMerge>
              <feMergeNode in="sg1" />
              <feMergeNode in="sg2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="lightBeamGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#00f3ff" stopOpacity={0.6} />
            <stop offset="50%" stopColor="#00f3ff" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#00f3ff" stopOpacity={0} />
          </linearGradient>
          <radialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f3ff" stopOpacity={0.04} />
            <stop offset="100%" stopColor="#00f3ff" stopOpacity={0} />
          </radialGradient>
        </defs>

        <GridBg />
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#ambientGlow)" />
        <ScanLine />

        {/* county fills */}
        {countyFills.map((d, i) => (
          <path
            key={`fill-${i}`} d={d}
            fill="rgba(0,243,255,0.03)" stroke="rgba(0,243,255,0.1)" strokeWidth={0.4}
          />
        ))}

        {/* county borders */}
        {countyBorders.map((d, i) => (
          <path
            key={`border-${i}`} d={d} fill="none" stroke="#00f3ff" strokeWidth={0.3} opacity={0.15}
            filter="url(#glowCyan)"
          />
        ))}

        {/* outer border */}
        <path
          d={outerBorder} fill="none" stroke="#00f3ff" strokeWidth={1.2} opacity={0.6}
          filter="url(#glowCyanStrong)"
        />
        <path d={outerBorder} fill="none" stroke="#00f3ff" strokeWidth={3} opacity={0.05} filter="url(#glowCyanStrong)" />

        <GeoGrid project={project} show={showGrid} />

        {/* markers */}
        {mapData.map((spot, i) => (
          <Marker
            key={spot.id} spot={spot} index={i}
            active={activeId === spot.id} zoom={zoom}
            onClick={handleMarkerClick} project={project}
            manualPos={manualPos}
          />
        ))}

        {/* custom markers */}
        {customMarkers.map((cm, i) => {
          const [svgX, svgY] = cm.svgPos;
          const s = 1 / zoom;
          const r = 2.5 * s;
          const glowR = 6 * s;
          const emojiSize = (activeId === cm.id ? 14 : 10) * s;
          const emojiY = svgY - 6 * s;
          return (
            <g key={cm.id} onClick={(e) => { e.stopPropagation(); if (!cmMode) handleMarkerClick(cm.id); }} style={{ cursor: cmMode ? "default" : "pointer" }}>
              <circle cx={svgX} cy={svgY - 3 * s} r={12 * s} fill="transparent" />
              <circle
                cx={svgX} cy={svgY} r={glowR} fill="none" stroke="#00f3ff" strokeWidth={0.6 * s}
                className="mk-breathe" style={{ animationDelay: `${i * 0.12}s` }}
              />
              <circle
                cx={svgX} cy={emojiY} r={8 * s} fill="rgba(250,204,21,0.06)"
                className="mk-halo" style={{ animationDelay: `${i * 0.12}s` }}
              />
              <circle cx={svgX} cy={svgY} r={r} fill="#00f3ff" opacity={activeId === cm.id ? 1 : 0.7} />
              <text
                x={svgX} y={emojiY} textAnchor="middle" dominantBaseline="central" fontSize={emojiSize}
                style={{ fontFamily: EMOJI_FONT, filter: "url(#emojiGold)", pointerEvents: "none" }}
              >{cm.emoji}</text>
              {activeId === cm.id && (
                <text x={svgX} y={svgY + 6 * s} textAnchor="middle" fontSize={3.5 * s}
                  fill="#00f3ff" opacity={0.7} fontFamily="'Inter', system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >{cm.content.zh.title || "自定义标点"}</text>
              )}
              <AnimatePresence>
                {activeId === cm.id && <LightBeam x={svgX} y={svgY} zoom={zoom} />}
              </AnimatePresence>
            </g>
          );
        })}

        {/* emoji stamps — single filter on group instead of per-element */}
        <g style={{ filter: vis.glowIntensity > 0 ? "url(#stampGold)" : "none" }}>
          {stamps.map((s) => (
            <text
              key={s.id} x={s.x} y={s.y}
              textAnchor="middle" dominantBaseline="central"
              fontSize={s.size} style={{ fontFamily: EMOJI_FONT, pointerEvents: "none" }}
            >{s.emoji}</text>
          ))}
        </g>

        {/* debug anchors */}
        {debugMode && (
          <>
            <DragAnchor
              pos={anchors.north} geo={NORTH_GEO} color="#f87171" label="北 N"
              screenToSvg={screenToSvg} isDraggingAnchor={isDraggingAnchor}
              onMove={(p) => setAnchors((prev) => ({ ...prev, north: p }))}
            />
            <DragAnchor
              pos={anchors.east} geo={EAST_GEO} color="#60a5fa" label="东 E"
              screenToSvg={screenToSvg} isDraggingAnchor={isDraggingAnchor}
              onMove={(p) => setAnchors((prev) => ({ ...prev, east: p }))}
            />
          </>
        )}
      </svg>

      <BottomBar zoom={zoom} debugMode={debugMode} editMode={editMode} paintMode={paintMode} cmMode={cmMode} showGrid={showGrid} showSettings={showSettings} onEnterDebug={enterDebug} onEnterEdit={enterEdit} onEnterPaint={enterPaint} onEnterCm={enterCm} onToggleGrid={() => setShowGrid(g => !g)} onExportAll={exportAll} onImportAll={importAll} onToggleSettings={() => setShowSettings(s => !s)} />

      <AnimatePresence>
        {showSettings && <SettingsPanel vis={vis} setVis={setVis} onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      {/* debug panel */}
      {debugMode && (
        <DebugPanel coeffs={coeffs} anchors={anchors} onReset={handleResetDebug} onSave={handleSaveDebug} onExitNoSave={handleExitNoSave} />
      )}

      {/* edit panel */}
      {editMode && (
        <EditPanel
          editingId={editingId} setEditingId={setEditingId}
          manualPos={manualPos} onClear={clearManualPos}
          onClearAll={clearAllManualPos} onExport={exportManualPos}
          onExit={exitEdit}
        />
      )}

      {/* paint panel */}
      {paintMode && (
        <PaintPanel
          brush={brush} setBrush={setBrush}
          brushSize={brushSize} setBrushSize={setBrushSize}
          eraseMode={eraseMode} setEraseMode={setEraseMode}
          stamps={stamps} onUndo={undoStamp}
          onClearAll={clearAllStamps} onExport={exportStamps}
          onExit={exitPaint}
        />
      )}

      {/* custom marker panel */}
      {cmMode && (
        <CustomMarkerPanel
          customMarkers={customMarkers}
          editingCm={editingCm} setEditingCm={setEditingCm}
          placingCm={placingCm} setPlacingCm={setPlacingCm}
          onSaveCm={saveCm} onDeleteCm={deleteCm}
          onExportCm={exportCm} onExit={exitCm}
        />
      )}

      {/* info card */}
      <AnimatePresence>
        {activeSpot && !debugMode && !editMode && !paintMode && !cmMode && (
          <InfoCard key={activeSpot.id} spot={activeSpot} lang={lang} setLang={setLang} onClose={() => setActiveId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
