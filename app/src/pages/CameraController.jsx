import React, { useRef, useState } from "react";
import { vision } from "../lib/api.js";

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

export default function CameraController() {
  const [topUrl, setTopUrl] = useState(DEFAULT_TOP);
  const [sideUrl, setSideUrl] = useState(DEFAULT_SIDE);
  const [connected, setConnected] = useState(false);
  const [label, setLabel] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const topImgRef = useRef(null);
  const sideImgRef = useRef(null);
  const topCanvasRef = useRef(null);
  const sideCanvasRef = useRef(null);

  const handleConnect = () => {
    setError(null);
    setConnected(true);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setLastResult(null);
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const topBlob = await captureFrame(topImgRef.current, topCanvasRef.current);
      const sideBlob = await captureFrame(sideImgRef.current, sideCanvasRef.current);
      if (!topBlob) throw new Error("Top camera frame not ready");
      const result = await vision.scan(topBlob, sideBlob, label || undefined);
      setLastResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Camera Scanner</h1>
          <p className="page-subtitle">Connect ESP32 stereo cameras to scan and measure boxes</p>
        </div>
        {connected && (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={handleScan} disabled={scanning}>
              {scanning ? "⏳ Scanning..." : "📷 Capture & Measure"}
            </button>
            <button className="btn-secondary" onClick={handleDisconnect}>Disconnect</button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Connection</h3>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>Top Camera URL</label>
            <input value={topUrl} onChange={(e) => setTopUrl(e.target.value)} placeholder="http://192.168.1.50:81/stream" />
          </div>
          <div className="form-group">
            <label>Side Camera URL</label>
            <input value={sideUrl} onChange={(e) => setSideUrl(e.target.value)} placeholder="http://192.168.1.51:81/stream" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          {!connected && <button className="btn-primary" onClick={handleConnect}>Connect Cameras</button>}
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <input placeholder="Box label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
        {connected && (
          <div className="info-panel" style={{ marginTop: 12 }}>
            <div className="info-chip"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} /> <strong>Connected</strong></div>
          </div>
        )}
      </div>

      {connected && (
        <div className="grid grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <h3>Top Camera</h3>
            <div style={{ marginTop: 12 }}>
              <img ref={topImgRef} src={topUrl} alt="top stream" crossOrigin="anonymous" style={{ width: "100%", borderRadius: "var(--radius)", background: "#000" }} />
              <canvas ref={topCanvasRef} className="preview" style={{ display: "none" }} />
            </div>
          </div>
          <div className="card">
            <h3>Side Camera</h3>
            <div style={{ marginTop: 12 }}>
              <img ref={sideImgRef} src={sideUrl} alt="side stream" crossOrigin="anonymous" style={{ width: "100%", borderRadius: "var(--radius)", background: "#000" }} />
              <canvas ref={sideCanvasRef} className="preview" style={{ display: "none" }} />
            </div>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="card">
          <h3>Scan Result</h3>
          <div className="info-panel" style={{ marginTop: 12 }}>
            <div className="info-chip">Dimensions <strong>{lastResult.box.length_cm} &times; {lastResult.box.width_cm} &times; {lastResult.box.height_cm} cm</strong></div>
            <div className="info-chip">Confidence <strong>{(lastResult.box.confidence * 100).toFixed(1)}%</strong></div>
          </div>
          {lastResult.vision_meta && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>Raw vision metadata</summary>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", marginTop: 8, padding: 12, background: "var(--bg)", borderRadius: "var(--radius)" }}>
                {JSON.stringify(lastResult.vision_meta, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
