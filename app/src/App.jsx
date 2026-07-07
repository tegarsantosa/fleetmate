import React, { useEffect, useState } from "react";
import { NavLink, Routes, Route, Navigate, useLocation } from "react-router-dom";
import CameraController from "./pages/CameraController.jsx";
import Visualizer from "./pages/Visualizer.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Account from "./pages/Account.jsx";
import ApiKeys from "./pages/ApiKeys.jsx";
import Login from "./pages/Login.jsx";
import { Moon, Sun } from "lucide-react";

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  
  const [theme, setTheme] = useState("dark");
  
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  if (isLogin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="nav-brand">
          <div style={{ width: 24, height: 24, background: "var(--accent-blue)", borderRadius: 6 }}></div>
          FleetMate
        </div>
        
        <div className="nav-section">Overview</div>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Dashboard
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Inventory
        </NavLink>
        
        <div className="nav-section">Operations</div>
        <NavLink to="/camera" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Camera Scanner
        </NavLink>
        <NavLink to="/visualizer" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Load Simulator
        </NavLink>
        
        <div style={{ flex: 1 }} />
        
        <div style={{ padding: "0 20px 20px" }}>
          <button 
            onClick={toggleTheme} 
            className="btn-secondary" 
            style={{ width: "100%", justifyContent: "center" }}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        <div className="nav-section">Settings</div>
        <NavLink to="/api-keys" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          API Keys
        </NavLink>
        <NavLink to="/account" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Account
        </NavLink>
      </div>
      
      <div className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/camera" element={<CameraController />} />
          <Route path="/visualizer" element={<Visualizer />} />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route path="/account" element={<Account />} />
        </Routes>
      </div>
    </div>
  );
}
