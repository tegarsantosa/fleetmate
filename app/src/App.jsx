import React from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import CameraController from "./pages/CameraController.jsx";
import Visualizer from "./pages/Visualizer.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <div className="nav-bar">
        <div className="nav-brand">FleetMate</div>
        <NavLink to="/camera" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Camera Controller
        </NavLink>
        <NavLink to="/visualizer" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          Load Visualizer
        </NavLink>
      </div>
      <div className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/camera" replace />} />
          <Route path="/camera" element={<CameraController />} />
          <Route path="/visualizer" element={<Visualizer />} />
        </Routes>
      </div>
    </div>
  );
}
