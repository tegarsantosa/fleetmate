import React, { useRef, useState } from "react";
import { vision } from "../lib/api.js";

const DEFAULT_LEFT = "http://192.168.1.50:81/stream";
const DEFAULT_RIGHT = "http://192.168.1.51:81/stream";

function captureFrame(imgEl, canvasEl) {
  if (!imgEl || !canvasEl || !imgEl.complete) return null;
  const ctx = canvasEl.getContext("2d");
  canvasEl.width = imgEl.naturalWidth || 640;
  canvasEl.height = imgEl.naturalHeight || 480;
  ctx.drawImage(imgEl, 0, 0, canvasEl.width, canvasEl.height);
  return new Promise((resolve) => canvasEl.toBlob(resolve, "image/jpeg", 0.92));
}

export default function CameraController() {
  const [leftUrl, setLeftUrl] = useState(DEFAULT_LEFT);
  const [rightUrl, setRightUrl] = useState(DEFAULT_RIGHT);
  const [connected, setConnected] = useState(false);
  const [label, setLabel] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const leftImgRef = useRef(null);
  const rightImgRef = useRef(null);
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);

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
      const leftBlob = await captureFrame(leftImgRef.current, leftCanvasRef.current);
      const rightBlob = await captureFrame(rightImgRef.current, rightCanvasRef.current);
      if (!leftBlob) throw new Error("Left camera frame not ready");
      const result = await vision.scan(leftBlob, rightBlob, label || undefined);
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
            <label>Left Camera URL</label>
            <input value={leftUrl} onChange={(e) => setLeftUrl(e.target.value)} placeholder="http://192.168.1.50:81/stream" />
          </div>
          <div className="form-group">
            <label>Right Camera URL</label>
            <input value={rightUrl} onChange={(e) => setRightUrl(e.target.value)} placeholder="http://192.168.1.51:81/stream" />
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
            <h3>Left Camera</h3>
            <div style={{ marginTop: 12 }}>
              <img ref={leftImgRef} src={leftUrl} alt="left stream" crossOrigin="anonymous" style={{ width: "100%", borderRadius: "var(--radius)", background: "#000" }} />
              <canvas ref={leftCanvasRef} className="preview" style={{ display: "none" }} />
            </div>
          </div>
          <div className="card">
            <h3>Right Camera</h3>
            <div style={{ marginTop: 12 }}>
              <img ref={rightImgRef} src={rightUrl} alt="right stream" crossOrigin="anonymous" style={{ width: "100%", borderRadius: "var(--radius)", background: "#000" }} />
              <canvas ref={rightCanvasRef} className="preview" style={{ display: "none" }} />
            </div>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="card">
          <h3>Scan Result</h3>
          <div className="info-panel" style={{ marginTop: 12 }}>
            <div className="info-chip">Length <strong>{lastResult.box.length_cm} cm</strong></div>
            <div className="info-chip">Width <strong>{lastResult.box.width_cm} cm</strong></div>
            <div className="info-chip">Height <strong>{lastResult.box.height_cm} cm</strong></div>
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
