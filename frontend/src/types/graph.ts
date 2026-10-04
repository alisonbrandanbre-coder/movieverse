export type ConnectionType = "DIRECTOR" | "ACTOR" | "SIMILAR" | "GENRE";

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
}

export interface GraphConnection {
  source: number;
  target: number;
  /** Strongest connection type. */
  type: ConnectionType;
  types: ConnectionType[];
  label: string;
  reasons: ConnectionReason[];
  /** 0–1: director 1.00, lead actor 0.90, TMDB similar 0.80, genres 0.60 / 0.35. */
  strength: number;
}

export interface Neighborhood {
  center: number;
  nodes: GraphMovie[];
  edges: GraphConnection[];
  degraded: boolean;
}
