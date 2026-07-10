/**
 * cinematics.js — pure math for the scrollytelling camera rig and the
 * truck's physical attitude. No three.js imports: everything here is
 * plain numbers in/out so it can be unit-tested headlessly (vitest).
 *
 * Coordinate convention (matches TruckModel):
 *   - truck centered at origin, resting on y = 0
 *   - front grille faces -X, total length ≈ 9.2 m, cab roof ≈ y 3.1
 */

export const CABIN_GREEN = "#84cc16"; // brand primary — applied to cab paint

export function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/** Quintic smootherstep — zero 1st/2nd derivative at the ends. */
export function smootherstep(u) {
  const t = clamp01(u);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function lerp(a, b, u) {
  return a + (b - a) * u;
}

function lerp3(a, b, u) {
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

/**
 * Camera keyframes over normalized scroll progress p ∈ [0, 1].
 * Beat 1 — extreme close-up on the grille/headlights.
 * Beat 2 — pull back & pan along the flank.
 * Beat 3 — wide orbit to a high three-quarter hero shot.
 */
export const CAMERA_KEYFRAMES = [
  { t: 0.0, pos: [-6.1, 1.15, 0.9], look: [-4.6, 1.35, 0], fov: 32 },
  { t: 0.18, pos: [-8.2, 1.7, 4.2], look: [-2.5, 1.6, 0], fov: 36 },
  { t: 0.42, pos: [-2.5, 2.4, 9.0], look: [0.3, 1.7, 0], fov: 40 },
  { t: 0.68, pos: [5.5, 3.0, 7.6], look: [0.4, 1.6, 0], fov: 42 },
  { t: 1.0, pos: [10.0, 6.0, -8.0], look: [0.0, 1.4, 0], fov: 45 },
];

/**
 * Resolve the camera pose at scroll progress p by easing between the two
 * surrounding keyframes. Returns { pos, look, fov } with plain arrays.
 */
export function cameraPose(p, keys = CAMERA_KEYFRAMES) {
  const t = clamp01(p);
  if (t <= keys[0].t) {
    const k = keys[0];
    return { pos: [...k.pos], look: [...k.look], fov: k.fov };
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) {
      const u = smootherstep((t - a.t) / (b.t - a.t));
      return {
        pos: lerp3(a.pos, b.pos, u),
        look: lerp3(a.look, b.look, u),
        fov: lerp(a.fov, b.fov, u),
      };
    }
  }
  const k = keys[keys.length - 1];
  return { pos: [...k.pos], look: [...k.look], fov: k.fov };
}

/**
 * Physical attitude of the truck. The brief is explicit: the rig must bank
 * on its ROLL and PITCH axes to convey weight — never a flat yaw-only turn.
 *
 * @param {number} p    normalized scroll progress [0, 1]
 * @param {number} time elapsed seconds (idle micro-motion)
 * @returns {{ roll:number, pitch:number, yaw:number, bob:number }} radians / meters
 */
export function truckAttitude(p, time = 0) {
  const t = clamp01(p);
  return {
    // banking into the turn — peaks mid-scroll, settles at both ends
    roll: -0.16 * Math.sin(t * Math.PI * 1.35) + 0.008 * Math.sin(time * 1.1),
    // nose dips under braking as the camera pulls away
    pitch: 0.075 * Math.sin(t * Math.PI * 0.9 + 0.5) + 0.006 * Math.sin(time * 1.7 + 1),
    // slow drift of heading across the whole scroll
    yaw: -0.15 + t * 1.15,
    // suspension idle bob
    bob: 0.035 * Math.sin(time * 1.3),
  };
}
