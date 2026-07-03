import React from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import CameraController from "./pages/CameraController.jsx";
import Visualizer from "./pages/Visualizer.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Account from "./pages/Account.jsx";
import ApiKeys from "./pages/ApiKeys.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="nav-brand">FleetMate</div>
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
