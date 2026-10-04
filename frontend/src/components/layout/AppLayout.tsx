import { Outlet, useLocation } from "react-router";

import { SpaceBackground } from "@/components/brand/SpaceBackground";

import { Navbar } from "./Navbar";

const HERO_PLANET_ROUTES = ["/login", "/register"];

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="relative isolate flex min-h-screen flex-col text-fg">
      <SpaceBackground planet={HERO_PLANET_ROUTES.includes(pathname) ? "hero" : "subtle"} />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line px-4 py-6 text-center text-xs text-fg-muted">
        MovieVerse · Datos e imágenes provistos por TMDB. Este producto usa la API de TMDB pero no está avalado ni
        certificado por TMDB.
      </footer>
    </div>
  );
}
