"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "success" | "danger" | "warning" | "muted";
}

const COLOR_MAP = {
  primary: "text-primary",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted",
};

export default function StatCard({
  label,
  value,
  sub,
  color = "primary",
}: StatCardProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${COLOR_MAP[color]}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}
