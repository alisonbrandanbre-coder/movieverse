/**
 * Pure map logic (no React): turning neighborhoods into React Flow nodes/edges, merging
 * expansions without duplicates and placing new nodes radially around the expanded one.
 */
import type { Edge, Node } from "@xyflow/react";

import type { GraphConnection, GraphMovie, Neighborhood } from "@/types/graph";

export const MAX_ACTIVE_NODES = 50;

export interface MovieNodeData extends Record<string, unknown> {
  movie: GraphMovie;
  /** Position in the batch it arrived with: staggers the appear animation. */
  order: number;
}

export interface ConnectionEdgeData extends Record<string, unknown> {
  connection: GraphConnection;
  order: number;
}

export type MovieNode = Node<MovieNodeData, "movie">;
export type ConnectionEdge = Edge<ConnectionEdgeData, "connection">;

export interface Point {
  x: number;
  y: number;
}

// Layout (flow units). Stronger connections sit closer to the node they connect to.
// The first ring is an ellipse (wider than tall, like the screen) so posters on the sides
// keep enough vertical room for poster + title.
const CENTER_RING = { min: 370, span: 260 };

/** Ellipse stretch of the first ring: wide on landscape screens, tall on phones. */
export interface RingShape {
  x: number;
  y: number;
}
export const LANDSCAPE_RING: RingShape = { x: 1.4, y: 1 };
export const PORTRAIT_RING: RingShape = { x: 0.8, y: 1.15 };
const RING_STAGGER = 70; // every other neighbor a bit further out: neighbors on the sides do not touch
const EXPANSION_RING = { min: 270, span: 260 };
const MIN_DISTANCE = 215; // between node origins: posters + titles do not overlap
const EXPANSION_ARC = (4 / 3) * Math.PI; // 240°, opening away from where we came from
// Free-spot search: rings further out, and on each ring angles further from the intended one.
const RING_STEPS = 14;
const RING_STEP = 70;
const ANGLE_OFFSETS = [0, 0.2, -0.2, 0.4, -0.4, 0.65, -0.65, 0.9, -0.9];

export function nodeId(movieId: number): string {
  return String(movieId);
}

export function edgeId(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function ringRadius(strength: number, ring: { min: number; span: number }): number {
  return ring.min + (1 - Math.min(1, Math.max(0, strength))) * ring.span;
}

function toNode(movie: GraphMovie, position: Point, order: number): MovieNode {
  return { id: nodeId(movie.id), type: "movie", position, data: { movie, order } };
}

function toEdge(connection: GraphConnection, order: number): ConnectionEdge {
  return {
    id: edgeId(connection.source, connection.target),
    type: "connection",
    source: nodeId(connection.source),
    target: nodeId(connection.target),
    data: { connection, order },
  };
}

/** Neighbors of the center, strongest first (the order the API returns them in). */
function neighborsByStrength(neighborhood: Neighborhood): GraphConnection[] {
  return [...neighborhood.edges].sort((a, b) => b.strength - a.strength);
}

/** First map: the center at the origin and its neighbors on a ring, strongest closest. */
export function createMap(
  neighborhood: Neighborhood,
  shape: RingShape = LANDSCAPE_RING,
): { nodes: MovieNode[]; edges: ConnectionEdge[] } {
  const movies = new Map(neighborhood.nodes.map((m) => [m.id, m]));
  const center = movies.get(neighborhood.center);
  if (!center) return { nodes: [], edges: [] };
  const connections = neighborsByStrength(neighborhood);
  const step = (2 * Math.PI) / Math.max(1, connections.length);
  const nodes: MovieNode[] = [toNode(center, { x: 0, y: 0 }, 0)];
  connections.forEach((connection, i) => {
    const movie = movies.get(connection.target);
    if (!movie) return;
    const angle = -Math.PI / 2 + i * step;
    const radius = ringRadius(connection.strength, CENTER_RING) + (i % 2) * RING_STAGGER;
    nodes.push(toNode(movie, { x: Math.cos(angle) * radius * shape.x, y: Math.sin(angle) * radius * shape.y }, i + 1));
  });
  return { nodes, edges: connections.map((c, i) => toEdge(c, i + 1)) };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Closest free position to (angle, radius) around `origin`: tries a few angles near the
 * intended one on each ring, moving outwards ring by ring (a spiral search).
 */
function freeSpot(origin: Point, angle: number, radius: number, taken: Point[]): Point {
  for (let step = 0; step < RING_STEPS; step += 1) {
    const r = radius + step * RING_STEP;
    for (const offset of ANGLE_OFFSETS) {
      const a = angle + offset;
      const point = { x: origin.x + Math.cos(a) * r, y: origin.y + Math.sin(a) * r };
      if (taken.every((t) => distance(t, point) >= MIN_DISTANCE)) return point;
    }
  }
  // Practically unreachable below MAX_ACTIVE_NODES: far out on the intended direction.
  const r = radius + RING_STEPS * RING_STEP;
  return { x: origin.x + Math.cos(angle) * r, y: origin.y + Math.sin(angle) * r };
}

export interface MergeResult {
  nodes: MovieNode[];
  edges: ConnectionEdge[];
  added: number[];
}

/**
 * Add `neighborhood` (centered on an existing node) to the map. Existing nodes are reused
 * and never moved; new ones open on an arc pointing away from `from` (where the user came
 * from). An edge between two movies is kept once (the stronger one wins).
 */
export function mergeNeighborhood(
  nodes: MovieNode[],
  edges: ConnectionEdge[],
  neighborhood: Neighborhood,
  from: Point | null,
): MergeResult {
  const anchor = nodes.find((n) => n.id === nodeId(neighborhood.center));
  if (!anchor) {
    const fresh = createMap(neighborhood);
    return { ...fresh, added: fresh.nodes.map((n) => n.data.movie.id) };
  }
  const known = new Set(nodes.map((n) => n.id));
  const movies = new Map(neighborhood.nodes.map((m) => [m.id, m]));
  const origin = anchor.position;
  const outward = from ? Math.atan2(origin.y - from.y, origin.x - from.x) : -Math.PI / 2;
  const fresh = neighborsByStrength(neighborhood).filter((c) => !known.has(nodeId(c.target)) && movies.has(c.target));
  const taken = nodes.map((n) => n.position);
  const added: MovieNode[] = [];
  fresh.forEach((connection, i) => {
    const fraction = fresh.length === 1 ? 0.5 : i / (fresh.length - 1);
    const angle = outward - EXPANSION_ARC / 2 + fraction * EXPANSION_ARC;
    const position = freeSpot(origin, angle, ringRadius(connection.strength, EXPANSION_RING), taken);
    taken.push(position);
    added.push(toNode(movies.get(connection.target)!, position, i + 1));
  });

  const byId = new Map(edges.map((e) => [e.id, e]));
  neighborsByStrength(neighborhood).forEach((connection, i) => {
    const id = edgeId(connection.source, connection.target);
    const existing = byId.get(id);
    if (!existing || (existing.data?.connection.strength ?? 0) < connection.strength) {
      byId.set(id, toEdge(connection, i + 1));
    }
  });

  return { nodes: [...nodes, ...added], edges: [...byId.values()], added: added.map((n) => n.data.movie.id) };
}

/** Every connection touching a movie, with the movie on the other side. */
export function connectionsOf(movieId: number, edges: ConnectionEdge[]): GraphConnection[] {
  return edges
    .map((e) => e.data?.connection)
    .filter((c): c is GraphConnection => Boolean(c) && (c!.source === movieId || c!.target === movieId))
    .sort((a, b) => b.strength - a.strength);
}

/** Breadcrumb: visiting a node already in the path goes back to it; otherwise it is appended. */
export function visit(path: number[], movieId: number): number[] {
  const index = path.indexOf(movieId);
  return index >= 0 ? path.slice(0, index + 1) : [...path, movieId];
}

/** Short hover label for an edge: the strongest reason, plus how many more there are. */
export function shortLabel(labels: string[]): string {
  return labels.length > 1 ? `${labels[0]} · +${labels.length - 1}` : (labels[0] ?? "");
}
