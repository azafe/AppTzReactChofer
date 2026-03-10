import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-[rgba(20,26,36,0.9)] p-4 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent = false }: StatCardProps) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${accent ? "text-tz-yellow" : "text-[var(--text)]"}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </Card>
  );
}

type ChipVariant = "neutral" | "good" | "warn" | "bad";

interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
}

const chipStyles: Record<ChipVariant, string> = {
  neutral: "bg-white/10 text-[var(--text)]",
  good: "bg-[rgba(79,209,161,0.18)] text-[var(--good)]",
  warn: "bg-[rgba(240,199,95,0.18)] text-tz-yellow",
  bad: "bg-[rgba(255,107,107,0.18)] text-tz-red",
};

export function Chip({ children, variant = "neutral" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipStyles[variant]}`}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-lg font-semibold text-[var(--text)]">
      {children}
    </h2>
  );
}
