// Points of the decorative constellation (viewBox 240 × 640) and the lines joining them.
const STARS = [
  { x: 52, y: 40, r: 1.6 },
  { x: 118, y: 96, r: 2.4 },
  { x: 74, y: 170, r: 1.4 },
  { x: 168, y: 214, r: 2 },
  { x: 120, y: 290, r: 2.8 },
  { x: 40, y: 330, r: 1.5 },
  { x: 190, y: 352, r: 1.3 },
  { x: 96, y: 418, r: 2.2 },
  { x: 150, y: 486, r: 1.6 },
  { x: 58, y: 530, r: 2 },
  { x: 132, y: 600, r: 1.4 },
] as const;

const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [3, 4],
  [2, 4],
  [4, 5],
  [4, 6],
  [4, 7],
  [7, 8],
  [7, 9],
  [9, 10],
];

/**
 * Faint constellation on the left of the page, behind the content: twinkling points joined
 * by thin lines. Purely decorative and quiet (low opacity) so it never competes with
 * posters; it fills the empty margin of wide screens. Hidden under `lg`; still with
 * reduced motion.
 */
export function SideConstellation({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 640"
      aria-hidden
      focusable="false"
      className={`pointer-events-none fixed left-0 top-28 -z-10 hidden h-[72vh] max-h-[46rem] w-auto opacity-35 lg:block min-[1800px]:opacity-55 ${className}`}
    >
      {LINKS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={STARS[a].x}
          y1={STARS[a].y}
          x2={STARS[b].x}
          y2={STARS[b].y}
          className="stroke-violet-light/40"
          strokeWidth="0.8"
        />
      ))}
      {STARS.map((star, index) => (
        <g key={index} className="animate-twinkle motion-reduce:animate-none" style={{ animationDelay: `${-index * 0.7}s` }}>
          <circle cx={star.x} cy={star.y} r={star.r * 3} className="fill-violet/20" />
          <circle cx={star.x} cy={star.y} r={star.r} className={index === 4 ? "fill-violet-soft" : "fill-fg"} />
        </g>
      ))}
    </svg>
  );
}
