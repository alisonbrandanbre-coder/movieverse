import type { ReactNode } from "react";

import { Constellation } from "@/components/brand/Constellation";
import { TAGLINE } from "@/components/brand/tagline";
import { Card } from "@/components/ui/Card";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Login/Register: brand pitch + mini constellation on the left, glass form card on the right. Stacks on mobile. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:min-h-[calc(100vh-10rem)] lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-14">
      <section className="flex animate-fade-up flex-col gap-5">
        <p className="eyebrow">Tu mapa estelar del cine</p>
        <p className="font-display text-5xl leading-[0.95] tracking-wide text-fg sm:text-6xl lg:text-7xl">
          {TAGLINE.lead}
          <span className="block text-violet-light">{TAGLINE.accent}</span>
        </p>
        <p className="max-w-md text-fg-secondary">
          MovieVerse conecta películas por directores, géneros y afinidades para que encuentres tu próxima favorita
          más allá de los títulos de siempre.
        </p>
        <Constellation className="hidden w-full max-w-md sm:block" />
      </section>

      <Card className="w-full animate-fade-up p-6 [animation-delay:120ms] sm:p-9 lg:max-w-md lg:justify-self-end">
        <header className="mb-7 flex flex-col gap-1.5">
          <h1 className="font-display text-4xl leading-none tracking-wide text-fg">{title}</h1>
          <p className="text-fg-secondary">{subtitle}</p>
        </header>
        {children}
        <p className="mt-6 text-center text-sm text-fg-secondary">{footer}</p>
      </Card>
    </div>
  );
}
