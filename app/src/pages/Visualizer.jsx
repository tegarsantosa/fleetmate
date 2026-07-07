import React, { useEffect, useState, useMemo, useCallback } from "react";
import Container3D from "../components/Container3D.jsx";
import { api, packing } from "../lib/api.js";
import { Camera, Zap, RefreshCw, Truck, Box, Cpu } from "lucide-react";

export default function Visualizer() {
  const [containers, setContainers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pendingBoxes, setPendingBoxes] = useState([]);
  const [error, setError] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchAnimId, setDispatchAnimId] = useState(null);
  const [isPacking, setIsPacking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [containerList, planList, pendingBoxesData] = await Promise.all([
        api.listContainers(),
        api.listPlans(),
        api.listBoxes("pending"),
      ]);
      const available = containerList.filter(c => c.status !== "shipped");
      setContainers(available);
      setPlans(planList);
      
      // Sort pending boxes by created_at ascending (FIFO)
      const sortedBoxes = pendingBoxesData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setPendingBoxes(sortedBoxes);
      
      setSelectedId((prev) => {
        if (prev == null && available.length > 0) return available[0].id;
        if (available.find(c => c.id === prev)) return prev;
        return available.length > 0 ? available[0].id : null;
      });
      return sortedBoxes.length;
    } catch (err) {
      setError(err.message);
      return 0;
    }
  }, []);

  // Poll only for boxes count and status updates
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      await refresh();
    };

    poll();
    const interval = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [refresh]);

  const handleManualPack = async () => {
    setIsPacking(true);
    try {
      await packing.run();
      await refresh();
      setAnimKey(k => k + 1); // re-trigger drops
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPacking(false);
    }
  };

  const handlePickBestVehicle = () => {
    const eligible = containers.filter(c => c.status !== 'shipped' && c.status !== 'full');
    if (eligible.length > 0) {
      eligible.sort((a, b) => (b.max_volume_cm3 - b.used_volume_cm3) - (a.max_volume_cm3 - a.used_volume_cm3));
      setSelectedId(eligible[0].id);
    }
  };

  const handleResetContainer = async (id) => {
    await api.resetContainer(id);
    await refresh();
    setAnimKey((k) => k + 1);
  };

  const handleDispatch = async (id) => {
    setDispatching(true);
    setDispatchAnimId(id);
    setTimeout(async () => {
      try {
        await api.dispatchContainer(id);
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setDispatching(false);
        setDispatchAnimId(null);
        setAnimKey((k) => k + 1);
      }
    }, 3500);
  };

  const selectedContainer = containers.find((c) => c.id === selectedId) || null;

  const itemsForSelected = useMemo(() => {
    const containerPlans = plans
      .filter((p) => p.container_id === selectedId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let idx = 0;
    return containerPlans.flatMap((p) =>
      p.items.map(item => ({ ...item, colorIndex: idx++ }))
    );
  }, [plans, selectedId]);

  const containerPlans = plans.filter((p) => p.container_id === selectedId);
  const totalBoxesLoaded = containerPlans.reduce((sum, p) => sum + p.box_count, 0);
  const currentUtilization = selectedContainer && selectedContainer.max_volume_cm3 > 0
    ? (selectedContainer.used_volume_cm3 / selectedContainer.max_volume_cm3)
    : 0;

  const isDispatching = dispatchAnimId === selectedId;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            Load Simulator
            <span style={{ fontSize: 10, padding: "4px 8px", background: "var(--accent-blue)", color: "#fff", borderRadius: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <Cpu size={12} /> AI Powered
            </span>
          </h1>
          <p className="page-subtitle">Digital-twin 3D bin packing engine</p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button className="btn-primary" style={{ background: "var(--accent-blue)" }} onClick={() => window.location.href = '/camera'}>
            <Camera size={16} /> Open Camera Scan
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--danger)", color: "#fff", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div className="card" style={{ background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(138, 129, 255, 0.05) 100%)", border: "1px solid var(--accent-blue)" }}>
            <h3 style={{ color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Zap size={16} /> Pending Boxes Queue
            </h3>
            
            <div style={{ 
              maxHeight: 180, 
              overflowY: "auto", 
              background: "var(--bg-primary)", 
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              marginBottom: 16
            }}>
              {pendingBoxes.length > 0 ? pendingBoxes.map((box, i) => (
                <div key={box.id} style={{ 
                  padding: "8px 12px", 
                  borderBottom: "1px solid var(--border-color)", 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 12, background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{box.label || `Box ${box.id.substring(0,6)}`}</span>
                  </div>
                  <div className="mono-num" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {box.length_cm} &times; {box.width_cm} &times; {box.height_cm} cm
                  </div>
                </div>
              )) : (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                  No boxes waiting to be packed
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button 
                className="btn-primary" 
                style={{ flex: 1, background: "var(--accent-blue)" }}
                onClick={handleManualPack}
                disabled={pendingBoxes.length === 0 || isPacking}
              >
                {isPacking ? <RefreshCw size={16} className="spin" /> : <Box size={16} />}
                Pack Collected Boxes
              </button>
              <button 
                className="btn-secondary" 
                style={{ padding: "8px 12px" }}
                onClick={handlePickBestVehicle}
                title="Pick Best Fit Vehicle"
              >
                <Truck size={16} />
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Vehicle Picker</h3>
            <div className="container-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {containers.map((c) => {
                const utilization = c.max_volume_cm3 > 0 ? c.used_volume_cm3 / c.max_volume_cm3 : 0;
                return (
                  <div
                    key={c.id}
                    className={`container-row ${c.id === selectedId ? "selected" : ""}`}
                    onClick={() => { setSelectedId(c.id); setAnimKey((k) => k + 1); }}
                    style={{ padding: 12, border: "1px solid var(--border-color)", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.status === "full" ? "var(--danger)" : "var(--success)" }} title={c.status} />
                    </div>
                    <div className="mono-num" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {c.length_cm} &times; {c.width_cm} &times; {c.height_cm} cm
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 4, background: "var(--bg-primary)", flex: 1, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(utilization * 100, 100)}%`, height: "100%", background: utilization > 0.9 ? "var(--success)" : "var(--accent-blue)" }} />
                      </div>
                      <span className="mono-num" style={{ fontSize: 10 }}>{Math.round(utilization * 100)}%</span>
                    </div>
                  </div>
                );
              })}
              {containers.length === 0 && (
                <p style={{ color: "var(--text-secondary)", fontSize: 13, padding: 12, gridColumn: "1 / -1" }}>No available vehicles</p>
              )}
            </div>
          </div>

          {selectedContainer && (
            <div className="card">
              <h3>Load Plan Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, background: "var(--bg-surface)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>Boxes Loaded</div>
                  <div className="mono-num" style={{ fontSize: 24, fontWeight: 700 }}>{totalBoxesLoaded}</div>
                </div>
                <div style={{ padding: 12, background: "var(--bg-surface)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>Space Used</div>
                  <div className="mono-num" style={{ fontSize: 24, fontWeight: 700, color: currentUtilization > 0.9 ? "var(--success)" : "inherit" }}>
                    {(currentUtilization * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {totalBoxesLoaded > 0 && (
                  <button
                    className="btn-success"
                    style={{ flex: 1 }}
                    onClick={() => handleDispatch(selectedContainer.id)}
                    disabled={dispatching}
                  >
                    {isDispatching ? "Releasing..." : "Release Shipment"}
                  </button>
                )}
                {totalBoxesLoaded > 0 && (
                  <button
                    className="btn-secondary"
                    onClick={() => handleResetContainer(selectedContainer.id)}
                    disabled={dispatching}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden", height: "100%" }}>
          <Container3D key={animKey} container={selectedContainer} items={itemsForSelected} isDispatching={isDispatching} />
        </div>
      </div>
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .container-row:hover { border-color: var(--accent-blue); background: var(--bg-surface); }
        .container-row.selected { border-color: var(--accent-blue); background: var(--bg-surface); box-shadow: 0 0 0 1px var(--accent-blue); }
      `}</style>
    </div>
  );
}
