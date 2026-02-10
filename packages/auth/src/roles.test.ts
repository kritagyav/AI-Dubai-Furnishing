import { describe, expect, it } from "vitest";

import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  PERMISSIONS,
  requiresMFA,
  USER_ROLES,
} from "./roles";

describe("Role Permissions", () => {
  it("platform admin has all permissions", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission(USER_ROLES.PLATFORM_ADMIN, permission)).toBe(true);
    }
  });

  it("user has only own permissions", () => {
    expect(hasPermission(USER_ROLES.USER, PERMISSIONS.USER_READ_OWN)).toBe(
      true,
    );
    expect(hasPermission(USER_ROLES.USER, PERMISSIONS.USER_UPDATE_OWN)).toBe(
      true,
    );
    expect(hasPermission(USER_ROLES.USER, PERMISSIONS.USER_DELETE_OWN)).toBe(
      true,
    );
    expect(hasPermission(USER_ROLES.USER, PERMISSIONS.USER_READ_ALL)).toBe(
      false,
    );
    expect(hasPermission(USER_ROLES.USER, PERMISSIONS.USER_UPDATE_ALL)).toBe(
      false,
    );
  });

  it("retailer admin can manage catalog and orders", () => {
    expect(
      hasPermission(USER_ROLES.RETAILER_ADMIN, PERMISSIONS.CATALOG_MANAGE),
    ).toBe(true);
    expect(
      hasPermission(USER_ROLES.RETAILER_ADMIN, PERMISSIONS.ORDER_MANAGE),
    ).toBe(true);
    expect(
      hasPermission(USER_ROLES.RETAILER_ADMIN, PERMISSIONS.USER_DELETE_ALL),
    ).toBe(false);
  });

  it("support agent can read all users and manage orders", () => {
    expect(
      hasPermission(USER_ROLES.SUPPORT_AGENT, PERMISSIONS.USER_READ_ALL),
    ).toBe(true);
    expect(
      hasPermission(USER_ROLES.SUPPORT_AGENT, PERMISSIONS.ORDER_MANAGE),
    ).toBe(true);
    expect(
      hasPermission(USER_ROLES.SUPPORT_AGENT, PERMISSIONS.USER_DELETE_ALL),
    ).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true if user has at least one permission", () => {
    expect(
      hasAnyPermission(USER_ROLES.USER, [
        PERMISSIONS.USER_READ_OWN,
        PERMISSIONS.USER_READ_ALL,
      ]),
    ).toBe(true);
  });

  it("returns false if user has none of the permissions", () => {
    expect(
      hasAnyPermission(USER_ROLES.USER, [
        PERMISSIONS.USER_READ_ALL,
        PERMISSIONS.USER_DELETE_ALL,
      ]),
    ).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("returns true if user has all permissions", () => {
    expect(
      hasAllPermissions(USER_ROLES.USER, [
        PERMISSIONS.USER_READ_OWN,
        PERMISSIONS.USER_UPDATE_OWN,
      ]),
    ).toBe(true);
  });

  it("returns false if user is missing a permission", () => {
    expect(
      hasAllPermissions(USER_ROLES.USER, [
        PERMISSIONS.USER_READ_OWN,
        PERMISSIONS.USER_READ_ALL,
      ]),
    ).toBe(false);
  });
});

describe("MFA Requirements", () => {
  it("MFA required for platform admin", () => {
    expect(requiresMFA(USER_ROLES.PLATFORM_ADMIN)).toBe(true);
  });

  it("MFA required for support agent", () => {
    expect(requiresMFA(USER_ROLES.SUPPORT_AGENT)).toBe(true);
  });

  it("MFA required for retailer admin", () => {
    expect(requiresMFA(USER_ROLES.RETAILER_ADMIN)).toBe(true);
  });

  it("MFA not required for regular user", () => {
    expect(requiresMFA(USER_ROLES.USER)).toBe(false);
  });

  it("MFA not required for retailer staff", () => {
    expect(requiresMFA(USER_ROLES.RETAILER_STAFF)).toBe(false);
  });
});
