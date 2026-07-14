/**
 * FleetMate — Tailwind setup.
 *
 * Brand identity is exposed exclusively through CSS variables (defined in
 * src/tailwind.css :root), so the exact brand palette/typography can be
 * swapped in one place without touching any component markup:
 *
 *   bg-brand-primary   → var(--brand-primary)    (lime  — growth / CTA)
 *   bg-brand-accent    → var(--brand-accent)     (purple — tech depth)
 *   bg-brand-ink       → var(--brand-ink)        (slate-900 — control center)
 *   bg-brand-surface   → var(--brand-surface)    (slate-50 canvas)
 *   font-brand         → headline face
 *   font-brand-body    → body face
 *   font-brand-mono    → data / label face
 *
 * Preflight is disabled on purpose: the operator console (styles.css) styles
 * raw elements and must not be reset by Tailwind.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          "primary-deep": "rgb(var(--brand-primary-deep) / <alpha-value>)",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
          "accent-deep": "rgb(var(--brand-accent-deep) / <alpha-value>)",
          ink: "rgb(var(--brand-ink) / <alpha-value>)",
          "ink-soft": "rgb(var(--brand-ink-soft) / <alpha-value>)",
          surface: "rgb(var(--brand-surface) / <alpha-value>)",
          line: "rgb(var(--brand-line) / <alpha-value>)",
        },
      },
      fontFamily: {
        brand: "var(--brand-font-head)",
        "brand-body": "var(--brand-font-body)",
        "brand-mono": "var(--brand-font-mono)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
