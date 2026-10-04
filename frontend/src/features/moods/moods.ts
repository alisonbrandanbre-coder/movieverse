import { Brain, CloudRain, Ghost, Laugh, Sunrise, Zap, type LucideIcon } from "lucide-react";

/**
 * The Home's mood cards ("¿Cómo te sentís hoy?"). What each mood means in movies (TMDB
 * genres) is decided by the backend (`backend/apps/movies/moods.py`); here only how each
 * card looks. Colors are palette tokens; class names are literal so Tailwind sees them.
 */
export interface MoodCardStyle {
  slug: string;
  label: string;
  tagline: string;
  icon: LucideIcon;
  /** Icon and accents. */
  text: string;
  /** Card tint and border. */
  tint: string;
  /** Glow on hover / focus. */
  glow: string;
}

export const MOODS: MoodCardStyle[] = [
  {
    slug: "para-reir",
    label: "Para reír",
    tagline: "Comedias que levantan cualquier día",
    icon: Laugh,
    text: "text-mint",
    tint: "from-mint/20 border-mint/30",
    glow: "hover:shadow-[0_0_48px_-8px_var(--color-mint)] focus-visible:shadow-[0_0_48px_-8px_var(--color-mint)] hover:border-mint/70",
  },
  {
    slug: "para-pensar",
    label: "Para pensar",
    tagline: "Ideas que te siguen después de los créditos",
    icon: Brain,
    text: "text-sky",
    tint: "from-sky/20 border-sky/30",
    glow: "hover:shadow-[0_0_48px_-8px_var(--color-sky)] focus-visible:shadow-[0_0_48px_-8px_var(--color-sky)] hover:border-sky/70",
  },
  {
    slug: "adrenalina",
    label: "Adrenalina",
    tagline: "Acción y suspenso sin respiro",
    icon: Zap,
    text: "text-coral",
    tint: "from-coral/20 border-coral/30",
    glow: "hover:shadow-[0_0_48px_-8px_var(--color-coral)] focus-visible:shadow-[0_0_48px_-8px_var(--color-coral)] hover:border-coral/70",
  },
  {
    slug: "para-llorar",
    label: "Para llorar",
    tagline: "Historias que llegan al corazón",
    icon: CloudRain,
    text: "text-blue",
    tint: "from-blue/25 border-blue/35",
    glow: "hover:shadow-[0_0_48px_-8px_var(--color-blue)] focus-visible:shadow-[0_0_48px_-8px_var(--color-blue)] hover:border-blue/80",
  },
  {
    slug: "inspiradora",
    label: "Inspiradora",
    tagline: "Basadas en hechos reales que inspiran",
    icon: Sunrise,
    text: "text-violet-light",
    tint: "from-violet-light/20 border-violet-light/30",
    glow: "hover:shadow-[0_0_48px_-8px_var(--color-violet-light)] focus-visible:shadow-[0_0_48px_-8px_var(--color-violet-light)] hover:border-violet-light/70",
  },
  {
    slug: "miedo",
    label: "Miedo",
    tagline: "Terror para ver con la luz prendida",
    icon: Ghost,
    text: "text-danger",
    tint: "from-danger-strong/20 border-danger-strong/30",
    glow: "hover:shadow-[0_0_48px_-8px_var(--color-danger-strong)] focus-visible:shadow-[0_0_48px_-8px_var(--color-danger-strong)] hover:border-danger-strong/70",
  },
];

export function moodStyle(slug: string | undefined): MoodCardStyle | undefined {
  return MOODS.find((mood) => mood.slug === slug);
}
