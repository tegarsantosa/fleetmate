import React, { useEffect, useState, useMemo } from "react";
import Container3D from "../components/Container3D.jsx";
import { api, packing } from "../lib/api.js";

export default function Visualizer() {
  const [containers, setContainers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState(null);

  const refresh = async () => {
    const [containerList, planList, pendingBoxes] = await Promise.all([
      api.listContainers(),
      api.listPlans(),
      api.listBoxes("pending"),
    ]);

    setContainers(containerList);
    setPlans(planList);
    setPendingCount(pendingBoxes.length);

    setSelectedId((prev) =>
      prev == null && containerList.length > 0
        ? containerList[0].id
        : prev
    );
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleRunPacking = async () => {
    setRunning(true);
    setError(null);
    try {
      await packing.run();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const selectedContainer = containers.find((c) => c.id === selectedId) || null;

  const itemsForSelected = useMemo(() => {
    return plans
      .filter((p) => p.container_id === selectedId)
      .flatMap((p) => p.items);
  }, [plans, selectedId]);

  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Fleet Inventory</h3>
          <p style={{ color: "#9aa4b8", marginTop: -8 }}>
            {pendingCount} box(es) waiting to be packed
          </p>
          <button onClick={handleRunPacking} disabled={running || pendingCount === 0}>
            {running ? "Optimizing..." : "Run Smart Packing"}
          </button>
          {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
        </div>

        <div className="card">
          <h3>Containers</h3>
          <div className="container-list">
            {containers.map((c) => {
              const utilization = c.max_volume_cm3 > 0 ? c.used_volume_cm3 / c.max_volume_cm3 : 0;
              return (
                <div
                  key={c.id}
                  className={`container-row ${c.id === selectedId ? "selected" : ""}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#9aa4b8" }}>{c.code}</div>
                  </div>
                  <span className={`badge ${c.status}`}>{c.status}</span>
                  <div className="utilization-bar">
                    <div
                      className="utilization-fill"
                      style={{ width: `${Math.min(utilization * 100, 100)}%` }}
                    />
                  </div>
                  <div style={{ fontSize: 12, width: 48, textAlign: "right" }}>
                    {Math.round(utilization * 100)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{selectedContainer ? selectedContainer.name : "Load Plan"}</h3>
        <Container3D container={selectedContainer} items={itemsForSelected} />
      </div>
    </div>
  );
}
