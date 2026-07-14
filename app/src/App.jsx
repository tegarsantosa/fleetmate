import React, { useEffect, useState, lazy, Suspense } from "react";
import BRAND_LOGO from "./assets/logo.png";
import { NavLink, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import CameraController from "./pages/CameraController.jsx";
import Visualizer from "./pages/Visualizer.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Account from "./pages/Account.jsx";
import ApiKeys from "./pages/ApiKeys.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import TopBar from "./components/TopBar.jsx";
import { api } from "./lib/api.js";
import {
  Moon, Sun, LayoutDashboard, Boxes, ScanLine, Container as ContainerIcon,
  KeyRound, UserRound, Box, LogOut,
} from "lucide-react";

// The landing carries its own fonts/CSS — split it so the console stays lean.
const Landing = lazy(() => import("./pages/Landing.jsx"));

const NAV = [
  { section: "Overview" },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { section: "Operations" },
  { to: "/camera", label: "AI Scan Station", icon: ScanLine },
  { to: "/visualizer", label: "Load Simulator", icon: ContainerIcon },
  { section: "Settings" },
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/account", label: "Account", icon: UserRound },
];



function SidebarUser({ theme, onToggleTheme }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
  }, []);

  const logout = () => {
    localStorage.removeItem("fleetmate_logged_in");
    navigate("/login");
  };

  return (
    <div className="sidebar-user">
      <div className="avatar">{(user?.username || "F").charAt(0).toUpperCase()}</div>
      <div style={{ minWidth: 0 }}>
        <div className="u-name">{user?.username || "Operator"}</div>
        <div className="u-mail">{user?.email || "fleet console"}</div>
      </div>
      <button
        className="theme-btn"
        onClick={onToggleTheme}
        title={theme === "light" ? "Switch to night shift" : "Switch to day shift"}
      >
        {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
      </button>
      <button className="theme-btn" style={{ marginLeft: 6 }} onClick={logout} title="Sign out to the landing page">
        <LogOut size={14} />
      </button>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  const [logoOk, setLogoOk] = useState(true);

  // Industrial Precision is light-first; the old dark default is retired.
  const [theme, setTheme] = useState(() => localStorage.getItem("fleetmate_theme_v2") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fleetmate_theme_v2", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  if (isLogin) {
    return (
      <ToastProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Landing />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="sidebar">
          <div className="nav-brand">
            {logoOk ? (
              <img src={BRAND_LOGO} alt="FleetMate" onError={() => setLogoOk(false)} />
            ) : (
              <div className="brand-mark"><Box size={16} /></div>
            )}
            <div>
              FleetMate
              <span className="brand-sub">Fleet Space Console</span>
            </div>
          </div>

          {NAV.map((item, i) =>
            item.section ? (
              <div key={`s-${i}`} className="nav-section">{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            )
          )}

          <div style={{ flex: 1 }} />
          <SidebarUser theme={theme} onToggleTheme={toggleTheme} />
        </div>

        <div className="main-col">
          <TopBar />
          <div className="page">
            {/* key remounts the wrapper per route for the enter transition */}
            <div key={location.pathname} className="page-enter">
              <Routes location={location}>
                <Route
                  path="/"
                  element={
                    <Navigate
                      to={localStorage.getItem("fleetmate_logged_in") ? "/dashboard" : "/login"}
                      replace
                    />
                  }
                />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/camera" element={<CameraController />} />
                <Route path="/visualizer" element={<Visualizer />} />
                <Route path="/api-keys" element={<ApiKeys />} />
                <Route path="/account" element={<Account />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
