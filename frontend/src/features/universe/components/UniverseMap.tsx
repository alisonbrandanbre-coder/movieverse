import { useQueryClient } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import { Eraser, Info, LocateFixed, Minus, Plus, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import type { Neighborhood } from "@/types/graph";

import { getNeighborhood, graphKeys } from "../api";
import {
  connectionsOf,
  createMap,
  LANDSCAPE_RING,
  MAX_ACTIVE_NODES,
  mergeNeighborhood,
  nodeId,
  PORTRAIT_RING,
  visit,
  type ConnectionEdge as ConnectionEdgeType,
  type MovieNode as MovieNodeType,
} from "../graph";
import { UniverseContext, type UniverseContextValue } from "../UniverseContext";
import { ConnectionEdge } from "./ConnectionEdge";
import { MapBreadcrumb } from "./MapBreadcrumb";
import { MapLegend } from "./MapLegend";
import { MovieNode } from "./MovieNode";
import { NodePanel } from "./NodePanel";

const NODE_TYPES = { movie: MovieNode };
const EDGE_TYPES = { connection: ConnectionEdge };
const FIT_OPTIONS = { padding: 0.18, duration: 700 };
const FOCUS_ZOOM = 0.85;
const FALLBACK_SIZE = { width: 96, height: 190 };
const FEEDBACK_MS = 4500;

type Feedback = { text: string; tone: "info" | "error" } | null;

/** The cinematic map. Mount with `key={movieId}` so a new starting movie resets it. */
export function UniverseMap({ initial }: { initial: Neighborhood }) {
  return (
    <ReactFlowProvider>
      <MapCanvas initial={initial} />
    </ReactFlowProvider>
  );
}

function MapCanvas({ initial }: { initial: Neighborhood }) {
  const queryClient = useQueryClient();
  const flow = useReactFlow<MovieNodeType, ConnectionEdgeType>();
  // Phones are portrait: a tall ring keeps posters bigger once the map is fitted.
  const [shape] = useState(() =>
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches ? PORTRAIT_RING : LANDSCAPE_RING,
  );
  const start = useMemo(() => createMap(initial, shape), [initial, shape]);
  const [nodes, setNodes, onNodesChange] = useNodesState<MovieNodeType>(start.nodes);
  const [edges, setEdges] = useEdgesState<ConnectionEdgeType>(start.edges);
  const rootId = initial.center;
  const [path, setPath] = useState<number[]>([rootId]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([rootId]));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [expanding, setExpanding] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [degraded, setDegraded] = useState(initial.degraded);

  const focusId = path[path.length - 1];
  const movies = useMemo(() => new Map(nodes.map((n) => [n.data.movie.id, n.data.movie])), [nodes]);
  const atLimit = nodes.length >= MAX_ACTIVE_NODES;

  const highlighted = useMemo(() => {
    if (selectedId === null) return null;
    const ids = new Set([selectedId]);
    connectionsOf(selectedId, edges).forEach((c) => ids.add(c.source).add(c.target));
    return ids;
  }, [selectedId, edges]);

  const centerOn = useCallback(
    (movieId: number, zoom?: number) => {
      const node = flow.getNode(nodeId(movieId));
      if (!node) return;
      const width = node.measured?.width ?? FALLBACK_SIZE.width;
      const height = node.measured?.height ?? FALLBACK_SIZE.height;
      void flow.setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: zoom ?? Math.max(flow.getZoom(), FOCUS_ZOOM),
        duration: 800,
      });
    },
    [flow],
  );

  const select = useCallback((movieId: number) => setSelectedId((current) => (current === movieId ? null : movieId)), []);

  const context = useMemo<UniverseContextValue>(
    () => ({ rootId, focusId, selectedId, hoveredEdgeId, highlighted, select }),
    [rootId, focusId, selectedId, hoveredEdgeId, highlighted, select],
  );

  // Informative messages fade away so they do not stay on top of posters.
  useEffect(() => {
    if (feedback?.tone !== "info") return;
    const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  // Escape closes the panel (keyboard users).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function expand(movieId: number) {
    if (atLimit) {
      setFeedback({ text: `El mapa ya tiene ${nodes.length} películas. Limpialo para seguir explorando.`, tone: "error" });
      return;
    }
    setExpanding(movieId);
    setFeedback(null);
    try {
      const neighborhood = await queryClient.fetchQuery({
        queryKey: graphKeys.movie(movieId),
        queryFn: ({ signal }) => getNeighborhood(movieId, signal),
        staleTime: 10 * 60_000,
      });
      // New neighbors open away from where the user came from.
      const fromId = focusId !== movieId ? focusId : path[path.length - 2];
      const from = fromId !== undefined ? (flow.getNode(nodeId(fromId))?.position ?? null) : null;
      const result = mergeNeighborhood(nodes, edges, neighborhood, from);
      setNodes(result.nodes);
      setEdges(result.edges);
      setExpanded((current) => new Set(current).add(movieId));
      setPath((current) => visit(current, movieId));
      if (neighborhood.degraded) setDegraded(true);
      const title = movies.get(movieId)?.title ?? "esta película";
      setFeedback({
        text:
          result.added.length > 0
            ? `${result.added.length} ${result.added.length === 1 ? "película nueva" : "películas nuevas"} conectadas con ${title}.`
            : `Todas las conexiones de ${title} ya están en el mapa.`,
        tone: "info",
      });
      centerOn(movieId);
    } catch (error) {
      setFeedback({ text: getErrorMessage(error, "No pudimos expandir el mapa. Probá de nuevo."), tone: "error" });
    } finally {
      setExpanding(null);
    }
  }

  function goTo(movieId: number) {
    setPath((current) => visit(current, movieId));
    setSelectedId(movieId);
    centerOn(movieId);
  }

  function recenter() {
    setPath((current) => visit(current, rootId));
    setSelectedId(null);
    centerOn(rootId, FOCUS_ZOOM);
  }

  function clearMap() {
    const fresh = createMap(initial, shape);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setPath([rootId]);
    setExpanded(new Set([rootId]));
    setSelectedId(null);
    setFeedback({ text: "Mapa limpio: volviste al punto de partida.", tone: "info" });
    window.setTimeout(() => void flow.fitView(FIT_OPTIONS), 80);
  }

  const selected = selectedId !== null ? movies.get(selectedId) : undefined;
  const focusMovie = movies.get(focusId);
  const crumbs = path.map((id) => movies.get(id)).filter((m) => m !== undefined);

  return (
    <UniverseContext.Provider value={context}>
      <div className="mv-flow relative size-full">
        <ReactFlow<MovieNodeType, ConnectionEdgeType>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          // An edge handler also keeps edges hoverable (React Flow disables pointer events
          // on non-selectable edges without a click handler).
          onEdgeClick={(_, edge) => edge.data && setSelectedId(edge.data.connection.target)}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onPaneClick={() => setSelectedId(null)}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.2}
          maxZoom={1.8}
          colorMode="dark"
          aria-label="Mapa cinematográfico"
        >
          <Background variant={BackgroundVariant.Dots} gap={42} size={1.4} color="var(--color-violet-soft)" className="opacity-40" />
          <MiniMap
            pannable
            zoomable
            ariaLabel="Minimapa"
            className="!hidden md:!block"
            nodeColor={(node: Node) => (node.id === nodeId(rootId) ? "var(--color-gold)" : "var(--color-violet-light)")}
            nodeStrokeWidth={0}
            nodeBorderRadius={6}
            style={{ width: 168, height: 112 }}
          />
        </ReactFlow>

        {/* Top: breadcrumb + tools */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
          <div className="pointer-events-auto min-w-0 max-w-full sm:max-w-[60%]">
            <MapBreadcrumb path={crumbs} onSelect={goTo} />
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-surface p-1 shadow-card backdrop-blur-md">
            <span className="hidden px-2 text-xs font-semibold text-fg-muted sm:inline" aria-live="polite">
              {nodes.length}/{MAX_ACTIVE_NODES} películas
            </span>
            <MapIconButton label="Acercar" onClick={() => void flow.zoomIn({ duration: 300 })}>
              <Plus className="size-4" aria-hidden />
            </MapIconButton>
            <MapIconButton label="Alejar" onClick={() => void flow.zoomOut({ duration: 300 })}>
              <Minus className="size-4" aria-hidden />
            </MapIconButton>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={recenter}>
              <LocateFixed className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Recentrar</span>
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={clearMap}>
              <Eraser className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Limpiar mapa</span>
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="pointer-events-none absolute inset-x-3 top-16 z-10 flex flex-col items-center gap-2 sm:top-[4.5rem]">
          {atLimit && (
            <div
              role="alert"
              className="pointer-events-auto flex max-w-xl flex-col gap-3 rounded-card border border-danger-strong/40 bg-base/95 px-4 py-3 shadow-card backdrop-blur-md sm:flex-row sm:items-center"
            >
              <p className="flex items-start gap-2 text-sm text-fg-secondary">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                El mapa tiene {nodes.length} películas (máximo ~{MAX_ACTIVE_NODES}). Limpialo para seguir explorando con fluidez.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" onClick={clearMap}>
                  Limpiar mapa
                </Button>
                {focusMovie && focusId !== rootId && (
                  <Link to={`/universe/${focusId}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                    Empezar desde {focusMovie.title}
                  </Link>
                )}
              </div>
            </div>
          )}
          <p
            role="status"
            className={`pointer-events-auto max-w-xl rounded-full border bg-raised/95 px-4 py-1.5 text-center text-sm font-semibold shadow-card backdrop-blur-md empty:hidden ${
              feedback?.tone === "error" ? "border-danger-strong/50 text-danger" : "border-violet-light/40 text-fg"
            }`}
          >
            {feedback?.text}
          </p>
          {degraded && (
            <p className="pointer-events-auto flex items-center gap-2 rounded-full bg-raised/90 px-4 py-1.5 text-xs text-fg-secondary">
              <Info className="size-3.5 text-violet-soft" aria-hidden />
              TMDB no respondió del todo: pueden faltar algunas conexiones.
            </p>
          )}
        </div>

        {/* Legend */}
        <MapLegend className="absolute bottom-3 left-3 z-10 sm:bottom-4 sm:left-4" />

        {selected && (
          <NodePanel
            key={selected.id}
            movie={selected}
            connections={connectionsOf(selected.id, edges).map((connection) => ({
              connection,
              other: movies.get(connection.source === selected.id ? connection.target : connection.source),
            }))}
            isRoot={selected.id === rootId}
            isExpanded={expanded.has(selected.id)}
            expanding={expanding === selected.id}
            atLimit={atLimit}
            onExpand={() => void expand(selected.id)}
            onCenter={() => goTo(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </UniverseContext.Provider>
  );
}

function MapIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-violet/15 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
    >
      {children}
    </button>
  );
}
