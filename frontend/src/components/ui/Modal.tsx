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
  /** `center` (default) or `bottom`: a sheet that slides up from the bottom edge (mobile filters). */
  placement?: "center" | "bottom";
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: rendered over a blurred night backdrop, closes with Esc, the ✕
 * or a click outside; keeps Tab inside, focuses its first control and gives the focus back
 * to whatever opened it. The page behind does not scroll while it is open. With
 * `placement="bottom"` it is a bottom sheet: full width, glued to the bottom, scrolls inside.
 */
export function Modal({ open, onClose, labelledBy, children, size = "md", placement = "center", className = "" }: ModalProps) {
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
  const sheet = placement === "bottom";
  const layout = sheet
    ? "items-end justify-center"
    : "items-center justify-center overflow-y-auto p-4";
  const panelLayout = sheet
    ? "max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-card border-b-0 animate-sheet-up"
    : `my-auto ${size === "lg" ? "max-w-5xl" : "max-w-2xl"} animate-fade-up overflow-hidden rounded-card`;
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex bg-deep/80 backdrop-blur-sm ${layout}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative w-full border border-line-strong bg-base shadow-card outline-none ${panelLayout} ${className}`}
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
