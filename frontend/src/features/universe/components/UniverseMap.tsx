import { useQueryClient } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  type FitViewOptions,
  type Node,
} from "@xyflow/react";
import { Eraser, Info, LocateFixed, Map as MapIcon, Minimize2, Minus, Plus, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import type { ConnectionType, Neighborhood } from "@/types/graph";

import { getNeighborhood, getSaga, graphKeys } from "../api";
import {
  chipLayout,
  connectionsOf,
  createMap,
  LANDSCAPE_ASPECT,
  MAX_ACTIVE_NODES,
  mergeNeighborhood,
  NODE_SIZE,
  nodeId,
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
// Room for the top bar (breadcrumb + tools) and the TMDB credit; the sides stay tight so
// the initial zoom is close to 1 on desktop. The legend and the minimap get room at the
// bottom only when, once fitted, they would cover a movie (see `keepOverlaysClear`).
type Padding = { top: `${number}px`; bottom: `${number}px`; left: `${number}px`; right: `${number}px` };
// Sides: titles overhang the node React Flow fits by ~30% of a poster on each side.
const FIT_PADDING: Padding = { top: "76px", bottom: "28px", left: "36px", right: "36px" };
const PHONE_FIT_PADDING: Padding = { top: "76px", bottom: "56px", left: "18px", right: "18px" };
const OVERLAY_GAP = 12;
const TITLE_OVERHANG = 44;

const px = (value: `${number}px`) => Number.parseFloat(value);
const MAX_FIT_ZOOM = 1.1; // few neighbors: don't blow posters up
const FOCUS_ZOOM = 0.95;
const FALLBACK_SIZE = { width: NODE_SIZE.poster, height: NODE_SIZE.height };
const HEADER_HEIGHT = 64;
const MINIMAP_SIZE = { width: 168, height: 112 };

/** Width / height of the area the map is fitted into: the ring takes the same shape. */
function mapAspect(): number {
  if (typeof window === "undefined" || !window.innerWidth || !window.innerHeight) return LANDSCAPE_ASPECT;
  const width = window.innerWidth - 40;
  const height = window.innerHeight - HEADER_HEIGHT - 104;
  return Math.min(2.6, Math.max(0.4, width / Math.max(1, height)));
}

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
  // The first ring takes the screen's shape (phones get compact columns instead).
  const [aspect] = useState(mapAspect);
  const [padding] = useState<Padding>(() =>
    window.matchMedia?.("(max-width: 639px)").matches ? PHONE_FIT_PADDING : FIT_PADDING,
  );
  const fit = useMemo<FitViewOptions<MovieNodeType>>(() => ({ padding, maxZoom: MAX_FIT_ZOOM }), [padding]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodesReady = useNodesInitialized();
  const initialFitDone = useRef(false);
  const start = useMemo(() => createMap(initial, aspect), [initial, aspect]);
  const [nodes, setNodes, onNodesChange] = useNodesState<MovieNodeType>(start.nodes);
  const [edges, setEdges] = useEdgesState<ConnectionEdgeType>(start.edges);
  const rootId = initial.center;
  const [path, setPath] = useState<number[]>([rootId]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([rootId]));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<ConnectionType>>(() => new Set());
  const [expanding, setExpanding] = useState<number | null>(null);
  const [loadingSaga, setLoadingSaga] = useState(false);
  // The minimap can be folded away: after expanding, a movie may end up beneath it.
  const [showMinimap, setShowMinimap] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [degraded, setDegraded] = useState(initial.degraded);

  const focusId = path[path.length - 1];
  const movies = useMemo(() => new Map(nodes.map((n) => [n.data.movie.id, n.data.movie])), [nodes]);
  const atLimit = nodes.length >= MAX_ACTIVE_NODES;

  // The legend filter hides edges of the turned-off types (React Flow skips hidden edges).
  const shownEdges = useMemo(
    () => edges.map((e) => ({ ...e, hidden: e.data ? hiddenTypes.has(e.data.connection.type) : false })),
    [edges, hiddenTypes],
  );
  const visibleEdges = useMemo(() => shownEdges.filter((e) => !e.hidden), [shownEdges]);
  const chips = useMemo(() => chipLayout(nodes, edges, hiddenTypes), [nodes, edges, hiddenTypes]);
  const orphans = useMemo(() => {
    const linked = new Set(visibleEdges.flatMap((e) => [e.source, e.target]));
    return new Set(nodes.filter((n) => !linked.has(n.id)).map((n) => n.data.movie.id));
  }, [nodes, visibleEdges]);

  // Hovering a movie (or, without hover, the selected one) lights its connections up.
  const spotlightId = hoveredNodeId ?? selectedId;
  // Its chips get their own layout (only they show), so they don't cover each other either.
  const spotlightChips = useMemo(() => {
    if (spotlightId === null) return chips;
    const id = nodeId(spotlightId);
    return chipLayout(nodes, edges.filter((e) => e.source === id || e.target === id), hiddenTypes);
  }, [spotlightId, chips, nodes, edges, hiddenTypes]);
  const highlighted = useMemo(() => {
    if (spotlightId === null) return null;
    const ids = new Set([spotlightId]);
    connectionsOf(spotlightId, visibleEdges).forEach((c) => ids.add(c.source).add(c.target));
    return ids;
  }, [spotlightId, visibleEdges]);

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
    () => ({
      rootId,
      focusId,
      selectedId,
      hoveredEdgeId,
      spotlightId,
      highlighted,
      orphans,
      chips: spotlightChips,
      select,
      hoverNode: setHoveredNodeId,
      hoverEdge: setHoveredEdgeId,
    }),
    [rootId, focusId, selectedId, hoveredEdgeId, spotlightId, highlighted, orphans, spotlightChips, select],
  );

  function toggleType(type: ConnectionType) {
    setHiddenTypes((current) => {
      const next = new Set(current);
      if (!next.delete(type)) next.add(type);
      return next;
    });
  }

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

  // The neighborhood shows at most 3 movies of the center's saga; the rest is one click away.
  const sagaOnMap = edges.filter(
    (e) => e.data?.connection.type === "SAGA" && (e.data.connection.source === rootId || e.data.connection.target === rootId),
  ).length;
  const sagaMissing = initial.saga !== null && sagaOnMap + 1 < initial.saga.total;

  async function showSaga() {
    setLoadingSaga(true);
    setFeedback(null);
    try {
      const saga = await queryClient.fetchQuery({
        queryKey: graphKeys.saga(rootId),
        queryFn: ({ signal }) => getSaga(rootId, signal),
        staleTime: 10 * 60_000,
      });
      const result = mergeNeighborhood(nodes, edges, saga, null);
      setNodes(result.nodes);
      setEdges(result.edges);
      setFeedback({
        text:
          result.added.length > 0
            ? `${result.added.length} ${result.added.length === 1 ? "película más" : "películas más"} de la saga${saga.saga ? ` ${saga.saga.name}` : ""}.`
            : "Toda la saga ya está en el mapa.",
        tone: "info",
      });
      window.setTimeout(() => void flow.fitView({ ...fit, duration: 700 }).then(() => keepOverlaysClear(400)), 80);
    } catch (error) {
      setFeedback({ text: getErrorMessage(error, "No pudimos traer la saga. Probá de nuevo."), tone: "error" });
    } finally {
      setLoadingSaga(false);
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

  /**
   * The legend (bottom left) and the minimap (bottom right) float over the map. If, once
   * fitted, one of them covers a movie, fit again keeping free either the bottom strip or the
   * sides they sit on, whichever leaves the posters bigger.
   */
  const keepOverlaysClear = useCallback(
    (duration: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const area = canvas.getBoundingClientRect();
      // From React Flow's layout, not the DOM: nodes may still be scaled by their appear
      // animation. Titles are 160% of the poster wide (30% overhang on each side).
      const movies = flow.getNodes().map((node) => {
        const width = node.measured?.width ?? FALLBACK_SIZE.width;
        const height = node.measured?.height ?? FALLBACK_SIZE.height;
        const topLeft = flow.flowToScreenPosition({ x: node.position.x - width * 0.3, y: node.position.y });
        const bottomRight = flow.flowToScreenPosition({ x: node.position.x + width * 1.3, y: node.position.y + height });
        return { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y };
      });
      const covering = [...canvas.querySelectorAll<HTMLElement>("[data-map-overlay], .react-flow__minimap")]
        .map((el) => el.getBoundingClientRect())
        .filter((o) => o.width > 0 && movies.some((m) => m.left < o.right && o.left < m.right && m.top < o.bottom && o.top < m.bottom));
      if (covering.length === 0) return;

      const base = { top: px(padding.top), bottom: px(padding.bottom), left: px(padding.left), right: px(padding.right) };
      const below = { ...base, bottom: Math.max(base.bottom, ...covering.map((o) => area.bottom - o.top + OVERLAY_GAP)) };
      const beside = { ...base };
      for (const o of covering) {
        // Titles are wider than the node React Flow fits: keep a title's overhang free too.
        if (o.left - area.left < area.right - o.right) beside.left = Math.max(beside.left, o.right - area.left + TITLE_OVERHANG);
        else beside.right = Math.max(beside.right, area.right - o.left + TITLE_OVERHANG);
      }
      const bounds = flow.getNodesBounds(flow.getNodes());
      const zoom = (p: typeof base) =>
        Math.min(MAX_FIT_ZOOM, (area.width - p.left - p.right) / bounds.width, (area.height - p.top - p.bottom) / bounds.height);
      const best = zoom(beside) > zoom(below) ? beside : below;
      void flow.fitView({
        ...fit,
        padding: { top: `${best.top}px`, bottom: `${best.bottom}px`, left: `${best.left}px`, right: `${best.right}px` },
        duration,
      });
    },
    [flow, fit, padding],
  );

  // The first fit is ours (not React Flow's `fitView` prop, which could run after the
  // overlay check and undo it): fit once the nodes are measured, then keep overlays clear.
  useEffect(() => {
    if (!nodesReady || initialFitDone.current) return;
    initialFitDone.current = true;
    void flow.fitView(fit).then(() => window.setTimeout(() => keepOverlaysClear(0), 50));
  }, [nodesReady, flow, fit, keepOverlaysClear]);

  function clearMap() {
    const fresh = createMap(initial, aspect);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setPath([rootId]);
    setExpanded(new Set([rootId]));
    setSelectedId(null);
    setFeedback({ text: "Mapa limpio: volviste al punto de partida.", tone: "info" });
    window.setTimeout(() => void flow.fitView({ ...fit, duration: 700 }).then(() => keepOverlaysClear(400)), 80);
  }

  const selected = selectedId !== null ? movies.get(selectedId) : undefined;
  const focusMovie = movies.get(focusId);
  const crumbs = path.map((id) => movies.get(id)).filter((m) => m !== undefined);

  return (
    <UniverseContext.Provider value={context}>
      <div ref={canvasRef} className="mv-flow relative size-full">
        <ReactFlow<MovieNodeType, ConnectionEdgeType>
          nodes={nodes}
          edges={shownEdges}
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
          // Keyboard users tab through the posters (buttons inside the nodes); edges and the
          // node wrappers are not actionable, so they are not tab stops.
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          minZoom={0.2}
          maxZoom={1.8}
          colorMode="dark"
          aria-label="Mapa cinematográfico"
        >
          <Background variant={BackgroundVariant.Dots} gap={42} size={1.4} color="var(--color-violet-soft)" className="opacity-40" />
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              ariaLabel="Minimapa"
              className="!hidden md:!block"
              nodeColor={(node: Node) => (node.id === nodeId(rootId) ? "var(--color-gold)" : "var(--color-violet-light)")}
              nodeStrokeWidth={0}
              nodeBorderRadius={6}
              style={{ width: MINIMAP_SIZE.width, height: MINIMAP_SIZE.height }}
            />
          )}
        </ReactFlow>

        {/* Minimap toggle (desktop only, like the minimap): on its corner, or alone when folded. */}
        <button
          type="button"
          onClick={() => setShowMinimap((value) => !value)}
          aria-pressed={showMinimap}
          aria-label={showMinimap ? "Ocultar minimapa" : "Mostrar minimapa"}
          title={showMinimap ? "Ocultar minimapa" : "Mostrar minimapa"}
          className={`absolute right-4 z-10 hidden items-center gap-1.5 rounded-full border border-line bg-surface text-xs font-semibold text-fg-secondary shadow-card backdrop-blur-md transition hover:border-focus hover:text-fg focus-visible:outline-2 focus-visible:outline-focus md:flex ${
            showMinimap ? "bottom-[8.4rem] p-1.5" : "bottom-4 px-3 py-2"
          }`}
        >
          {showMinimap ? <Minimize2 className="size-3.5" aria-hidden /> : <MapIcon className="size-4" aria-hidden />}
          {!showMinimap && "Minimapa"}
        </button>

        {/* Top: breadcrumb + tools */}
        {/* One row even on phones: the breadcrumb scrolls/truncates instead of pushing the tools down. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
          <div className="pointer-events-auto min-w-0 flex-1 sm:max-w-[60%] sm:flex-none">
            <MapBreadcrumb path={crumbs} onSelect={goTo} />
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface p-1 shadow-card backdrop-blur-md">
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
        <MapLegend
          hidden={hiddenTypes}
          onToggle={toggleType}
          className="absolute bottom-3 left-3 z-10 sm:bottom-4 sm:left-4"
        />

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
            saga={
              selected.id === rootId && sagaMissing && initial.saga
                ? { total: initial.saga.total, loading: loadingSaga, onShow: () => void showSaga() }
                : undefined
            }
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
