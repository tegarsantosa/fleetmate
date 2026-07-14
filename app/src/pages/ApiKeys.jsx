import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const refresh = () => {
    api.listApiKeys().then(setKeys).catch(console.error);
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createApiKey({ name: newName.trim() });
      setNewName("");
      setShowCreate(false);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm("Revoke this API key? This action cannot be undone.")) return;
    await api.deleteApiKey(id);
    refresh();
  };

  const handleCopy = (key, id) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">API Keys</h1>
          <p className="page-subtitle">Manage integration keys for 3rd-party ERP applications</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Generate Key</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Created</th>
              <th>Last Used</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id}>
                <td style={{ fontWeight: 600 }}>{k.name}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code className="mono" style={{ background: "var(--bg-surface)", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
                      {k.key.slice(0, 12)}...{k.key.slice(-4)}
                    </code>
                    <button className="btn-secondary btn-sm" onClick={() => handleCopy(k.key, k.id)}>
                      {copiedId === k.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </td>
                <td>{new Date(k.created_at).toLocaleDateString()}</td>
                <td>{k.last_used ? new Date(k.last_used).toLocaleDateString() : "Never"}</td>
                <td>
                  <div className="actions-cell">
                    <button className="btn-danger btn-sm" onClick={() => handleRevoke(k.id)}>Revoke</button>
                  </div>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 48 }}>No API keys created yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Generate New API Key</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Key Name</label>
                <input
                  placeholder="e.g. SAP Integration, WMS Connector"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Generating..." : "Generate"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
