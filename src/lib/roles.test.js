import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ROLE_INFO,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  isRoleAtLeast,
  getAssignableRoles,
  getRoleInfo,
  normalizeRole,
  isValidRole,
} from './roles';

describe('roles', () => {
  describe('ROLES constants', () => {
    it('should define USER role', () => {
      expect(ROLES.USER).toBe('user');
    });

    it('should define UNIFORM_ADMIN role', () => {
      expect(ROLES.UNIFORM_ADMIN).toBe('uniform_admin');
    });

    it('should define LEAVE_ADMIN role', () => {
      expect(ROLES.LEAVE_ADMIN).toBe('leave_admin');
    });

    it('should define CANDIDATE_LEADERSHIP role', () => {
      expect(ROLES.CANDIDATE_LEADERSHIP).toBe('candidate_leadership');
    });

    it('should define ADMIN role', () => {
      expect(ROLES.ADMIN).toBe('admin');
    });
  });

  describe('ROLE_INFO', () => {
    it('should have info for all roles', () => {
      expect(ROLE_INFO[ROLES.USER]).toBeDefined();
      expect(ROLE_INFO[ROLES.UNIFORM_ADMIN]).toBeDefined();
      expect(ROLE_INFO[ROLES.LEAVE_ADMIN]).toBeDefined();
      expect(ROLE_INFO[ROLES.CANDIDATE_LEADERSHIP]).toBeDefined();
      expect(ROLE_INFO[ROLES.ADMIN]).toBeDefined();
    });

    it('should have required properties for each role', () => {
      Object.values(ROLE_INFO).forEach((info) => {
        expect(info).toHaveProperty('label');
        expect(info).toHaveProperty('description');
        expect(info).toHaveProperty('color');
      });
    });

    it('should have correct labels', () => {
      expect(ROLE_INFO[ROLES.USER].label).toBe('User');
      expect(ROLE_INFO[ROLES.UNIFORM_ADMIN].label).toBe('Uniform Admin');
      expect(ROLE_INFO[ROLES.LEAVE_ADMIN].label).toBe('Leave Admin');
      expect(ROLE_INFO[ROLES.CANDIDATE_LEADERSHIP].label).toBe('Candidate Leadership');
      expect(ROLE_INFO[ROLES.ADMIN].label).toBe('Admin');
    });

    it('should have distinct colors', () => {
      expect(ROLE_INFO[ROLES.USER].color).toBe('gray');
      expect(ROLE_INFO[ROLES.UNIFORM_ADMIN].color).toBe('blue');
      expect(ROLE_INFO[ROLES.LEAVE_ADMIN].color).toBe('teal');
      expect(ROLE_INFO[ROLES.CANDIDATE_LEADERSHIP].color).toBe('green');
      expect(ROLE_INFO[ROLES.ADMIN].color).toBe('purple');
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('should have USER at the bottom', () => {
      expect(ROLE_HIERARCHY[0]).toBe(ROLES.USER);
    });

    it('should have UNIFORM_ADMIN second', () => {
      expect(ROLE_HIERARCHY[1]).toBe(ROLES.UNIFORM_ADMIN);
    });

    it('should have LEAVE_ADMIN third', () => {
      expect(ROLE_HIERARCHY[2]).toBe(ROLES.LEAVE_ADMIN);
    });

    it('should have CANDIDATE_LEADERSHIP fourth', () => {
      expect(ROLE_HIERARCHY[3]).toBe(ROLES.CANDIDATE_LEADERSHIP);
    });

    it('should have ADMIN at the top', () => {
      expect(ROLE_HIERARCHY[4]).toBe(ROLES.ADMIN);
    });

    it('should contain all roles', () => {
      expect(ROLE_HIERARCHY).toHaveLength(5);
      expect(ROLE_HIERARCHY).toContain(ROLES.USER);
      expect(ROLE_HIERARCHY).toContain(ROLES.UNIFORM_ADMIN);
      expect(ROLE_HIERARCHY).toContain(ROLES.LEAVE_ADMIN);
      expect(ROLE_HIERARCHY).toContain(ROLES.CANDIDATE_LEADERSHIP);
      expect(ROLE_HIERARCHY).toContain(ROLES.ADMIN);
    });
  });

  describe('PERMISSIONS', () => {
    it('should define user permissions', () => {
      expect(PERMISSIONS.VIEW_ASSIGNED_DETAILS).toBe('view_assigned_details');
      expect(PERMISSIONS.SIGN_OTHERS_ON_PASS).toBe('sign_others_on_pass');
      expect(PERMISSIONS.VIEW_UPDATES).toBe('view_updates');
    });

    it('should define uniform admin permissions', () => {
      expect(PERMISSIONS.MODIFY_UOTD).toBe('modify_uotd');
      expect(PERMISSIONS.APPROVE_WEATHER_UOTD).toBe('approve_weather_uotd');
      expect(PERMISSIONS.MODIFY_UNIFORMS).toBe('modify_uniforms');
    });

    it('should define leave admin permissions', () => {
      expect(PERMISSIONS.APPROVE_PASS_REQUESTS).toBe('approve_pass_requests');
      expect(PERMISSIONS.VIEW_PASS_REQUESTS).toBe('view_pass_requests');
      expect(PERMISSIONS.CREATE_LEAVE_FOR_OTHERS).toBe('create_leave_for_others');
    });

    it('should define candidate leadership permissions', () => {
      expect(PERMISSIONS.MANAGE_CQ_OPERATIONS).toBe('manage_cq_operations');
    });

    it('should define admin permissions', () => {
      expect(PERMISSIONS.MANAGE_POSTS).toBe('manage_posts');
      expect(PERMISSIONS.MANAGE_DOCUMENTS).toBe('manage_documents');
      expect(PERMISSIONS.MANAGE_PERSONNEL).toBe('manage_personnel');
      expect(PERMISSIONS.MANAGE_ROLES).toBe('manage_roles');
      expect(PERMISSIONS.MANAGE_DETAILS).toBe('manage_details');
      expect(PERMISSIONS.MANAGE_CQ).toBe('manage_cq');
      expect(PERMISSIONS.MANAGE_CONFIG).toBe('manage_config');
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('should give USER basic permissions', () => {
      expect(ROLE_PERMISSIONS[ROLES.USER]).toContain(PERMISSIONS.VIEW_ASSIGNED_DETAILS);
      expect(ROLE_PERMISSIONS[ROLES.USER]).toContain(PERMISSIONS.SIGN_OTHERS_ON_PASS);
      expect(ROLE_PERMISSIONS[ROLES.USER]).toContain(PERMISSIONS.VIEW_UPDATES);
    });

    it('should not give USER admin permissions', () => {
      expect(ROLE_PERMISSIONS[ROLES.USER]).not.toContain(PERMISSIONS.MANAGE_ROLES);
      expect(ROLE_PERMISSIONS[ROLES.USER]).not.toContain(PERMISSIONS.MODIFY_UOTD);
    });

    it('should give UNIFORM_ADMIN user permissions plus uniform permissions', () => {
      // User permissions
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).toContain(PERMISSIONS.VIEW_ASSIGNED_DETAILS);
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).toContain(PERMISSIONS.SIGN_OTHERS_ON_PASS);
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).toContain(PERMISSIONS.VIEW_UPDATES);
      // Uniform admin permissions
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).toContain(PERMISSIONS.MODIFY_UOTD);
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).toContain(PERMISSIONS.APPROVE_WEATHER_UOTD);
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).toContain(PERMISSIONS.MODIFY_UNIFORMS);
    });

    it('should not give UNIFORM_ADMIN full admin permissions', () => {
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).not.toContain(PERMISSIONS.MANAGE_ROLES);
      expect(ROLE_PERMISSIONS[ROLES.UNIFORM_ADMIN]).not.toContain(PERMISSIONS.MANAGE_PERSONNEL);
    });

    it('should give LEAVE_ADMIN pass approval and leave creation permissions', () => {
      // User permissions
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).toContain(PERMISSIONS.VIEW_ASSIGNED_DETAILS);
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).toContain(PERMISSIONS.SIGN_OTHERS_ON_PASS);
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).toContain(PERMISSIONS.VIEW_UPDATES);
      // Leave admin specific permissions
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).toContain(PERMISSIONS.APPROVE_PASS_REQUESTS);
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).toContain(PERMISSIONS.VIEW_PASS_REQUESTS);
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).toContain(PERMISSIONS.CREATE_LEAVE_FOR_OTHERS);
    });

    it('should not give LEAVE_ADMIN full admin permissions', () => {
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).not.toContain(PERMISSIONS.MANAGE_ROLES);
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).not.toContain(PERMISSIONS.MANAGE_PERSONNEL);
      expect(ROLE_PERMISSIONS[ROLES.LEAVE_ADMIN]).not.toContain(PERMISSIONS.MANAGE_CQ_OPERATIONS);
    });

    it('should give CANDIDATE_LEADERSHIP pass approval and CQ permissions', () => {
      // User permissions
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.VIEW_ASSIGNED_DETAILS);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.SIGN_OTHERS_ON_PASS);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.VIEW_UPDATES);
      // Candidate leadership specific permissions
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.APPROVE_PASS_REQUESTS);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.VIEW_PASS_REQUESTS);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.CREATE_LEAVE_FOR_OTHERS);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.MANAGE_CQ_OPERATIONS);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).toContain(PERMISSIONS.MANAGE_CQ);
    });

    it('should not give CANDIDATE_LEADERSHIP full admin permissions', () => {
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).not.toContain(PERMISSIONS.MANAGE_ROLES);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).not.toContain(PERMISSIONS.MANAGE_PERSONNEL);
      expect(ROLE_PERMISSIONS[ROLES.CANDIDATE_LEADERSHIP]).not.toContain(PERMISSIONS.MANAGE_POSTS);
    });

    it('should give ADMIN all permissions', () => {
      Object.values(PERMISSIONS).forEach((permission) => {
        expect(ROLE_PERMISSIONS[ROLES.ADMIN]).toContain(permission);
      });
    });
  });

  describe('hasPermission', () => {
    it('should return true for valid role-permission combinations', () => {
      expect(hasPermission(ROLES.USER, PERMISSIONS.VIEW_ASSIGNED_DETAILS)).toBe(true);
      expect(hasPermission(ROLES.UNIFORM_ADMIN, PERMISSIONS.MODIFY_UOTD)).toBe(true);
      expect(hasPermission(ROLES.LEAVE_ADMIN, PERMISSIONS.APPROVE_PASS_REQUESTS)).toBe(true);
      expect(hasPermission(ROLES.LEAVE_ADMIN, PERMISSIONS.CREATE_LEAVE_FOR_OTHERS)).toBe(true);
      expect(hasPermission(ROLES.CANDIDATE_LEADERSHIP, PERMISSIONS.APPROVE_PASS_REQUESTS)).toBe(true);
      expect(hasPermission(ROLES.CANDIDATE_LEADERSHIP, PERMISSIONS.MANAGE_CQ)).toBe(true);
      expect(hasPermission(ROLES.ADMIN, PERMISSIONS.MANAGE_ROLES)).toBe(true);
    });

    it('should return false for invalid role-permission combinations', () => {
      expect(hasPermission(ROLES.USER, PERMISSIONS.MANAGE_ROLES)).toBe(false);
      expect(hasPermission(ROLES.UNIFORM_ADMIN, PERMISSIONS.MANAGE_ROLES)).toBe(false);
      expect(hasPermission(ROLES.LEAVE_ADMIN, PERMISSIONS.MANAGE_ROLES)).toBe(false);
      expect(hasPermission(ROLES.LEAVE_ADMIN, PERMISSIONS.MANAGE_CQ_OPERATIONS)).toBe(false);
      expect(hasPermission(ROLES.CANDIDATE_LEADERSHIP, PERMISSIONS.MANAGE_ROLES)).toBe(false);
      expect(hasPermission(ROLES.CANDIDATE_LEADERSHIP, PERMISSIONS.MANAGE_POSTS)).toBe(false);
    });

    it('should return false for null/undefined role', () => {
      expect(hasPermission(null, PERMISSIONS.VIEW_UPDATES)).toBe(false);
      expect(hasPermission(undefined, PERMISSIONS.VIEW_UPDATES)).toBe(false);
    });

    it('should return false for null/undefined permission', () => {
      expect(hasPermission(ROLES.ADMIN, null)).toBe(false);
      expect(hasPermission(ROLES.ADMIN, undefined)).toBe(false);
    });

    it('should return false for invalid role', () => {
      expect(hasPermission('invalid_role', PERMISSIONS.VIEW_UPDATES)).toBe(false);
    });

    it('should return false for invalid permission', () => {
      expect(hasPermission(ROLES.ADMIN, 'invalid_permission')).toBe(false);
    });
  });

  describe('isRoleAtLeast', () => {
    it('should return true when roleA equals roleB', () => {
      expect(isRoleAtLeast(ROLES.USER, ROLES.USER)).toBe(true);
      expect(isRoleAtLeast(ROLES.UNIFORM_ADMIN, ROLES.UNIFORM_ADMIN)).toBe(true);
      expect(isRoleAtLeast(ROLES.LEAVE_ADMIN, ROLES.LEAVE_ADMIN)).toBe(true);
      expect(isRoleAtLeast(ROLES.CANDIDATE_LEADERSHIP, ROLES.CANDIDATE_LEADERSHIP)).toBe(true);
      expect(isRoleAtLeast(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
    });

    it('should return true when roleA is higher than roleB', () => {
      expect(isRoleAtLeast(ROLES.ADMIN, ROLES.USER)).toBe(true);
      expect(isRoleAtLeast(ROLES.ADMIN, ROLES.UNIFORM_ADMIN)).toBe(true);
      expect(isRoleAtLeast(ROLES.ADMIN, ROLES.LEAVE_ADMIN)).toBe(true);
      expect(isRoleAtLeast(ROLES.ADMIN, ROLES.CANDIDATE_LEADERSHIP)).toBe(true);
      expect(isRoleAtLeast(ROLES.CANDIDATE_LEADERSHIP, ROLES.USER)).toBe(true);
      expect(isRoleAtLeast(ROLES.CANDIDATE_LEADERSHIP, ROLES.UNIFORM_ADMIN)).toBe(true);
      expect(isRoleAtLeast(ROLES.CANDIDATE_LEADERSHIP, ROLES.LEAVE_ADMIN)).toBe(true);
      expect(isRoleAtLeast(ROLES.LEAVE_ADMIN, ROLES.USER)).toBe(true);
      expect(isRoleAtLeast(ROLES.LEAVE_ADMIN, ROLES.UNIFORM_ADMIN)).toBe(true);
      expect(isRoleAtLeast(ROLES.UNIFORM_ADMIN, ROLES.USER)).toBe(true);
    });

    it('should return false when roleA is lower than roleB', () => {
      expect(isRoleAtLeast(ROLES.USER, ROLES.ADMIN)).toBe(false);
      expect(isRoleAtLeast(ROLES.USER, ROLES.UNIFORM_ADMIN)).toBe(false);
      expect(isRoleAtLeast(ROLES.USER, ROLES.LEAVE_ADMIN)).toBe(false);
      expect(isRoleAtLeast(ROLES.USER, ROLES.CANDIDATE_LEADERSHIP)).toBe(false);
      expect(isRoleAtLeast(ROLES.UNIFORM_ADMIN, ROLES.ADMIN)).toBe(false);
      expect(isRoleAtLeast(ROLES.UNIFORM_ADMIN, ROLES.LEAVE_ADMIN)).toBe(false);
      expect(isRoleAtLeast(ROLES.UNIFORM_ADMIN, ROLES.CANDIDATE_LEADERSHIP)).toBe(false);
      expect(isRoleAtLeast(ROLES.LEAVE_ADMIN, ROLES.ADMIN)).toBe(false);
      expect(isRoleAtLeast(ROLES.LEAVE_ADMIN, ROLES.CANDIDATE_LEADERSHIP)).toBe(false);
      expect(isRoleAtLeast(ROLES.CANDIDATE_LEADERSHIP, ROLES.ADMIN)).toBe(false);
    });

    it('should return false for null/undefined roles', () => {
      expect(isRoleAtLeast(null, ROLES.USER)).toBe(false);
      expect(isRoleAtLeast(ROLES.USER, null)).toBe(false);
      expect(isRoleAtLeast(undefined, ROLES.USER)).toBe(false);
      expect(isRoleAtLeast(ROLES.USER, undefined)).toBe(false);
    });

    it('should return false for invalid roles', () => {
      expect(isRoleAtLeast('invalid', ROLES.USER)).toBe(false);
      expect(isRoleAtLeast(ROLES.USER, 'invalid')).toBe(false);
    });
  });

  describe('getAssignableRoles', () => {
    it('should return all roles for admin', () => {
      const assignable = getAssignableRoles(ROLES.ADMIN);
      expect(assignable).toHaveLength(5);
      expect(assignable).toContain(ROLES.USER);
      expect(assignable).toContain(ROLES.UNIFORM_ADMIN);
      expect(assignable).toContain(ROLES.LEAVE_ADMIN);
      expect(assignable).toContain(ROLES.CANDIDATE_LEADERSHIP);
      expect(assignable).toContain(ROLES.ADMIN);
    });

    it('should return empty array for non-admin roles', () => {
      expect(getAssignableRoles(ROLES.USER)).toEqual([]);
      expect(getAssignableRoles(ROLES.UNIFORM_ADMIN)).toEqual([]);
      expect(getAssignableRoles(ROLES.LEAVE_ADMIN)).toEqual([]);
      expect(getAssignableRoles(ROLES.CANDIDATE_LEADERSHIP)).toEqual([]);
    });

    it('should return empty array for null/undefined', () => {
      expect(getAssignableRoles(null)).toEqual([]);
      expect(getAssignableRoles(undefined)).toEqual([]);
    });

    it('should return a copy to prevent mutation', () => {
      const assignable = getAssignableRoles(ROLES.ADMIN);
      assignable.push('modified');
      expect(ROLE_HIERARCHY).not.toContain('modified');
    });
  });

  describe('getRoleInfo', () => {
    it('should return info for valid roles', () => {
      expect(getRoleInfo(ROLES.USER)).toEqual(ROLE_INFO[ROLES.USER]);
      expect(getRoleInfo(ROLES.UNIFORM_ADMIN)).toEqual(ROLE_INFO[ROLES.UNIFORM_ADMIN]);
      expect(getRoleInfo(ROLES.CANDIDATE_LEADERSHIP)).toEqual(ROLE_INFO[ROLES.CANDIDATE_LEADERSHIP]);
      expect(getRoleInfo(ROLES.ADMIN)).toEqual(ROLE_INFO[ROLES.ADMIN]);
    });

    it('should return null for invalid roles', () => {
      expect(getRoleInfo('invalid')).toBeNull();
      expect(getRoleInfo(null)).toBeNull();
      expect(getRoleInfo(undefined)).toBeNull();
    });
  });

  describe('normalizeRole', () => {
    it('should return lowercase role for valid roles', () => {
      expect(normalizeRole('user')).toBe(ROLES.USER);
      expect(normalizeRole('USER')).toBe(ROLES.USER);
      expect(normalizeRole('User')).toBe(ROLES.USER);
      expect(normalizeRole('admin')).toBe(ROLES.ADMIN);
      expect(normalizeRole('ADMIN')).toBe(ROLES.ADMIN);
      expect(normalizeRole('uniform_admin')).toBe(ROLES.UNIFORM_ADMIN);
      expect(normalizeRole('UNIFORM_ADMIN')).toBe(ROLES.UNIFORM_ADMIN);
      expect(normalizeRole('leave_admin')).toBe(ROLES.LEAVE_ADMIN);
      expect(normalizeRole('LEAVE_ADMIN')).toBe(ROLES.LEAVE_ADMIN);
      expect(normalizeRole('candidate_leadership')).toBe(ROLES.CANDIDATE_LEADERSHIP);
      expect(normalizeRole('CANDIDATE_LEADERSHIP')).toBe(ROLES.CANDIDATE_LEADERSHIP);
    });

    it('should trim whitespace', () => {
      expect(normalizeRole('  user  ')).toBe(ROLES.USER);
      expect(normalizeRole(' admin ')).toBe(ROLES.ADMIN);
    });

    it('should return USER for invalid/empty input', () => {
      expect(normalizeRole('')).toBe(ROLES.USER);
      expect(normalizeRole(null)).toBe(ROLES.USER);
      expect(normalizeRole(undefined)).toBe(ROLES.USER);
      expect(normalizeRole('invalid_role')).toBe(ROLES.USER);
      expect(normalizeRole(123)).toBe(ROLES.USER);
    });
  });

  describe('isValidRole', () => {
    it('should return true for valid roles', () => {
      expect(isValidRole('user')).toBe(true);
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('uniform_admin')).toBe(true);
      expect(isValidRole('leave_admin')).toBe(true);
      expect(isValidRole('candidate_leadership')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isValidRole('USER')).toBe(true);
      expect(isValidRole('Admin')).toBe(true);
      expect(isValidRole('UNIFORM_ADMIN')).toBe(true);
      expect(isValidRole('LEAVE_ADMIN')).toBe(true);
      expect(isValidRole('CANDIDATE_LEADERSHIP')).toBe(true);
    });

    it('should trim whitespace', () => {
      expect(isValidRole('  user  ')).toBe(true);
      expect(isValidRole(' admin ')).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(isValidRole('superuser')).toBe(false);
      expect(isValidRole('moderator')).toBe(false);
      expect(isValidRole('invalid')).toBe(false);
    });

    it('should return false for empty/null input', () => {
      expect(isValidRole('')).toBe(false);
      expect(isValidRole(null)).toBe(false);
      expect(isValidRole(undefined)).toBe(false);
    });
  });
});
