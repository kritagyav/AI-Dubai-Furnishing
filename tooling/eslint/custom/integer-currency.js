/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "All currency values must be integer fils, never floating point",
    },
    messages: {
      integerCurrency:
        "Currency values must be represented as integer fils (1/100th of AED), not floating point.",
    },
    schema: [],
  },
  create() {
    // Stub - full implementation in Story 1.6
    return {};
  },
};
