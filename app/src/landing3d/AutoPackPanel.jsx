import React, { useState } from "react";
import { Cpu, Loader2, Download, RotateCcw, CheckCircle2, PackageCheck, Printer } from "lucide-react";
import { buildDummyManifest, downloadManifestCsv, openLoadingGuide } from "../lib/AutoPackLogic.js";

/**
 * AutoPackPanel — simulates the FleetMate "AI Auto-Pack" bin-packing pass and
 * exports a warehouse-ready loading manifest as a CSV.
 *
 * All the physics-aware layering/depth logic and the CSV formatting live in
 * lib/AutoPackLogic.js (shared with the real dashboard). This component is
 * purely the UI + state machine:
 *   idle → (Run) → running (~1.6s) → ready → (Download CSV) / (Run again)
 */

const LIME = "#84D12A";

const WEIGHT_STYLE = {
  Heavy: { color: "#f87171", bg: "rgba(248,113,113,0.14)" },
  Medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.14)" },
  Light: { color: "#4ade80", bg: "rgba(74,222,128,0.14)" },
};

export default function AutoPackPanel() {
  const [status, setStatus] = useState("idle"); // idle | running | ready
  const [rows, setRows] = useState([]);

  const run = () => {
    setStatus("running");
    setRows([]);
    setTimeout(() => {
      setRows(buildDummyManifest(16));
      setStatus("ready");
    }, 1600);
  };

  const reset = () => {
    setStatus("idle");
    setRows([]);
  };

  const layerCount = new Set(rows.map((r) => r.Layering_Level)).size;
  const floorCount = rows.filter((r) => r.Layering_Level.startsWith("Layer 1")).length;
  const utilization = rows.length ? Math.min(97, 58 + rows.length * 2.4).toFixed(1) : "0";

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-gray-900/80 p-6 sm:p-8 shadow-2xl ring-1 ring-black/40 backdrop-blur">
      {/* header */}
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(132,209,42,0.14)", color: LIME }}>
          <Cpu size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold tracking-tight text-white text-lg sm:text-xl">AI Auto-Pack Simulation</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">
            Run the physics-aware bin-packing engine, then export a loading
            manifest your dock crew can follow box-by-box — sequenced deepest &amp;
            heaviest first, with plain-language placement notes.
          </p>
        </div>
      </div>

      {/* body */}
      <div className="mt-6">
        {status === "idle" && (
          <button
            onClick={run}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-[15px] font-bold text-gray-950 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: LIME, boxShadow: "0 10px 30px rgba(132,209,42,0.32)" }}
          >
            <PackageCheck size={18} />
            Run Auto-Pack Simulation
          </button>
        )}

        {status === "running" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 px-6 py-10 text-center">
            <Loader2 size={26} className="animate-spin" style={{ color: LIME }} />
            <div className="text-sm font-semibold text-white">Optimising load plan…</div>
            <div className="font-mono text-xs text-gray-500">layering by weight · sequencing deepest-first</div>
          </div>
        )}

        {status === "ready" && (
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: LIME }}>
              <CheckCircle2 size={17} /> Plan ready — {rows.length} boxes sequenced
            </div>
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[
                { v: rows.length, l: "Boxes packed" },
                { v: `${utilization}%`, l: "Space utilization" },
                { v: `${floorCount}/${layerCount}`, l: "Floor boxes / layers" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-center">
                  <div className="font-mono text-xl font-bold text-white tabular-nums">{s.v}</div>
                  <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{s.l}</div>
                </div>
              ))}
            </div>

            {/* manifest preview (the 7-column CSV, minus the long Action_Note) */}
            <div className="mb-5 overflow-hidden rounded-xl border border-white/10">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="sticky top-0 bg-gray-800/95 text-[10.5px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">#</th>
                      <th className="px-3 py-2.5 font-semibold">Box ID</th>
                      <th className="px-3 py-2.5 font-semibold">Penempatan / Placement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {rows.map((r) => {
                      const ws = WEIGHT_STYLE[r.Weight_Class] || {};
                      return (
                        <tr key={r.Sequence_No} className="hover:bg-white/5">
                          <td className="px-3 py-2 font-mono tabular-nums text-gray-500">{r.Sequence_No}</td>
                          <td className="px-3 py-2 font-mono font-medium text-white">
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: ws.color }} title={r.Weight_Class} />
                            {r.Box_ID}
                          </td>
                          <td className="px-3 py-2 text-gray-300">{r.Placement}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => openLoadingGuide(rows, { vehicle: "Demo Truck (FMATE)" })}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold text-gray-950 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: LIME, boxShadow: "0 10px 30px rgba(132,209,42,0.32)" }}
                title="Printable visual guide the dock crew can actually follow — top-down map + steps"
              >
                <Printer size={18} />
                Print Loading Guide
              </button>
              <button
                onClick={() => downloadManifestCsv(rows)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10"
                title="Raw manifest CSV (for systems / records)"
              >
                <Download size={16} /> CSV
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10"
              >
                <RotateCcw size={16} /> Run again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
