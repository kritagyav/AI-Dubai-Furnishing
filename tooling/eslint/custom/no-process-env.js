/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Must use @dubai/shared/env validated entry point instead of process.env",
    },
    messages: {
      noProcessEnv:
        "Direct process.env access is not allowed. Use @dubai/shared/env instead.",
    },
    schema: [],
  },
  create() {
    // Stub - full implementation in Story 1.6
    return {};
  },
};
