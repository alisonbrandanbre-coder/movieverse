import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

interface CarouselProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Optional element on the header's right (e.g. a "Ver todo" link). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal row with a heading and ‹ › arrows that scroll one "page" smoothly. Also
 * scrolls with swipe, trackpad and (once focused) the arrow keys; the scrollbar is hidden.
 * Arrows hide at each end and on touch screens. Children are the row's items.
 * The row starts aligned with the title and runs to the right edge of the window, fading
 * out there while there is more to see.
 */
export function Carousel({ title, description, icon: Icon, action, children, className = "" }: CarouselProps) {
  const headingId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setEdges({ start: row.scrollLeft <= 4, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [update, children]);

  function scroll(direction: 1 | -1) {
    const row = rowRef.current;
    if (!row) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy?.({ left: direction * row.clientWidth * 0.85, behavior: reduced ? "auto" : "smooth" });
  }

  const arrow =
    "hidden size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-fg-secondary shadow-card backdrop-blur-md transition hover:border-focus hover:text-fg focus-visible:outline-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-0 [@media(hover:hover)]:flex";

  return (
    <section aria-labelledby={headingId} className={`flex flex-col gap-4 ${className}`}>
      <header className="flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-violet-light/40 bg-violet/15">
              <Icon className="size-5 text-violet-soft" aria-hidden />
            </span>
          )}
          <div className="flex flex-col gap-1">
            <h2 id={headingId} className="font-display text-3xl leading-none tracking-wide text-fg">
              {title}
            </h2>
            {description && <p className="text-sm text-fg-secondary">{description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <button type="button" className={arrow} onClick={() => scroll(-1)} disabled={edges.start} aria-label={`Anteriores de ${title}`}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" className={arrow} onClick={() => scroll(1)} disabled={edges.end} aria-label={`Siguientes de ${title}`}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </header>
      <div
        ref={rowRef}
        onScroll={update}
        tabIndex={0}
        role="group"
        aria-label={`${title} (desplazable)`}
        className={`-ml-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto pb-3 pl-4 pr-16 pt-2 scrollbar-none bleed-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:-ml-6 sm:scroll-px-6 sm:gap-5 sm:pl-6 ${edges.end ? "" : "fade-right"}`}
      >
        {children}
      </div>
    </section>
  );
}
