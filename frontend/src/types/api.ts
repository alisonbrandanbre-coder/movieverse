/** Error envelope returned by the MovieVerse API (docs/API_GUIDELINES.md). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[] | string>;
  };
}
