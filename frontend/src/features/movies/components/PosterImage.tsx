import { ImageOff } from "lucide-react";
import { useState } from "react";

interface PosterImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/** Poster with a graceful fallback when TMDB has no image or it fails to load. */
export function PosterImage({ src, alt, className = "" }: PosterImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex aspect-[2/3] items-center justify-center bg-slate-800 text-slate-500 ${className}`}
      >
        <ImageOff className="size-8" aria-hidden />
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
