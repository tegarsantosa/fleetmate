import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/**
 * The scrollytelling act: three full-viewport text beats stacked over the
 * fixed 3D canvas. A single ScrollTrigger maps the act's scroll progress
 * onto progressRef (consumed by the camera rig), while each beat's copy
 * fades in and parallax-translates out on its own scrubbed timeline.
 */

const BEATS = [
  {
    kicker: "FLEETMATE — OPS CONSOLE",
    title: ["Precision", "Logistics"],
    sub: "A cinematic look at the machine that packs your fleet. Keep scrolling.",
  },
  {
    kicker: "STEREO VISION · DIGITAL TWIN",
    title: ["Measured in", "Cubic Meters"],
    sub: "Every box is scanned by dual cameras and placed by a deterministic 3D bin-packing engine — no tape measures, no guesswork.",
  },
  {
    kicker: "BEST-FIT SCHEDULING",
    title: ["Every Truck", "Leaves Full."],
    sub: "Partially loaded vehicles fill first. Full ones roll out. The story of why we built it is just below.",
  },
];

export default function ScrollOverlay({ progressRef, onExplore, onSignIn }) {
  const actRef = useRef(null);

  useEffect(() => {
    const act = actRef.current;
    if (!act) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const beats = gsap.utils.toArray(act.querySelectorAll("[data-beat]"));

    if (reduced) {
      gsap.set(beats, { autoAlpha: 1, y: 0 });
      if (progressRef?.current) progressRef.current.p = 0.82;
      return;
    }

    const triggers = [];

    /* master progress: 0 → 1 across the whole act, feeds the camera rig */
    triggers.push(
      ScrollTrigger.create({
        trigger: act,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          if (progressRef?.current) progressRef.current.p = self.progress;
        },
      })
    );

    /* each beat: rise in, hold, drift out — fully scrubbed to scroll */
    beats.forEach((el) => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el.parentElement,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      tl.fromTo(el, { autoAlpha: 0, y: 110 }, { autoAlpha: 1, y: 0, duration: 0.32 })
        .to(el, { autoAlpha: 1, y: -18, duration: 0.36 })
        .to(el, { autoAlpha: 0, y: -120, duration: 0.32 });
      triggers.push(tl.scrollTrigger);
    });

    /* hand the stage back to the light content: fade the canvas out */
    const canvas = document.getElementById("cine-canvas");
    if (canvas) {
      triggers.push(
        ScrollTrigger.create({
          trigger: act,
          start: "bottom 85%",
          end: "bottom 35%",
          scrub: true,
          animation: gsap.fromTo(canvas, { opacity: 1 }, { opacity: 0, ease: "none" }),
          onLeave: () => { canvas.style.visibility = "hidden"; },
          onEnterBack: () => { canvas.style.visibility = "visible"; },
        })
      );
    }

    return () => triggers.forEach((t) => t && t.kill());
  }, [progressRef]);

  return (
    <div ref={actRef} id="cine-act" className="relative z-10 pointer-events-none">
      {BEATS.map((beat, i) => (
        <section key={i} className="min-h-screen flex items-center justify-center overflow-hidden">
          <div data-beat className="text-center px-6 will-change-transform">
            <div className="font-brand-mono text-[11px] md:text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary mb-6">
              {beat.kicker}
            </div>
            <h2 className="font-brand font-extrabold tracking-tight leading-[0.95] text-white text-[13vw] md:text-[8.5vw] drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
              {beat.title[0]}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">
                {beat.title[1]}
              </span>
            </h2>
            <p className="font-brand-body text-white/70 text-base md:text-lg max-w-xl mx-auto mt-7 leading-relaxed">
              {beat.sub}
            </p>

            {i === BEATS.length - 1 && (
              <div className="flex gap-3 justify-center mt-10 pointer-events-auto">
                <button
                  onClick={onExplore}
                  className="font-brand font-bold text-sm px-6 py-3.5 rounded-lg bg-brand-primary text-brand-ink
                             transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(132,204,22,0.45)]
                             inline-flex items-center gap-2 border-0 cursor-pointer"
                >
                  Explore the story <ArrowDown size={15} />
                </button>
                <button
                  onClick={onSignIn}
                  className="font-brand font-bold text-sm px-6 py-3.5 rounded-lg bg-white/10 text-white backdrop-blur
                             border border-white/25 transition-all duration-200 ease-brand hover:bg-white/20 cursor-pointer"
                >
                  Sign in to Console
                </button>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* scroll cue on the first beat */}
      <div className="absolute top-[92vh] left-1/2 -translate-x-1/2 text-white/50 font-brand-mono text-[10px] tracking-[0.35em] uppercase flex flex-col items-center gap-2">
        <span className="block w-px h-10 bg-gradient-to-b from-transparent via-white/50 to-transparent" />
        scroll
      </div>
    </div>
  );
}
