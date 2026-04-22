import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { allProvinces, NE_PROVINCE_INDICES, countryBorder } from "./data/mapPaths";
import { scenicData } from "./data/scenicData";
import "./index.css";

const SVG_W = 878;
const SVG_H = 434;
const MAX_ZOOM = 8;

/* ---------- calibration anchors ---------- */
const EAST_GEO = [135.083, 48.45];
const WEST_GEO = [73.667, 39.25];
const DEFAULT_ANCHORS = { east: [651.1, 66.0], west: [227.6, 153.3] };
const DEFAULT_CROP = { x: 380, y: 10, w: 300, h: 220 };

function loadSaved() {
  try {
    const s = localStorage.getItem("map_debug_v2");
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return { anchors: DEFAULT_ANCHORS, crop: DEFAULT_CROP };
}

function computeCoeffs(anchors) {
  const a = (anchors.east[0] - anchors.west[0]) / (EAST_GEO[0] - WEST_GEO[0]);
  const b = anchors.west[0] - a * WEST_GEO[0];
  const c = (anchors.east[1] - anchors.west[1]) / (EAST_GEO[1] - WEST_GEO[1]);
  const d = anchors.west[1] - c * WEST_GEO[1];
  return { a, b, c, d };
}

/* ---------- zoom / pan ---------- */

function useZoomPan(initVB) {
  const [viewBox, setViewBox] = useState(initVB);
  const svgRef = useRef(null);
  const dragState = useRef(null);
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
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
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

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 || isDraggingAnchor.current) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, startVB: { ...viewBox } };
    svgRef.current?.setPointerCapture(e.pointerId);
  }, [viewBox]);

  const onPointerMove = useCallback((e) => {
    if (!dragState.current || isDraggingAnchor.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const { startX, startY, startVB } = dragState.current;
    const dx = ((e.clientX - startX) / rect.width) * startVB.w;
    const dy = ((e.clientY - startY) / rect.height) * startVB.h;
    let nx = startVB.x - dx;
    let ny = startVB.y - dy;
    nx = Math.max(0, Math.min(SVG_W - startVB.w, nx));
    ny = Math.max(0, Math.min(SVG_H - startVB.h, ny));
    setViewBox({ x: nx, y: ny, w: startVB.w, h: startVB.h });
  }, []);

  const onPointerUp = useCallback(() => { dragState.current = null; }, []);

  const resetView = useCallback((vb) => {
    baseVB.current = vb;
    setViewBox(vb);
  }, []);

  const zoom = baseVB.current.w / viewBox.w;
  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return {
    svgRef, viewBoxStr, zoom, screenToSvg, isDraggingAnchor, resetView,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp,
      onDoubleClick: () => resetView(baseVB.current) },
  };
}

/* ---------- sub-components ---------- */

function GridBackground() {
  const cols = 24, rows = 14;
  const cw = SVG_W / cols, rh = SVG_H / rows;
  return (
    <g opacity={0.08}>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={`c${i}`} x1={i * cw} y1={0} x2={i * cw} y2={SVG_H} stroke="#6ee7b7" strokeWidth={0.3} />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`r${i}`} x1={0} y1={i * rh} x2={SVG_W} y2={i * rh} stroke="#6ee7b7" strokeWidth={0.3} />
      ))}
      {Array.from({ length: cols + 1 }, (_, ci) =>
        Array.from({ length: rows + 1 }, (_, ri) => (
          <circle key={`d${ci}-${ri}`} cx={ci * cw} cy={ri * rh} r={0.8} fill="#6ee7b7" opacity={0.5} />
        ))
      )}
    </g>
  );
}

function LatLngLabels({ project }) {
  const lngTicks = [120, 122, 124, 126, 128, 130, 132, 134];
  const latTicks = [40, 42, 44, 46, 48, 50, 52];
  return (
    <g opacity={0.18} fontSize={5} fill="#6ee7b7" fontFamily="monospace">
      {lngTicks.map((lng) => {
        const [x] = project(lng, 46);
        return <text key={`lng${lng}`} x={x} y={SVG_H - 4} textAnchor="middle">{lng}°E</text>;
      })}
      {latTicks.map((lat) => {
        const [, y] = project(128, lat);
        return <text key={`lat${lat}`} x={SVG_W - 4} y={y} textAnchor="end" dominantBaseline="middle">{lat}°N</text>;
      })}
    </g>
  );
}

function HoverCard({ spot, svgX, svgY, zoom }) {
  const s = 1 / zoom;
  const cardW = 170 * s, cardH = 72 * s;
  let cx = svgX + 14 * s, cy = svgY - cardH / 2;
  if (cx + cardW > SVG_W - 10) cx = svgX - cardW - 14 * s;
  if (cy < 4) cy = 4;
  if (cy + cardH > SVG_H - 4) cy = SVG_H - 4 - cardH;
  return (
    <motion.foreignObject x={cx} y={cy} width={cardW} height={cardH}
      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.18 }}
      style={{ pointerEvents: "none", overflow: "visible" }}>
      <div style={{
        background: "rgba(16,24,20,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(110,231,183,0.18)", borderRadius: 10 * s, padding: `${8 * s}px ${11 * s}px`,
        color: "#e2e8f0", fontFamily: "'Inter',system-ui,sans-serif",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.05)",
      }}>
        <div style={{ fontSize: 11 * s, fontWeight: 600, marginBottom: 3 * s, color: "#6ee7b7" }}>{spot.icon} {spot.name}</div>
        <div style={{ fontSize: 8.5 * s, opacity: 0.7, marginBottom: 3 * s }}>{spot.desc}</div>
        <div style={{ fontSize: 7.5 * s, fontFamily: "monospace", opacity: 0.45 }}>
          {spot.coords[0].toFixed(2)}°E, {spot.coords[1].toFixed(2)}°N
        </div>
      </div>
    </motion.foreignObject>
  );
}

function Marker({ spot, index, hovered, onHover, onLeave, project, zoom }) {
  const [svgX, svgY] = project(spot.coords[0], spot.coords[1]);
  const s = 1 / zoom;
  const r = 2.2 * s, glowR = 5 * s;
  const emojiSize = (hovered ? 11 : 8) * s;
  const emojiY = svgY - 5 * s;
  return (
    <g onMouseEnter={() => onHover(spot.id)} onMouseLeave={onLeave} style={{ cursor: "pointer" }}>
      <motion.circle cx={svgX} cy={svgY} r={glowR} fill="none" stroke="#6ee7b7" strokeWidth={0.6 * s}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0.15, 0.45, 0.15], scale: [0.7, 1.3, 0.7] }}
        transition={{ delay: 0.6 + index * 0.08, duration: 2.8, repeat: Infinity, ease: "easeInOut" }} />
      <motion.circle cx={svgX} cy={svgY} r={r} fill="#6ee7b7"
        initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 + index * 0.08, type: "spring", stiffness: 260, damping: 16 }} />
      <motion.text x={svgX} y={emojiY} textAnchor="middle" fontSize={emojiSize}
        initial={{ opacity: 0, y: emojiY - 13 * s }} animate={{ opacity: 1, y: emojiY }}
        transition={{ delay: 0.5 + index * 0.08, type: "spring", stiffness: 200, damping: 14 }}
        style={{ pointerEvents: "none" }}>{spot.icon}</motion.text>
      <AnimatePresence>{hovered && <HoverCard spot={spot} svgX={svgX} svgY={svgY} zoom={zoom} />}</AnimatePresence>
    </g>
  );
}

/* ---------- debug: drag anchor ---------- */

function DragAnchor({ pos, geo, color, label, screenToSvg, isDraggingAnchor, onMove }) {
  const dragging = useRef(false);
  const onPtrDown = useCallback((e) => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = true; isDraggingAnchor.current = true;
    e.target.setPointerCapture(e.pointerId);
  }, [isDraggingAnchor]);
  const onPtrMove = useCallback((e) => {
    if (!dragging.current) return; e.stopPropagation();
    const [sx, sy] = screenToSvg(e.clientX, e.clientY);
    onMove([Math.round(sx * 10) / 10, Math.round(sy * 10) / 10]);
  }, [screenToSvg, onMove]);
  const onPtrUp = useCallback((e) => {
    e.stopPropagation(); dragging.current = false; isDraggingAnchor.current = false;
  }, [isDraggingAnchor]);

  return (
    <g style={{ cursor: "move" }} onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp}>
      <circle cx={pos[0]} cy={pos[1]} r={10} fill="transparent" />
      <line x1={pos[0]-8} y1={pos[1]} x2={pos[0]+8} y2={pos[1]} stroke={color} strokeWidth={0.6} opacity={0.6} />
      <line x1={pos[0]} y1={pos[1]-8} x2={pos[0]} y2={pos[1]+8} stroke={color} strokeWidth={0.6} opacity={0.6} />
      <circle cx={pos[0]} cy={pos[1]} r={4} fill={color} opacity={0.9} stroke="#fff" strokeWidth={0.5} />
      <text x={pos[0]+7} y={pos[1]-7} fill={color} fontSize={5} fontFamily="monospace" fontWeight={700}>{label}</text>
      <text x={pos[0]+7} y={pos[1]+1} fill={color} fontSize={3.5} fontFamily="monospace" opacity={0.7}>
        {geo[0].toFixed(2)}°E, {geo[1].toFixed(2)}°N
      </text>
      <text x={pos[0]+7} y={pos[1]+7} fill={color} fontSize={3.5} fontFamily="monospace" opacity={0.5}>
        SVG ({pos[0].toFixed(1)}, {pos[1].toFixed(1)})
      </text>
    </g>
  );
}

/* ---------- debug: crop rectangle ---------- */

function CropOverlay({ crop, screenToSvg, isDraggingAnchor, onCropChange }) {
  const { x, y, w, h } = crop;
  const dragRef = useRef(null); // { type, startCrop, startSvg }

  const onPtrDown = useCallback((type) => (e) => {
    e.stopPropagation(); e.preventDefault();
    isDraggingAnchor.current = true;
    const [sx, sy] = screenToSvg(e.clientX, e.clientY);
    dragRef.current = { type, startCrop: { ...crop }, sx, sy };
    e.target.setPointerCapture(e.pointerId);
  }, [crop, screenToSvg, isDraggingAnchor]);

  const onPtrMove = useCallback((e) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const [sx, sy] = screenToSvg(e.clientX, e.clientY);
    const { type, startCrop, sx: sx0, sy: sy0 } = dragRef.current;
    const dx = sx - sx0, dy = sy - sy0;
    const sc = startCrop;
    let next;

    if (type === "body") {
      let nx = sc.x + dx, ny = sc.y + dy;
      nx = Math.max(0, Math.min(SVG_W - sc.w, nx));
      ny = Math.max(0, Math.min(SVG_H - sc.h, ny));
      next = { x: nx, y: ny, w: sc.w, h: sc.h };
    } else {
      // corner drag
      let x1 = type.includes("l") ? sc.x + dx : sc.x;
      let y1 = type.includes("t") ? sc.y + dy : sc.y;
      let x2 = type.includes("r") ? sc.x + sc.w + dx : sc.x + sc.w;
      let y2 = type.includes("b") ? sc.y + sc.h + dy : sc.y + sc.h;
      // enforce min size 40x30
      if (x2 - x1 < 40) { if (type.includes("l")) x1 = x2 - 40; else x2 = x1 + 40; }
      if (y2 - y1 < 30) { if (type.includes("t")) y1 = y2 - 30; else y2 = y1 + 30; }
      x1 = Math.max(0, x1); y1 = Math.max(0, y1);
      x2 = Math.min(SVG_W, x2); y2 = Math.min(SVG_H, y2);
      next = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    onCropChange(next);
  }, [screenToSvg, onCropChange]);

  const onPtrUp = useCallback((e) => {
    e.stopPropagation();
    dragRef.current = null;
    isDraggingAnchor.current = false;
  }, [isDraggingAnchor]);

  const handleSize = 6;
  const corners = [
    { id: "tl", cx: x,     cy: y,     cursor: "nwse-resize" },
    { id: "tr", cx: x + w, cy: y,     cursor: "nesw-resize" },
    { id: "bl", cx: x,     cy: y + h, cursor: "nesw-resize" },
    { id: "br", cx: x + w, cy: y + h, cursor: "nwse-resize" },
  ];

  return (
    <g onPointerMove={onPtrMove} onPointerUp={onPtrUp}>
      {/* dim everything outside crop */}
      <path
        d={`M0,0 H${SVG_W} V${SVG_H} H0 Z M${x},${y} V${y+h} H${x+w} V${y} Z`}
        fill="rgba(0,0,0,0.55)" fillRule="evenodd" style={{ pointerEvents: "none" }}
      />
      {/* crop border */}
      <rect x={x} y={y} width={w} height={h}
        fill="transparent" stroke="#fbbf24" strokeWidth={1} strokeDasharray="4,3"
        style={{ cursor: "move" }}
        onPointerDown={onPtrDown("body")} />
      {/* dimension label */}
      <text x={x + w / 2} y={y - 4} fill="#fbbf24" fontSize={4} fontFamily="monospace"
        textAnchor="middle" opacity={0.7}>
        {Math.round(w)} × {Math.round(h)} — viewBox: {Math.round(x)},{Math.round(y)}
      </text>
      {/* corner handles */}
      {corners.map((c) => (
        <rect key={c.id}
          x={c.cx - handleSize / 2} y={c.cy - handleSize / 2}
          width={handleSize} height={handleSize}
          fill="#fbbf24" stroke="#000" strokeWidth={0.4} rx={1}
          style={{ cursor: c.cursor }}
          onPointerDown={onPtrDown(c.id)} />
      ))}
    </g>
  );
}

/* ---------- debug panel ---------- */

function DebugPanel({ coeffs, anchors, crop, onReset, onSave }) {
  return (
    <div style={{
      position: "fixed", top: 12, right: 12, zIndex: 50,
      background: "rgba(16,24,20,0.88)", backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,100,100,0.3)", borderRadius: 10, padding: "12px 16px",
      color: "#f0f0f0", fontFamily: "monospace", fontSize: 11, minWidth: 280,
    }}>
      <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
        DEBUG
      </div>
      <div style={{ opacity: 0.5, marginBottom: 4, fontSize: 9 }}>投影系数</div>
      <div style={{ opacity: 0.6, marginBottom: 3, fontSize: 9 }}>
        svgX = <span style={{ color: "#fbbf24" }}>{coeffs.a.toFixed(4)}</span> × lng
        + <span style={{ color: "#fbbf24" }}>{coeffs.b.toFixed(2)}</span>
      </div>
      <div style={{ opacity: 0.6, marginBottom: 6, fontSize: 9 }}>
        svgY = <span style={{ color: "#fbbf24" }}>{coeffs.c.toFixed(4)}</span> × lat
        + <span style={{ color: "#fbbf24" }}>{coeffs.d.toFixed(2)}</span>
      </div>
      <div style={{ opacity: 0.5, marginBottom: 4, fontSize: 9 }}>展示范围 (黄色框)</div>
      <div style={{ opacity: 0.6, marginBottom: 8, fontSize: 9, color: "#fbbf24" }}>
        viewBox: {Math.round(crop.x)}, {Math.round(crop.y)}, {Math.round(crop.w)}, {Math.round(crop.h)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onReset} style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 6, padding: "4px 10px", color: "#e2e8f0", cursor: "pointer", fontSize: 10,
        }}>重置全部</button>
        <button onClick={onSave} style={{
          background: "rgba(110,231,183,0.15)", border: "1px solid rgba(110,231,183,0.4)",
          borderRadius: 6, padding: "4px 10px", color: "#6ee7b7", cursor: "pointer", fontSize: 10, fontWeight: 700,
        }}>保存并退出调试</button>
      </div>
    </div>
  );
}

/* ---------- main ---------- */

export default function App() {
  const saved = useMemo(() => loadSaved(), []);
  const [hoveredId, setHoveredId] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [anchors, setAnchors] = useState(saved.anchors);
  const [crop, setCrop] = useState(saved.crop);

  const { svgRef, viewBoxStr, zoom, screenToSvg, isDraggingAnchor, resetView, handlers } =
    useZoomPan(debugMode ? { x: 0, y: 0, w: SVG_W, h: SVG_H } : crop);

  const coeffs = useMemo(() => computeCoeffs(anchors), [anchors]);
  const project = useCallback((lng, lat) => [coeffs.a * lng + coeffs.b, coeffs.c * lat + coeffs.d], [coeffs]);

  const enterDebug = useCallback(() => {
    setDebugMode(true);
    resetView({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  }, [resetView]);

  const handleSaveDebug = useCallback(() => {
    const data = { anchors, crop };
    localStorage.setItem("map_debug_v2", JSON.stringify(data));
    const c = computeCoeffs(anchors);
    console.log(`[已保存] anchors:`, JSON.stringify(anchors));
    console.log(`[已保存] crop:`, JSON.stringify(crop));
    console.log(`[已保存] svgX = ${c.a.toFixed(4)} * lng + ${c.b.toFixed(2)}, svgY = ${c.c.toFixed(4)} * lat + ${c.d.toFixed(2)}`);
    setDebugMode(false);
    resetView(crop);
  }, [anchors, crop, resetView]);

  const handleResetDebug = useCallback(() => {
    setAnchors(DEFAULT_ANCHORS);
    setCrop(DEFAULT_CROP);
    localStorage.removeItem("map_debug_v2");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "#050505" }}>

      <motion.h1 className="text-center mb-2 select-none"
        style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 20, fontWeight: 300,
          color: "rgba(110,231,183,0.6)", letterSpacing: 8 }}
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        东三省风景名胜经纬度地图
      </motion.h1>

      <motion.div className="relative w-full px-2"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
        <svg ref={svgRef} viewBox={viewBoxStr} className="w-full h-auto"
          style={{ display: "block", cursor: zoom > 1.05 ? "grab" : "default", touchAction: "none" }}
          {...handlers}>
          <defs>
            <radialGradient id="neGlow" cx="67%" cy="25%" r="35%">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0} />
            </radialGradient>
          </defs>

          <GridBackground />
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#neGlow)" />

          {allProvinces.map((d, i) => (
            <motion.path key={`prov-${i}`} d={d}
              fill={NE_PROVINCE_INDICES.includes(i) ? "rgba(110,231,183,0.06)" : "rgba(255,255,255,0.012)"}
              stroke={NE_PROVINCE_INDICES.includes(i) ? "rgba(110,231,183,0.25)" : "rgba(255,255,255,0.05)"}
              strokeWidth={NE_PROVINCE_INDICES.includes(i) ? 0.8 : 0.25}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: NE_PROVINCE_INDICES.includes(i) ? 0.3 : 0 }} />
          ))}

          <path d={countryBorder} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
          <LatLngLabels project={project} />

          {scenicData.map((spot, i) => (
            <Marker key={spot.id} spot={spot} index={i} project={project} zoom={zoom}
              hovered={hoveredId === spot.id}
              onHover={setHoveredId} onLeave={() => setHoveredId(null)} />
          ))}

          {/* debug overlays */}
          {debugMode && (
            <>
              <CropOverlay crop={crop} screenToSvg={screenToSvg}
                isDraggingAnchor={isDraggingAnchor} onCropChange={setCrop} />
              <DragAnchor pos={anchors.east} geo={EAST_GEO} color="#f87171" label="东 E"
                screenToSvg={screenToSvg} isDraggingAnchor={isDraggingAnchor}
                onMove={(p) => setAnchors((prev) => ({ ...prev, east: p }))} />
              <DragAnchor pos={anchors.west} geo={WEST_GEO} color="#60a5fa" label="西 W"
                screenToSvg={screenToSvg} isDraggingAnchor={isDraggingAnchor}
                onMove={(p) => setAnchors((prev) => ({ ...prev, west: p }))} />
            </>
          )}
        </svg>
      </motion.div>

      <motion.div className="mt-2 flex gap-6 select-none items-center"
        style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(110,231,183,0.35)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
        <span>⬤ 黑龙江</span>
        <span>⬤ 吉林</span>
        <span>⬤ 辽宁</span>
        <span style={{ opacity: 0.5 }}>共 {scenicData.length} 处景点</span>
        <span style={{ opacity: 0.4 }}>
          {zoom > 1.05 ? `${zoom.toFixed(1)}x · 双击重置` : "滚轮缩放"}
        </span>
        {!debugMode && (
          <button onClick={enterDebug} style={{
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 6, padding: "2px 10px", color: "#f87171", cursor: "pointer",
            fontSize: 10, marginLeft: 8,
          }}>调试</button>
        )}
      </motion.div>

      {debugMode && (
        <DebugPanel coeffs={coeffs} anchors={anchors} crop={crop}
          onReset={handleResetDebug} onSave={handleSaveDebug} />
      )}
    </div>
  );
}
