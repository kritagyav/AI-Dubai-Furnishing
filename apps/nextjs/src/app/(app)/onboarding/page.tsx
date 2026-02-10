"use client";

/**
 * Onboarding Path Selection — Story 1.10.
 *
 * After first login, users choose between:
 * - "I need to furnish now" → room input → preferences → package generation
 * - "Just browsing" → discovery features, style gallery
 *
 * Acceptance criteria:
 * - Two clear path options with descriptions
 * - Touch targets minimum 44x44px (NFR-A5)
 * - Accessible via keyboard and screen reader (NFR-A3, NFR-A4)
 * - Path preference stored for personalization
 * - All features accessible regardless of path chosen
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@dubai/ui/button";

import { useTRPC } from "~/trpc/react";

type PathChoice = "FURNISH_NOW" | "JUST_BROWSING";

interface PathOption {
  id: PathChoice;
  title: string;
  description: string;
  cta: string;
  highlights: string[];
}

const PATH_OPTIONS: PathOption[] = [
  {
    id: "FURNISH_NOW",
    title: "I need to furnish now",
    description:
      "Get a complete furnishing package for your apartment with AI-curated recommendations, real inventory, and coordinated delivery.",
    cta: "Start furnishing",
    highlights: [
      "Scan your rooms or enter dimensions",
      "Get AI-curated furniture packages",
      "One-click checkout with delivery scheduling",
    ],
  },
  {
    id: "JUST_BROWSING",
    title: "Just browsing",
    description:
      "Explore styles, browse completed apartments, and save ideas for later. No commitment needed.",
    cta: "Explore styles",
    highlights: [
      "Browse the Style Gallery",
      "Discover design trends by neighborhood",
      "Save packages for later",
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [selected, setSelected] = useState<PathChoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async (path: PathChoice) => {
    setSelected(path);
    setIsSubmitting(true);

    try {
      await trpc.user.setOnboardingPath.mutate({ path });

      if (path === "FURNISH_NOW") {
        router.push("/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setIsSubmitting(false);
      setSelected(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome to Dubai Furnishing
          </h1>
          <p className="text-muted-foreground text-lg">
            How would you like to get started?
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {PATH_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              disabled={isSubmitting}
              aria-pressed={selected === option.id}
              className={`
                group relative flex flex-col rounded-xl border-2 p-6 text-left transition-all
                min-h-[200px]
                focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  selected === option.id
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/50 hover:shadow-sm"
                }
              `}
              style={{ minWidth: "44px", minHeight: "44px" }}
            >
              <div className="flex-1 space-y-3">
                <h2 className="text-xl font-semibold">{option.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {option.description}
                </p>
                <ul className="space-y-1.5" aria-label={`${option.title} features`}>
                  {option.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="text-muted-foreground flex items-start gap-2 text-sm"
                    >
                      <span
                        className="text-primary mt-0.5 text-xs"
                        aria-hidden="true"
                      >
                        &#x2713;
                      </span>
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <span
                  className={`
                    inline-flex items-center text-sm font-medium
                    ${selected === option.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}
                  `}
                >
                  {selected === option.id && isSubmitting
                    ? "Setting up..."
                    : option.cta}
                  <span aria-hidden="true" className="ml-1">
                    &rarr;
                  </span>
                </span>
              </div>

              {selected === option.id && (
                <div
                  className="bg-primary absolute -top-px -right-px rounded-bl-lg rounded-tr-xl px-3 py-1 text-xs font-medium text-white"
                  aria-hidden="true"
                >
                  Selected
                </div>
              )}
            </button>
          ))}
        </div>

        <p className="text-muted-foreground text-center text-xs">
          You can switch between these modes at any time. All features remain
          accessible regardless of your choice.
        </p>
      </div>
    </div>
  );
}
