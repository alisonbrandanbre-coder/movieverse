export type ConnectionType = "SAGA" | "UNIVERSE" | "DIRECTOR" | "ACTOR" | "SIMILAR" | "GENRE";

export interface GraphMovie {
  id: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  year: number | null;
  score: number | null;
  overview: string;
}

export interface ConnectionReason {
  type: ConnectionType;
  /** Readable and verifiable: "Dirigidas por Christopher Nolan". */
  label: string;
  /** For the map's chip: "Christopher Nolan", "Similar", "Fantasía". */
  short: string;
}

export interface GraphConnection {
  source: number;
  target: number;
  /** Strongest connection type. */
  type: ConnectionType;
  types: ConnectionType[];
  label: string;
  reasons: ConnectionReason[];
  /** 0–1: saga 1.00, universe 0.95, director 0.92, lead actor 0.90, similar 0.80, genres 0.60 / 0.35. */
  strength: number;
}

/** The center's saga: how many released movies it has, the center included. */
export interface SagaInfo {
  name: string;
  total: number;
}

export interface Neighborhood {
  center: number;
  nodes: GraphMovie[];
  edges: GraphConnection[];
  degraded: boolean;
  saga: SagaInfo | null;
}
