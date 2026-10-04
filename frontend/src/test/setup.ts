import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// findBy*/waitFor wait up to 3 s (default 1 s): full-route tests (lazy map, React Flow
// measuring) occasionally needed longer on a loaded machine.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
