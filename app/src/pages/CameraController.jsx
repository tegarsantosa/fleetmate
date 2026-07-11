import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { vision, api, API_BASE_URL } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import { beepSuccess, beepError, flashLedOn, flashLedOff, setWhiteBalance } from "../lib/scanFx.js";
import {
  Camera, Cpu, ScanLine, Ruler, ArrowRight, Plug, Unplug, RefreshCw, PencilRuler, SunMedium,
} from "lucide-react";

const WB_MODES = [
  { value: 0, label: "Auto" },
  { value: 1, label: "Sunny" },
  { value: 2, label: "Office (anti green-tint)" },
  { value: 3, label: "Cloudy" },
  { value: 4, label: "Home" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_TOP = "http://fleetmate-cam-C414.local";
const DEFAULT_SIDE = "http://fleetmate-cam-0C1F.local";

async function captureDirect(rawUrl) {
  const endpoint = captureEndpoint(rawUrl);
  if (!endpoint) return null;
  try {
    const res = await fetch(`${endpoint}?_=${Date.now()}`);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function mediaUrl(path) {
  if (!path) return null;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Derive the ESP32 single-shot JPEG endpoint (http://<host>/capture, port 80)
// from whatever the operator typed — a bare host (fleetmate-cam-XXXX.local),
// an IP, or a legacy :81/stream URL. We poll /capture instead of :81/stream
// because the stream endpoint serves only ONE client at a time (a second open
// browser tab blocks it forever) and Safari can't cleanly abort it. /capture
// has no such limit, sends CORS headers, and never hangs. Same approach as the
// vanilla FleetMate app (public/js/camera-preview.js).
function captureEndpoint(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    return `${u.protocol}//${u.hostname}/capture`; // force port 80 + /capture
  } catch {
    return null;
  }
}

// Profile pushed to every board on connect so both rigs always start at the
// same WiFi-friendly settings regardless of what a prior stock-UI session left
// them on. Stock CameraWebServer does NOT persist these across a reboot, so we
// re-assert them each time we connect.  framesize 2 = QCIF 176x144.
const CAMERA_DEFAULTS = { framesize: 2, quality: 4, xclkMhz: 15, special_effect: 0 };

async function applyCameraDefaults(rawUrl) {
  let host;
  try {
    const u = new URL(rawUrl.includes("://") ? rawUrl : `http://${rawUrl}`);
    host = `${u.protocol}//${u.hostname}`;
  } catch {
    return;
  }
  // Fire-and-forget GET side-effects. mode:"no-cors" so they still reach the
  // board even if it omits CORS headers on these endpoints (we never read the
  // response). NOTE: xclk uses the dedicated /xclk endpoint — /control?var=xclk
  // returns HTTP 500 on this firmware.
  const hit = (path) => fetch(`${host}${path}`, { mode: "no-cors" }).catch(() => { });
  await hit(`/xclk?xclk=${CAMERA_DEFAULTS.xclkMhz}`); // re-inits sensor clock first
  await hit(`/control?var=framesize&val=${CAMERA_DEFAULTS.framesize}`);
  await hit(`/control?var=quality&val=${CAMERA_DEFAULTS.quality}`);
  await hit(`/control?var=special_effect&val=${CAMERA_DEFAULTS.special_effect}`); // 0 = No Effect (disables grayscale etc)
  await hit(`/control?var=wb_mode&val=2`); // lock AWB to Office — kills fluorescent green-tint
  await hit(`/control?var=led_intensity&val=0`); // safety: LED off while previewing
}

// Fake a live feed by repeatedly reloading /capture into the <img>: schedule the
// next frame only after the current one settles (self-paced, never hammers the
// board), with a per-frame watchdog so a stalled request can't freeze the feed.
function useSnapshotStream(imgRef, rawUrl, isPaused, refreshKey) {
  const [status, setStatus] = useState("connecting");
  useEffect(() => {
    if (isPaused) {
      setStatus("paused");
      return;
    }
    const endpoint = captureEndpoint(rawUrl);
    const img = imgRef.current;
    if (!endpoint || !img) { setStatus("retrying"); return; }

    let stopped = false;
    let everLoaded = false;
    let timer = null;
    let watchdog = null;

    const poll = () => {
      if (stopped) return;
      let settled = false;
      const started = Date.now();
      const finish = (ok) => {
        if (settled || stopped) return;
        settled = true;
        clearTimeout(watchdog);
        if (ok) { everLoaded = true; setStatus("online"); }
        else setStatus(everLoaded ? "online" : "retrying");
        const wait = Math.max(800 - (Date.now() - started), 0);
        timer = setTimeout(poll, wait);
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      watchdog = setTimeout(() => finish(false), 4000);
      img.src = `${endpoint}?_=${Date.now()}`; // cache-bust every frame
    };

    setStatus("connecting");
    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
      img.onload = null;
      img.onerror = null;
    };
  }, [imgRef, rawUrl, isPaused, refreshKey]);
  return status;
}

function StreamCard({ title, url, imgRef, canvasRef, isPaused, refreshKey }) {
  const status = useSnapshotStream(imgRef, url, isPaused, refreshKey);
  const online = status === "online" || status === "paused";
  const label = status === "paused" ? "PAUSED" : online ? "LIVE" : status === "connecting" ? "CONNECTING…" : "NO SIGNAL";
  return (
    <div className="card">
      <h3>
        <Camera size={13} /> {title}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: online ? "var(--success)" : "var(--text-secondary)" }}>
          <span className="pulse-dot" /> {label}
        </span>
      </h3>
      <div style={{ marginTop: 12 }}>
        {/* src is driven imperatively by useSnapshotStream (polling /capture). */}
        <img ref={imgRef} alt={`${title} stream`} crossOrigin="anonymous" className="stream-frame" />
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
  const [wbMode, setWbMode] = useState(2); // Office default (anti green-tint)
  const [flashKey, setFlashKey] = useState(0); // remounts the screen-flash overlay
  const [refreshKey, setRefreshKey] = useState(0); // soft-refreshes stream

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
      .catch(() => { });
  };

  useEffect(refreshRecent, []);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    const camUrls = [topUrl, sideUrl];
    try {
      // Pause stream to free up ESP32
      await sleep(500);

      // 1. Hardware flash auto-pulse
      await flashLedOn(camUrls, 180);
      await sleep(300); // Wait for sensor exposure adjustment

      // 2. Screen flash — visual confirmation the photo is being taken now.
      setFlashKey((k) => k + 1);

      const [topBlob, sideBlob] = await Promise.all([
        captureDirect(topUrl),
        captureDirect(sideUrl)
      ]);

      if (!topBlob) throw new Error("Top camera frame not ready or inaccessible");
      const result = await vision.scan(topBlob, sideBlob, label || undefined);

      // 3. Barcode-gun double beep: measurement confirmed, no need to look.
      beepSuccess();
      setLastResult(result);
      setLabel("");
      refreshRecent();
      if (result.vision_meta?.simulation_mode) {
        toast("Simulation Mode Active: Scaled 1cm = 10cm", "info");
      }
      toast(`Measured ${result.box.length_cm} × ${result.box.width_cm} × ${result.box.height_cm} cm — queued for packing`, "success");
    } catch (err) {
      beepError();
      setError(err.message);
      toast("Scan failed", "error");
    } finally {
      // 4. ALWAYS kill the LED — a standing intensity would strobe with the
      //    preview's /capture polling (stock firmware fires LED per capture).
      flashLedOff(camUrls);
      setScanning(false);
      setRefreshKey(k => k + 1);
    }
  };

  const handleWbChange = (mode) => {
    setWbMode(mode);
    setWhiteBalance([topUrl, sideUrl], mode);
    toast(`White balance → ${WB_MODES.find((m) => m.value === mode)?.label}`, "success");
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
      {/* Screen-flash: white blink synced with the hardware shot (key remounts it) */}
      {flashKey > 0 && <div key={flashKey} className="scan-flash" aria-hidden="true" />}
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
            <button
              className="btn-cta"
              onClick={async () => {
                setError(null);
                setConnected(true);
                // Push the shared profile to BOTH boards, then confirm.
                await Promise.all([applyCameraDefaults(topUrl), applyCameraDefaults(sideUrl)]);
                toast("Camera profile applied — QCIF 176×144 · Q4 · 15 MHz", "success");
              }}
            >
              <Plug size={15} /> Connect Cameras
            </button>
          )}
          <div style={{ flex: 1 }}>
            <input placeholder="Box label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          {connected && (
            <>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
                <SunMedium size={14} />
                <select
                  value={wbMode}
                  onChange={(e) => handleWbChange(Number(e.target.value))}
                  title="Remote white balance — both cameras"
                  style={{ padding: "6px 8px", fontSize: 12 }}
                >
                  {WB_MODES.map((m) => (
                    <option key={m.value} value={m.value}>WB: {m.label}</option>
                  ))}
                </select>
              </label>
              <span className="info-chip" style={{ flexShrink: 0 }}>
                <span className="status-dot" style={{ background: "var(--success)" }} /> Connected
              </span>
            </>
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
          <StreamCard title="Top Camera" url={topUrl} imgRef={topImgRef} canvasRef={topCanvasRef} isPaused={scanning} refreshKey={refreshKey} />
          <StreamCard title="Side Camera" url={sideUrl} imgRef={sideImgRef} canvasRef={sideCanvasRef} isPaused={scanning} refreshKey={refreshKey} />
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
