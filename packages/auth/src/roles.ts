export const USER_ROLES = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  RETAILER_ADMIN: "RETAILER_ADMIN",
  RETAILER_STAFF: "RETAILER_STAFF",
  CORPORATE_ADMIN: "CORPORATE_ADMIN",
  CORPORATE_EMPLOYEE: "CORPORATE_EMPLOYEE",
  PORTFOLIO_OWNER: "PORTFOLIO_OWNER",
  PROPERTY_MANAGER: "PROPERTY_MANAGER",
  AGENT: "AGENT",
  HOUSEHOLD_MEMBER: "HOUSEHOLD_MEMBER",
  USER: "USER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const PERMISSIONS = {
  USER_READ_OWN: "user:read:own",
  USER_UPDATE_OWN: "user:update:own",
  USER_DELETE_OWN: "user:delete:own",
  USER_READ_ALL: "user:read:all",
  USER_UPDATE_ALL: "user:update:all",
  USER_DELETE_ALL: "user:delete:all",
  RETAILER_MANAGE: "retailer:manage",
  CATALOG_MANAGE: "catalog:manage",
  ORDER_MANAGE: "order:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [USER_ROLES.PLATFORM_ADMIN]: Object.values(PERMISSIONS),
  [USER_ROLES.SUPPORT_AGENT]: [
    PERMISSIONS.USER_READ_ALL,
    PERMISSIONS.ORDER_MANAGE,
  ],
  [USER_ROLES.RETAILER_ADMIN]: [
    PERMISSIONS.RETAILER_MANAGE,
    PERMISSIONS.CATALOG_MANAGE,
    PERMISSIONS.ORDER_MANAGE,
  ],
  [USER_ROLES.RETAILER_STAFF]: [
    PERMISSIONS.CATALOG_MANAGE,
    PERMISSIONS.ORDER_MANAGE,
  ],
  [USER_ROLES.CORPORATE_ADMIN]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.ORDER_MANAGE,
  ],
  [USER_ROLES.CORPORATE_EMPLOYEE]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
  ],
  [USER_ROLES.PORTFOLIO_OWNER]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
  ],
  [USER_ROLES.PROPERTY_MANAGER]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
  ],
  [USER_ROLES.AGENT]: [PERMISSIONS.USER_READ_OWN, PERMISSIONS.ORDER_MANAGE],
  [USER_ROLES.HOUSEHOLD_MEMBER]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
  ],
  [USER_ROLES.USER]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_DELETE_OWN,
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export const MFA_REQUIRED_ROLES: UserRole[] = [
  USER_ROLES.PLATFORM_ADMIN,
  USER_ROLES.SUPPORT_AGENT,
  USER_ROLES.RETAILER_ADMIN,
];

export function requiresMFA(role: UserRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}
