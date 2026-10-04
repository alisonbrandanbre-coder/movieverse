/** Graph API: a movie's neighborhood on the cinematic map. Built by GraphService (backend). */
import { apiRequest } from "@/api/client";
import type { ConnectionReason, ConnectionType, GraphMovie, Neighborhood, SagaInfo } from "@/types/graph";

interface GraphNodeDto {
  id: number;
  tmdb_id: number;
  title: string;
  poster: string | null;
  year: number | null;
  score: number | null;
  overview: string;
}

interface GraphEdgeDto {
  source: number;
  target: number;
  type: ConnectionType;
  types: ConnectionType[];
  label: string;
  reasons: ConnectionReason[];
  strength: number;
}

interface NeighborhoodDto {
  center: number;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  degraded: boolean;
  saga?: SagaInfo | null;
}

export const graphKeys = {
  movie: (id: number) => ["graph", id] as const,
  saga: (id: number) => ["graph", id, "saga"] as const,
};

function toMovie(dto: GraphNodeDto): GraphMovie {
  return {
    id: dto.id,
    tmdbId: dto.tmdb_id,
    title: dto.title,
    posterUrl: dto.poster,
    year: dto.year,
    score: dto.score,
    overview: dto.overview,
  };
}

function toNeighborhood(dto: NeighborhoodDto): Neighborhood {
  return { center: dto.center, nodes: dto.nodes.map(toMovie), edges: dto.edges, degraded: dto.degraded, saga: dto.saga ?? null };
}

export async function getNeighborhood(movieId: number, signal?: AbortSignal): Promise<Neighborhood> {
  return toNeighborhood(await apiRequest<NeighborhoodDto>(`/graph/movies/${movieId}`, { params: { limit: 12 }, signal }));
}

/** Every released movie of the movie's saga, as SAGA edges from it ("Ver saga completa"). */
export async function getSaga(movieId: number, signal?: AbortSignal): Promise<Neighborhood> {
  return toNeighborhood(await apiRequest<NeighborhoodDto>(`/graph/movies/${movieId}/saga`, { signal }));
}
