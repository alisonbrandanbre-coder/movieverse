interface ProgressBarProps {
  value: number;
  max: number;
  /** Accessible name, e.g. "Progreso del onboarding". */
  label: string;
  /** Human readable value, e.g. "Paso 2 de 6". */
  valueText?: string;
}

/** Thin track filled with the brand gradient. */
export function ProgressBar({ value, max, label, valueText }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className="h-2 w-full overflow-hidden rounded-full border border-line bg-deep/70"
    >
      <div className="h-full rounded-full bg-brand shadow-glow transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}
