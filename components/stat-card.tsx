import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: "teal" | "orange" | "blue";
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, accent = "teal", icon }: StatCardProps) {
  return (
    <article className={`stat-card stat-${accent}`}>
      <header>
        <span>{label}</span>
        {icon}
      </header>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </article>
  );
}
