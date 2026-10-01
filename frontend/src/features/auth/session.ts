/**
 * Single source of truth for JWT tokens in the browser.
 * No other module reads or writes tokens directly.
 */
export interface SessionTokens {
  access: string;
  refresh: string;
}

const ACCESS_KEY = "movieverse.access";
const REFRESH_KEY = "movieverse.refresh";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export const session = {
  getAccessToken(): string | null {
    return read(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return read(REFRESH_KEY);
  },

  hasSession(): boolean {
    return Boolean(read(REFRESH_KEY));
  },

  setTokens(tokens: SessionTokens): void {
    window.localStorage.setItem(ACCESS_KEY, tokens.access);
    window.localStorage.setItem(REFRESH_KEY, tokens.refresh);
    notify();
  },

  setAccessToken(access: string): void {
    window.localStorage.setItem(ACCESS_KEY, access);
  },

  clear(): void {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    notify();
  },

  /** Subscribe to login/logout changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
