import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import anime from "animejs";
import {
  ScanLine, FileDigit, Cpu, Box, PiggyBank, Eye, EyeOff, ShieldCheck,
  Camera, BrainCircuit, Container, Timer, Route, Scale, Leaf,
} from "lucide-react";
import { useToast } from "../components/Toast.jsx";
import Scene from "../landing3d/Scene.jsx";
import ScrollOverlay from "../landing3d/ScrollOverlay.jsx";
import "./Landing.css";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const LOGO = "/logo.png";

const STEPS = [
  { n: "01", icon: ScanLine, title: "Scan & Measure", body: "Boxes captured in 3D by the dual stereo-camera rig at the dock." },
  { n: "02", icon: FileDigit, title: "Digitalize", body: "Every box becomes an accurate digital asset — no manual tape, no typos." },
  { n: "03", icon: Cpu, title: "Optimize", body: "A deterministic 3D bin-packing engine computes the best placement." },
  { n: "04", icon: Box, title: "Visualize", body: "The digital-twin simulator shows the exact loading sequence in 3D." },
  { n: "05", icon: PiggyBank, title: "Save", body: "More capacity per trip — lower cost, fewer trucks, higher efficiency." },
];

const PLATFORM = [
  {
    icon: Camera, title: "Vision Layer",
    body: "Two low-cost stereo cameras measure length, width and height the moment a box enters the dock — seconds instead of minutes, and no human error in the numbers.",
  },
  {
    icon: BrainCircuit, title: "Intelligence Layer",
    body: "Deterministic 3D bin-packing — not probabilistic guesswork. Every placement is explainable, repeatable, and constraint-aware. Vehicles are chosen best-fit first, like a scheduler placing workloads on nodes.",
  },
  {
    icon: Container, title: "Digital Twin",
    body: "A real-time 3D simulator bridges optimization and the physical warehouse: operators see the exact loading order before a single door closes.",
  },
];

const IMPACT = [
  { icon: Route, title: "Fewer trips", body: "15–20% utilization improvement targeted in the first quarter — the same volume shipped in fewer vehicles.", bar: 78 },
  { icon: Timer, title: "Time back at the dock", body: "Automated measurement removes the manual tape-and-clipboard bottleneck from every shipment.", bar: 86 },
  { icon: Scale, title: "Consistent loading", body: "A new operator and a veteran get the same plan — quality no longer depends on who is on shift.", bar: 92 },
  { icon: Leaf, title: "Lower emissions", body: "Every underfilled truck is a needless emission. Higher fill rates shrink the fleet's carbon footprint.", bar: 70 },
];

const TEAM = [
  { name: "Desta Prasetyo A.S.", role: "Team Lead", color: "#84cc16" },
  { name: "M. Tegar Santosa P.", role: "Engineer", color: "#8b5cf6" },
  { name: "M. Athoillah", role: "UI / UX", color: "#f59e0b" },
  { name: "Jesica Cristy", role: "Technical Writer", color: "#0ea5e9" },
];

const TERMINAL_LINES = [
  ["dim", "$ fleetmate --watch dock-A"],
  ["ok", "[vision]  cam-TOP frame captured · 640×480"],
  ["ok", "[vision]  box detected → 42.0 × 30.5 × 28.0 cm (conf 0.93)"],
  ["ai", "[packing] evaluating 4 vehicles… best-fit: FMATE-002 (61% loaded)"],
  ["ai", "[packing] placed @ (120, 0, 55) rot 90° · utilization → 78.4%"],
  ["dim", "[api]     plan persisted · dashboard notified"],
  ["ok", "[twin]    3D simulation updated in 34 ms"],
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Terminal() {
  const [count, setCount] = useState(() => (prefersReducedMotion() ? TERMINAL_LINES.length : 1));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      setCount((c) => (c >= TERMINAL_LINES.length ? 1 : c + 1));
    }, 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ld-terminal" data-reveal>
      <div className="bar">
        <i style={{ background: "#f87171" }} /><i style={{ background: "#fbbf24" }} /><i style={{ background: "#a3e635" }} />
        <span className="dim" style={{ marginLeft: 10, fontSize: 11 }}>fleetmate · intelligence layer — live</span>
      </div>
      {TERMINAL_LINES.slice(0, count).map(([cls, text], i) => (
        <div key={i} className={cls}>{text}</div>
      ))}
      <span className="ld-cursor" />
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const toast = useToast();
  const rootRef = useRef(null);
  const stepsLineRef = useRef(null);
  // scroll progress of the cinematic act, consumed by the 3D camera rig
  const progressRef = useRef({ p: 0 });
  const [navScrolled, setNavScrolled] = useState(false);
  const [navDark, setNavDark] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const scrollTo = (id) => {
    if (prefersReducedMotion()) {
      document.querySelector(id)?.scrollIntoView();
      return;
    }
    gsap.to(window, { duration: 1.05, scrollTo: id, ease: "power3.inOut" });
  };

  /* ---------- motion engine ---------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = prefersReducedMotion();
    const hidden = document.visibilityState === "hidden";
    const desktop = window.matchMedia("(min-width: 769px)").matches && !("ontouchstart" in window);

    /* nav shadow — piggybacks on the same rAF-throttled scroll listener */
    let ticking = false;
    const pLayers = desktop && !reduced ? Array.from(root.querySelectorAll("[data-pspeed]")) : [];
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setNavScrolled(y > 40);
        // nav shows light chrome while the dark cinematic act is on stage
        const act = document.getElementById("cine-act");
        setNavDark(act ? y < act.offsetTop + act.offsetHeight - 140 : false);
        for (const el of pLayers) {
          el.style.transform = `translate3d(0, ${y * parseFloat(el.dataset.pspeed)}px, 0)`;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* mouse parallax (hero) */
    let onMove = null;
    if (desktop && !reduced) {
      const dLayers = Array.from(root.querySelectorAll("[data-depth]")).map((el) => ({
        x: gsap.quickTo(el, "x", { duration: 0.7, ease: "power3.out" }),
        y: gsap.quickTo(el, "y", { duration: 0.7, ease: "power3.out" }),
        depth: parseFloat(el.dataset.depth),
      }));
      onMove = (e) => {
        const cx = e.clientX / window.innerWidth - 0.5;
        const cy = e.clientY / window.innerHeight - 0.5;
        for (const l of dLayers) {
          l.x(cx * 46 * l.depth);
          l.y(cy * 30 * l.depth);
        }
      };
      window.addEventListener("mousemove", onMove);
    }

    /* reveals, counters, bars, line draw */
    const reveals = gsap.utils.toArray(root.querySelectorAll("[data-reveal]"));
    const counters = gsap.utils.toArray(root.querySelectorAll("[data-count]"));
    const bars = gsap.utils.toArray(root.querySelectorAll("[data-barw]"));

    if (reduced || hidden) {
      gsap.set(reveals, { opacity: 1, y: 0, clearProps: "transform" });
      counters.forEach((el) => { el.textContent = el.dataset.count; });
      bars.forEach((el) => { el.style.width = `${el.dataset.barw}%`; });
      if (stepsLineRef.current) {
        const path = stepsLineRef.current.querySelector("path");
        if (path) path.style.strokeDashoffset = 0;
      }
    } else {
      ScrollTrigger.batch(reveals, {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1, y: 0, duration: 0.75, stagger: 0.09,
            ease: "power3.out", overwrite: true, clearProps: "transform",
          }),
      });

      counters.forEach((el) => {
        const target = parseFloat(el.dataset.count);
        const decimals = parseInt(el.dataset.decimals || "0", 10);
        const prefix = el.dataset.prefix || "";
        const suffix = el.dataset.suffix || "";
        ScrollTrigger.create({
          trigger: el, start: "top 90%", once: true,
          onEnter: () => {
            const proxy = { v: 0 };
            gsap.to(proxy, {
              v: target, duration: 1.5, ease: "power2.out",
              onUpdate: () => { el.textContent = `${prefix}${proxy.v.toFixed(decimals)}${suffix}`; },
            });
          },
        });
      });

      bars.forEach((el) => {
        ScrollTrigger.create({
          trigger: el, start: "top 90%", once: true,
          onEnter: () => { el.style.width = `${el.dataset.barw}%`; },
        });
      });

      /* anime.js — dashed process line draw-in */
      if (stepsLineRef.current) {
        const path = stepsLineRef.current.querySelector("path");
        if (path) {
          ScrollTrigger.create({
            trigger: stepsLineRef.current, start: "top 85%", once: true,
            onEnter: () =>
              anime({
                targets: path,
                strokeDashoffset: [anime.setDashoffset, 0],
                easing: "easeInOutSine",
                duration: 1600,
              }),
          });
        }
      }
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (onMove) window.removeEventListener("mousemove", onMove);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    localStorage.setItem("fleetmate_logged_in", "1");
    toast("Welcome back — console unlocked", "success");
    setTimeout(() => navigate("/dashboard"), 420);
  };

  return (
    <div ref={rootRef} className={`ld-root ${prefersReducedMotion() ? "ld-no-motion" : ""}`}>

      {/* ================= NAV ================= */}
      <nav className={`ld-nav ${navScrolled ? "scrolled" : ""} ${navDark ? "dark" : ""}`}>
        <div className="ld-nav-inner">
          <div className="ld-nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })}>
            <img src={LOGO} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            FLEETMATE
          </div>
          <div className="ld-nav-links">
            <button className="ld-nav-link" onClick={() => scrollTo("#why")}>Why</button>
            <button className="ld-nav-link" onClick={() => scrollTo("#how")}>How it works</button>
            <button className="ld-nav-link" onClick={() => scrollTo("#platform")}>Platform</button>
            <button className="ld-nav-link" onClick={() => scrollTo("#impact")}>Impact</button>
          </div>
          <button className="ld-btn ld-btn-dark" style={{ padding: "9px 18px", marginLeft: 8 }} onClick={() => scrollTo("#login")}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ================= CINEMATIC 3D ACT ================= */}
      <Scene progressRef={progressRef} />
      <ScrollOverlay
        progressRef={progressRef}
        onExplore={() => scrollTo("#why")}
        onSignIn={() => scrollTo("#login")}
      />

      {/* ================= MARQUEE ================= */}
      <div className="ld-marquee" aria-hidden="true">
        <div className="ld-marquee-track">
          {[0, 1].map((k) => (
            <React.Fragment key={k}>
              <span>Scan</span><span>Measure</span><span>Digitalize</span><span>Optimize</span>
              <span>Visualize</span><span>Dispatch</span><span>Save</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ================= WHY ================= */}
      <section className="ld-section" id="why">
        <div className="ld-container ld-why-grid">
          <div>
            <div className="ld-kicker" data-reveal>The problem</div>
            <h2 className="ld-h2" data-reveal>Trucks leave the dock half&nbsp;empty.</h2>
            <p className="ld-body" data-reveal>
              In most Indonesian warehouses, loading decisions still rely on tape
              measures and operator judgment. Small measurement errors compound
              into bad loading plans — empty pockets of space, extra trips, and a
              bottleneck right at the dock.
            </p>
            <p className="ld-body" data-reveal style={{ marginTop: 14 }}>
              Worse, the result depends on who is on shift: two operators can
              produce two different loads for the same shipment. FleetMate was
              built to make that decision <b>measured, repeatable, and visible</b> —
              for warehouse operators, loading supervisors, and fleet managers.
            </p>

            <div className="ld-bar-compare" style={{ marginTop: 30 }}>
              <div className="ld-bar-row" data-reveal>
                <div className="lbl"><span>Manual loading today</span><span className="ld-mono">~65%</span></div>
                <div className="ld-bar-track"><div className="ld-bar-fill gray" data-barw="65" /></div>
              </div>
              <div className="ld-bar-row" data-reveal>
                <div className="lbl"><span>With optimized loading</span><span className="ld-mono">85–90%</span></div>
                <div className="ld-bar-track"><div className="ld-bar-fill grad" data-barw="88" /></div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="ld-glass ld-stat-tile" data-reveal>
              <div className="num">45–55%</div>
              <div className="cap">average truck utilization in Indonesia today (ITB study) — nearly half the space ships as air</div>
            </div>
            <div className="ld-glass ld-stat-tile" data-reveal>
              <div className="num" data-count="65" data-suffix="%">0%</div>
              <div className="cap">typical utilization when loading is planned by hand and habit</div>
            </div>
            <div className="ld-glass ld-stat-tile" data-reveal>
              <div className="num lime" data-count="90" data-suffix="%">0%</div>
              <div className="cap">what optimized, measured loading can reach — FleetMate's target band</div>
            </div>
            <div className="ld-glass ld-stat-tile" data-reveal>
              <div className="num purple" data-count="20" data-prefix="+" data-suffix="%">0%</div>
              <div className="cap">utilization improvement targeted within the first quarter of deployment</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW ================= */}
      <section className="ld-section ld-blueprint" id="how" style={{ background: "#f2f4f6" }}>
        <div className="ld-container">
          <div className="ld-kicker" data-reveal>How it works</div>
          <h2 className="ld-h2" data-reveal>From cardboard to load plan<br />in five steps.</h2>
          <p className="ld-body" data-reveal style={{ maxWidth: 560 }}>
            The FleetMate process turns every physical box into a digital asset,
            then lets a deterministic optimization engine do the spatial thinking.
          </p>

          <div className="ld-steps">
            <svg ref={stepsLineRef} className="ld-steps-line" viewBox="0 0 1000 30" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0,15 L1000,15" fill="none" stroke="url(#ldg)" strokeWidth="2" strokeDasharray="6 7" />
              <defs>
                <linearGradient id="ldg" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#84cc16" /><stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            {STEPS.map((s) => (
              <div className="ld-glass ld-step-card" data-reveal key={s.n}>
                <span className="n">{s.n}</span>
                <div className="ic"><s.icon size={20} /></div>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PLATFORM ================= */}
      <section className="ld-section" id="platform">
        <div className="ld-container">
          <div className="ld-kicker" data-reveal>The platform</div>
          <h2 className="ld-h2" data-reveal>Three layers, one decision.</h2>
          <p className="ld-body" data-reveal style={{ maxWidth: 560 }}>
            Camera hardware feeds a vision service; the intelligence layer packs;
            the digital twin shows the crew exactly what to do. Explainable
            optimization — not a black box.
          </p>

          <div className="ld-platform-grid">
            {PLATFORM.map((p) => (
              <div className="ld-glass" data-reveal key={p.title}>
                <div className="ic" style={{
                  width: 44, height: 44, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(45deg, rgba(132,204,22,0.14), rgba(139,92,246,0.14))", marginBottom: 14,
                }}>
                  <p.icon size={21} />
                </div>
                <h4 style={{ fontFamily: "var(--ld-font-head)", fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>{p.title}</h4>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ld-ink-2)", margin: 0 }}>{p.body}</p>
              </div>
            ))}
          </div>

          <Terminal />
        </div>
      </section>

      {/* ================= IMPACT ================= */}
      <section className="ld-section ld-blueprint" id="impact" style={{ background: "#f2f4f6" }}>
        <div className="ld-container">
          <div className="ld-kicker" data-reveal>Why it matters</div>
          <h2 className="ld-h2" data-reveal>Built for the dock,<br />felt across the fleet.</h2>

          <div className="ld-impact-grid">
            {IMPACT.map((m) => (
              <div className="ld-glass" data-reveal key={m.title}>
                <m.icon size={20} style={{ color: "var(--ld-purple-deep)", marginBottom: 12 }} />
                <h4 style={{ fontFamily: "var(--ld-font-head)", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{m.title}</h4>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ld-ink-2)", margin: "0 0 16px" }}>{m.body}</p>
                <div className="ld-bar-track" style={{ height: 8 }}>
                  <div className="ld-bar-fill grad" data-barw={m.bar} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 56 }} data-reveal>
            <div className="ld-caps" style={{ color: "var(--ld-ink-3)", marginBottom: 14 }}>Team STAGE · President University · AI Open Innovation Challenge 2026</div>
            <div className="ld-team">
              {TEAM.map((t) => (
                <div className="ld-team-chip" key={t.name}>
                  <span className="av" style={{ background: t.color }}>{t.name.charAt(0)}</span>
                  <span>
                    <span className="nm" style={{ display: "block" }}>{t.name}</span>
                    <span className="rl">{t.role}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= LOGIN ================= */}
      <section className="ld-login ld-blueprint" id="login">
        <div className="ld-hero-layer" data-pspeed="-0.06">
          <div className="ld-glow" style={{ top: "0%", left: "-8%", width: 560, height: 560, background: "#84cc16", opacity: 0.1 }} />
          <div className="ld-glow" style={{ bottom: "-10%", right: "-6%", width: 560, height: 560, background: "#8b5cf6", opacity: 0.1 }} />
        </div>

        <div className="ld-container">
          <div className="ld-login-inner">
            <div>
              <span className="ld-chip" data-reveal>
                <span className="dot" /> FLEETMATE <span style={{ color: "#94a3b8" }}>·</span> OPS CONSOLE
              </span>
              <h2 className="ld-h1" style={{ fontSize: "clamp(34px, 3.8vw, 52px)", margin: "20px 0 16px" }} data-reveal>
                Precision logistics,<br />
                <span className="grad-p">measured in cubic</span><br />
                <span className="grad">meters.</span>
              </h2>
              <p className="ld-hero-sub" data-reveal>
                Dual-camera intake scanning, 3D load simulation and 2026 fiscal
                forecasting — one console for the whole depot.
              </p>

              <div className="ld-login-stats" data-reveal>
                <div className="ld-login-stat">
                  <div className="v">128</div>
                  <div className="l">shipments / mo</div>
                </div>
                <div className="ld-login-stat purple">
                  <div className="v">87.4%</div>
                  <div className="l">fleet utilization</div>
                </div>
                <div className="ld-login-stat orange">
                  <div className="v">Rp 128 jt</div>
                  <div className="l">saved this quarter</div>
                </div>
              </div>
            </div>

            <form className="ld-login-card" data-reveal onSubmit={handleLogin}>
              <h2>Sign in</h2>
              <div className="sub">Use your operator credentials to continue.</div>

              <div className="ld-input-wrap">
                <input
                  className="ld-input"
                  placeholder="Username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="ld-input-wrap">
                <input
                  className="ld-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: 44 }}
                />
                <button type="button" className="ld-eye" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <div className="ld-login-row">
                <label><input type="checkbox" /> Remember me</label>
                <button type="button" className="forgot" onClick={() => toast("Ask your fleet administrator to reset it", "info")}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="ld-btn ld-btn-dark" style={{ width: "100%", height: 50, fontSize: 15 }}>
                Sign in to Console
              </button>

              <div className="ld-or">or</div>

              <button type="button" className="ld-btn ld-btn-ghost" style={{ width: "100%", height: 46 }}
                onClick={() => toast("Access requests are handled by your fleet administrator", "info")}>
                Request access
              </button>

              <div className="ld-secure">
                <ShieldCheck size={14} /> Protected with enterprise-grade security
              </div>
            </form>
          </div>

          <div className="ld-footer">
            <span>© 2026 FleetMate Premium</span>
            <span>Smarter Fleet. Stronger Business.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
