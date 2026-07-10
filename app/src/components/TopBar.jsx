import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, health } from "../lib/api.js";
import { Search, ChevronRight, Truck, Package } from "lucide-react";

const PAGE_NAMES = {
  "/dashboard": "Dashboard",
  "/inventory": "Inventory",
  "/camera": "AI Scan Station",
  "/visualizer": "Load Simulator",
  "/api-keys": "API Keys",
  "/account": "Account",
};

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="topbar-clock">
      {now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}{" "}
      {now.toLocaleTimeString("en-GB", { hour12: false })}
    </span>
  );
}

function HealthStrip() {
  const [status, setStatus] = useState({ api: null, vision: null, packing: null });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const s = await health.check();
      if (!cancelled) setStatus(s);
    };
    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const dot = (ok) => (ok === null ? "var(--warning)" : ok ? "var(--success)" : "var(--danger)");

  return (
    <div className="health-strip" title="Live service health, checked every 15s">
      {[["API", status.api], ["Vision", status.vision], ["Packing", status.packing]].map(([name, ok]) => (
        <span key={name} className="health-chip">
          <span className="status-dot" style={{ background: dot(ok) }} />
          {name}
        </span>
      ))}
    </div>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const boxRef = useRef(null);
  const dataRef = useRef({ containers: [], boxes: [] });

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setResults(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const runSearch = useMemo(() => {
    let timer;
    return (value) => {
      clearTimeout(timer);
      if (!value.trim()) { setResults(null); return; }
      timer = setTimeout(async () => {
        try {
          const [containers, boxes] = await Promise.all([api.listContainers(), api.listBoxes()]);
          dataRef.current = { containers, boxes };
          const needle = value.toLowerCase();
          const hits = [
            ...containers
              .filter((c) => c.code.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle))
              .slice(0, 4)
              .map((c) => ({ type: "vehicle", label: `${c.code} — ${c.name}`, sub: c.status, to: "/visualizer" })),
            ...boxes
              .filter((b) => (b.label || "").toLowerCase().includes(needle) || b.id.startsWith(needle))
              .slice(0, 4)
              .map((b) => ({
                type: "box",
                label: b.label || `Box ${b.id.substring(0, 6)}`,
                sub: `${Number(b.length_cm)}×${Number(b.width_cm)}×${Number(b.height_cm)} cm · ${b.status}`,
                to: "/camera",
              })),
          ];
          setResults(hits);
        } catch {
          setResults([]);
        }
      }, 220);
    };
  }, []);

  return (
    <div className="search-box" ref={boxRef}>
      <Search size={14} className="search-ico" />
      <input
        placeholder="Search vehicles, cargo…"
        value={q}
        onChange={(e) => { setQ(e.target.value); runSearch(e.target.value); }}
      />
      {results !== null && (
        <div className="search-results">
          {results.length === 0 && <div className="empty-state" style={{ padding: 16 }}>No matches</div>}
          {results.map((r, i) => (
            <div
              key={i}
              className="search-result-row"
              onClick={() => { navigate(r.to); setQ(""); setResults(null); }}
            >
              {r.type === "vehicle" ? <Truck size={13} style={{ color: "var(--accent)" }} /> : <Package size={13} style={{ color: "var(--data-blue)" }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 10 }}>{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const location = useLocation();
  const pageName = PAGE_NAMES[location.pathname] || "Console";

  return (
    <div className="topbar">
      <div className="crumb">
        FleetMate <ChevronRight size={13} /> <b>{pageName}</b>
      </div>
      <GlobalSearch />
      <HealthStrip />
      <Clock />
    </div>
  );
}
