import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { MOODS } from "../moods";

/** "¿Cómo te sentís hoy?": six large cards, each with its icon, color and glow, to /mood/:slug. */
export function MoodCards() {
  return (
    <section aria-labelledby="moods-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Según tu ánimo</p>
        <h2 id="moods-title" className="font-display text-4xl leading-none tracking-wide text-fg sm:text-5xl">
          ¿Cómo te sentís hoy?
        </h2>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {MOODS.map((mood, index) => {
          const Icon = mood.icon;
          return (
            <li key={mood.slug} className="animate-card-in" style={{ animationDelay: `${index * 60}ms` }}>
              <Link
                to={`/mood/${mood.slug}`}
                className={`group relative flex h-full min-h-36 flex-col justify-between gap-4 overflow-hidden rounded-card border bg-linear-to-br to-surface p-4 backdrop-blur-md transition duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-44 sm:p-6 ${mood.tint} ${mood.glow}`}
              >
                <span className="flex size-12 items-center justify-center rounded-full border border-current/30 bg-deep/50 sm:size-14">
                  <Icon className={`size-6 sm:size-7 ${mood.text}`} aria-hidden />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 font-display text-2xl leading-none tracking-wide text-fg sm:text-3xl">
                    {mood.label}
                    <ArrowRight
                      className={`size-5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 ${mood.text}`}
                      aria-hidden
                    />
                  </span>
                  <span className="text-xs text-fg-secondary sm:text-sm">{mood.tagline}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
