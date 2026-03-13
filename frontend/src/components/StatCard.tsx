"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "success" | "danger" | "warning" | "muted";
}

const COLOR_MAP = {
  primary: "text-accent",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-text-secondary",
};

const GLOW_MAP: Record<string, string> = {
  primary: "shadow-[0_0_30px_rgba(74,222,128,0.06)]",
  success: "shadow-[0_0_30px_rgba(74,222,128,0.06)]",
  danger: "shadow-[0_0_30px_rgba(239,68,68,0.06)]",
  warning: "shadow-[0_0_30px_rgba(245,158,11,0.06)]",
  muted: "",
};

export default function StatCard({
  label,
  value,
  sub,
  color = "primary",
}: StatCardProps) {
  return (
    <div
      className={`bg-bg-card/60 backdrop-blur-sm border border-border-default rounded-xl p-5 transition-all duration-200 hover:border-border-strong ${GLOW_MAP[color]}`}
    >
      <p className="text-sm text-text-tertiary mb-1">{label}</p>
      <p className={`text-2xl font-heading font-bold ${COLOR_MAP[color]}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-text-tertiary mt-1">{sub}</p>}
    </div>
  );
}
