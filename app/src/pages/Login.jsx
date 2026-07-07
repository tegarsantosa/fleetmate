import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import anime from "animejs";
import { ArrowRight, Box, Layers, Truck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const heroRef = useRef();
  const titleRef = useRef();
  const formRef = useRef();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Parallax background (CSS requestAnimationFrame driven)
    let animationFrameId;
    const handleScroll = () => {
      if (!heroRef.current || window.innerWidth <= 768) return;
      const scrollY = window.scrollY;
      const layers = heroRef.current.querySelectorAll(".parallax-layer");
      layers.forEach((layer) => {
        const speed = layer.getAttribute("data-speed");
        const yPos = -(scrollY * speed);
        layer.style.transform = `translate3d(0, ${yPos}px, 0)`;
      });
      animationFrameId = requestAnimationFrame(handleScroll);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (document.visibilityState === "hidden") {
      gsap.set(formRef.current, { y: 0, opacity: 1 });
      return;
    }

    // GSAP staggered entrance
    gsap.fromTo(
      formRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.2)", delay: 0.2 }
    );

    // Anime.js title character animation
    if (titleRef.current) {
      const chars = Array.from(titleRef.current.innerText);
      titleRef.current.innerHTML = "";
      chars.forEach((char) => {
        const span = document.createElement("span");
        span.innerText = char;
        span.style.opacity = 0;
        span.style.display = "inline-block";
        titleRef.current.appendChild(span);
      });

      anime({
        targets: titleRef.current.querySelectorAll("span"),
        opacity: [0, 1],
        translateY: [20, 0],
        easing: "easeOutExpo",
        duration: 800,
        delay: anime.stagger(40),
      });
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      {/* Hero section with parallax */}
      <div 
        ref={heroRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "120vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "var(--bg-primary)"
        }}
      >
        <div 
          className="parallax-layer" 
          data-speed="0.2"
          style={{
            position: "absolute",
            inset: 0,
            backgroundSize: "60px 60px",
            backgroundImage: "linear-gradient(to right, var(--border-color) 1px, transparent 1px), linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)",
            opacity: 0.1
          }}
        />
        <div 
          className="parallax-layer" 
          data-speed="0.5"
          style={{
            position: "absolute",
            top: "20%",
            right: "10%",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, var(--accent-blue) 0%, transparent 60%)",
            opacity: 0.05,
            filter: "blur(40px)"
          }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div 
          ref={formRef}
          className="card"
          style={{
            width: "100%",
            maxWidth: "420px",
            padding: "40px",
            background: "rgba(20, 20, 20, 0.8)", // slightly transparent for hero effect
            backdropFilter: "blur(12px)",
            border: "1px solid var(--border-color)"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ display: "inline-flex", padding: "12px", borderRadius: "12px", background: "var(--bg-surface)", marginBottom: "16px" }}>
              <Box color="var(--accent-blue)" size={32} />
            </div>
            <h1 ref={titleRef} style={{ fontSize: "28px", fontWeight: "800", marginBottom: "8px", letterSpacing: "-0.5px" }}>
              FleetMate
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Every cubic meter, accounted for.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="floating-group">
              <input 
                type="email" 
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label>Work Email</label>
            </div>

            <div className="floating-group">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label>Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "10px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  padding: "4px 8px",
                  fontSize: "12px"
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", height: "48px", marginTop: "12px", fontSize: "14px" }}>
              Sign In to Dashboard
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ marginTop: "32px", borderTop: "1px solid var(--border-color)", paddingTop: "24px", display: "flex", justifyContent: "center", gap: "24px" }}>
            <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
              <Layers size={20} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
              <div>3D Packing</div>
            </div>
            <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
              <Truck size={20} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
              <div>Fleet Opt</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
