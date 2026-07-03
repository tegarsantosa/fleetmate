import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Container3D from "../components/Container3D.jsx";
import { api, packing } from "../lib/api.js";

export default function Visualizer() {
  const [containers, setContainers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchAnimId, setDispatchAnimId] = useState(null);

  const refresh = useCallback(async () => {
    const [containerList, planList, pendingBoxes] = await Promise.all([
      api.listContainers(),
      api.listPlans(),
      api.listBoxes("pending"),
    ]);
    const available = containerList.filter(c => c.status !== "shipped");
    setContainers(available);
    setPlans(planList);
    setPendingCount(pendingBoxes.length);
    setSelectedId((prev) => {
      if (prev == null && available.length > 0) return available[0].id;
      if (available.find(c => c.id === prev)) return prev;
      return available.length > 0 ? available[0].id : null;
    });
    return pendingBoxes.length;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let isPacking = false;

    const poll = async () => {
      if (cancelled || isPacking) return;
      try {
        const count = await refresh();
        if (count > 0 && !cancelled) {
          isPacking = true;
          await packing.run();
          await refresh();
          isPacking = false;
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
        isPacking = false;
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [refresh]);

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
          <h1 className="page-title">Load Simulator</h1>
          <p className="page-subtitle">AI-powered 3D bin packing visualization</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {pendingCount > 0 ? (
            <span className="info-chip">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)", animation: "pulse 1s infinite" }} />
              Packing {pendingCount} box(es)...
            </span>
          ) : (
            <span className="info-chip" style={{ background: "var(--success-soft)", color: "var(--success)", borderColor: "rgba(34, 197, 94, 0.2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", animation: "pulse 2s infinite" }} />
              Listening for scans
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--danger-soft)", color: "var(--danger)", padding: "10px 16px", borderRadius: "var(--radius)", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h3>Fleet Containers</h3>
            <div className="container-list" style={{ marginTop: 10 }}>
              {containers.map((c) => {
                const utilization = c.max_volume_cm3 > 0 ? c.used_volume_cm3 / c.max_volume_cm3 : 0;
                return (
                  <div
                    key={c.id}
                    className={`container-row ${c.id === selectedId ? "selected" : ""}`}
                    onClick={() => { setSelectedId(c.id); setAnimKey((k) => k + 1); }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{c.code}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <div className="utilization-bar" style={{ flex: 1 }}>
                          <div className="utilization-fill" style={{ width: `${Math.min(utilization * 100, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 32, textAlign: "right" }}>
                          {Math.round(utilization * 100)}%
                        </span>
                      </div>
                    </div>
                    <span className={`badge ${c.status}`}>{c.status}</span>
                  </div>
                );
              })}
              {containers.length === 0 && (
                <p style={{ color: "var(--text-secondary)", fontSize: 13, padding: 12 }}>No available containers</p>
              )}
            </div>
          </div>

          {selectedContainer && (
            <div className="card">
              <h3>Load Info</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                <div className="info-chip">
                  Dimensions: <strong>{selectedContainer.length_cm} × {selectedContainer.width_cm} × {selectedContainer.height_cm} cm</strong>
                </div>
                <div className="info-chip">
                  Max Volume: <strong>{(selectedContainer.max_volume_cm3 / 1000000).toFixed(2)} m³</strong>
                </div>
                {totalBoxesLoaded > 0 ? (
                  <>
                    <div className="info-chip">
                      Boxes Loaded: <strong>{totalBoxesLoaded}</strong>
                    </div>
                    <div className="info-chip">
                      Utilization: <strong>{(currentUtilization * 100).toFixed(1)}%</strong>
                    </div>
                  </>
                ) : (
                  <div className="info-chip">
                    Status: <strong>Empty. Ready to pack</strong>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {totalBoxesLoaded > 0 && (
                  <button
                    className="btn-success btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleDispatch(selectedContainer.id)}
                    disabled={dispatching}
                  >
                    {isDispatching ? "🚛 Releasing..." : "🚛 Release Shipment"}
                  </button>
                )}
                {totalBoxesLoaded > 0 && (
                  <button
                    className="btn-danger btn-sm"
                    style={{ flex: 1 }}
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

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <Container3D key={animKey} container={selectedContainer} items={itemsForSelected} isDispatching={isDispatching} />
        </div>
      </div>
    </div>
  );
}
