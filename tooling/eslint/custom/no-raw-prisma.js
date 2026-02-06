/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevents direct Prisma client usage; must use scopedClient(tenantId)",
    },
    messages: {
      noRawPrisma:
        "Direct Prisma client usage is not allowed. Use scopedClient(tenantId) from @dubai/db instead.",
    },
    schema: [],
  },
  create() {
    // Stub - full implementation in Story 1.6
    return {};
  },
};
