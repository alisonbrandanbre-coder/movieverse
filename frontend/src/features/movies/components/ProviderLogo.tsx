import { Tv } from "lucide-react";

import type { WatchProvider } from "@/types/movie";

const SIZES = { sm: "size-6 rounded-md", md: "size-12 rounded-control" } as const;

/** A streaming platform's logo (TMDB), or a TV icon when it has none. Decorative: the name goes next to it. */
export function ProviderLogo({ provider, size = "md" }: { provider: WatchProvider; size?: keyof typeof SIZES }) {
  if (!provider.logoUrl) {
    return (
      <span aria-hidden className={`flex shrink-0 items-center justify-center border border-line bg-raised text-fg-muted ${SIZES[size]}`}>
        <Tv className="size-1/2" />
      </span>
    );
  }
  return <img src={provider.logoUrl} alt="" loading="lazy" className={`shrink-0 object-cover ring-1 ring-line ${SIZES[size]}`} />;
}
