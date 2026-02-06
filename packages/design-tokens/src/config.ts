// Design token configuration
// Style Dictionary pipeline configuration for W3C DTCG spec
// Full implementation in Story 1.4

export const tokenConfig = {
  source: ["src/tokens/**/*.json"],
  platforms: {
    css: { transformGroup: "css", buildPath: "dist/css/" },
    js: { transformGroup: "js", buildPath: "dist/js/" },
  },
} as const;
