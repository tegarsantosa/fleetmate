import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Count-up on a plain object tween. Skips straight to the final value when the
// tab is hidden (rAF is frozen there) or the user prefers reduced motion.
export function useCountUp(value, { duration = 1.1, decimals = 0, format } = {}) {
  const ref = useRef(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = Number(value) || 0;
    const fmt = format || ((v) => v.toFixed(decimals));

    if (document.visibilityState === "hidden" || prefersReducedMotion()) {
      el.textContent = fmt(target);
      prevValue.current = target;
      return;
    }

    const proxy = { v: prevValue.current };
    const tween = gsap.to(proxy, {
      v: target,
      duration,
      ease: "power2.out",
      onUpdate: () => { el.textContent = fmt(proxy.v); },
    });
    prevValue.current = target;
    return () => tween.kill();
  }, [value, duration, decimals, format]);

  return ref;
}

// Staggered rise-in for a container's [data-animate="rise"] children.
export function useRiseIn(deps = []) {
  const scopeRef = useRef(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const targets = scope.querySelectorAll('[data-animate="rise"]');
    if (!targets.length) return;

    if (document.visibilityState === "hidden" || prefersReducedMotion()) {
      gsap.set(targets, { y: 0, opacity: 1 });
      return;
    }

    const tween = gsap.fromTo(
      targets,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: "power3.out", clearProps: "transform,opacity" }
    );
    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scopeRef;
}

export const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
export const fmtM3 = (v) => `${(v / 1_000_000).toFixed(2)}`;
export const fmtPct = (v) => `${v.toFixed(1)}%`;
