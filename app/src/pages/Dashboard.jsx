import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useCountUp, useRiseIn, fmtInt, prefersReducedMotion } from "../lib/motion.js";
import anime from "animejs";
import {
  Activity, Package, Truck, ArrowUpRight, ScanLine, CalendarClock, Gauge, RefreshCw, Boxes,
} from "lucide-react";

/* ---------- charts ---------- */
function Sparkline({ data, color }) {
  const pathRef = useRef();

  useEffect(() => {
    if (!pathRef.current) return;
    if (document.visibilityState === "hidden" || prefersReducedMotion()) return;
    anime({
      targets: pathRef.current,
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: "easeInOutSine",
      duration: 1400,
    });
  }, [data]);

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const y = h - ((val - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" L ");

  return (
    <svg width="100%" height="38" viewBox="0 -5 100 40" preserveAspectRatio="none">
      <path
        ref={pathRef}
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DonutChart({ percentage, color, label, size = 116 }) {
  const circleRef = useRef();

  useEffect(() => {
    if (!circleRef.current) return;
    if (document.visibilityState === "hidden" || prefersReducedMotion()) {
      circleRef.current.setAttribute("stroke-dasharray", `${percentage}, 100`);
      return;
    }
    anime({
      targets: circleRef.current,
      strokeDasharray: ["0, 100", `${percentage}, 100`],
      easing: "easeOutQuart",
      duration: 1200,
    });
  }, [percentage]);

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width="100%" height="100%" viewBox="0 0 36 36">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="var(--border-color)" strokeWidth="3"
        />
        <path
          ref={circleRef}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke={color} strokeWidth="3" strokeDasharray="0, 100" strokeLinecap="round"
        />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <div className="mono-num" style={{ fontSize: 19, fontWeight: 700 }}>{Math.round(percentage)}%</div>
        <div style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", maxWidth: 70 }}>{label}</div>
      </div>
    </div>
  );
}

/* ---------- KPI card ---------- */
function KpiCard({ title, value, format, icon: Icon, tint, spark, footer, delta }) {
  const valueRef = useCountUp(value, { format });
  const deltaCls = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <div className="card" data-animate="rise">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <h3>{title}</h3>
          <p className="stat-value" ref={valueRef} style={{ marginTop: 6 }}>0</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div className="stat-icon" style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}>
            <Icon size={18} />
          </div>
          {deltaCls && (
            <span className={`kpi-delta ${deltaCls}`}>
              {delta > 0 ? "+" : ""}{delta}{typeof delta === "number" && !Number.isInteger(delta) ? "" : ""}
            </span>
          )}
        </div>
      </div>
      {spark && spark.length > 1 && <Sparkline data={spark} color={tint} />}
      {footer && <div className="stat-trend">{footer}</div>}
    </div>
  );
}

/* ---------- helpers ---------- */
function withinDays(dateStr, from, to) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return diff >= from && diff < to;
}

function dailyCounts(records, days) {
  const counts = new Array(days).fill(0);
  const now = Date.now();
  for (const r of records) {
    const diff = Math.floor((now - new Date(r.created_at).getTime()) / 86400000);
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
  }
  return counts;
}

function relTime(dateStr) {
  const s = Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_COLORS = {
  available: "var(--success)",
  loading: "var(--warning)",
  full: "var(--danger)",
  shipped: "var(--info)",
};

const RANGES = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [containers, setContainers] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [error, setError] = useState(null);
  const [rangeDays, setRangeDays] = useState(7);
  const [refreshing, setRefreshing] = useState(false);
  const scopeRef = useRiseIn([stats !== null]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, c, b, p, sh] = await Promise.all([
        api.getDashboard(),
        api.listContainers(),
        api.listBoxes(),
        api.listPlans(),
        api.listShipments().catch(() => []),
      ]);
      setStats(s);
      setContainers(c);
      setBoxes(b);
      setPlans(p);
      setShipments(sh);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const derived = useMemo(() => {
    const active = containers.filter((c) => c.status !== "shipped");
    const fleetMax = active.reduce((s, c) => s + Number(c.max_volume_cm3), 0);
    const fleetUsed = active.reduce((s, c) => s + Number(c.used_volume_cm3), 0);
    const statusCounts = containers.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    const boxesInWindow = boxes.filter((b) => withinDays(b.created_at, 0, rangeDays)).length;
    const boxesPrevWindow = boxes.filter((b) => withinDays(b.created_at, rangeDays, rangeDays * 2)).length;
    const plansInWindow = plans.filter((p) => withinDays(p.created_at, 0, rangeDays)).length;
    const plansPrevWindow = plans.filter((p) => withinDays(p.created_at, rangeDays, rangeDays * 2)).length;

    const scannedVolume = boxes.reduce((s, b) => s + Number(b.volume_cm3 || 0), 0);
    const pendingCount = boxes.filter((b) => b.status === "pending").length;

    return {
      active: active.length,
      fleetPct: fleetMax > 0 ? (fleetUsed / fleetMax) * 100 : 0,
      fleetUsedM3: fleetUsed / 1_000_000,
      fleetMaxM3: fleetMax / 1_000_000,
      statusCounts,
      scannedVolume,
      pendingCount,
      boxSeries: dailyCounts(boxes, rangeDays),
      planSeries: dailyCounts(plans, rangeDays),
      boxDelta: boxesInWindow - boxesPrevWindow,
      planDelta: plansInWindow - plansPrevWindow,
    };
  }, [containers, boxes, plans, rangeDays]);

  const containerCode = useMemo(() => {
    const map = {};
    for (const c of containers) map[c.id] = c.code;
    return map;
  }, [containers]);

  const recentPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6),
    [plans]
  );

  const activityFeed = useMemo(() => {
    const events = [
      ...boxes.map((b) => ({
        at: b.created_at,
        icon: ScanLine,
        tint: "var(--data-blue)",
        title: `${b.label || `Box ${b.id.substring(0, 6)}`} digitized`,
        sub: `${Number(b.length_cm)}×${Number(b.width_cm)}×${Number(b.height_cm)} cm · ${(Number(b.confidence) * 100).toFixed(0)}% confidence`,
      })),
      ...plans.map((p) => ({
        at: p.created_at,
        icon: Boxes,
        tint: "var(--accent)",
        title: `Plan packed into ${containerCode[p.container_id] || "vehicle"}`,
        sub: `${p.box_count} boxes · ${(p.volume_utilization * 100).toFixed(1)}% volume`,
      })),
      ...shipments.map((s) => ({
        at: s.created_at,
        icon: CalendarClock,
        tint: "var(--data-amber)",
        title: `Shipment scheduled → ${s.destination}`,
        sub: new Date(s.scheduled_date).toLocaleString(),
      })),
    ];
    return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 9);
  }, [boxes, plans, shipments, containerCode]);

  if (error) return <div className="alert error">{error}</div>;

  if (!stats) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Operations overview — scans, packing plans, fleet capacity</p>
          </div>
        </div>
        <div className="grid grid-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 150 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div ref={scopeRef}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Operations overview — scans, packing plans, fleet capacity</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="range-strip">
            {RANGES.map((r) => (
              <button
                key={r.days}
                className={`range-chip ${rangeDays === r.days ? "active" : ""}`}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="btn-secondary btn-icon" onClick={load} title="Refresh">
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          </button>
          <Link to="/camera"><button className="btn-cta"><ScanLine size={15} /> Scan a Box</button></Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <KpiCard
          title="Boxes Scanned"
          value={stats.total_boxes}
          format={fmtInt}
          icon={Package}
          tint="var(--data-blue)"
          spark={derived.boxSeries}
          delta={derived.boxDelta}
          footer={`${derived.pendingCount} pending in queue`}
        />
        <KpiCard
          title="Active Fleet"
          value={derived.active}
          format={fmtInt}
          icon={Truck}
          tint="var(--accent)"
          spark={derived.planSeries}
          delta={derived.planDelta}
          footer={`${stats.total_containers} vehicles registered`}
        />
        <KpiCard
          title="Avg Plan Utilization"
          value={stats.avg_utilization_percent}
          format={(v) => `${v.toFixed(1)}%`}
          icon={Gauge}
          tint="var(--data-amber)"
          footer="volume-based packing"
        />
        <KpiCard
          title="Scheduled Shipments"
          value={stats.total_shipments}
          format={fmtInt}
          icon={CalendarClock}
          tint="var(--data-violet)"
          footer="from inventory schedule"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }}>
        <div className="card flush" data-animate="rise">
          <div className="card-header">
            <h3><Activity size={13} /> Fleet Capacity</h3>
            <div className="spacer" />
            <span className="mono-num" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {derived.fleetUsedM3.toFixed(2)} / {derived.fleetMaxM3.toFixed(2)} m³
            </span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
              Volume in use across the active fleet — the scheduler fills partially loaded vehicles first
            </p>
            <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                {containers.filter((c) => c.status !== "shipped").map((c) => {
                  const used = Number(c.used_volume_cm3);
                  const max = Number(c.max_volume_cm3) || 1;
                  const pct = Math.min((used / max) * 100, 100);
                  return (
                    <div key={c.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                        <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <span className="status-dot" style={{ background: STATUS_COLORS[c.status] || "var(--text-muted)" }} />
                          <span className="mono-num">{c.code}</span> {c.name}
                        </span>
                        <span className="mono-num" style={{ color: "var(--text-muted)" }}>
                          {(used / 1_000_000).toFixed(2)} m³ · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="capacity-bar">
                        <div className="seg" style={{ width: `${pct}%`, background: pct > 90 ? "var(--success)" : "var(--accent)" }} />
                      </div>
                    </div>
                  );
                })}
                {containers.length === 0 && <div className="empty-state">No vehicles yet</div>}
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <DonutChart percentage={derived.fleetPct} color="var(--accent)" label="Fleet volume" />
                <DonutChart percentage={stats.avg_utilization_percent} color="var(--data-blue)" label="Avg per plan" />
              </div>
            </div>

            <div className="divider" />
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                  <span className="status-dot" style={{ background: color }} />
                  <span style={{ textTransform: "capitalize" }}>{status}</span>
                  <b className="mono-num">{derived.statusCounts[status] || 0}</b>
                </span>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                Scanned cargo total: <b className="mono-num">{(derived.scannedVolume / 1_000_000).toFixed(2)} m³</b>
              </span>
            </div>
          </div>
        </div>

        <div className="card flush" data-animate="rise">
          <div className="card-header">
            <h3><Activity size={13} /> Live Activity</h3>
            <div className="spacer" />
            <span className="pulse-dot" />
          </div>
          <div className="feed">
            {activityFeed.map((e, i) => (
              <div key={i} className="feed-item">
                <div className="feed-ico" style={{ background: `color-mix(in srgb, ${e.tint} 12%, transparent)`, color: e.tint }}>
                  <e.icon size={13} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="feed-title">{e.title}</div>
                  <div className="feed-sub">{e.sub}</div>
                </div>
                <span className="feed-time">{relTime(e.at)}</span>
              </div>
            ))}
            {activityFeed.length === 0 && <div className="empty-state">No activity yet — scan your first box</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card flush" data-animate="rise">
          <div className="card-header">
            <h3><Truck size={13} /> Fleet & Load Status</h3>
            <div className="spacer" />
            <Link to="/inventory" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              Manage <ArrowUpRight size={12} />
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Volume Cap.</th>
                <th>Load</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => {
                const util = c.max_volume_cm3 > 0 ? (c.used_volume_cm3 / c.max_volume_cm3) * 100 : 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="mono-num" style={{ fontWeight: 600, fontSize: 12 }}>{c.code}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.name}</div>
                    </td>
                    <td className="mono-num">{(c.max_volume_cm3 / 1_000_000).toFixed(2)} m³</td>
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${Math.min(util, 100)}%`, background: util > 90 ? "var(--success)" : "var(--accent)" }} />
                        </div>
                        <span className="mono-num" style={{ fontSize: 11 }}>{Math.round(util)}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                  </tr>
                );
              })}
              {containers.length === 0 && (
                <tr><td colSpan={4} className="empty-state">No vehicles yet — add one in Inventory</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card flush" data-animate="rise">
          <div className="card-header">
            <h3><Package size={13} /> Recent Packing Plans</h3>
            <div className="spacer" />
            <Link to="/visualizer" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              Simulator <ArrowUpRight size={12} />
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Boxes</th>
                <th>Utilization</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentPlans.map((p) => (
                <tr key={p.id}>
                  <td className="mono-num" style={{ fontWeight: 600, fontSize: 12 }}>{containerCode[p.container_id] || "—"}</td>
                  <td className="mono-num">{p.box_count}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.min(p.volume_utilization * 100, 100)}%`, background: "var(--data-blue)" }} />
                      </div>
                      <span className="mono-num" style={{ fontSize: 11 }}>{(p.volume_utilization * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{relTime(p.created_at)}</td>
                </tr>
              ))}
              {recentPlans.length === 0 && (
                <tr><td colSpan={4} className="empty-state">No plans yet — scan boxes and run the AI packer</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
