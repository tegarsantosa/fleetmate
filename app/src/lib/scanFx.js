// ============================================================
// scanFx.js — industrial-scanner feedback for the AI Scan Station
//
// Ported from the previous FleetMate (documented UX):
//  • Double "beep-beep" on a successful scan (Web Audio API),
//    like a warehouse barcode gun — instant confirmation without
//    looking at the screen. Low buzz on failure.
//  • ESP32-CAM flash-LED auto-pulse: the LED lights ONLY around
//    the actual capture, then is forced back to 0. Never leave it
//    on — the stock firmware fires the LED on every /capture and
//    the preview polls /capture continuously, so a standing
//    intensity would strobe (and cook the LED).
// ============================================================

let audioCtx = null;

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  // Safari suspends fresh contexts until a user gesture resumes them;
  // handleScan runs from a click so resume() here always succeeds.
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, startMs, durMs, type = "square", peak = 0.18) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + startMs / 1000;
  const t1 = t0 + durMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t1);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

/** Double high beep = scan OK (barcode-gun UX). */
export function beepSuccess() {
  tone(1318, 0, 70);
  tone(1760, 130, 90);
}

/** Single low buzz = scan failed. */
export function beepError() {
  tone(220, 0, 200, "sawtooth", 0.14);
}

/* ---------- ESP32 flash LED ---------- */

function camHost(rawUrl) {
  try {
    const u = new URL(rawUrl.includes("://") ? rawUrl : `http://${rawUrl}`);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

function controlCam(rawUrl, varName, val) {
  const host = camHost(rawUrl);
  if (!host) return Promise.resolve();
  // GET side-effect on the board; no-cors so a missing CORS header on
  // /control can never break the scan flow (we don't read the response).
  return fetch(`${host}/control?var=${varName}&val=${val}`, { mode: "no-cors" }).catch(() => {});
}

/** Raise the flash LED on both boards just before a capture… */
export function flashLedOn(urls, intensity = 180) {
  return Promise.all(urls.map((u) => controlCam(u, "led_intensity", intensity)));
}

/** …and ALWAYS force it back off afterwards (call from finally). */
export function flashLedOff(urls) {
  return Promise.all(urls.map((u) => controlCam(u, "led_intensity", 0)));
}

/** Remote white-balance preset (0 Auto · 1 Sunny · 2 Office · 3 Cloudy · 4 Home).
 *  Office (2) is the anti green-tint default under warehouse fluorescents. */
export function setWhiteBalance(urls, mode) {
  return Promise.all(urls.map((u) => controlCam(u, "wb_mode", mode)));
}
