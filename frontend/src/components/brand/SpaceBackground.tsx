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

// Hero: big enough to show the artwork's detail (Login, Register, Intro). Subtle: small
// and translucent so it doesn't compete with the posters.
const PLANET_SIZES = {
  hero: "right-[-20%] top-[9%] w-[15rem] opacity-35 sm:right-[-8%] sm:w-[22rem] sm:opacity-75 lg:right-[-5%] lg:top-[6%] lg:w-[420px] lg:opacity-100",
  subtle: "right-[3%] top-[14%] w-28 opacity-40 sm:w-[180px] sm:opacity-55",
};

const COMETS = [
  { top: "0", left: "0", delay: "1s" },
  { top: "-5vh", left: "35vw", delay: "5.5s" },
];

/**
 * The MovieVerse sky: three twinkling star layers, a blue and a violet glow,
 * comets crossing diagonally every ~9 s and a slowly floating planet
 * (`planet="hero"` on Login/Register/Intro, `"subtle"` everywhere else).
 * Fixed behind the page content; purely decorative. With
 * `prefers-reduced-motion` nothing moves and the comets are hidden.
 */
export function SpaceBackground({
  planet = "subtle",
  className = "",
}: {
  planet?: keyof typeof PLANET_SIZES;
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

      {/* The artwork's space background is already cut out (transparent WebP). */}
      <img
        src={planetUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`absolute aspect-square animate-float drop-shadow-planet motion-reduce:animate-none ${PLANET_SIZES[planet]}`}
      />

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
