// A small constellation whose stars light up one after the other (loading the map).
const STARS = [
  { x: 60, y: 60, r: 5 },
  { x: 22, y: 30, r: 3 },
  { x: 100, y: 24, r: 3.5 },
  { x: 108, y: 82, r: 3 },
  { x: 30, y: 98, r: 3.5 },
  { x: 70, y: 112, r: 2.5 },
  { x: 8, y: 66, r: 2.5 },
];
const LINES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [4, 5],
  [1, 6],
];

/** Loading state for space-themed screens: stars appearing in sequence + a label. */
export function StarsLoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-5 py-16 text-fg-secondary">
      <svg viewBox="0 0 120 130" className="size-32 overflow-visible" aria-hidden>
        {LINES.map(([a, b], i) => (
          <line
            key={i}
            x1={STARS[a].x}
            y1={STARS[a].y}
            x2={STARS[b].x}
            y2={STARS[b].y}
            stroke="var(--color-violet-light)"
            strokeOpacity="0.35"
            strokeWidth="1"
            className="animate-star-in"
            style={{ animationDelay: `${(b + 1) * 160}ms`, transformOrigin: `${STARS[a].x}px ${STARS[a].y}px` }}
          />
        ))}
        {STARS.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill={i === 0 ? "var(--color-gold)" : "var(--color-fg)"}
            className="animate-star-in"
            style={{ animationDelay: `${i * 160}ms`, transformOrigin: `${star.x}px ${star.y}px` }}
          />
        ))}
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}
