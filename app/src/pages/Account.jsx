import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export default function Account() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getMe().then((data) => {
      setUser(data);
      setForm({ username: data.username, email: data.email });
    }).catch(console.error);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateMe(form);
      setUser(updated);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="page"><p style={{ color: "var(--text-secondary)" }}>Loading account...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Settings</h1>
          <p className="page-subtitle">Manage your profile information</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Profile</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, marginTop: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent) 0%, #a855f7 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, color: "white"
            }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user.username}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{user.email}</div>
            </div>
          </div>

          {editing ? (
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Username</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-actions" style={{ justifyContent: "flex-start" }}>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setForm({ username: user.username, email: user.email }); }}>Cancel</button>
              </div>
            </form>
          ) : (
            <div>
              <div className="form-group">
                <label>Username</label>
                <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius)", fontSize: 13 }}>{user.username}</div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius)", fontSize: 13 }}>{user.email}</div>
              </div>
              <div className="form-group">
                <label>Member Since</label>
                <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius)", fontSize: 13 }}>{new Date(user.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn-primary" onClick={() => setEditing(true)}>Edit Profile</button>
                {saved && <span style={{ color: "var(--success)", fontSize: 13, alignSelf: "center" }}>✓ Saved</span>}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Security</h3>
          <div style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Password</label>
              <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius)", fontSize: 13, color: "var(--text-secondary)" }}>••••••••••••</div>
            </div>
            <button className="btn-secondary" disabled>Change Password</button>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>Password management is handled by your identity provider.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
