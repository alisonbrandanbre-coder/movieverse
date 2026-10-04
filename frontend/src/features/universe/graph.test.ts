import { describe, expect, it } from "vitest";

import type { GraphConnection, GraphMovie, Neighborhood } from "@/types/graph";

import {
  connectionsOf,
  createMap,
  edgeId,
  mergeNeighborhood,
  NODE_SIZE,
  PORTRAIT_ASPECT,
  ROOT_SIZE,
  shortLabel,
  visit,
  type MovieNode,
} from "./graph";

function movie(id: number, title = `Película ${id}`): GraphMovie {
  return { id, tmdbId: 1000 + id, title, posterUrl: null, year: 2000, score: 7.5, overview: "" };
}

function connection(source: number, target: number, strength: number, type: GraphConnection["type"] = "GENRE"): GraphConnection {
  return { source, target, type, types: [type], label: `motivo ${target}`, reasons: [{ type, label: `motivo ${target}` }], strength };
}

function neighborhood(center: number, neighbors: [number, number][]): Neighborhood {
  return {
    center,
    nodes: [movie(center), ...neighbors.map(([id]) => movie(id))],
    edges: neighbors.map(([id, strength]) => connection(center, id, strength)),
    degraded: false,
  };
}

const distance = (a: MovieNode, b: MovieNode) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);

describe("createMap", () => {
  it("puts the center at the origin and every neighbor once", () => {
    const { nodes, edges } = createMap(neighborhood(1, [[2, 1], [3, 0.9], [4, 0.35]]));

    expect(nodes[0]).toMatchObject({ id: "1", position: { x: 0, y: 0 } });
    expect(nodes.map((n) => n.id)).toEqual(["1", "2", "3", "4"]);
    expect(edges.map((e) => e.id)).toEqual(["1-2", "1-3", "1-4"]);
  });

  it("places stronger connections closer to the center", () => {
    const { nodes } = createMap(neighborhood(1, [[2, 1], [3, 0.35]]));
    // Between box centers: the center node is bigger than its neighbors.
    const middle = (n: MovieNode) => {
      const size = n.id === "1" ? ROOT_SIZE : NODE_SIZE;
      return { x: n.position.x + size.poster / 2, y: n.position.y + size.height / 2 };
    };
    const from = (id: string) => {
      const a = middle(nodes[0]);
      const b = middle(nodes.find((n) => n.id === id)!);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    expect(from("2")).toBeLessThan(from("3"));
  });

  it("keeps 8 to 12 neighbors apart and off the center (no overlapping posters or titles), on any screen", () => {
    const box = (n: MovieNode) => {
      const size = n.id === "1" ? ROOT_SIZE : NODE_SIZE;
      return { left: n.position.x + (size.poster - size.width) / 2, top: n.position.y, ...size };
    };
    for (const count of [8, 10, 12]) {
      const around = neighborhood(1, Array.from({ length: count }, (_, i) => [i + 2, 1 - i * 0.05] as [number, number]));
      for (const aspect of [2.4, undefined, 1.2, PORTRAIT_ASPECT]) {
        const { nodes } = createMap(around, aspect);
        for (let i = 0; i < nodes.length; i += 1) {
          for (let j = i + 1; j < nodes.length; j += 1) {
            const a = box(nodes[i]);
            const b = box(nodes[j]);
            const apart =
              a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top;
            expect(apart).toBe(true);
          }
        }
      }
    }
  });

  it("follows the screen's shape: a wide ring on desktop, a tall one on phones", () => {
    const twelve = neighborhood(1, Array.from({ length: 12 }, (_, i) => [i + 2, 1] as [number, number]));
    const extent = (aspect: number) => {
      const { nodes } = createMap(twelve, aspect);
      const xs = nodes.map((n) => n.position.x);
      const ys = nodes.map((n) => n.position.y);
      return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
    };

    expect(extent(1.9)).toBeGreaterThan(1.5);
    expect(extent(PORTRAIT_ASPECT)).toBeLessThan(1);
  });
});

describe("mergeNeighborhood", () => {
  const first = createMap(neighborhood(1, [[2, 1], [3, 0.8]]));

  it("adds only new movies, reuses existing ones and never moves them", () => {
    // Expanding from 2: it knows 1 (center), 3 (already on the map) and 4, 5 (new).
    const expansion = neighborhood(2, [[1, 1], [3, 0.6], [4, 0.9], [5, 0.35]]);

    const result = mergeNeighborhood(first.nodes, first.edges, expansion, { x: 0, y: 0 });

    expect(result.added).toEqual([4, 5]);
    const ids = result.nodes.map((n) => n.id);
    expect(ids).toEqual(["1", "2", "3", "4", "5"]);
    expect(new Set(ids).size).toBe(ids.length);
    first.nodes.forEach((node, i) => expect(result.nodes[i].position).toEqual(node.position));
  });

  it("keeps one edge per pair (the stronger) and adds the new ones", () => {
    const expansion = neighborhood(2, [[1, 0.35], [3, 0.6]]);

    const result = mergeNeighborhood(first.nodes, first.edges, expansion, null);

    const ids = result.edges.map((e) => e.id).sort();
    expect(ids).toEqual(["1-2", "1-3", "2-3"]);
    expect(result.edges.find((e) => e.id === "1-2")?.data?.connection.strength).toBe(1); // kept
  });

  it("opens new nodes away from where the user came from", () => {
    const anchor = first.nodes.find((n) => n.id === "2")!;
    const from = first.nodes[0].position; // the center
    const expansion = neighborhood(2, [[4, 1], [5, 1], [6, 1]]);

    const result = mergeNeighborhood(first.nodes, first.edges, expansion, from);
    const outward = { x: anchor.position.x - from.x, y: anchor.position.y - from.y };

    result.nodes
      .filter((n) => ["4", "5", "6"].includes(n.id))
      .forEach((n) => {
        const v = { x: n.position.x - anchor.position.x, y: n.position.y - anchor.position.y };
        // At most 120° away from the outward direction (the arc is 240° wide).
        const cos = (v.x * outward.x + v.y * outward.y) / (Math.hypot(v.x, v.y) * Math.hypot(outward.x, outward.y));
        expect(cos).toBeGreaterThan(Math.cos((2 * Math.PI) / 3) - 0.01);
      });
  });

  it("does not place new nodes on top of existing ones", () => {
    const crowded = createMap(neighborhood(1, Array.from({ length: 12 }, (_, i) => [i + 2, 1] as [number, number])));
    const expansion = neighborhood(2, Array.from({ length: 12 }, (_, i) => [100 + i, 1] as [number, number]));

    const result = mergeNeighborhood(crowded.nodes, crowded.edges, expansion, { x: 0, y: 0 });

    const added = result.nodes.filter((n) => Number(n.id) >= 100);
    added.forEach((n) => {
      result.nodes
        .filter((other) => other.id !== n.id)
        .forEach((other) => expect(distance(n, other)).toBeGreaterThan(150));
    });
  });
});

describe("helpers", () => {
  it("edge ids do not depend on direction", () => {
    expect(edgeId(3, 1)).toBe(edgeId(1, 3));
  });

  it("visit appends a new step or goes back to an existing one", () => {
    expect(visit([1, 2], 3)).toEqual([1, 2, 3]);
    expect(visit([1, 2, 3], 2)).toEqual([1, 2]);
    expect(visit([1, 2, 3], 1)).toEqual([1]);
  });

  it("connectionsOf lists every connection of a movie, strongest first", () => {
    const { edges } = createMap(neighborhood(1, [[2, 0.35], [3, 1]]));

    expect(connectionsOf(1, edges).map((c) => c.target)).toEqual([3, 2]);
    expect(connectionsOf(2, edges).map((c) => c.source)).toEqual([1]);
  });

  it("shortLabel keeps the strongest reason", () => {
    expect(shortLabel(["Dirigidas por Christopher Nolan"])).toBe("Dirigidas por Christopher Nolan");
    expect(shortLabel(["Dirigidas por Christopher Nolan", "Comparten Drama"])).toBe(
      "Dirigidas por Christopher Nolan · +1",
    );
  });
});
