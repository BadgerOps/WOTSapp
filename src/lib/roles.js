/**
 * Role definitions and permission mappings for WOTS App
 *
 * This module provides centralized role management including:
 * - Role identifiers (use these instead of hardcoded strings)
 * - Role display information (labels, descriptions, colors)
 * - Permission definitions
 * - Role-to-permission mappings
 * - Helper functions for permission checks
 */

// Role identifiers - use these instead of hardcoded strings
export const ROLES = {
  USER: 'user',
  UNIFORM_ADMIN: 'uniform_admin',
  ADMIN: 'admin',
};

// Role display information for UI
export const ROLE_INFO = {
  [ROLES.USER]: {
    label: 'User',
    description: 'Standard user access',
    color: 'gray',
  },
  [ROLES.UNIFORM_ADMIN]: {
    label: 'Uniform Admin',
    description: 'Can manage UOTD and approve weather recommendations',
    color: 'blue',
  },
  [ROLES.ADMIN]: {
    label: 'Admin',
    description: 'Full administrative access',
    color: 'purple',
  },
};

// Role hierarchy (higher index = more permissions)
export const ROLE_HIERARCHY = [ROLES.USER, ROLES.UNIFORM_ADMIN, ROLES.ADMIN];

// Permission definitions
export const PERMISSIONS = {
  // User permissions
  VIEW_ASSIGNED_DETAILS: 'view_assigned_details',
  SIGN_OTHERS_ON_PASS: 'sign_others_on_pass',
  VIEW_UPDATES: 'view_updates',

  // Uniform admin permissions
  MODIFY_UOTD: 'modify_uotd',
  APPROVE_WEATHER_UOTD: 'approve_weather_uotd',
  MODIFY_UNIFORMS: 'modify_uniforms',

  // Admin permissions
  MANAGE_POSTS: 'manage_posts',
  MANAGE_DOCUMENTS: 'manage_documents',
  MANAGE_PERSONNEL: 'manage_personnel',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_DETAILS: 'manage_details',
  MANAGE_CQ: 'manage_cq',
  MANAGE_CONFIG: 'manage_config',
};

// Role to permissions mapping
export const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.VIEW_ASSIGNED_DETAILS,
    PERMISSIONS.SIGN_OTHERS_ON_PASS,
    PERMISSIONS.VIEW_UPDATES,
  ],
  [ROLES.UNIFORM_ADMIN]: [
    // Inherits USER permissions
    PERMISSIONS.VIEW_ASSIGNED_DETAILS,
    PERMISSIONS.SIGN_OTHERS_ON_PASS,
    PERMISSIONS.VIEW_UPDATES,
    // Own permissions
    PERMISSIONS.MODIFY_UOTD,
    PERMISSIONS.APPROVE_WEATHER_UOTD,
    PERMISSIONS.MODIFY_UNIFORMS,
  ],
  [ROLES.ADMIN]: [
    // All permissions
    ...Object.values(PERMISSIONS),
  ],
};

/**
 * Check if a role has a specific permission
 * @param {string} role - The role to check
 * @param {string} permission - The permission to check for
 * @returns {boolean} True if the role has the permission
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Check if roleA is at least as privileged as roleB in the hierarchy
 * @param {string} roleA - The role to check
 * @param {string} roleB - The role to compare against
 * @returns {boolean} True if roleA is at least as privileged as roleB
 */
export function isRoleAtLeast(roleA, roleB) {
  if (!roleA || !roleB) return false;
  const indexA = ROLE_HIERARCHY.indexOf(roleA);
  const indexB = ROLE_HIERARCHY.indexOf(roleB);
  if (indexA === -1 || indexB === -1) return false;
  return indexA >= indexB;
}

/**
 * Get roles that are assignable by the given role
 * Only admins can assign roles
 * @param {string} currentRole - The role of the user attempting to assign
 * @returns {string[]} Array of assignable role identifiers
 */
export function getAssignableRoles(currentRole) {
  if (currentRole !== ROLES.ADMIN) return [];
  return [...ROLE_HIERARCHY]; // Return a copy to prevent mutation
}

/**
 * Get role info for display purposes
 * @param {string} role - The role identifier
 * @returns {object|null} Role info object or null if invalid
 */
export function getRoleInfo(role) {
  return ROLE_INFO[role] || null;
}

/**
 * Normalize a role string (lowercase, trim)
 * Returns 'user' as default for invalid/empty roles
 * @param {string} role - The role string to normalize
 * @returns {string} Normalized role identifier
 */
export function normalizeRole(role) {
  if (!role || typeof role !== 'string') return ROLES.USER;
  const normalized = role.toLowerCase().trim();
  return ROLE_HIERARCHY.includes(normalized) ? normalized : ROLES.USER;
}

/**
 * Check if a role string is valid
 * @param {string} role - The role string to validate
 * @returns {boolean} True if the role is valid
 */
export function isValidRole(role) {
  if (!role) return false;
  return ROLE_HIERARCHY.includes(role.toLowerCase().trim());
}
