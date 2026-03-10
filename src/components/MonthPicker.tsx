import { monthLabel } from "../lib/format";

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthPicker({ year, month, onChange }: MonthPickerProps) {
  function prev() {
    if (month === 1) {
      onChange(year - 1, 12);
    } else {
      onChange(year, month - 1);
    }
  }

  function next() {
    if (month === 12) {
      onChange(year + 1, 1);
    } else {
      onChange(year, month + 1);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={prev}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-[var(--muted)] hover:border-tz-yellow/40 hover:text-tz-yellow transition-colors"
      >
        ‹
      </button>
      <span className="font-display text-sm font-semibold text-[var(--text)] min-w-[130px] text-center">
        {monthLabel(year, month)}
      </span>
      <button
        onClick={next}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-[var(--muted)] hover:border-tz-yellow/40 hover:text-tz-yellow transition-colors"
      >
        ›
      </button>
    </div>
  );
}
