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

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const leftBlob = await captureFrame(leftImgRef.current, leftCanvasRef.current);
      const rightBlob = await captureFrame(rightImgRef.current, rightCanvasRef.current);

      if (!leftBlob) {
        throw new Error("left camera frame not ready");
      }

      const result = await vision.scan(leftBlob, rightBlob, label || undefined);
      setLastResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h3>ESP32 Stereo Camera Connection</h3>
        <div className="grid grid-2">
          <div>
            <label>Left camera stream URL</label>
            <input
              style={{ width: "100%", padding: 8, marginTop: 6 }}
              value={leftUrl}
              onChange={(e) => setLeftUrl(e.target.value)}
            />
          </div>
          <div>
            <label>Right camera stream URL</label>
            <input
              style={{ width: "100%", padding: 8, marginTop: 6 }}
              value={rightUrl}
              onChange={(e) => setRightUrl(e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={handleConnect}>Connect Cameras</button>
          <input
            placeholder="box label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={handleScan} disabled={!connected || scanning}>
            {scanning ? "Scanning..." : "Capture & Measure"}
          </button>
        </div>
        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
      </div>

      {connected && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Left Camera</h3>
            <img ref={leftImgRef} src={leftUrl} alt="left stream" crossOrigin="anonymous" />
            <canvas ref={leftCanvasRef} className="preview" style={{ display: "none" }} />
          </div>
          <div className="card">
            <h3>Right Camera</h3>
            <img ref={rightImgRef} src={rightUrl} alt="right stream" crossOrigin="anonymous" />
            <canvas ref={rightCanvasRef} className="preview" style={{ display: "none" }} />
          </div>
        </div>
      )}

      {lastResult && (
        <div className="card">
          <h3>Last Scan Result</h3>
          <pre style={{ whiteSpace: "pre-wrap", color: "#9aa4b8" }}>
            {JSON.stringify(lastResult.vision_meta, null, 2)}
          </pre>
          <p>
            Box recorded: {lastResult.box.length_cm} x {lastResult.box.width_cm} x{" "}
            {lastResult.box.height_cm} cm (confidence {lastResult.box.confidence})
          </p>
        </div>
      )}
    </div>
  );
}
