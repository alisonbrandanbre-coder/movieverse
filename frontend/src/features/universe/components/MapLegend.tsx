import { CONNECTION_ORDER, CONNECTION_STYLES } from "../connectionStyles";

/** Fixed legend: line color (and dash for genres) per connection type. One compact row on phones. */
export function MapLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-card border border-line bg-surface px-3 py-2 shadow-card backdrop-blur-md sm:px-4 sm:py-3 ${className}`}
      aria-label="Leyenda de conexiones"
      role="group"
    >
      <p className="eyebrow mb-2 hidden text-[10px] tracking-[3px] sm:block">Conexiones</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 sm:grid sm:grid-cols-1">
        {CONNECTION_ORDER.map((type) => {
          const style = CONNECTION_STYLES[type];
          return (
            <li key={type} className="flex items-center gap-1.5 text-xs font-semibold text-fg-secondary sm:gap-2.5">
              <svg aria-hidden width="26" height="6" viewBox="0 0 26 6" className="w-4 shrink-0 overflow-visible sm:w-[26px]">
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
