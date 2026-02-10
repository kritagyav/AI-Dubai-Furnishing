/**
 * Style Dictionary pipeline configuration.
 *
 * Compiles W3C DTCG-format tokens (Primitive → Semantic → Component)
 * into CSS custom properties (web) and TypeScript theme objects (RN).
 */
import StyleDictionary from "style-dictionary";

const SOURCE_GLOBS = [
  "src/tokens/primitive/**/*.json",
  "src/tokens/semantic/**/*.json",
  "src/tokens/component/**/*.json",
];

/** Transforms matching the built-in 'css' transform group */
const CSS_TRANSFORMS = [
  "attribute/cti",
  "name/kebab",
  "time/seconds",
  "html/icon",
  "size/rem",
  "color/css",
];

/** Main token build — all layers except zone overrides */
export async function buildTokens() {
  const sd = new StyleDictionary({
    source: SOURCE_GLOBS,
    platforms: {
      css: {
        transformGroup: "css",
        buildPath: "dist/css/",
        files: [
          {
            destination: "variables.css",
            format: "css/variables",
            options: { outputReferences: true },
          },
        ],
      },
      js: {
        transformGroup: "js",
        buildPath: "dist/js/",
        files: [
          {
            destination: "tokens.js",
            format: "javascript/es6",
          },
        ],
      },
      ts: {
        transformGroup: "js",
        buildPath: "dist/js/",
        files: [
          {
            destination: "tokens.d.ts",
            format: "typescript/es6-declarations",
          },
        ],
      },
      reactNative: {
        transformGroup: "js",
        buildPath: "dist/react-native/",
        files: [
          {
            destination: "theme.js",
            format: "javascript/es6",
          },
          {
            destination: "theme.d.ts",
            format: "typescript/es6-declarations",
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
}

/** Zone token build — generates per-zone CSS with only zone-specific overrides */
export async function buildZoneTokens() {
  const zones = ["warmth", "delight", "efficiency"] as const;

  // Strip zone prefix so overrides shadow base semantic vars
  StyleDictionary.registerTransform({
    name: "name/strip-zone",
    type: "name",
    filter: (token) => token.path[0]?.startsWith("zone-") ?? false,
    transform: (token) => token.path.slice(1).join("-"),
  });

  for (const zone of zones) {
    const sd = new StyleDictionary({
      source: [...SOURCE_GLOBS, `src/tokens/zones/${zone}.json`],
      platforms: {
        css: {
          transforms: [...CSS_TRANSFORMS, "name/strip-zone"],
          buildPath: "dist/css/zones/",
          files: [
            {
              destination: `${zone}.css`,
              format: "css/variables",
              filter: (token) => token.path[0] === `zone-${zone}`,
              options: {
                outputReferences: true,
                selector: `[data-zone="${zone}"]`,
              },
            },
          ],
        },
      },
    });

    await sd.buildAllPlatforms();
  }
}

/** Run full build pipeline */
export async function build() {
  await buildTokens();
  await buildZoneTokens();
}
