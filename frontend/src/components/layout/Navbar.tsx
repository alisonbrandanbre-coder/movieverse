import { Compass, LogOut, Menu, Orbit, Search, User, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { useAuth } from "@/features/auth/useAuth";

const PRIVATE_LINKS = [
  { to: "/search", label: "Buscar", icon: Search },
  { to: "/discover", label: "Descubrir", icon: Compass },
  { to: "/profile", label: "Mi perfil", icon: User },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
  }`;
}

export function Navbar() {
  const { status, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAuthenticated = status === "authenticated";

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  const links = isAuthenticated ? (
    <>
      {PRIVATE_LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={navLinkClass} onClick={() => setOpen(false)}>
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
      <button type="button" onClick={handleLogout} className={navLinkClass({ isActive: false })}>
        <LogOut className="size-4" aria-hidden />
        Salir
      </button>
    </>
  ) : (
    <>
      <NavLink to="/login" className={navLinkClass} onClick={() => setOpen(false)}>
        Iniciar sesión
      </NavLink>
      <NavLink
        to="/register"
        onClick={() => setOpen(false)}
        className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400"
      >
        Crear cuenta
      </NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to={isAuthenticated ? "/discover" : "/"} className="flex items-center gap-2 text-lg font-bold text-white">
          <Orbit className="size-6 text-violet-400" aria-hidden />
          MovieVerse
        </Link>
        <div className="hidden items-center gap-1 md:flex">{links}</div>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>
      {open && <div className="flex flex-col gap-1 border-t border-slate-800 px-4 py-3 md:hidden">{links}</div>}
    </header>
  );
}
