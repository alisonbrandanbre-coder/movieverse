import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";

import { SideConstellation } from "@/components/brand/SideConstellation";
import { SpaceBackground } from "@/components/brand/SpaceBackground";
import { SurpriseProvider } from "@/features/recommendations/components/Surprise";

import { Navbar } from "./Navbar";

const HERO_PLANET_ROUTES = ["/login", "/register"];

export function AppLayout() {
  const { pathname } = useLocation();
  // The cinematic map fills the viewport: no page scroll and the TMDB credit moves inside it.
  const immersive = pathname.startsWith("/universe/");

  // A new page starts at the top (query-only changes, like a search or a tab, keep their place).
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [pathname]);

  return (
    <SurpriseProvider>
      {/* overflow-x-clip: carousels run to the window's edge (bleed-right) without a horizontal scroll. */}
      <div className={`relative isolate flex flex-col text-fg ${immersive ? "h-dvh overflow-hidden" : "min-h-screen overflow-x-clip"}`}>
        {/* On the map the planets would cover its controls: only the stars stay. */}
        <SpaceBackground planet={immersive ? "none" : HERO_PLANET_ROUTES.includes(pathname) ? "hero" : "subtle"} />
        {!immersive && !HERO_PLANET_ROUTES.includes(pathname) && <SideConstellation />}
        <Navbar />
        <main className={immersive ? "relative min-h-0 flex-1" : "flex-1"}>
          {/* Keyed by route: every page change fades in (opacity only, see --animate-page-in). */}
          <div key={pathname} className={`animate-page-in ${immersive ? "h-full" : ""}`}>
            <Outlet />
          </div>
        </main>
        {immersive ? (
          <p className="pointer-events-none absolute bottom-1 left-1/2 z-10 -translate-x-1/2 text-[10px] text-fg-muted">
            Datos e imágenes: TMDB
          </p>
        ) : (
          <footer className="border-t border-line px-4 py-6 text-center text-xs text-fg-muted">
            MovieVerse · Datos e imágenes provistos por TMDB. Este producto usa la API de TMDB pero no está avalado ni
            certificado por TMDB.
          </footer>
        )}
      </div>
    </SurpriseProvider>
  );
}
