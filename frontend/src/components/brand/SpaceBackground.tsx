import planetUrl from "@/assets/planeta.webp";

const STAR_COLORS = ["var(--color-fg)", "var(--color-fg)", "var(--color-label)", "var(--color-violet-soft)"];

/** Small deterministic PRNG so the sky is the same on every render and in every test. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One `box-shadow` per star, in viewport units so the field covers any screen. */
function starShadows(count: number, seed: number): string {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    const color = STAR_COLORS[Math.floor(random() * STAR_COLORS.length)];
    return `${(random() * 100).toFixed(2)}vw ${(random() * 100).toFixed(2)}vh ${color}`;
  }).join(", ");
}

const STAR_LAYERS = [
  { size: 1, shadows: starShadows(150, 11), duration: "3.5s", delay: "0s" },
  { size: 1.5, shadows: starShadows(60, 23), duration: "5s", delay: "-1.5s" },
  { size: 2, shadows: starShadows(22, 37), duration: "7s", delay: "-3s" },
];

interface PlanetSpec {
  /** Position, size and opacity (Tailwind classes); keep them near the edges, away from the content column. */
  className: string;
  /** Float cycle: different speeds so they don't move in sync. */
  duration: string;
  delay?: string;
}

// One planet per screen. Hero: big enough to show the artwork's detail (Login, Register,
// Intro). Subtle: smaller and translucent so it doesn't compete with posters. None: only the
// sky (the cinematic map, whose controls it would cover).
const PLANETS: Record<"hero" | "subtle" | "none", PlanetSpec[]> = {
  hero: [
    {
      className:
        "right-[-20%] top-[9%] w-[15rem] opacity-35 sm:right-[-8%] sm:w-[22rem] sm:opacity-75 lg:right-[-5%] lg:top-[6%] lg:w-[420px] lg:opacity-100",
      duration: "14s",
    },
  ],
  subtle: [{ className: "right-[-9%] top-[14%] w-24 opacity-30 sm:right-[2%] sm:w-[150px] sm:opacity-50", duration: "14s" }],
  none: [],
};

const COMETS = [
  { top: "0", left: "0", delay: "1s" },
  { top: "-5vh", left: "35vw", delay: "5.5s" },
];

/**
 * The MovieVerse sky: three twinkling star layers, a blue and a violet glow,
 * comets crossing diagonally every ~9 s and one slowly floating planet
 * (`planet="hero"` on Login/Register/Intro, `"subtle"` everywhere else, `"none"` on the map).
 * Fixed behind the page content; purely decorative. With
 * `prefers-reduced-motion` nothing moves and the comets are hidden.
 */
export function SpaceBackground({
  planet = "subtle",
  className = "",
}: {
  planet?: keyof typeof PLANETS;
  className?: string;
}) {
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base ${className}`}>
      <div className="absolute -left-48 -top-48 size-[38rem] rounded-full bg-blue/25 blur-[120px]" />
      <div className="absolute -bottom-56 -right-40 size-[40rem] rounded-full bg-violet/25 blur-[130px]" />

      {STAR_LAYERS.map((layer) => (
        <span
          key={layer.size}
          className="absolute left-0 top-0 animate-twinkle rounded-full motion-reduce:animate-none"
          style={{
            width: layer.size,
            height: layer.size,
            boxShadow: layer.shadows,
            animationDuration: layer.duration,
            animationDelay: layer.delay,
          }}
        />
      ))}

      {PLANETS[planet].map((spec) => (
        <Planet key={spec.className} spec={spec} />
      ))}

      {COMETS.map((comet) => (
        <div
          key={comet.delay}
          className="absolute animate-comet opacity-0 motion-reduce:hidden"
          style={{ top: comet.top, left: comet.left, animationDelay: comet.delay }}
        >
          <div className="relative h-0.5 w-40 rounded-full bg-linear-to-r from-transparent via-violet-soft/50 to-fg sm:w-56">
            <span className="absolute -right-0.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-white shadow-comet" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One world: the cut-out artwork (transparent WebP) with a night-side shadow on top, so a
 * busy illustration reads as a lit sphere and stays quiet behind the content.
 */
function Planet({ spec }: { spec: PlanetSpec }) {
  return (
    <div
      className={`absolute aspect-square animate-float motion-reduce:animate-none ${spec.className}`}
      style={{ animationDuration: spec.duration, animationDelay: spec.delay }}
    >
      <img
        src={planetUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full drop-shadow-planet"
      />
      <div className="absolute inset-[7%] rounded-full bg-radial-[at_30%_28%] from-transparent from-35% to-deep/80" />
    </div>
  );
}
