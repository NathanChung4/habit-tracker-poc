interface ProgressRingProps {
  value: number;
  label: string;
}

export function ProgressRing({ value, label }: ProgressRingProps) {
  const normalized = Math.max(0, Math.min(1, value));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalized);

  return (
    <div className="progress-ring" aria-label={label}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} className="ring-bg" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          className="ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div>
        <strong>{Math.round(normalized * 100)}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
