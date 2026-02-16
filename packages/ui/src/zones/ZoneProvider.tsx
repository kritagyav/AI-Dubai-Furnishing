"use client";

import * as React from "react";

export type ZoneName = "warmth" | "delight" | "efficiency";

interface ZoneContextProps {
  zone: ZoneName;
}

const ZoneContext = React.createContext<ZoneContextProps | undefined>(
  undefined,
);

interface ZoneProviderProps extends React.PropsWithChildren {
  zone: ZoneName;
  className?: string;
}

/**
 * Applies zone-specific design token overrides via CSS scope.
 *
 * Wraps children in a `<div data-zone="...">` that activates
 * per-zone CSS custom property overrides built by Style Dictionary.
 */
export function ZoneProvider({ zone, className, children }: ZoneProviderProps) {
  return (
    <ZoneContext value={{ zone }}>
      <div data-zone={zone} className={className}>
        {children}
      </div>
    </ZoneContext>
  );
}

/**
 * Returns the current zone name for conditional rendering logic.
 * Must be used within a ZoneProvider.
 */
export function useZone(): ZoneContextProps {
  const context = React.use(ZoneContext);
  if (!context) {
    throw new Error("useZone must be used within a ZoneProvider");
  }
  return context;
}
