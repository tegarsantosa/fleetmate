/**
 * AutoPackLogic.js — physics-aware loading-manifest generation + a CSV export
 * formatted for manual warehouse staff (not engineers).
 *
 * WAREHOUSE PHYSICS (the non-negotiable rules the sort obeys):
 *   1. LAYER before DEPTH before WEIGHT: you build the floor layer first, then
 *      stack — you can never place a Layer-2 box before its Layer-1 support.
 *   2. DEEPEST first: you cannot load the front (near the door) before the back
 *      of the trailer, so within a layer the deepest zone is loaded first.
 *   3. HEAVY on the FLOOR: heavy boxes are strictly Layer 1, and within the same
 *      layer+depth the heavier box is loaded (and placed) first.
 *
 * Two entry points:
 *   • buildDummyManifest(n)          → realistic synthetic plan (landing demo)
 *   • manifestFromPlan(items, cont)  → maps a REAL packing plan (box positions
 *                                       from the engine) into the same manifest
 *
 * Both return rich rows carrying: Sequence_No · Box_ID · Weight_Class ·
 * Depth_Zone · Placement_Side · Layering_Level · Action_Note. These feed the
 * on-screen tables and the visual loading guide.
 *
 * The exported CSV is deliberately SLIMMER and human-readable (see CSV_HEADERS):
 *   Sequence_No · Box_ID · Placement · Action_Note
 * — no Weight_Class, and the three placement fields collapsed into one plain
 * "Layer · Zona · Sisi" sentence a picker can read at a glance.
 */

/* ---------- vocabulary (human-readable, bilingual where it matters) ---------- */

export const MANIFEST_HEADERS = [
  "Sequence_No",
  "Box_ID",
  "Weight_Class",
  "Depth_Zone",
  "Placement_Side",
  "Layering_Level",
  "Action_Note",
];

// depthIdx 0 = load first (against the front wall), 2 = load last (by the door)
const DEPTH_ZONES = ["Deepest/Mentok Dalam", "Middle/Tengah", "Near Door/Dekat Pintu"];
const SIDES = ["Left", "Center", "Right"];
const LAYERS = ["Layer 1 (Floor)", "Layer 2 (Stack)", "Layer 3 (Top)"];
const WEIGHTS = ["Heavy", "Medium", "Light"]; // rank 0 = heaviest → floor first

const weightRank = (w) => WEIGHTS.indexOf(w);

/* ---------- spatial classifiers (shared by dummy + real mappers) ---------- */

/** Fraction 0..1 along the truck length → depth zone. 0 = deepest (front wall). */
function depthZoneFromFraction(f) {
  const idx = f < 1 / 3 ? 0 : f < 2 / 3 ? 1 : 2;
  return { zone: DEPTH_ZONES[idx], idx };
}

/** Fraction 0..1 across the truck width → side. */
function sideFromFraction(f) {
  const idx = f < 0.34 ? 0 : f < 0.66 ? 1 : 2;
  return SIDES[idx];
}

/** Height (cm) above the floor → layer. z≈0 is the floor. */
function layerFromHeight(z, containerHeight = 240) {
  if (z <= 5) return { level: LAYERS[0], idx: 0 };
  if (z <= containerHeight * 0.55) return { level: LAYERS[1], idx: 1 };
  return { level: LAYERS[2], idx: 2 };
}

/* ---------- action note (clear instruction for a picker on the floor) ---------- */

function actionNote(depthIdx, side, layerIdx, weight) {
  const deep = ["deepest (paling dalam)", "middle (tengah)", "near the door (dekat pintu)"][depthIdx];
  const sideWord = { Left: "left (kiri)", Right: "right (kanan)", Center: "center (tengah)" }[side];
  if (layerIdx === 0) {
    const care = weight === "Heavy" ? " This is a HEAVY box — floor only, never stack it high." : "";
    return `Place on the FLOOR, slide to the ${deep} ${sideWord} corner.${care}`;
  }
  return `Stack on Layer ${layerIdx} at the ${deep} ${sideWord} position. Do NOT place heavier boxes on top.`;
}

/* ---------- the physics sort (produces Sequence_No) ---------- */

function physicsSort(rows) {
  return [...rows].sort((a, b) => {
    if (a._layerIdx !== b._layerIdx) return a._layerIdx - b._layerIdx;   // floor first
    if (a._depthIdx !== b._depthIdx) return a._depthIdx - b._depthIdx;   // deepest first
    const wr = weightRank(a.Weight_Class) - weightRank(b.Weight_Class);
    if (wr !== 0) return wr;                                             // heavier first
    return SIDES.indexOf(a.Placement_Side) - SIDES.indexOf(b.Placement_Side);
  });
}

/** Finalise a set of partial rows: enforce Heavy⇒Layer 1, sort, number, note. */
function finalize(partials) {
  // Rule: a Heavy box can never live above the floor.
  partials.forEach((p) => {
    if (p.Weight_Class === "Heavy" && p._layerIdx > 0) {
      p._layerIdx = 0;
      p.Layering_Level = LAYERS[0];
    }
  });
  const sorted = physicsSort(partials);
  return sorted.map((p, i) => ({
    Sequence_No: i + 1,
    Box_ID: p.Box_ID,
    Weight_Class: p.Weight_Class,
    Depth_Zone: p.Depth_Zone,
    Placement_Side: p.Placement_Side,
    Layering_Level: p.Layering_Level,
    Action_Note: actionNote(p._depthIdx, p.Placement_Side, p._layerIdx, p.Weight_Class),
  }));
}

/* ---------- 1) synthetic, physics-valid dummy manifest ---------- */

export function buildDummyManifest(count = 16) {
  // A believable inbound shipment: a heavy base, medium mid-fill, light top-off.
  const mix = [];
  for (let i = 0; i < count; i++) {
    const r = i / count;
    const weight = r < 0.34 ? "Heavy" : r < 0.7 ? "Medium" : "Light";
    // heavy → floor & deep; light → stacked & near the door
    const depthIdx = weight === "Heavy" ? i % 2 : weight === "Medium" ? 1 + (i % 2) - (i % 3 === 0 ? 1 : 0) : 1 + (i % 2);
    const layerIdx = weight === "Heavy" ? 0 : weight === "Medium" ? (i % 3 === 0 ? 1 : 0) : (i % 2) + 1;
    const side = SIDES[i % 3];
    mix.push({
      Box_ID: `PKG-${String(i + 1).padStart(3, "0")}`,
      Weight_Class: weight,
      Depth_Zone: DEPTH_ZONES[Math.min(2, Math.max(0, depthIdx))],
      Placement_Side: side,
      Layering_Level: LAYERS[Math.min(2, layerIdx)],
      _depthIdx: Math.min(2, Math.max(0, depthIdx)),
      _layerIdx: Math.min(2, layerIdx),
    });
  }
  return finalize(mix);
}

/* ---------- 2) map a REAL engine plan → the same manifest ---------- */

/**
 * @param items      packing-plan items with pos_x/pos_y/pos_z + placed_*_cm (cm),
 *                   plus an optional boxLabel / box_id.
 * @param container  { length_cm, width_cm, height_cm } — the vehicle envelope.
 * Depth runs along the LENGTH (x): x≈0 is the deepest (front wall), x≈length is
 * the door. Side runs across the WIDTH (y). Layer is the height (z).
 */
export function manifestFromPlan(items, container = {}) {
  const L = Number(container.length_cm) || 600;
  const W = Number(container.width_cm) || 235;
  const H = Number(container.height_cm) || 239;

  const partials = items.map((it, i) => {
    const l = Number(it.placed_length_cm);
    const w = Number(it.placed_width_cm);
    const h = Number(it.placed_height_cm);
    const cx = (Number(it.pos_x) + l / 2) / L; // depth fraction (0 = deepest)
    const cy = (Number(it.pos_y) + w / 2) / W; // side fraction
    const z = Number(it.pos_z);                // floor height

    const depth = depthZoneFromFraction(cx);
    const layer = layerFromHeight(z, H);
    // Weight class by ABSOLUTE volume (semantic: a big box is heavy regardless
    // of what else is in the load). ~0.2 m³ ≈ Heavy, ~0.06 m³ ≈ Medium.
    const vol = l * w * h; // cm³
    const weight = vol >= 200000 ? "Heavy" : vol >= 60000 ? "Medium" : "Light";

    return {
      Box_ID: it.boxLabel || `PKG-${String(i + 1).padStart(3, "0")}`,
      Weight_Class: weight,
      Depth_Zone: depth.zone,
      Placement_Side: sideFromFraction(cy),
      Layering_Level: layer.level,
      _depthIdx: depth.idx,
      _layerIdx: layer.idx,
    };
  });

  return finalize(partials);
}

/* ---------- CSV: RFC-4180 safe, Excel/Sheets-friendly, browser download ---------- */

function csvField(value) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* The CSV columns actually written to disk — no Weight_Class, and one clear
 * Placement sentence instead of three coded columns. */
export const CSV_HEADERS = ["Sequence_No", "Box_ID", "Placement", "Action_Note"];

// Plain-language pieces used to build the readable Placement sentence.
const DEPTH_TEXT = ["Paling Dalam", "Tengah", "Dekat Pintu"];
const SIDE_TEXT = { Left: "Kiri", Center: "Tengah", Right: "Kanan" };
const LAYER_TEXT = ["Layer 1 - Lantai", "Layer 2 - Tumpuk", "Layer 3 - Atas"];

/** Collapse a row's layer/depth/side into one readable instruction, e.g.
 *  "Layer 1 - Lantai · Paling Dalam · Sisi Kiri". */
function placementText(row) {
  const layer = LAYER_TEXT[layerNumOf(row) - 1] || row.Layering_Level;
  const depth = DEPTH_TEXT[depthIdxOf(row)] || row.Depth_Zone;
  const side = SIDE_TEXT[row.Placement_Side] || row.Placement_Side;
  return `${layer} · ${depth} · Sisi ${side}`;
}

export function manifestToCsv(rows) {
  const lines = [CSV_HEADERS.map(csvField).join(",")];
  for (const row of rows) {
    lines.push(
      [row.Sequence_No, row.Box_ID, placementText(row), row.Action_Note]
        .map(csvField)
        .join(",")
    );
  }
  // UTF-8 BOM + CRLF → opens cleanly (and keeps the Indonesian text) in Excel
  return "﻿" + lines.join("\r\n");
}

export function downloadManifestCsv(rows, filename) {
  const blob = new Blob([manifestToCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `fleetmate_loading_manifest_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
 * VISUAL LOADING GUIDE — the operator-proof output.
 *
 * A CSV is unreadable to a picker on the floor: it forces them to rebuild a
 * 3D map from text. This renders a printable, bilingual (ID/EN) sheet with a
 * TOP-DOWN diagram of the truck bed (one grid per stacking layer, numbered by
 * loading order and colour-coded by weight) plus big step-by-step cards. Print
 * it, tape it to the trailer, load top-to-bottom.
 * ============================================================ */

const WEIGHT_COLOR = { Heavy: "#dc2626", Medium: "#d97706", Light: "#16a34a" };
const depthIdxOf = (r) => (r.Depth_Zone.startsWith("Deepest") ? 0 : r.Depth_Zone.startsWith("Middle") ? 1 : 2);
const sideIdxOf = (r) => (r.Placement_Side === "Left" ? 0 : r.Placement_Side === "Center" ? 1 : 2);
const layerNumOf = (r) => parseInt((r.Layering_Level.match(/\d/) || [1])[0], 10);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const DEPTH_ROW_LABELS = [
  "PALING DALAM · Deepest",
  "TENGAH · Middle",
  "DEKAT PINTU · Near Door",
];
const SIDE_COL_LABELS = ["KIRI · Left", "TENGAH · Center", "KANAN · Right"];

function layerGridHtml(rows) {
  // cells[depth][side] = [row, ...]
  const cells = [0, 1, 2].map(() => [[], [], []]);
  rows.forEach((r) => cells[depthIdxOf(r)][sideIdxOf(r)].push(r));

  const body = [0, 1, 2]
    .map((d) => {
      const tds = [0, 1, 2]
        .map((s) => {
          const items = cells[d][s]
            .sort((a, b) => a.Sequence_No - b.Sequence_No)
            .map(
              (r) =>
                `<span class="seq" style="background:${WEIGHT_COLOR[r.Weight_Class]}" title="${esc(r.Box_ID)}">${r.Sequence_No}</span>`
            )
            .join("");
          return `<td>${items || '<span class="empty">—</span>'}</td>`;
        })
        .join("");
      return `<tr><th class="rowlbl">${DEPTH_ROW_LABELS[d]}</th>${tds}</tr>`;
    })
    .join("");

  return `
    <table class="map">
      <tr><th></th>${SIDE_COL_LABELS.map((c) => `<th class="collbl">${c}</th>`).join("")}</tr>
      ${body}
    </table>`;
}

export function buildLoadingGuideHtml(manifest, meta = {}) {
  const vehicle = esc(meta.vehicle || meta.code || "Vehicle");
  const date = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const layers = [...new Set(manifest.map((r) => layerNumOf(r)))].sort((a, b) => a - b);

  const layerSections = layers
    .map((ln) => {
      const rows = manifest.filter((r) => layerNumOf(r) === ln);
      const name =
        ln === 1 ? "LAYER 1 — LANTAI / FLOOR (muat paling dulu)" : `LAYER ${ln} — TUMPUK / STACK (di atas Layer ${ln - 1})`;
      return `<section class="layer"><h2>${name}</h2>${layerGridHtml(rows)}</section>`;
    })
    .join("");

  const steps = manifest
    .map(
      (r) => `
      <li>
        <span class="step-no" style="background:${WEIGHT_COLOR[r.Weight_Class]}">${r.Sequence_No}</span>
        <div class="step-body">
          <div class="step-top">
            <b>${esc(r.Box_ID)}</b>
            <span class="wtag" style="color:${WEIGHT_COLOR[r.Weight_Class]};border-color:${WEIGHT_COLOR[r.Weight_Class]}">${esc(r.Weight_Class)}</span>
            <span class="zone">${esc(r.Depth_Zone)} · ${esc(r.Placement_Side)} · ${esc(r.Layering_Level)}</span>
          </div>
          <div class="step-note">${esc(r.Action_Note)}</div>
        </div>
      </li>`
    )
    .join("");

  return `<!doctype html><html lang="id"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Panduan Muat — ${vehicle}</title>
<style>
  :root{ --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --lime:#84D12A; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:var(--ink); background:#f1f5f9; }
  .sheet{ max-width:900px; margin:0 auto; background:#fff; padding:28px 32px 48px; }
  .top{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid var(--ink); padding-bottom:14px; }
  .brand{ font-weight:800; letter-spacing:.06em; font-size:15px; } .brand b{ color:var(--lime); }
  h1{ font-size:22px; margin:6px 0 2px; } .sub{ color:var(--mut); font-size:13px; }
  .meta{ text-align:right; font-size:12px; color:var(--mut); line-height:1.6; }
  .meta .big{ font-size:26px; font-weight:800; color:var(--ink); }
  .legend{ display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin:16px 0 6px; font-size:12px; color:var(--mut); }
  .legend .dir{ font-weight:700; color:var(--ink); }
  .chip{ display:inline-flex; align-items:center; gap:6px; }
  .chip i{ width:12px; height:12px; border-radius:3px; display:inline-block; }
  h2{ font-size:14px; letter-spacing:.04em; margin:22px 0 10px; padding:7px 12px; background:#0f172a; color:#fff; border-radius:6px; }
  table.map{ width:100%; border-collapse:collapse; table-layout:fixed; }
  table.map th, table.map td{ border:1px solid var(--line); padding:8px; vertical-align:top; }
  table.map .collbl{ background:#f8fafc; font-size:11px; color:var(--mut); text-align:center; }
  table.map .rowlbl{ background:#f8fafc; font-size:11px; color:var(--mut); width:150px; text-align:left; }
  table.map td{ height:56px; text-align:center; }
  .seq{ display:inline-flex; align-items:center; justify-content:center; min-width:26px; height:26px; margin:2px; padding:0 5px;
        border-radius:6px; color:#fff; font-weight:800; font-size:13px; }
  .empty{ color:#cbd5e1; }
  ol.steps{ list-style:none; margin:6px 0 0; padding:0; }
  ol.steps li{ display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-bottom:1px dashed var(--line); page-break-inside:avoid; }
  .step-no{ flex-shrink:0; width:34px; height:34px; border-radius:8px; color:#fff; font-weight:800; font-size:15px;
            display:flex; align-items:center; justify-content:center; }
  .step-top{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .step-top b{ font-size:15px; } .wtag{ border:1.5px solid; border-radius:5px; padding:1px 7px; font-size:11px; font-weight:800; text-transform:uppercase; }
  .zone{ font-size:12px; color:var(--mut); } .step-note{ font-size:13px; margin-top:3px; }
  .noprint{ margin:18px 0; text-align:center; }
  .btn{ background:var(--lime); color:#0a0a0a; border:none; border-radius:8px; padding:11px 22px; font-weight:800; font-size:14px; cursor:pointer; }
  @media print{ body{ background:#fff; } .sheet{ max-width:none; padding:0; } .noprint{ display:none; } h2{ -webkit-print-color-adjust:exact; print-color-adjust:exact; } .seq,.step-no{ -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">FLEET<b>MATE</b> · PANDUAN MUAT</div>
        <h1>Loading Guide — ${vehicle}</h1>
        <div class="sub">Muat sesuai nomor urut. Ikuti dari Layer 1 (lantai) dulu. / Load in number order, Layer 1 first.</div>
      </div>
      <div class="meta"><div class="big">${manifest.length}</div>kotak / boxes<br />${date}</div>
    </div>

    <div class="legend">
      <span class="dir">◄ Muat dari SINI (paling dalam) &nbsp;·&nbsp; Load from HERE (deepest) — pintu di kanan / door at right ►</span>
      <span class="chip"><i style="background:${WEIGHT_COLOR.Heavy}"></i> Berat/Heavy</span>
      <span class="chip"><i style="background:${WEIGHT_COLOR.Medium}"></i> Sedang/Medium</span>
      <span class="chip"><i style="background:${WEIGHT_COLOR.Light}"></i> Ringan/Light</span>
    </div>

    ${layerSections}

    <h2>URUTAN MUAT LANGKAH-DEMI-LANGKAH · STEP-BY-STEP</h2>
    <ol class="steps">${steps}</ol>

    <div class="noprint"><button class="btn" onclick="window.print()">🖨️ Cetak / Print</button></div>
  </div>
</body></html>`;
}

/** Open the printable loading guide in a new tab (falls back to an .html
 *  download if the browser blocks the popup). */
export function openLoadingGuide(manifest, meta = {}) {
  const html = buildLoadingGuideHtml(manifest, meta);
  const win = window.open("", "_blank");
  if (win && win.document) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `loading_guide_${(meta.vehicle || meta.code || "vehicle")}_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
