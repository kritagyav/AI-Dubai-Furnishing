/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "All user-facing strings must come from @dubai/shared/messages",
    },
    messages: {
      noInlineStrings:
        "User-facing strings should be imported from @dubai/shared/messages.",
    },
    schema: [],
  },
  create() {
    // Stub - full implementation in Story 1.6
    return {};
  },
};
