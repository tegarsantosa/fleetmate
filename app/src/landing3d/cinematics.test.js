import { describe, it, expect } from "vitest";
import {
  clamp01, smootherstep, cameraPose, truckAttitude, CAMERA_KEYFRAMES,
} from "./cinematics.js";

describe("clamp01 / smootherstep", () => {
  it("clamps out-of-range progress", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(7)).toBe(1);
  });

  it("smootherstep hits exact endpoints with flat tangents", () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    // near-zero derivative at the ends → values hug the endpoints
    expect(smootherstep(0.01)).toBeLessThan(0.001);
    expect(smootherstep(0.99)).toBeGreaterThan(0.999);
  });
});

describe("CAMERA_KEYFRAMES contract", () => {
  it("is sorted, starts at 0 and ends at 1", () => {
    expect(CAMERA_KEYFRAMES[0].t).toBe(0);
    expect(CAMERA_KEYFRAMES[CAMERA_KEYFRAMES.length - 1].t).toBe(1);
    for (let i = 1; i < CAMERA_KEYFRAMES.length; i++) {
      expect(CAMERA_KEYFRAMES[i].t).toBeGreaterThan(CAMERA_KEYFRAMES[i - 1].t);
    }
  });
});

describe("cameraPose", () => {
  it("matches the first/last keyframe at the extremes (and beyond)", () => {
    for (const p of [0, -1]) {
      const { pos, fov } = cameraPose(p);
      expect(pos).toEqual(CAMERA_KEYFRAMES[0].pos);
      expect(fov).toBe(CAMERA_KEYFRAMES[0].fov);
    }
    for (const p of [1, 2]) {
      const { pos, fov } = cameraPose(p);
      expect(pos).toEqual(CAMERA_KEYFRAMES.at(-1).pos);
      expect(fov).toBe(CAMERA_KEYFRAMES.at(-1).fov);
    }
  });

  it("produces finite, bounded values across the whole scroll", () => {
    for (let i = 0; i <= 100; i++) {
      const { pos, look, fov } = cameraPose(i / 100);
      for (const v of [...pos, ...look, fov]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(fov).toBeGreaterThanOrEqual(30);
      expect(fov).toBeLessThanOrEqual(50);
    }
  });

  it("actually travels — start and end poses are far apart", () => {
    const a = cameraPose(0).pos;
    const b = cameraPose(1).pos;
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    expect(dist).toBeGreaterThan(10);
  });

  it("returns fresh arrays (no shared mutable state)", () => {
    const a = cameraPose(0);
    a.pos[0] = 999;
    expect(cameraPose(0).pos[0]).not.toBe(999);
  });
});

describe("truckAttitude — the banking mandate", () => {
  it("banks on the roll axis mid-scroll (not a flat yaw-only turn)", () => {
    const mid = truckAttitude(0.4, 0);
    expect(Math.abs(mid.roll)).toBeGreaterThan(0.05);
  });

  it("pitches as well as rolls", () => {
    const mid = truckAttitude(0.5, 0);
    expect(Math.abs(mid.pitch)).toBeGreaterThan(0.01);
  });

  it("keeps every axis finite and within physical bounds", () => {
    for (let i = 0; i <= 50; i++) {
      const { roll, pitch, yaw, bob } = truckAttitude(i / 50, i * 0.37);
      for (const v of [roll, pitch, yaw, bob]) expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(roll)).toBeLessThan(0.35);
      expect(Math.abs(pitch)).toBeLessThan(0.2);
      expect(Math.abs(bob)).toBeLessThan(0.1);
    }
  });

  it("heading drifts across the scroll", () => {
    expect(truckAttitude(1, 0).yaw).toBeGreaterThan(truckAttitude(0, 0).yaw);
  });
});
