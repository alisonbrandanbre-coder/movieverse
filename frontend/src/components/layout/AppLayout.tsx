import { Outlet, useLocation } from "react-router";

import { SpaceBackground } from "@/components/brand/SpaceBackground";

import { Navbar } from "./Navbar";

const HERO_PLANET_ROUTES = ["/login", "/register"];

export function AppLayout() {
  const { pathname } = useLocation();
  // The cinematic map fills the viewport: no page scroll and the TMDB credit moves inside it.
  const immersive = pathname.startsWith("/universe/");

  return (
    <div className={`relative isolate flex flex-col text-fg ${immersive ? "h-dvh overflow-hidden" : "min-h-screen"}`}>
      <SpaceBackground planet={HERO_PLANET_ROUTES.includes(pathname) ? "hero" : "subtle"} />
      <Navbar />
      <main className={immersive ? "relative min-h-0 flex-1" : "flex-1"}>
        <Outlet />
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
  );
}
