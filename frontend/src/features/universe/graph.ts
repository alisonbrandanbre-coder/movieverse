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

// Layout (flow units; at zoom 1 they are screen pixels). Node sizes match MovieNode: the
// box is poster + title + year, and the title is wider than the poster.
export const NODE_SIZE = { poster: 90, width: 144, height: 210 };
export const ROOT_SIZE = { poster: 150, width: 240, height: 300 };
const GAP = 12; // free space between two node boxes

// First ring: an ellipse with the map's aspect ratio (wide on desktop, tall on phones), as
// tight as possible without overlaps so the initial zoom stays close to 1. Stronger
// connections sit a bit closer to the center.
export const LANDSCAPE_ASPECT = 1.9;
export const PORTRAIT_ASPECT = 0.5;
const START_RADIUS_Y = 170;
// Center to center, a neighbor clears the center node sideways from CLEAR_X and
// vertically from CLEAR_Y. A flat ring leaves the band right above and below the center
// empty (|x| < CLEAR_X), so it can stay low and use a wide screen.
const CLEAR_X = ROOT_SIZE.width / 2 + NODE_SIZE.width / 2 + GAP;
const CLEAR_Y = ROOT_SIZE.height / 2 + NODE_SIZE.height / 2 + GAP;
// Phones (narrower than this aspect) can't fit a ring: three compact columns instead.
const PHONE_ASPECT = 0.75;
const RING_GROWTH = 1.03;
const MAX_RING_TRIES = 100;
const STRENGTH_SPREAD = 0.08; // the weakest neighbor is 8% further out than the strongest
const ARC_SAMPLES = 720;

// Expansions: new neighbors on an arc around the expanded node, never overlapping.
const EXPANSION_RING = { min: 300, span: 200 }; // min: even at the arc ends (±120°) a box clears the anchor
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

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The area a node covers (poster + title), from its top-left position. */
function boxAt(position: Point, size: typeof NODE_SIZE): Box {
  return { left: position.x + (size.poster - size.width) / 2, top: position.y, width: size.width, height: size.height };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.left + b.width + GAP &&
    b.left < a.left + a.width + GAP &&
    a.top < b.top + b.height + GAP &&
    b.top < a.top + a.height + GAP
  );
}

function nodeBox(node: MovieNode, rootId: string): Box {
  return boxAt(node.position, node.id === rootId ? ROOT_SIZE : NODE_SIZE);
}

/**
 * `count` centers on an ellipse (radii `rx`, `ry`), evenly spaced by arc length measured in
 * node boxes, so neighbors are as far apart at the narrow ends as on the long sides. When
 * the ring is too low to pass over the center node, the arcs above and below it are skipped.
 */
function ellipsePoints(count: number, rx: number, ry: number): Point[] {
  const unitX = NODE_SIZE.width + GAP;
  const unitY = NODE_SIZE.height + GAP;
  const allowed = (angle: number) => ry >= CLEAR_Y || Math.abs(Math.cos(angle) * rx) >= CLEAR_X;
  const angles: number[] = [];
  const lengths: number[] = [0];
  for (let i = 0; i <= ARC_SAMPLES; i += 1) {
    angles.push(-Math.PI / 2 + (i / ARC_SAMPLES) * 2 * Math.PI);
    if (i > 0) {
      const usable = allowed(angles[i]) && allowed(angles[i - 1]);
      const dx = (Math.cos(angles[i]) - Math.cos(angles[i - 1])) * (rx / unitX);
      const dy = (Math.sin(angles[i]) - Math.sin(angles[i - 1])) * (ry / unitY);
      lengths.push(lengths[i - 1] + (usable ? Math.hypot(dx, dy) : 0));
    }
  }
  const total = lengths[ARC_SAMPLES];
  const points: Point[] = [];
  let sample = 0;
  for (let k = 0; k < count; k += 1) {
    // Half a step in: with no gap, nobody sits right above the center's title either.
    const target = ((k + 0.5) / count) * total;
    while (sample < ARC_SAMPLES && lengths[sample + 1] < target) sample += 1;
    const angle = angles[sample + 1] ?? angles[sample];
    points.push({ x: Math.cos(angle) * rx, y: Math.sin(angle) * ry });
  }
  return points;
}

/**
 * Phone layout: the center in the middle column, neighbors beside it (two side columns)
 * and above/below it; the nearest free slots first, so the map stays as short as possible.
 */
function columnPoints(count: number): Point[] {
  const row = NODE_SIZE.height + GAP;
  const slots: Point[] = [];
  for (let j = 0; j <= count; j += 1) {
    for (const y of j === 0 ? [0] : [j * row, -j * row]) slots.push({ x: CLEAR_X, y }, { x: -CLEAR_X, y });
    slots.push({ x: 0, y: CLEAR_Y + j * row }, { x: 0, y: -(CLEAR_Y + j * row) });
  }
  // Nearest first; on ties the lower one (keeps the map short), then right before left.
  return slots
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || Math.abs(a.y) - Math.abs(b.y) || b.x - a.x || a.y - b.y)
    .slice(0, count);
}

/**
 * First map: the center at the origin and its neighbors on an ellipse around it, strongest
 * first and closest. `aspect` is the map's width / height: the ring takes the same shape so
 * the initial fit uses the whole screen.
 */
export function createMap(
  neighborhood: Neighborhood,
  aspect: number = LANDSCAPE_ASPECT,
): { nodes: MovieNode[]; edges: ConnectionEdge[] } {
  const movies = new Map(neighborhood.nodes.map((m) => [m.id, m]));
  const center = movies.get(neighborhood.center);
  if (!center) return { nodes: [], edges: [] };
  const connections = neighborsByStrength(neighborhood).filter((c) => movies.has(c.target));
  const root = toNode(center, { x: 0, y: 0 }, 0);
  const middle = { x: ROOT_SIZE.poster / 2, y: ROOT_SIZE.height / 2 };
  const rootBox = boxAt(root.position, ROOT_SIZE);

  const place = (point: Point, strength: number): Point => {
    const push = 1 + (1 - Math.min(1, Math.max(0, strength))) * STRENGTH_SPREAD;
    return { x: middle.x + point.x * push - NODE_SIZE.poster / 2, y: middle.y + point.y * push - NODE_SIZE.height / 2 };
  };
  if (aspect < PHONE_ASPECT) {
    const positions = columnPoints(connections.length).map((point) => place(point, 1));
    const nodes = [root, ...connections.map((c, i) => toNode(movies.get(c.target)!, positions[i], i + 1))];
    return { nodes, edges: connections.map((c, i) => toEdge(c, i + 1)) };
  }

  // Ring radii between centers: whole content box ≈ aspect, then grown until nothing overlaps.
  let ry = START_RADIUS_Y;
  let rx = (aspect * (2 * ry + NODE_SIZE.height) - NODE_SIZE.width) / 2;
  if (rx < CLEAR_X) {
    rx = CLEAR_X;
    ry = Math.max(START_RADIUS_Y, ((2 * rx + NODE_SIZE.width) / aspect - NODE_SIZE.height) / 2);
  }
  let positions: Point[] = [];
  for (let attempt = 0; attempt < MAX_RING_TRIES; attempt += 1) {
    positions = ellipsePoints(connections.length, rx, ry).map((point, i) => place(point, connections[i].strength));
    const boxes = positions.map((p) => boxAt(p, NODE_SIZE));
    const clear = boxes.every(
      (box, i) => !overlaps(box, rootBox) && boxes.slice(i + 1).every((other) => !overlaps(box, other)),
    );
    if (clear) break;
    rx *= RING_GROWTH;
    ry *= RING_GROWTH;
  }

  const nodes = [root, ...connections.map((c, i) => toNode(movies.get(c.target)!, positions[i], i + 1))];
  return { nodes, edges: connections.map((c, i) => toEdge(c, i + 1)) };
}

/**
 * Closest free position to (angle, radius) around `origin`: tries a few angles near the
 * intended one on each ring, moving outwards ring by ring (a spiral search).
 */
function freeSpot(origin: Point, angle: number, radius: number, taken: Box[]): Point {
  for (let step = 0; step < RING_STEPS; step += 1) {
    const r = radius + step * RING_STEP;
    for (const offset of ANGLE_OFFSETS) {
      const a = angle + offset;
      const point = { x: origin.x + Math.cos(a) * r, y: origin.y + Math.sin(a) * r };
      const box = boxAt(point, NODE_SIZE);
      if (taken.every((t) => !overlaps(t, box))) return point;
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
  const taken = nodes.map((n) => nodeBox(n, nodes[0].id)); // the map's root is always first
  const added: MovieNode[] = [];
  fresh.forEach((connection, i) => {
    const fraction = fresh.length === 1 ? 0.5 : i / (fresh.length - 1);
    const angle = outward - EXPANSION_ARC / 2 + fraction * EXPANSION_ARC;
    const position = freeSpot(origin, angle, ringRadius(connection.strength, EXPANSION_RING), taken);
    taken.push(boxAt(position, NODE_SIZE));
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
