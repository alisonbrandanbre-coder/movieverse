import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";

import { CONNECTION_STYLES } from "../connectionStyles";
import { shortLabel, type ConnectionEdge as ConnectionEdgeType } from "../graph";
import { useUniverse } from "../UniverseContext";

const LABEL_POSITION = 0.62;

function ConnectionEdgeView({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<ConnectionEdgeType>) {
  const { hoveredEdgeId, selectedId } = useUniverse();
  if (!data) return null;
  const { connection } = data;
  const style = CONNECTION_STYLES[connection.type];
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  // Label toward the neighbor: the middle of the line is often behind the center poster.
  const labelX = sourceX + (targetX - sourceX) * LABEL_POSITION;
  const labelY = sourceY + (targetY - sourceY) * LABEL_POSITION;

  const hovered = hoveredEdgeId === id;
  const touchesSelection = selectedId !== null && (connection.source === selectedId || connection.target === selectedId);
  const opacity = hovered || touchesSelection ? 0.95 : selectedId !== null ? 0.12 : 0.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={24}
        className="animate-edge-in"
        style={{
          stroke: style.color,
          strokeWidth: 1 + connection.strength * 3 + (hovered ? 1.5 : 0),
          strokeOpacity: opacity,
          strokeDasharray: style.dash,
          strokeLinecap: "round",
          transition: "stroke-opacity 250ms, stroke-width 200ms",
          animationDelay: `${data.order * 55 + 150}ms`,
        }}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex max-w-64 animate-fade-up items-center gap-2 rounded-full border border-line-strong bg-raised/95 px-3 py-1.5 text-xs font-bold text-fg shadow-poster backdrop-blur-md"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${style.swatch}`} />
            <span className="truncate">{shortLabel(connection.reasons.map((r) => r.label))}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const ConnectionEdge = memo(ConnectionEdgeView);
