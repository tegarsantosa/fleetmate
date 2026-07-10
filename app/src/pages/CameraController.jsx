import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { vision, api, API_BASE_URL } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import {
  Camera, Cpu, ScanLine, Ruler, ArrowRight, Plug, Unplug, RefreshCw, PencilRuler,
} from "lucide-react";

const DEFAULT_TOP = "http://fleetmate-cam-C414.local";
const DEFAULT_SIDE = "http://fleetmate-cam-0C1F.local";

function captureFrame(imgEl, canvasEl) {
  if (!imgEl || !canvasEl || !imgEl.complete) return null;
  const ctx = canvasEl.getContext("2d");
  canvasEl.width = imgEl.naturalWidth || 640;
  canvasEl.height = imgEl.naturalHeight || 480;
  ctx.drawImage(imgEl, 0, 0, canvasEl.width, canvasEl.height);
  return new Promise((resolve) => canvasEl.toBlob(resolve, "image/jpeg", 0.92));
}

function mediaUrl(path) {
  if (!path) return null;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function StreamCard({ title, url, imgRef, canvasRef }) {
  return (
    <div className="card">
      <h3>
        <Camera size={13} /> {title}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--success)" }}>
          <span className="pulse-dot" /> LIVE
        </span>
      </h3>
      <div style={{ marginTop: 12 }}>
        <img ref={imgRef} src={url} alt={`${title} stream`} crossOrigin="anonymous" className="stream-frame" />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}

export default function CameraController() {
  const toast = useToast();
  const [topUrl, setTopUrl] = useState(DEFAULT_TOP);
  const [sideUrl, setSideUrl] = useState(DEFAULT_SIDE);
  const [connected, setConnected] = useState(false);
  const [label, setLabel] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [recentBoxes, setRecentBoxes] = useState([]);
  const [manual, setManual] = useState({ length_cm: "", width_cm: "", height_cm: "" });
  const [savingManual, setSavingManual] = useState(false);

  const topImgRef = useRef(null);
  const sideImgRef = useRef(null);
  const topCanvasRef = useRef(null);
  const sideCanvasRef = useRef(null);

  const refreshRecent = () => {
    api.listBoxes()
      .then((boxes) => {
        const sorted = boxes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRecentBoxes(sorted.slice(0, 6));
      })
      .catch(() => {});
  };

  useEffect(refreshRecent, []);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const topBlob = await captureFrame(topImgRef.current, topCanvasRef.current);
      const sideBlob = await captureFrame(sideImgRef.current, sideCanvasRef.current);
      if (!topBlob) throw new Error("Top camera frame not ready");
      const result = await vision.scan(topBlob, sideBlob, label || undefined);
      setLastResult(result);
      setLabel("");
      refreshRecent();
      toast(`Measured ${result.box.length_cm} × ${result.box.width_cm} × ${result.box.height_cm} cm — queued for packing`, "success");
    } catch (err) {
      setError(err.message);
      toast("Scan failed", "error");
    } finally {
      setScanning(false);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    setSavingManual(true);
    try {
      const box = await api.createBox({
        label: label || null,
        length_cm: parseFloat(manual.length_cm),
        width_cm: parseFloat(manual.width_cm),
        height_cm: parseFloat(manual.height_cm),
        confidence: 0,
      });
      setManual({ length_cm: "", width_cm: "", height_cm: "" });
      setLabel("");
      refreshRecent();
      toast(`Box ${box.label || box.id.substring(0, 6)} added to the queue`, "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            AI Scan Station
            <span className="ai-badge"><Cpu size={11} /> Vision</span>
          </h1>
          <p className="page-subtitle">Stereo camera rig measures each box and turns it into a digital asset</p>
        </div>
        {connected && (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-cta" onClick={handleScan} disabled={scanning}>
              {scanning ? <RefreshCw size={15} className="spin" /> : <ScanLine size={15} />}
              {scanning ? "Measuring..." : "Capture & Measure"}
            </button>
            <button className="btn-secondary" onClick={() => { setConnected(false); setLastResult(null); }}>
              <Unplug size={15} /> Disconnect
            </button>
          </div>
        )}
      </div>

      <div className="stepper" style={{ marginBottom: 18 }}>
        <span className={`step ${!connected ? "on" : ""}`}><span className="n">1</span> Connect rig</span>
        <span className="step-line" />
        <span className={`step ${connected && !lastResult ? "on" : ""}`}><span className="n">2</span> Position the box</span>
        <span className="step-line" />
        <span className={`step ${lastResult ? "on" : ""}`}><span className="n">3</span> Capture &amp; queue</span>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3><Plug size={13} /> Camera Rig</h3>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>Top Camera URL</label>
            <input value={topUrl} onChange={(e) => setTopUrl(e.target.value)} placeholder="http://192.168.1.50:81/stream" />
          </div>
          <div className="form-group">
            <label>Side Camera URL</label>
            <input value={sideUrl} onChange={(e) => setSideUrl(e.target.value)} placeholder="http://192.168.1.51:81/stream" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!connected && (
            <button className="btn-cta" onClick={() => { setError(null); setConnected(true); }}>
              <Plug size={15} /> Connect Cameras
            </button>
          )}
          <div style={{ flex: 1 }}>
            <input placeholder="Box label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          {connected && (
            <span className="info-chip" style={{ flexShrink: 0 }}>
              <span className="status-dot" style={{ background: "var(--success)" }} /> Connected
            </span>
          )}
        </div>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <PencilRuler size={13} /> No camera? Enter dimensions manually
          </summary>
          <form onSubmit={handleManualAdd} style={{ marginTop: 12 }}>
            <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Length (cm)</label>
                <input type="number" step="0.1" min="1" required value={manual.length_cm} onChange={(e) => setManual({ ...manual, length_cm: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Width (cm)</label>
                <input type="number" step="0.1" min="1" required value={manual.width_cm} onChange={(e) => setManual({ ...manual, width_cm: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Height (cm)</label>
                <input type="number" step="0.1" min="1" required value={manual.height_cm} onChange={(e) => setManual({ ...manual, height_cm: e.target.value })} />
              </div>
              <button type="submit" className="btn-secondary" disabled={savingManual}>
                {savingManual ? "Adding..." : "Add to Queue"}
              </button>
            </div>
          </form>
        </details>
      </div>

      {connected && (
        <div className="grid grid-2" style={{ marginBottom: 16 }}>
          <StreamCard title="Top Camera" url={topUrl} imgRef={topImgRef} canvasRef={topCanvasRef} />
          <StreamCard title="Side Camera" url={sideUrl} imgRef={sideImgRef} canvasRef={sideCanvasRef} />
        </div>
      )}

      {lastResult && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--border-accent)" }}>
          <h3 style={{ color: "var(--accent-blue)" }}><Ruler size={13} /> Measurement Result</h3>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {["length_cm", "width_cm", "height_cm"].map((k) => (
                  <div key={k} style={{ flex: 1, padding: 14, background: "var(--bg-surface)", borderRadius: 10, textAlign: "center" }}>
                    <div className="mono-num" style={{ fontSize: 24, fontWeight: 700 }}>{lastResult.box[k]}</div>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                      {k.replace("_cm", "")} · cm
                    </div>
                  </div>
                ))}
              </div>
              <div className="info-panel">
                <div className="info-chip">Volume <strong>{(Number(lastResult.box.volume_cm3) / 1_000_000).toFixed(4)} m³</strong></div>
                <div className="info-chip">Confidence <strong>{(lastResult.box.confidence * 100).toFixed(1)}%</strong></div>
                <div className="info-chip">Status <span className="badge planned">queued</span></div>
              </div>
              <Link to="/visualizer">
                <button className="btn-cta" style={{ marginTop: 16 }}>
                  Pack it in the Simulator <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[["Top", lastResult.scan.camera_top_path], ["Side", lastResult.scan.camera_side_path]].map(([name, path]) =>
                path ? (
                  <div key={name} style={{ textAlign: "center" }}>
                    <img
                      src={mediaUrl(path)}
                      alt={`${name} capture`}
                      style={{ width: 150, borderRadius: 10, border: "1px solid var(--border-color)", display: "block" }}
                    />
                    <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{name} capture</span>
                  </div>
                ) : null
              )}
            </div>
          </div>
          {lastResult.vision_meta && (
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}>Raw vision metadata</summary>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", marginTop: 8, padding: 12, background: "var(--bg-primary)", borderRadius: 10, fontSize: 11 }}>
                {JSON.stringify(lastResult.vision_meta, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 12px" }}>
          <h3><ScanLine size={13} /> Recently Digitized</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Dimensions</th>
              <th>Volume</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Scanned</th>
            </tr>
          </thead>
          <tbody>
            {recentBoxes.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600, fontSize: 12 }}>{b.label || `Box ${b.id.substring(0, 6)}`}</td>
                <td className="mono-num" style={{ fontSize: 12 }}>{Number(b.length_cm)} × {Number(b.width_cm)} × {Number(b.height_cm)} cm</td>
                <td className="mono-num" style={{ fontSize: 12 }}>{(Number(b.volume_cm3) / 1_000_000).toFixed(4)} m³</td>
                <td className="mono-num" style={{ fontSize: 12 }}>{(Number(b.confidence) * 100).toFixed(0)}%</td>
                <td><span className={`badge ${b.status === "pending" ? "warning" : b.status}`}>{b.status}</span></td>
                <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{new Date(b.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {recentBoxes.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Nothing scanned yet — connect the rig or add a box manually</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
