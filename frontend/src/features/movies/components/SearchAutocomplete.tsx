import { Search } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";

import { Input } from "@/components/ui/Input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { SEARCH_MIN_LENGTH } from "../api";
import { useMovieSearch } from "../hooks";
import { PosterImage } from "./PosterImage";

const SUGGEST_DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

interface SearchAutocompleteProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Search field with suggestions (WAI-ARIA combobox): 300 ms after typing, up to 6 movies
 * with a mini poster, title and year. Opens when typing (not on focus, so coming back to a
 * search does not cover its results). ↑/↓ move, Enter opens the highlighted movie (or
 * submits the form if none is), Escape closes. Shares the search cache with the results
 * grid, so it costs no extra request.
 */
export function SearchAutocomplete({ id, value, onChange, placeholder, autoFocus }: SearchAutocompleteProps) {
  const listId = useId();
  const navigate = useNavigate();
  const query = useDebouncedValue(value, SUGGEST_DEBOUNCE_MS).trim();
  const search = useMovieSearch(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const ready = query.length >= SEARCH_MIN_LENGTH && query === value.trim() && search.isSuccess && !search.isPlaceholderData;
  const suggestions = ready ? search.data.results.slice(0, MAX_SUGGESTIONS) : [];
  const expanded = open && suggestions.length > 0;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(movieId: number) {
    setOpen(false);
    navigate(`/movies/${movieId}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (expanded) event.preventDefault();
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!expanded) {
      if (event.key === "ArrowDown" && suggestions.length > 0) setOpen(true);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      // -1 is the text field itself; past either end it wraps around.
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const next = current + step;
        if (next >= suggestions.length) return -1;
        if (next < -1) return suggestions.length - 1;
        return next;
      });
      return;
    }
    if (event.key === "Enter" && active >= 0 && suggestions[active]) {
      event.preventDefault();
      choose(suggestions[active].id);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        icon={Search}
        inputSize="lg"
        emphasis
        type="search"
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={100}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Sugerencias"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-30 mt-2 flex animate-fade-up flex-col gap-0.5 overflow-hidden rounded-card border border-line-strong bg-base/95 p-1.5 shadow-card backdrop-blur-lg"
      >
        {suggestions.map((movie, index) => (
          <li
            key={movie.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // mousedown: choose before the input's blur closes the list.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(movie.id);
            }}
            onMouseEnter={() => setActive(index)}
            className={`flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 transition-colors ${
              index === active ? "bg-violet/20 text-fg" : "text-fg-secondary"
            }`}
          >
            <PosterImage src={movie.posterUrl} alt="" title={movie.title} className="w-9 shrink-0 rounded-md" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold text-fg">{movie.title}</span>
              <span className="text-xs text-fg-muted">{movie.releaseYear ?? "Sin fecha"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
