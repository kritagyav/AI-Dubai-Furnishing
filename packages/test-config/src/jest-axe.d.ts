declare module "jest-axe" {
  import type { AxeResults, RunOptions, Spec } from "axe-core";

  export interface AxeConfigureOptions {
    rules?: Spec[];
    [key: string]: unknown;
  }

  export function axe(
    html: Element | string,
    options?: RunOptions,
  ): Promise<AxeResults>;

  export function configureAxe(
    options?: AxeConfigureOptions,
  ): typeof axe;

  export interface JestAxeMatchers {
    toHaveNoViolations(
      results: AxeResults,
    ): { pass: boolean; message(): string };
    [key: string]: unknown;
  }

  export const toHaveNoViolations: JestAxeMatchers;
}
