import type { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 ${className}`}>{children}</div>;
}

interface PageHeaderProps {
  title: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  description?: ReactNode;
}

/** The page's `<h1>` in Bebas Neue, with optional eyebrow and description. */
export function PageHeader({ title, eyebrow, description }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="font-display text-5xl leading-none tracking-wide text-fg sm:text-6xl">{title}</h1>
      {description && <p className="max-w-2xl text-fg-secondary">{description}</p>}
    </header>
  );
}
