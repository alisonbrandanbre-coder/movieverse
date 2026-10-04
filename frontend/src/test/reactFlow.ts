/**
 * jsdom has no layout: React Flow needs ResizeObserver, DOMMatrixReadOnly and element sizes
 * to render nodes and edges (recipe from the React Flow testing docs).
 */
class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const contentRect = { width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0 };
    this.callback([{ target, contentRect } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

class DOMMatrixReadOnlyMock {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
    this.m22 = scale !== undefined ? Number(scale) : 1;
  }
}

let installed = false;

export function mockReactFlow(): void {
  if (installed) return;
  installed = true;
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get() { return parseFloat((this as HTMLElement).style.height) || 200; } },
    offsetWidth: { configurable: true, get() { return parseFloat((this as HTMLElement).style.width) || 100; } },
  });
  (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}
