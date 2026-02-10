export interface MockTRPCContext {
  user: { id: string; email: string; role: string } | null;
  db: unknown;
  correlationId: string;
}

export function mockTRPCContext(
  overrides?: Partial<MockTRPCContext>,
): MockTRPCContext {
  return {
    user: null,
    db: {},
    correlationId: "test-corr-id",
    ...overrides,
  };
}
