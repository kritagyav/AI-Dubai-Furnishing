export const fixtures = {
  user: {
    priya: {
      id: "user-priya",
      name: "Priya Sharma",
      email: "priya@test.com",
      role: "user" as const,
    },
    ahmed: {
      id: "user-ahmed",
      name: "Ahmed Al-Rashidi",
      email: "ahmed@test.com",
      role: "retailer_admin" as const,
      tenantId: "retailer-1",
    },
    layla: {
      id: "user-layla",
      name: "Layla Osman",
      email: "layla@test.com",
      role: "platform_admin" as const,
    },
  },
};
