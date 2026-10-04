import { Compass, LogOut, Menu, Orbit, Search, User, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/features/auth/useAuth";
import { SurpriseButton } from "@/features/recommendations/components/Surprise";

const PRIVATE_LINKS = [
  { to: "/search", label: "Buscar", icon: Search },
  { to: "/discover", label: "Descubrir", icon: Compass },
  // NavLink also marks it active on /universe/:movieId (the map itself).
  { to: "/universe", label: "Universo", icon: Orbit },
  { to: "/profile", label: "Mi perfil", icon: User },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2 rounded-control px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-focus ${
    isActive
      ? "bg-violet/20 text-fg shadow-[inset_0_-2px_0_var(--color-violet-light)]"
      : "text-fg-secondary hover:bg-violet/10 hover:text-fg"
  }`;
}

/** Translucent header. Shows the nav only with a session; the auth screens get just the logo. */
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

  const links = (
    <>
      {PRIVATE_LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={navLinkClass} onClick={() => setOpen(false)}>
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
      <SurpriseButton variant="nav" onOpen={() => setOpen(false)} />
      <button type="button" onClick={handleLogout} className={navLinkClass({ isActive: false })}>
        <LogOut className="size-4" aria-hidden />
        Salir
      </button>
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/70 backdrop-blur-lg">
      <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to={isAuthenticated ? "/discover" : "/login"} className="rounded-control focus-visible:outline-2 focus-visible:outline-focus">
          <Logo />
        </Link>
        {isAuthenticated && (
          <>
            {/* Six items: the full row only fits from lg; tablets use the menu button too. */}
            <div className="hidden items-center gap-1 lg:flex">{links}</div>
            <button
              type="button"
              className="rounded-control p-2 text-fg-secondary hover:bg-violet/10 focus-visible:outline-2 focus-visible:outline-focus lg:hidden"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </>
        )}
      </nav>
      {isAuthenticated && open && (
        <nav id="mobile-menu" aria-label="Menú" className="flex flex-col gap-1 border-t border-line px-4 py-3 lg:hidden">
          {links}
        </nav>
      )}
    </header>
  );
}
