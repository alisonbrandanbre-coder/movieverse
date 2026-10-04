import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";

import { Tooltip } from "@/components/ui/Tooltip";

import { CONNECTION_STYLES, strokeWidth } from "../connectionStyles";
import { chipText, chipTooltip, type ConnectionEdge as ConnectionEdgeType } from "../graph";
import { useUniverse } from "../UniverseContext";

function ConnectionEdgeView({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<ConnectionEdgeType>) {
  const { hoveredEdgeId, spotlightId, chips, hoverEdge } = useUniverse();
  if (!data) return null;
  const { connection } = data;
  const style = CONNECTION_STYLES[connection.type];
  const Icon = style.icon;
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  const hovered = hoveredEdgeId === id;
  const lit = spotlightId !== null && (connection.source === spotlightId || connection.target === spotlightId);
  const opacity = hovered || lit ? 1 : spotlightId !== null ? 0.08 : 0.6;
  // With a movie in the spotlight only its chips show; always only those that fit without
  // covering a poster or another chip (the rest shows when its own line is hovered).
  const chip = chips.get(id);
  const showChip = chip !== undefined && (hovered || (chip.fits && (lit || spotlightId === null)));

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
          {/* The chip names the reason; its tooltip (and the side panel) has every reason in full. */}
          <div
            className="nodrag nopan absolute"
            style={{ transform: `translate(-50%, -50%) translate(${chip.x}px, ${chip.y}px)`, pointerEvents: "all", zIndex: hovered || lit ? 10 : undefined }}
            onMouseEnter={() => hoverEdge(id)}
            onMouseLeave={() => hoverEdge(null)}
          >
            <Tooltip text={chipTooltip(connection)}>
              {(tooltipId) => (
                <span
                  data-testid="edge-chip"
                  aria-describedby={tooltipId}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-deep/90 px-2.5 py-1.5 text-xs font-bold leading-none text-fg shadow-poster backdrop-blur-md ${
                    hovered || lit ? "border-line-strong" : "border-line"
                  }`}
                >
                  <Icon aria-hidden className={`size-3.5 shrink-0 ${style.text}`} />
                  {chipText(connection)}
                </span>
              )}
            </Tooltip>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const ConnectionEdge = memo(ConnectionEdgeView);
