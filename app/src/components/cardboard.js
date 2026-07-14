// ============================================================
// cardboard.js — procedural kraft-cardboard materials for cargo
//
// Replaces the old flat-colored cubes with realistic corrugated
// kraft boxes: paper-fibre noise, flap seams, packing tape (tinted
// with the pack-sequence color so color-coding survives), shipping
// label with barcode, and "this way up" handling marks.
//
// Everything is cached at module level: textures and materials are
// generated once per (shade, tape-color, face) combination and
// shared across every box in the scene, so 100 boxes cost the same
// GPU memory as ~10 unique materials. Because materials are SHARED,
// per-box hover effects must NOT mutate material props (emissive) —
// use an overlay mesh instead (see Container3D.jsx).
// ============================================================
import * as THREE from "three";

const TEX_SIZE = 256;

// Three kraft paper shades — boxes cycle through them so a stack
// doesn't look like clones of a single asset.
const KRAFT_SHADES = [
  { base: "#c7a476", dark: "#a5834f", light: "#dabf92", ink: "#6b4f2a" },
  { base: "#b8955f", dark: "#96753f", light: "#cdb083", ink: "#5d431f" },
  { base: "#d2b285", dark: "#b0905c", light: "#e2cba2", ink: "#75593a" },
];

// Deterministic PRNG so textures are identical across re-renders/HMR.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- painting helpers ---------- */

function paintKraftBase(ctx, shade, rnd) {
  const S = TEX_SIZE;
  ctx.fillStyle = shade.base;
  ctx.fillRect(0, 0, S, S);

  // paper fibre streaks
  for (let i = 0; i < 150; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 8 + rnd() * 30;
    ctx.strokeStyle = rnd() > 0.5 ? shade.light : shade.dark;
    ctx.globalAlpha = 0.04 + rnd() * 0.07;
    ctx.lineWidth = 0.8 + rnd() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rnd() - 0.5) * 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // faint corrugation ribbing (vertical)
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = shade.dark;
  for (let x = 0; x < S; x += 7) ctx.fillRect(x, 0, 2, S);
  ctx.globalAlpha = 1;

  // edge darkening — fake ambient occlusion around the face rim
  const rim = ctx.createLinearGradient(0, 0, 0, S);
  [
    [0, 0, S, 14, 0, 0, 0, 14],
    [0, S - 14, S, 14, 0, S, 0, S - 14],
  ].forEach(([x, y, w, h, gx0, gy0, gx1, gy1]) => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, "rgba(60,40,15,0.28)");
    g.addColorStop(1, "rgba(60,40,15,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  });
  [
    [0, 0, 14, S, 0, 0, 14, 0],
    [S - 14, 0, 14, S, S, 0, S - 14, 0],
  ].forEach(([x, y, w, h, gx0, gy0, gx1, gy1]) => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, "rgba(60,40,15,0.28)");
    g.addColorStop(1, "rgba(60,40,15,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  });
  void rim;
}

function paintTape(ctx, tapeColor, vertical = true) {
  const S = TEX_SIZE;
  const tw = Math.round(S * 0.2); // tape width
  const c = new THREE.Color(tapeColor);
  const rgba = (a) => `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${a})`;

  if (vertical) {
    const x = (S - tw) / 2;
    ctx.fillStyle = rgba(0.85);
    ctx.fillRect(x, 0, tw, S);
    // sheen + edge shadow make it read as plastic tape
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 4, 0, 3, S);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, 0, 2, S);
    ctx.fillRect(x + tw - 2, 0, 2, S);
  } else {
    const y = (S - tw) / 2;
    ctx.fillStyle = rgba(0.85);
    ctx.fillRect(0, y, S, tw);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, y + 4, S, 3);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, y, S, 2);
    ctx.fillRect(0, y + tw - 2, S, 2);
  }
}

function paintFlapSeam(ctx, shade) {
  const S = TEX_SIZE;
  // two lid flaps meet in the middle: darker seam + soft flap shadows
  ctx.strokeStyle = shade.dark;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, S / 2);
  ctx.lineTo(S, S / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const g1 = ctx.createLinearGradient(0, S / 2 - 16, 0, S / 2);
  g1.addColorStop(0, "rgba(60,40,15,0)");
  g1.addColorStop(1, "rgba(60,40,15,0.22)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, S / 2 - 16, S, 16);
  const g2 = ctx.createLinearGradient(0, S / 2, 0, S / 2 + 16);
  g2.addColorStop(0, "rgba(60,40,15,0.22)");
  g2.addColorStop(1, "rgba(60,40,15,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, S / 2, S, 16);
}

function paintShippingLabel(ctx, rnd) {
  const S = TEX_SIZE;
  const w = S * 0.42;
  const h = S * 0.3;
  const x = S * 0.09 + rnd() * S * 0.06;
  const y = S * 0.14 + rnd() * S * 0.08;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rnd() - 0.5) * 0.06); // slightly crooked, like a real sticker
  ctx.translate(-(x + w / 2), -(y + h / 2));

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x + 2, y + 3, w, h); // drop shadow
  ctx.fillStyle = "#f5f2ea";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#c9c2b2";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // fake address lines
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(x + 8, y + 8, w * 0.55, 4);
  ctx.fillStyle = "#8a8578";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 8, y + 18 + i * 8, w * (0.7 - i * 0.12), 3);
  }
  // barcode
  let bx = x + 8;
  const by = y + h - 22;
  ctx.fillStyle = "#1c1c1c";
  while (bx < x + w - 10) {
    const bw = 1 + Math.floor(rnd() * 3);
    if (rnd() > 0.35) ctx.fillRect(bx, by, bw, 15);
    bx += bw + 1 + Math.floor(rnd() * 2);
  }
  // brand corner
  ctx.fillStyle = "#6b4f2a";
  ctx.font = "bold 9px Inter, sans-serif";
  ctx.fillText("FLEETMATE", x + w - 58, y + 12);

  ctx.restore();
}

function paintHandlingMarks(ctx, shade) {
  const S = TEX_SIZE;
  const ink = shade.ink;
  ctx.save();
  ctx.globalAlpha = 0.75;

  // "this way up" arrows, stamped bottom-right
  const ax = S * 0.72;
  const ay = S * 0.66;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 3;
  [0, 20].forEach((dx) => {
    ctx.beginPath();
    ctx.moveTo(ax + dx, ay + 26);
    ctx.lineTo(ax + dx, ay + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + dx - 6, ay + 12);
    ctx.lineTo(ax + dx, ay + 2);
    ctx.lineTo(ax + dx + 6, ay + 12);
    ctx.closePath();
    ctx.fill();
  });
  ctx.beginPath();
  ctx.moveTo(ax - 10, ay + 32);
  ctx.lineTo(ax + 30, ay + 32);
  ctx.stroke();

  // fragile glass stamp (simple goblet)
  const gx = S * 0.78;
  const gy = S * 0.22;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(gx - 9, gy);
  ctx.lineTo(gx + 9, gy);
  ctx.quadraticCurveTo(gx + 7, gy + 14, gx, gy + 16);
  ctx.quadraticCurveTo(gx - 7, gy + 14, gx - 9, gy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx, gy + 16);
  ctx.lineTo(gx, gy + 24);
  ctx.moveTo(gx - 7, gy + 26);
  ctx.lineTo(gx + 7, gy + 26);
  ctx.stroke();

  ctx.restore();
}

/* ---------- texture factory (cached) ---------- */

const texCache = new Map();

function makeTexture(key, paint) {
  if (texCache.has(key)) return texCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d");
  paint(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

function topTexture(shadeIdx, tapeColor) {
  const shade = KRAFT_SHADES[shadeIdx];
  return makeTexture(`top|${shadeIdx}|${tapeColor}`, (ctx) => {
    const rnd = mulberry32(11 + shadeIdx * 97);
    paintKraftBase(ctx, shade, rnd);
    paintFlapSeam(ctx, shade);
    paintTape(ctx, tapeColor, true);
  });
}

function sideLabelTexture(shadeIdx, tapeColor) {
  const shade = KRAFT_SHADES[shadeIdx];
  return makeTexture(`sideL|${shadeIdx}|${tapeColor}`, (ctx) => {
    const rnd = mulberry32(31 + shadeIdx * 131);
    paintKraftBase(ctx, shade, rnd);
    paintShippingLabel(ctx, rnd);
    paintHandlingMarks(ctx, shade);
    // tape wraps over from the lid down this face
    paintTape(ctx, tapeColor, true);
  });
}

function sidePlainTexture(shadeIdx) {
  const shade = KRAFT_SHADES[shadeIdx];
  return makeTexture(`sideP|${shadeIdx}`, (ctx) => {
    const rnd = mulberry32(53 + shadeIdx * 173);
    paintKraftBase(ctx, shade, rnd);
    paintHandlingMarks(ctx, shade);
  });
}

function bottomTexture(shadeIdx) {
  const shade = KRAFT_SHADES[shadeIdx];
  return makeTexture(`bottom|${shadeIdx}`, (ctx) => {
    const rnd = mulberry32(71 + shadeIdx * 211);
    paintKraftBase(ctx, shade, rnd);
    // bottom is grubbier
    ctx.fillStyle = "rgba(60,40,15,0.16)";
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    paintFlapSeam(ctx, shade);
  });
}

/* ---------- material factory (cached + shared) ---------- */

const matCache = new Map();

function material(key, map) {
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.86,
    metalness: 0.02,
  });
  matCache.set(key, m);
  return m;
}

/**
 * Returns the 6-material array for a cardboard box, in BoxGeometry
 * face order [+x, -x, +y(top), -y(bottom), +z, -z].
 *
 * `tapeColor` should be the pack-sequence color so operators can
 * still match a box to the loading-sequence list at a glance.
 * `variantSeed` (usually the box index) picks the kraft shade so
 * neighbouring boxes don't look identical.
 *
 * Materials are SHARED across boxes — never mutate them per box.
 */
export function cardboardMaterials(tapeColor, variantSeed = 0) {
  const shadeIdx = Math.abs(variantSeed) % KRAFT_SHADES.length;
  return [
    material(`px|${shadeIdx}|${tapeColor}`, sideLabelTexture(shadeIdx, tapeColor)), // +x label side
    material(`nx|${shadeIdx}`, sidePlainTexture(shadeIdx)), // -x
    material(`py|${shadeIdx}|${tapeColor}`, topTexture(shadeIdx, tapeColor)), // top
    material(`ny|${shadeIdx}`, bottomTexture(shadeIdx)), // bottom
    material(`pz|${shadeIdx}`, sidePlainTexture(shadeIdx)), // +z
    material(`nz|${shadeIdx}`, sidePlainTexture(shadeIdx)), // -z
  ];
}
