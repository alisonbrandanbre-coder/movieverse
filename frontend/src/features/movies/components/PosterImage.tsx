import { useState } from "react";

interface PosterImageProps {
  src: string | null;
  alt: string;
  /** Shown in the placeholder when there is no image. */
  title?: string;
  className?: string;
}

/** Poster with a graceful fallback when TMDB has no image or it fails to load. */
export function PosterImage({ src, alt, title, className = "" }: PosterImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex aspect-[2/3] items-center justify-center bg-linear-to-br from-blue/70 via-violet/45 to-deep p-4 text-center ${className}`}
      >
        {title && <span className="line-clamp-4 font-display text-3xl leading-none tracking-wide text-fg">{title}</span>}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`aspect-[2/3] object-cover ${className}`}
    />
  );
}
