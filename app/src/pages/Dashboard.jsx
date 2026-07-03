import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    api.getDashboard().then(setStats).catch(console.error);
    api.listContainers().then(setContainers).catch(console.error);
  }, []);

  if (!stats) {
    return <div className="page"><p style={{ color: "var(--text-secondary)" }}>Loading dashboard...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time overview of your fleet operations</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <div className="card card-hover">
          <div className="stat-icon blue">📦</div>
          <h3>Boxes Scanned</h3>
          <p className="stat-value">{stats.total_boxes}</p>
        </div>
        <div className="card card-hover">
          <div className="stat-icon green">🚛</div>
          <h3>Fleet Containers</h3>
          <p className="stat-value">{stats.total_containers}</p>
        </div>
        <div className="card card-hover">
          <div className="stat-icon yellow">📋</div>
          <h3>Shipments</h3>
          <p className="stat-value">{stats.total_shipments}</p>
        </div>
        <div className="card card-hover">
          <div className="stat-icon red">📊</div>
          <h3>Avg Utilization</h3>
          <p className="stat-value">{stats.avg_utilization_percent}%</p>
        </div>
      </div>

      <div className="card">
        <h3>Fleet Status</h3>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Dimensions (cm)</th>
                <th>Volume</th>
                <th>Utilization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {containers.map(c => {
                const util = c.max_volume_cm3 > 0 ? (c.used_volume_cm3 / c.max_volume_cm3 * 100) : 0;
                return (
                  <tr key={c.id}>
                    <td><span className="mono">{c.code}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.length_cm} × {c.width_cm} × {c.height_cm}</td>
                    <td>{(c.max_volume_cm3 / 1000000).toFixed(2)} m³</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="utilization-bar">
                          <div className="utilization-fill" style={{ width: `${Math.min(util, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{Math.round(util)}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
