import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import { Truck, PackageCheck, Loader, PackageX } from "lucide-react";

function ContainerModal({ container, onClose, onSaved }) {
  const isEdit = !!container;
  const [form, setForm] = useState({
    code: container?.code || "",
    name: container?.name || "",
    length_cm: container?.length_cm || "",
    width_cm: container?.width_cm || "",
    height_cm: container?.height_cm || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        length_cm: parseFloat(form.length_cm),
        width_cm: parseFloat(form.width_cm),
        height_cm: parseFloat(form.height_cm),
      };
      if (isEdit) {
        await api.updateContainer(container.id, payload);
      } else {
        await api.createContainer(payload);
      }
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Edit Container" : "Add Container"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="form-group">
              <label>Length (cm)</label>
              <input type="number" value={form.length_cm} onChange={(e) => setForm({ ...form, length_cm: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Width (cm)</label>
              <input type="number" value={form.width_cm} onChange={(e) => setForm({ ...form, width_cm: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Height (cm)</label>
              <input type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} required />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShipmentModal({ shipment, containers, onClose, onSaved }) {
  const isEdit = !!shipment;
  const [form, setForm] = useState({
    container_id: shipment?.container_id || "",
    destination: shipment?.destination || "",
    scheduled_date: shipment?.scheduled_date ? new Date(shipment.scheduled_date).toISOString().slice(0, 16) : "",
    status: shipment?.status || "scheduled",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateShipment(shipment.id, {
          destination: form.destination,
          scheduled_date: new Date(form.scheduled_date).toISOString(),
          status: form.status,
        });
      } else {
        await api.createShipment({
          container_id: form.container_id,
          destination: form.destination,
          scheduled_date: new Date(form.scheduled_date).toISOString(),
        });
      }
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Edit Shipment" : "Schedule Shipment"}</h2>
        <form onSubmit={handleSubmit}>
          {!isEdit && (
            <div className="form-group">
              <label>Container</label>
              <select value={form.container_id} onChange={(e) => setForm({ ...form, container_id: e.target.value })} required>
                <option value="">Select a container</option>
                {containers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Destination</label>
            <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Scheduled Date</label>
              <input type="datetime-local" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} required />
            </div>
            {isEdit && (
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="scheduled">Scheduled</option>
                  <option value="shipped">Shipped</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const KPI_DEFS = [
  { key: "total", label: "Total Fleet", icon: Truck, color: "var(--accent-blue)" },
  { key: "available", label: "Available", icon: PackageCheck, color: "var(--success)" },
  { key: "loading", label: "Loading", icon: Loader, color: "var(--warning)" },
  { key: "full", label: "Full", icon: PackageX, color: "var(--danger)" },
];

export default function Inventory() {
  const toast = useToast();
  const [containers, setContainers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [containerModal, setContainerModal] = useState(null);
  const [shipmentModal, setShipmentModal] = useState(null);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [showShipmentForm, setShowShipmentForm] = useState(false);

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([api.listInventoryContainers(), api.listShipments()]);
    setContainers(c);
    setShipments(s);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const kpis = useMemo(() => ({
    total: containers.length,
    available: containers.filter((c) => c.status === "available").length,
    loading: containers.filter((c) => c.status === "loading").length,
    full: containers.filter((c) => c.status === "full").length,
  }), [containers]);

  const handleDeleteContainer = async (id) => {
    if (!confirm("Delete this container?")) return;
    try {
      await api.deleteContainer(id);
      toast("Container deleted", "info");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleDeleteShipment = async (id) => {
    if (!confirm("Delete this shipment?")) return;
    try {
      await api.deleteShipment(id);
      toast("Shipment deleted", "info");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Manage your fleet vehicles and scheduled shipments</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {KPI_DEFS.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
            <div className="stat-icon" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
              <Icon size={18} />
            </div>
            <div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700 }}>{kpis[key]}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 className="section-title">Fleet Containers</h2>
          <button className="btn-cta" onClick={() => { setContainerModal(null); setShowContainerForm(true); }}>+ Add Container</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>L × W × H (cm)</th>
                <th>Max Volume</th>
                <th>Load</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map(c => {
                const util = c.max_volume_cm3 > 0 ? (Number(c.used_volume_cm3) / Number(c.max_volume_cm3)) * 100 : 0;
                return (
                <tr key={c.id}>
                  <td><span className="mono">{c.code}</span></td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="mono-num">{Number(c.length_cm)} × {Number(c.width_cm)} × {Number(c.height_cm)}</td>
                  <td className="mono-num">{(c.max_volume_cm3 / 1000000).toFixed(2)} m³</td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.min(util, 100)}%`, background: util > 90 ? "var(--success)" : "var(--accent-blue)" }} />
                      </div>
                      <span className="mono-num" style={{ fontSize: 11 }}>{Math.round(util)}%</span>
                    </div>
                  </td>
                  <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-secondary btn-sm" onClick={() => { setContainerModal(c); setShowContainerForm(true); }}>Edit</button>
                      <button className="btn-danger btn-sm" onClick={() => handleDeleteContainer(c.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {containers.length === 0 && (
                <tr><td colSpan={7} className="empty-state">No vehicles yet — add your first container</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 className="section-title">Scheduled Shipments</h2>
          <button className="btn-cta" onClick={() => { setShipmentModal(null); setShowShipmentForm(true); }}>+ Schedule Shipment</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Destination</th>
                <th>Scheduled Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.destination}</td>
                  <td>{new Date(s.scheduled_date).toLocaleString()}</td>
                  <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-secondary btn-sm" onClick={() => { setShipmentModal(s); setShowShipmentForm(true); }}>Edit</button>
                      <button className="btn-danger btn-sm" onClick={() => handleDeleteShipment(s.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shipments.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 32 }}>No shipments scheduled</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showContainerForm && (
        <ContainerModal
          container={containerModal}
          onClose={() => setShowContainerForm(false)}
          onSaved={() => { setShowContainerForm(false); refresh(); }}
        />
      )}

      {showShipmentForm && (
        <ShipmentModal
          shipment={shipmentModal}
          containers={containers}
          onClose={() => setShowShipmentForm(false)}
          onSaved={() => { setShowShipmentForm(false); refresh(); }}
        />
      )}
    </div>
  );
}
