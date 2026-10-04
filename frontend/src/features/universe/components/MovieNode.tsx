import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, type CSSProperties } from "react";

import { PosterImage } from "@/features/movies/components/PosterImage";

import type { MovieNode as MovieNodeType } from "../graph";
import { useUniverse } from "../UniverseContext";

// Edges start and end at the poster's center, behind it: invisible, centered handles.
const HANDLE_STYLE: CSSProperties = {
  top: "38%",
  left: "50%",
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  opacity: 0,
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
};

function MovieNodeView({ data }: NodeProps<MovieNodeType>) {
  const { rootId, focusId, selectedId, highlighted, orphans, select, hoverNode } = useUniverse();
  const { movie } = data;
  const isRoot = movie.id === rootId;
  const isFocus = movie.id === focusId && !isRoot;
  const isSelected = movie.id === selectedId;
  const dimmed = (highlighted !== null && !highlighted.has(movie.id)) || (orphans.has(movie.id) && !isRoot);

  // Widths match NODE_SIZE / ROOT_SIZE in graph.ts (the layout keeps these boxes apart).
  const size = isRoot ? "w-[150px]" : isFocus ? "w-[104px]" : "w-[90px]";
  const frame = isRoot
    ? "border-2 border-gold shadow-halo"
    : isFocus
      ? "border-2 border-violet-light shadow-halo"
      : "border border-line-strong shadow-glow group-hover:border-focus group-hover:shadow-glow-strong";

  return (
    <div
      className={`group flex animate-node-in flex-col items-center gap-2 transition-opacity duration-300 ${size} ${dimmed ? "opacity-30" : ""}`}
      style={{ animationDelay: `${data.order * 55}ms` }}
      onMouseEnter={() => hoverNode(movie.id)}
      onMouseLeave={() => hoverNode(null)}
    >
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} isConnectable={false} />
      <button
        type="button"
        onClick={() => select(movie.id)}
        aria-pressed={isSelected}
        aria-label={`${movie.title}${movie.year ? ` (${movie.year})` : ""}`}
        className={`nodrag relative w-full overflow-hidden rounded-poster bg-raised transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus ${frame} ${
          isSelected ? "-translate-y-1 outline-2 outline-offset-4 outline-violet-light" : "group-hover:-translate-y-1"
        }`}
      >
        <PosterImage src={movie.posterUrl} alt="" title={movie.title} className="w-full" />
      </button>
      {/* A dark pill behind the title keeps it readable over edges and the dotted grid. */}
      <div className="pointer-events-none flex w-[160%] flex-col items-center text-center">
        <div className="flex max-w-full flex-col items-center rounded-control bg-deep/70 px-2 py-1 backdrop-blur-sm">
          <p className={`line-clamp-2 leading-tight text-fg ${isRoot ? "font-display text-3xl tracking-wide" : "text-md font-bold"}`}>
            {movie.title}
          </p>
          {movie.year && <p className="text-sm font-semibold text-fg-secondary">{movie.year}</p>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} isConnectable={false} />
    </div>
  );
}

export const MovieNode = memo(MovieNodeView);
