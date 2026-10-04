import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Id of the element that names the dialog (usually its heading). */
  labelledBy: string;
  children: ReactNode;
  /** `md` (672px, default) or `lg` (1024px, e.g. the surprise's three cards). */
  size?: "md" | "lg";
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: rendered over a blurred night backdrop, closes with Esc, the ✕
 * or a click outside; keeps Tab inside, focuses its first control and gives the focus back
 * to whatever opened it. The page behind does not scroll while it is open.
 */
export function Modal({ open, onClose, labelledBy, children, size = "md", className = "" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-deep/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative my-auto w-full ${size === "lg" ? "max-w-5xl" : "max-w-2xl"} animate-fade-up overflow-hidden rounded-card border border-line-strong bg-base shadow-card outline-none ${className}`}
      >
        {children}
        {/* After the content: the focus lands on the dialog's own actions first. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 rounded-control p-1.5 text-fg-secondary hover:bg-violet/15 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  );
}
