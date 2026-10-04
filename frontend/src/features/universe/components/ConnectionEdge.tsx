import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";

import { CONNECTION_STYLES, strokeWidth } from "../connectionStyles";
import { chipText, type ConnectionEdge as ConnectionEdgeType } from "../graph";
import { useUniverse } from "../UniverseContext";

function ConnectionEdgeView({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<ConnectionEdgeType>) {
  const { hoveredEdgeId, spotlightId, chips } = useUniverse();
  if (!data) return null;
  const { connection } = data;
  const style = CONNECTION_STYLES[connection.type];
  const Icon = style.icon;
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  const hovered = hoveredEdgeId === id;
  const lit = spotlightId !== null && (connection.source === spotlightId || connection.target === spotlightId);
  const opacity = hovered || lit ? 1 : spotlightId !== null ? 0.08 : 0.6;
  // With a movie in the spotlight only its chips show; otherwise those that fit without overlapping.
  const chip = chips.get(id);
  const showChip = chip !== undefined && (hovered || lit || (spotlightId === null && chip.fits));

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={24}
        className="animate-edge-in"
        style={{
          stroke: style.color,
          strokeWidth: strokeWidth(connection.type, connection.strength) + (hovered || lit ? 1 : 0),
          strokeOpacity: opacity,
          strokeDasharray: style.dash,
          strokeLinecap: style.lineCap,
          transition: "stroke-opacity 250ms, stroke-width 200ms",
          animationDelay: `${data.order * 55 + 150}ms`,
        }}
      />
      {showChip && (
        <EdgeLabelRenderer>
          <div
            data-testid="edge-chip"
            className={`pointer-events-none absolute flex max-w-48 items-center gap-1.5 rounded-full border bg-deep/90 px-2.5 py-1.5 text-xs font-bold leading-none text-fg shadow-poster backdrop-blur-md transition-opacity duration-200 ${
              hovered || lit ? "z-10 border-line-strong" : "border-line"
            }`}
            style={{ transform: `translate(-50%, -50%) translate(${chip.x}px, ${chip.y}px)` }}
          >
            <Icon aria-hidden className={`size-3.5 shrink-0 ${style.text}`} />
            <span className="truncate">{chipText(connection)}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const ConnectionEdge = memo(ConnectionEdgeView);
