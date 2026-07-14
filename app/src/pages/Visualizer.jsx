import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import Container3D from "../components/Container3D.jsx";
import { api, packing } from "../lib/api.js";
import { manifestFromPlan, downloadManifestCsv, openLoadingGuide } from "../lib/AutoPackLogic.js";
import { useToast } from "../components/Toast.jsx";
import {
  Camera, Zap, RefreshCw, Truck, Box, Cpu, ListOrdered, Send, RotateCcw, Sparkles, Scan, X, Undo2, FileDown, Printer,
} from "lucide-react";

// Mirrors the packing service's select_best_container(): a vehicle is eligible
// while it is available/loading and still fits the smallest pending box; the
// scheduler prefers the most-loaded vehicle that still fits (bin-packing
// best-fit, same idea as a k8s scheduler bin-packing pods onto nodes).
function rankVehicles(containers, pendingBoxes) {
  const smallest = pendingBoxes.length
    ? Math.min(...pendingBoxes.map((b) => Number(b.length_cm) * Number(b.width_cm) * Number(b.height_cm)))
    : 0;

  const annotated = containers.map((c) => {
    const free = Number(c.max_volume_cm3) - Number(c.used_volume_cm3);
    const eligible =
      (c.status === "available" || c.status === "loading") && free >= smallest && pendingBoxes.length > 0;
    return { ...c, free, eligible, remainingRatio: c.max_volume_cm3 > 0 ? free / c.max_volume_cm3 : 0 };
  });

  const eligibleSorted = annotated
    .filter((c) => c.eligible)
    .sort((a, b) => a.remainingRatio - b.remainingRatio || a.max_volume_cm3 - b.max_volume_cm3);

  return { annotated, recommendedId: eligibleSorted[0]?.id ?? null };
}

export default function Visualizer() {
  const toast = useToast();
  const [containers, setContainers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [allBoxes, setAllBoxes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchAnimId, setDispatchAnimId] = useState(null);
  const [isPacking, setIsPacking] = useState(false);
  const [autoPack, setAutoPack] = useState(false);
  const [viewPreset, setViewPreset] = useState(null);
  const [presetKey, setPresetKey] = useState(0);
  const [xray, setXray] = useState(true);
  const [landedCount, setLandedCount] = useState(0);
  const packingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [containerList, planList, boxList] = await Promise.all([
        api.listContainers(),
        api.listPlans(),
        api.listBoxes(),
      ]);
      // Shipped vehicles STAY visible so a dispatch can be recalled/edited —
      // they simply rank last and are never eligible for new boxes.
      const ordered = [...containerList].sort(
        (a, b) => (a.status === "shipped") - (b.status === "shipped")
      );
      setContainers(ordered);
      setPlans(planList);
      setAllBoxes(boxList);
      setError(null);

      setSelectedId((prev) => {
        if (prev == null && ordered.length > 0) return ordered[0].id;
        if (ordered.find((c) => c.id === prev)) return prev;
        return ordered.length > 0 ? ordered[0].id : null;
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [refresh]);

  // reset step tracker whenever the animation replays or the vehicle changes
  useEffect(() => {
    setLandedCount(0);
  }, [animKey, selectedId]);

  const pendingBoxes = useMemo(
    () =>
      allBoxes
        .filter((b) => b.status === "pending")
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [allBoxes]
  );

  const boxLabelById = useMemo(() => {
    const map = {};
    for (const b of allBoxes) map[b.id] = b.label;
    return map;
  }, [allBoxes]);

  const { annotated: rankedContainers, recommendedId } = useMemo(
    () => rankVehicles(containers, pendingBoxes),
    [containers, pendingBoxes]
  );

  const runPack = useCallback(async () => {
    if (packingRef.current) return;
    packingRef.current = true;
    setIsPacking(true);
    try {
      const result = await packing.run();
      await refresh();
      setAnimKey((k) => k + 1);
      const placed = result.plans.reduce((s, p) => s + p.box_count, 0);
      const vehicles = new Set(result.plans.map((p) => p.container_id)).size;
      if (placed > 0) {
        toast(`AI packed ${placed} box${placed > 1 ? "es" : ""} into ${vehicles} vehicle${vehicles > 1 ? "s" : ""}`, "success");
        if (result.plans.length > 0) setSelectedId(result.plans[0].container_id);
      }
      if (result.unplaced_boxes.length > 0) {
        toast(`${result.unplaced_boxes.length} box(es) did not fit any vehicle`, "error");
      }
    } catch (err) {
      setError(err.message);
      toast("Packing failed", "error");
    } finally {
      packingRef.current = false;
      setIsPacking(false);
    }
  }, [refresh, toast]);

  // Auto-pack: when enabled, newly scanned boxes are packed as they arrive.
  useEffect(() => {
    if (autoPack && pendingBoxes.length > 0 && !packingRef.current && !dispatching) {
      runPack();
    }
  }, [autoPack, pendingBoxes.length, dispatching, runPack]);

  const handlePickBestVehicle = () => {
    if (recommendedId) {
      setSelectedId(recommendedId);
      setAnimKey((k) => k + 1);
      const rec = rankedContainers.find((c) => c.id === recommendedId);
      toast(`Best fit: ${rec.name} — ${Math.round((1 - rec.remainingRatio) * 100)}% loaded, fills up first`, "info");
    } else {
      toast("No eligible vehicle for the current queue", "error");
    }
  };

  const handleResetContainer = async (id) => {
    try {
      await api.resetContainer(id);
      await refresh();
      setAnimKey((k) => k + 1);
      toast("Vehicle emptied — boxes returned to queue", "info");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDispatch = (id) => {
    setDispatching(true);
    setDispatchAnimId(id);
  };

  // Un-pack a single box: off the plan, back into the pending queue.
  const handleRemoveItem = async (item) => {
    try {
      await api.removePlanItem(item.id);
      await refresh();
      toast(`${item.boxLabel || "Box"} returned to the queue`, "info");
    } catch (err) {
      setError(err.message);
      toast("Could not remove the box", "error");
    }
  };

  // Undo a dispatch: the truck comes back to the dock, load intact.
  const handleRecall = async (id) => {
    try {
      await api.recallContainer(id);
      await refresh();
      setAnimKey((k) => k + 1);
      toast("Shipment recalled — vehicle is back at the dock", "info");
    } catch (err) {
      setError(err.message);
      toast("Recall failed", "error");
    }
  };

  const finishDispatch = useCallback(async () => {
    try {
      await api.dispatchContainer(dispatchAnimId);
      await refresh();
      toast("Shipment dispatched", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setDispatching(false);
      setDispatchAnimId(null);
      setAnimKey((k) => k + 1);
    }
  }, [dispatchAnimId, refresh, toast]);

  const selectedContainer = containers.find((c) => c.id === selectedId) || null;

  // Flatten plan items chronologically; within a plan, floor-level boxes drop
  // first so stacks build bottom-up in the animation.
  const itemsForSelected = useMemo(() => {
    const containerPlans = plans
      .filter((p) => p.container_id === selectedId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let idx = 0;
    return containerPlans.flatMap((p) =>
      [...p.items]
        .sort((a, b) => Number(a.pos_z) - Number(b.pos_z))
        .map((item) => ({ ...item, colorIndex: idx++, boxLabel: boxLabelById[item.box_id] }))
    );
  }, [plans, selectedId, boxLabelById]);

  const totalBoxesLoaded = itemsForSelected.length;
  const currentUtilization =
    selectedContainer && selectedContainer.max_volume_cm3 > 0
      ? selectedContainer.used_volume_cm3 / selectedContainer.max_volume_cm3
      : 0;
  const isDispatchingSelected = dispatchAnimId === selectedId;

  // Turn the REAL packed load plan into a warehouse-ready CSV manifest: the
  // physics-aware layering/depth/weight logic lives in lib/AutoPackLogic.js.
  const handleDownloadManifest = () => {
    if (!selectedContainer || itemsForSelected.length === 0) return;
    const manifest = manifestFromPlan(itemsForSelected, selectedContainer);
    downloadManifestCsv(manifest, `manifest_${selectedContainer.code}_${new Date().toISOString().slice(0, 10)}.csv`);
    toast(`Manifest exported — ${manifest.length} boxes, sequenced deepest & heaviest first`, "success");
  };

  // Operator-facing output: a printable visual loading guide (top-down map +
  // step cards) built from the same physics-aware manifest.
  const handlePrintGuide = () => {
    if (!selectedContainer || itemsForSelected.length === 0) return;
    const manifest = manifestFromPlan(itemsForSelected, selectedContainer);
    openLoadingGuide(manifest, { vehicle: `${selectedContainer.name} (${selectedContainer.code})` });
    toast("Loading guide opened — printable for the dock crew", "info");
  };

  const setPreset = (p) => {
    setViewPreset(p);
    setPresetKey((k) => k + 1);
  };

  const onBoxLanded = useCallback((seq) => {
    setLandedCount((c) => Math.max(c, seq + 1));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Load Simulator
            <span className="ai-badge"><Cpu size={11} /> AI Powered</span>
          </h1>
          <p className="page-subtitle">Digital-twin bin packing — volume-based, scheduler fills loaded vehicles first</p>
        </div>
        <Link to="/camera">
          <button className="btn-secondary"><Camera size={15} /> Open Scan Station</button>
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "370px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ---- Scheduler / queue ---- */}
          <div className="card flush">
            <div className="card-header">
              <h3><Zap size={13} /> Packing Queue</h3>
              <div className="spacer" />
              {pendingBoxes.length > 0 && <span className="pulse-dot" />}
              <span className="mono-num" style={{ fontSize: 11, color: "var(--text-muted)" }}>{pendingBoxes.length}</span>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <div style={{
                maxHeight: 160, overflowY: "auto",
                borderRadius: 6, border: "1px solid var(--border-color)", marginBottom: 12,
              }}>
                {pendingBoxes.length > 0 ? pendingBoxes.map((box, i) => (
                  <div key={box.id} className="queue-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span className="queue-index">{i + 1}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {box.label || `Box ${box.id.substring(0, 6)}`}
                      </span>
                    </div>
                    <span className="mono-num" style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                      {Number(box.length_cm)}×{Number(box.width_cm)}×{Number(box.height_cm)}
                    </span>
                  </div>
                )) : (
                  <div className="empty-state" style={{ padding: 18 }}>
                    Queue is empty — scan a box to feed the packer
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  className="btn-cta"
                  style={{ flex: 1 }}
                  onClick={runPack}
                  disabled={pendingBoxes.length === 0 || isPacking}
                >
                  {isPacking ? <RefreshCw size={15} className="spin" /> : <Box size={15} />}
                  AI Auto-Pack
                </button>
                <button
                  className="btn-secondary"
                  onClick={handlePickBestVehicle}
                  title="Recommend the best-fit vehicle for the queue"
                >
                  <Sparkles size={15} />
                </button>
              </div>

              <label style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                textTransform: "none", letterSpacing: 0, fontSize: 12, fontWeight: 500, margin: 0,
                color: "var(--text-secondary)",
              }}>
                <input
                  type="checkbox"
                  checked={autoPack}
                  onChange={(e) => setAutoPack(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Auto-pack as boxes arrive
              </label>
            </div>
          </div>

          {/* ---- Fleet nodes ---- */}
          <div className="card flush">
            <div className="card-header">
              <h3><Truck size={13} /> Fleet Scheduler</h3>
              <div className="spacer" />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>best-fit · volume-based</span>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 12px" }}>
                Like a k8s scheduler: partially loaded vehicles fill first; full ones are skipped automatically
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {rankedContainers.map((c) => {
                  const utilization = 1 - c.remainingRatio;
                  return (
                    <div
                      key={c.id}
                      className={[
                        "node-card",
                        c.id === selectedId ? "selected" : "",
                        c.id === recommendedId ? "recommended" : "",
                        !c.eligible && pendingBoxes.length > 0 ? "ineligible" : "",
                      ].join(" ")}
                      onClick={() => { setSelectedId(c.id); setAnimKey((k) => k + 1); }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <span
                          className="status-dot"
                          title={c.status}
                          style={{
                            background:
                              c.status === "shipped" ? "var(--info)"
                              : c.status === "full" ? "var(--danger)"
                              : c.status === "loading" ? "var(--warning)"
                              : "var(--success)",
                          }}
                        />
                      </div>
                      <div className="mono-num" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {Number(c.length_cm)}×{Number(c.width_cm)}×{Number(c.height_cm)} cm
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${Math.min(utilization * 100, 100)}%`, background: utilization > 0.9 ? "var(--success)" : "var(--accent)" }}
                          />
                        </div>
                        <span className="mono-num" style={{ fontSize: 10 }}>{Math.round(utilization * 100)}%</span>
                      </div>
                    </div>
                  );
                })}
                {rankedContainers.length === 0 && (
                  <p className="empty-state" style={{ gridColumn: "1 / -1", padding: 12 }}>No available vehicles — add one in Inventory</p>
                )}
              </div>
            </div>
          </div>

          {/* ---- Selected vehicle ---- */}
          {selectedContainer && (
            <div className="card flush">
              <div className="card-header">
                <h3><ListOrdered size={13} /> {selectedContainer.code} — Load Plan</h3>
              </div>
              <div className="card-body" style={{ paddingTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: 12, background: "var(--bg-surface)", borderRadius: 6 }}>
                    <div className="label-caps">Boxes Loaded</div>
                    <div className="mono-num" style={{ fontSize: 22, fontWeight: 700 }}>{totalBoxesLoaded}</div>
                  </div>
                  <div style={{ padding: 12, background: "var(--bg-surface)", borderRadius: 6 }}>
                    <div className="label-caps">Volume Used</div>
                    <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: currentUtilization > 0.9 ? "var(--success-ink)" : "inherit" }}>
                      {(currentUtilization * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {itemsForSelected.length > 0 && (
                  <details open={itemsForSelected.length <= 8} style={{ marginBottom: 12 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Loading sequence — {Math.min(landedCount, itemsForSelected.length)}/{itemsForSelected.length} placed
                    </summary>
                    <div style={{
                      maxHeight: 190, overflowY: "auto", marginTop: 8,
                      borderRadius: 6, border: "1px solid var(--border-color)",
                    }}>
                      {itemsForSelected.map((item, i) => (
                        <div
                          key={item.id ?? i}
                          className={`queue-row ${i < landedCount ? "done" : i === landedCount ? "active-step" : ""}`}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span className="queue-index">{i + 1}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.boxLabel || `Box ${String(item.box_id).substring(0, 6)}`}
                            </span>
                          </div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <span className="mono-num" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              @ {Math.round(item.pos_x)},{Math.round(item.pos_y)},{Math.round(item.pos_z)}
                            </span>
                            {selectedContainer.status !== "shipped" && !dispatching && (
                              <button
                                onClick={() => handleRemoveItem(item)}
                                title="Remove from plan — box returns to the queue"
                                style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 20, height: 20, padding: 0, borderRadius: 5,
                                  background: "transparent", border: "1px solid var(--border-color)",
                                  color: "var(--text-muted)", cursor: "pointer",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.borderColor = "var(--danger)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                              >
                                <X size={11} />
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {totalBoxesLoaded > 0 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button
                      className="btn-cta"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={handlePrintGuide}
                      title="Open a printable, visual loading guide for the dock crew: top-down map + step-by-step, deepest & heaviest first"
                    >
                      <Printer size={14} /> Print Loading Guide
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ justifyContent: "center" }}
                      onClick={handleDownloadManifest}
                      title="Export the raw manifest CSV (for systems / records)"
                    >
                      <FileDown size={14} /> CSV
                    </button>
                  </div>
                )}

                {selectedContainer.status === "shipped" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-cta"
                      style={{ flex: 1 }}
                      onClick={() => handleRecall(selectedContainer.id)}
                      title="Bring the vehicle back to the dock with its load intact"
                    >
                      <Undo2 size={14} /> Recall Shipment
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleResetContainer(selectedContainer.id)}
                      title="Cancel the shipment entirely — empty the vehicle, boxes return to the queue"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ) : totalBoxesLoaded > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-cta"
                      style={{ flex: 1 }}
                      onClick={() => handleDispatch(selectedContainer.id)}
                      disabled={dispatching}
                    >
                      <Send size={14} /> {isDispatchingSelected ? "Releasing..." : "Dispatch"}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleResetContainer(selectedContainer.id)}
                      disabled={dispatching}
                      title="Empty this vehicle and return boxes to the queue"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---- 3D viewer ---- */}
        <div className="card flush" style={{ position: "sticky", top: 0 }}>
          <div style={{ position: "relative", height: "calc(100vh - 150px)", minHeight: 560 }}>
            {selectedContainer && (
              <>
                <div className="viewer-hud top-left">
                  <span className="hud-chip mono-num">{selectedContainer.code}</span>
                  <span className="hud-chip mono-num">{totalBoxesLoaded} boxes</span>
                  <span className="hud-chip mono-num">{(currentUtilization * 100).toFixed(1)}% vol</span>
                </div>
                <div className="viewer-hud top-right">
                  {["iso", "top", "side", "rear", "cab"].map((p) => (
                    <button
                      key={p}
                      className={`hud-btn ${viewPreset === p ? "active" : ""}`}
                      onClick={() => setPreset(p)}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="viewer-hud bottom-right">
                  <button className={`hud-btn ${xray ? "active" : ""}`} onClick={() => setXray((v) => !v)} title="See through the container walls">
                    <Scan size={11} /> X-RAY
                  </button>
                  <button className="hud-btn" onClick={() => setAnimKey((k) => k + 1)} title="Replay the loading animation">
                    <RefreshCw size={11} /> REPLAY
                  </button>
                </div>
                <div className="viewer-hud bottom-left">
                  <span className="hud-chip">Drag to orbit · Scroll to zoom · Hover a box</span>
                </div>
              </>
            )}
            <Container3D
              key={`${animKey}-${selectedId}`}
              container={selectedContainer}
              items={itemsForSelected}
              isDispatching={isDispatchingSelected}
              onDispatchDone={finishDispatch}
              viewPreset={viewPreset}
              presetKey={presetKey}
              xray={xray}
              onBoxLanded={onBoxLanded}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
