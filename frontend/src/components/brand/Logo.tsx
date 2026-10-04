import { useId } from "react";

// SVG paint can't read Tailwind classes, so the mark carries the token values.
const BLUE = "#4F7DFF";
const VIOLET = "#8B5CFF";
const NAVY = "#141B52";
const BASE = "#0E1543";
const LINE = "#C3CCF0";
const GOLD = "#F5C76B";

const STRIPES = "M9 0h4l-3 5H6zM17 0h4l-3 5h-4zM25 0h4l-3 5h-4zM33 0h4l-3 5h-4z";

/** Tilted clapperboard with blue→violet stripes and a gold four-point star. Same drawing as the favicon. */
export function ClapperMark({ className = "" }: { className?: string }) {
  const gradient = `${useId()}-stripes`;

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={BLUE} />
          <stop offset="1" stopColor={VIOLET} />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 22 30)">
        <rect x="6" y="21" width="32" height="20" rx="3" fill={NAVY} stroke={`url(#${gradient})`} strokeWidth="1.6" />
        <path d="M11 28.5h22M11 33.5h15" stroke={LINE} strokeOpacity=".75" strokeWidth="1.6" strokeLinecap="round" />
        <g transform="translate(0 16.5)">
          <rect x="6" width="32" height="5" rx="1" fill={`url(#${gradient})`} />
          <path d={STRIPES} fill={BASE} />
        </g>
        {/* The open clapper arm, hinged on the left. */}
        <g transform="rotate(-18 6 16.5) translate(0 11)">
          <rect x="6" width="32" height="5" rx="1" fill={`url(#${gradient})`} />
          <path d={STRIPES} fill={BASE} />
        </g>
      </g>
      <path d="M40 3.5l1.3 4.2 4.2 1.3-4.2 1.3-1.3 4.2-1.3-4.2-4.2-1.3 4.2-1.3z" fill={GOLD} />
    </svg>
  );
}

const SIZES = {
  sm: { mark: "size-9", word: "text-[1.7rem]", gap: "gap-2" },
  lg: { mark: "size-20 sm:size-24", word: "text-6xl sm:text-7xl", gap: "gap-4" },
};

/** Clapperboard + "MOVIEVERSE" wordmark. The accessible name is the plain text. */
export function Logo({ size = "sm", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <ClapperMark className={s.mark} />
      <span className={`font-display leading-none tracking-[2px] text-fg ${s.word}`}>
        MOVIE<span className="text-violet-light">VERSE</span>
      </span>
    </span>
  );
}
