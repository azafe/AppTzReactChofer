/** Clases de formulario compartidas (antes duplicadas en cada página de carga). */

export const inputCls =
  "h-11 w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60";

export const readonlyCls =
  "h-11 w-full cursor-not-allowed rounded-2xl border border-white/8 bg-white/5 px-3 flex items-center text-[var(--muted)] text-sm";

export const labelCls = "mb-1 block text-xs text-[var(--muted)]";

export const textareaCls =
  "w-full rounded-2xl border border-white/15 bg-[#0f1115] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-tz-yellow/60 resize-none";

export const primaryBtnCls =
  "h-12 w-full rounded-xl bg-tz-yellow font-semibold text-tz-black hover:brightness-105 disabled:opacity-60 disabled:pointer-events-none transition-all";

/** Realce de un campo que completó el OCR. */
export const ocrRing = "ring-2 ring-tz-yellow/40 border-tz-yellow/30";
