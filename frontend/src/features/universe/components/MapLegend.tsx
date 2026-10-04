import { CONNECTION_ORDER, CONNECTION_STYLES } from "../connectionStyles";

/** Fixed legend: line color (and dash for genres) per connection type. */
export function MapLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-card border border-line bg-surface px-4 py-3 shadow-card backdrop-blur-md ${className}`}
      aria-label="Leyenda de conexiones"
      role="group"
    >
      <p className="eyebrow mb-2 text-[10px] tracking-[3px]">Conexiones</p>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-1">
        {CONNECTION_ORDER.map((type) => {
          const style = CONNECTION_STYLES[type];
          return (
            <li key={type} className="flex items-center gap-2.5 text-xs font-semibold text-fg-secondary">
              <svg aria-hidden width="26" height="6" className="shrink-0 overflow-visible">
                <line
                  x1="1"
                  y1="3"
                  x2="25"
                  y2="3"
                  stroke={style.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={style.dash ? "4 4" : undefined}
                />
              </svg>
              {style.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
