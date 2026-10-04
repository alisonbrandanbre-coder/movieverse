import { Compass, Search } from "lucide-react";
import { Link } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { useAuth } from "@/features/auth/useAuth";

// A constellation with one star missing: the page the user was looking for.
const STARS = [
  { x: 40, y: 120, r: 4 },
  { x: 110, y: 60, r: 5 },
  { x: 190, y: 100, r: 3.5 },
  { x: 150, y: 170, r: 4 },
];
const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [2, 3],
];
const LOST = { x: 285, y: 55 };

function LostConstellation() {
  return (
    <svg viewBox="0 0 320 210" className="w-64 overflow-visible sm:w-80" aria-hidden focusable="false">
      {LINKS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={STARS[a].x}
          y1={STARS[a].y}
          x2={STARS[b].x}
          y2={STARS[b].y}
          className="stroke-violet-light/60"
          strokeWidth={1.5}
        />
      ))}
      {/* The broken link, towards the star that is not there. */}
      <line x1={STARS[2].x} y1={STARS[2].y} x2={LOST.x} y2={LOST.y} className="stroke-fg-muted/60" strokeWidth={1.5} strokeDasharray="5 7" />
      <circle cx={LOST.x} cy={LOST.y} r={16} className="fill-none stroke-fg-muted/70" strokeWidth={1.5} strokeDasharray="4 5" />
      <text x={LOST.x} y={LOST.y + 6} textAnchor="middle" className="fill-fg-muted font-display text-lg">
        ?
      </text>
      {STARS.map((star, i) => (
        <circle
          key={i}
          cx={star.x}
          cy={star.y}
          r={star.r}
          className="animate-twinkle fill-fg motion-reduce:animate-none"
          style={{ animationDelay: `${-i * 0.9}s`, filter: "drop-shadow(0 0 6px var(--color-violet-light))" }}
        />
      ))}
    </svg>
  );
}

/** 404: lost in space. Back to Descubrir (or to the login without a session) or to Buscar. */
export function NotFoundPage() {
  const { status } = useAuth();
  const authenticated = status === "authenticated";

  return (
    <PageContainer className="flex min-h-[70vh] items-center justify-center">
      <div className="flex max-w-xl animate-fade-up flex-col items-center gap-5 text-center">
        <LostConstellation />
        <p className="eyebrow">Error 404 · Fuera del mapa</p>
        <h1 className="font-display text-6xl leading-none tracking-wide text-fg sm:text-7xl">Te perdiste en el espacio</h1>
        <p className="text-fg-secondary">
          Esta estrella no existe en nuestro universo: puede que el enlace esté mal escrito o que la página ya no esté.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link to={authenticated ? "/discover" : "/login"} className={buttonClasses({ size: "lg" })}>
            <Compass className="size-4" aria-hidden />
            {authenticated ? "Volver a Descubrir" : "Ir a iniciar sesión"}
          </Link>
          {authenticated && (
            <Link to="/search" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              <Search className="size-4" aria-hidden />
              Buscar películas
            </Link>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
