import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import anime from "animejs";
import { Search, Bell, Activity, DollarSign, Package, Truck, ArrowUpRight, Plus, Box, CheckCircle, TrendingUp } from "lucide-react";

function Sparkline({ data, color }) {
  const svgRef = useRef();
  const pathRef = useRef();

  useEffect(() => {
    if (!pathRef.current) return;
    
    // Animate the sparkline stroke
    anime({
      targets: pathRef.current,
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: 'easeInOutSine',
      duration: 1500,
      delay: function(el, i) { return i * 250 },
      direction: 'alternate',
      loop: false
    });
  }, [data]);

  // Generate SVG path from data array
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((val - min) / range) * h;
    return `${x},${y}`;
  }).join(" L ");

  return (
    <svg ref={svgRef} width="100%" height="40" viewBox={`0 -5 100 40`} preserveAspectRatio="none">
      <path
        ref={pathRef}
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DonutChart({ percentage, color, label, size = 120 }) {
  const circleRef = useRef();
  
  useEffect(() => {
    if (!circleRef.current) return;
    anime({
      targets: circleRef.current,
      strokeDasharray: [`0, 100`, `${percentage}, 100`],
      easing: 'easeOutQuart',
      duration: 1200
    });
  }, [percentage]);

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width="100%" height="100%" viewBox="0 0 36 36">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="var(--border-color)"
          strokeWidth="3"
        />
        <path
          ref={circleRef}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="0, 100"
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <div className="mono-num" style={{ fontSize: "20px", fontWeight: "700" }}>{percentage}%</div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    api.getDashboard().then(setStats).catch(console.error);
    api.listContainers().then(setContainers).catch(console.error);
  }, []);

  if (!stats) {
    return <div className="page"><div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}><div className="mono-num">Loading...</div></div></div>;
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "32px" }}>
        <div>
          <h1 className="page-title">Fleet Dashboard</h1>
          <p className="page-subtitle">Real-time overview of your fleet operations and logistics</p>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input 
              type="text" 
              placeholder="Search ID, Container..." 
              style={{ paddingLeft: "36px", width: "240px", height: "36px", borderRadius: "18px" }} 
            />
          </div>
          <button className="btn-icon btn-secondary" style={{ borderRadius: "50%", width: "36px", height: "36px" }}>
            <Bell size={16} />
          </button>
          <button className="btn-primary">
            <Plus size={16} /> New Shipment
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: "24px" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h3>Boxes Scanned</h3>
              <p className="stat-value mono-num">{stats.total_boxes}</p>
            </div>
            <div style={{ padding: "8px", background: "rgba(11, 197, 234, 0.1)", color: "var(--accent-cyan)", borderRadius: "8px" }}>
              <Package size={20} />
            </div>
          </div>
          <Sparkline data={[12, 14, 18, 15, 22, 28, 25, 30]} color="var(--accent-cyan)" />
          <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>
            <TrendingUp size={12} /> +14.2% vs last week
          </div>
        </div>
        
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h3>Active Fleet</h3>
              <p className="stat-value mono-num">{stats.total_containers}</p>
            </div>
            <div style={{ padding: "8px", background: "rgba(124, 58, 237, 0.1)", color: "var(--accent-blue)", borderRadius: "8px" }}>
              <Truck size={20} />
            </div>
          </div>
          <Sparkline data={[5, 5, 6, 8, 8, 10, 10, 12]} color="var(--accent-blue)" />
          <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>
            <TrendingUp size={12} /> +2 added today
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h3>Net Savings</h3>
              <p className="stat-value mono-num">$24,500</p>
            </div>
            <div style={{ padding: "8px", background: "rgba(76, 175, 80, 0.1)", color: "var(--success)", borderRadius: "8px" }}>
              <DollarSign size={20} />
            </div>
          </div>
          <Sparkline data={[400, 600, 500, 900, 1200, 1100, 1500, 2400]} color="var(--success)" />
          <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>
            <TrendingUp size={12} /> Optimization effect
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h3>Avg Utilization</h3>
              <p className="stat-value mono-num">{stats.avg_utilization_percent}%</p>
            </div>
            <div style={{ padding: "8px", background: "rgba(255, 135, 9, 0.1)", color: "var(--accent-orange)", borderRadius: "8px" }}>
              <Activity size={20} />
            </div>
          </div>
          <Sparkline data={[75, 78, 80, 85, 82, 88, 92, 94]} color="var(--accent-orange)" />
          <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>
            <TrendingUp size={12} /> approaching 95% target
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: "24px" }}>
        <div className="card" style={{ gridColumn: "span 2" }}>
          <h3>Financial & Operations Summary</h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>Projected End of Year expenses vs load efficiency</p>
          
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              {/* Mock Expenses Breakdown */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Fuel Costs</span>
                  <span className="mono-num">$45,200</span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "var(--bg-surface)", borderRadius: "2px" }}>
                  <div style={{ width: "65%", height: "100%", background: "var(--danger)", borderRadius: "2px" }} />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Maintenance</span>
                  <span className="mono-num">$12,450</span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "var(--bg-surface)", borderRadius: "2px" }}>
                  <div style={{ width: "25%", height: "100%", background: "var(--warning)", borderRadius: "2px" }} />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Driver Salaries</span>
                  <span className="mono-num">$82,000</span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "var(--bg-surface)", borderRadius: "2px" }}>
                  <div style={{ width: "85%", height: "100%", background: "var(--accent-blue)", borderRadius: "2px" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <DonutChart percentage={87} color="var(--accent-blue)" label="Efficiency" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <DonutChart percentage={42} color="var(--success)" label="Savings Rate" />
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Utilization Impact</h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>AI Optimization Metrics</p>
          
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px", padding: "16px", background: "var(--bg-surface)", borderRadius: "12px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Truck size={24} />
            </div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: "700" }} className="mono-num">12</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Fewer Trucks Needed</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "var(--bg-surface)", borderRadius: "12px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent-cyan)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}>
              <Box size={24} />
            </div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: "700" }} className="mono-num">4,200</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Extra Boxes Packed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Active Fleet & Load Status</h3>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Container ID</th>
                <th>Vehicle Type</th>
                <th>Dimensions (cm)</th>
                <th>Volume Cap.</th>
                <th>Load Utilization</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map(c => {
                const util = c.max_volume_cm3 > 0 ? (c.used_volume_cm3 / c.max_volume_cm3 * 100) : 0;
                return (
                  <tr key={c.id}>
                    <td><span className="mono-num" style={{ fontWeight: 600 }}>{c.code}</span></td>
                    <td style={{ color: "var(--text-secondary)" }}>{c.name}</td>
                    <td className="mono-num">{c.length_cm} × {c.width_cm} × {c.height_cm}</td>
                    <td className="mono-num">{(c.max_volume_cm3 / 1000000).toFixed(2)} m³</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: "100px", height: "4px", background: "var(--bg-surface)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(util, 100)}%`, height: "100%", background: util > 90 ? "var(--success)" : "var(--accent-blue)", borderRadius: "2px" }} />
                        </div>
                        <span className="mono-num" style={{ fontSize: "12px" }}>{Math.round(util)}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${c.status === "full" ? "success" : "warning"}`}>{c.status}</span></td>
                    <td>
                      <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }}>
                        View Plan <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
