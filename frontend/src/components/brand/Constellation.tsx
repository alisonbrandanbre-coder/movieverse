const CENTER = { x: 210, y: 140, title: "Interstellar" };

const NODES = [
  { x: 72, y: 58, title: "Inception", link: "DIRECTOR" },
  { x: 84, y: 228, title: "Memento", link: "DIRECTOR" },
  { x: 350, y: 52, title: "Gravity", link: "GÉNERO" },
  { x: 342, y: 226, title: "The Martian", link: "SIMILAR" },
];

/** Decorative mini constellation for the auth screens: Interstellar and the films it connects to. */
export function Constellation({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 280" className={className} aria-hidden focusable="false">
      {NODES.map((node) => {
        // Labels sit further out on the lower links so they clear the "INTERSTELLAR" pill.
        const t = node.y > CENTER.y ? 0.7 : 0.5;
        const labelX = CENTER.x + (node.x - CENTER.x) * t;
        const labelY = CENTER.y + (node.y - CENTER.y) * t;
        return (
          <g key={node.title}>
            <line
              x1={CENTER.x}
              y1={CENTER.y}
              x2={node.x}
              y2={node.y}
              className="stroke-violet-light/45"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <text x={labelX} y={labelY - 6} textAnchor="middle" className="fill-label text-[9px] font-bold tracking-[2px]">
              {node.link}
            </text>
            <circle cx={node.x} cy={node.y} r="9" className="fill-violet/20" />
            <circle cx={node.x} cy={node.y} r="3.5" className="fill-fg" />
            <text
              x={node.x}
              y={node.y + (node.y < CENTER.y ? -16 : 24)}
              textAnchor="middle"
              className="fill-fg-secondary text-[13px] font-semibold"
            >
              {node.title}
            </text>
          </g>
        );
      })}
      <circle cx={CENTER.x} cy={CENTER.y} r="22" className="fill-gold/10" />
      <circle cx={CENTER.x} cy={CENTER.y} r="13" className="fill-violet/30 stroke-violet-light" strokeWidth="1.2" />
      <circle cx={CENTER.x} cy={CENTER.y} r="5" className="fill-gold" />
      <rect x={CENTER.x - 68} y={CENTER.y + 20} width="136" height="28" rx="14" className="fill-deep/90 stroke-line" />
      <text x={CENTER.x} y={CENTER.y + 41} textAnchor="middle" className="fill-fg font-display text-[19px] tracking-[2px]">
        {CENTER.title.toUpperCase()}
      </text>
    </svg>
  );
}
