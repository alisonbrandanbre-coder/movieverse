import { Outlet } from "react-router";

import { Navbar } from "./Navbar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 px-4 py-6 text-center text-xs text-slate-500">
        MovieVerse · Datos provistos por TMDB. Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
      </footer>
    </div>
  );
}
