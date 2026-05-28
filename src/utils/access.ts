import type { User } from '../stores/authStore';

function normalizeRoleName(role: string): string {
  return String(role || '').replace(/[-_]/g, ' ').trim().toLowerCase();
}

function normalizePermissionCode(code: string): string {
  const value = String(code || '').trim().replace(/\s+/g, '_');
  if (!value) return '';
  if (!value.includes(':') && value.includes('.')) {
    const parts = value.split('.').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts.slice(0, -1).join('_')}:${parts[parts.length - 1]}`.toLowerCase();
    }
  }
  return value.toLowerCase();
}

export function userHasRoleName(user: User | null | undefined, ...targetRoles: string[]): boolean {
  const roleNames = user?.roleNames ?? user?.role_names ?? [];
  const normalizedRoles = roleNames.map(normalizeRoleName);
  return targetRoles.some((role) => normalizedRoles.includes(normalizeRoleName(role)));
}

export function userHasPermissionCode(user: User | null | undefined, requiredCode: string): boolean {
  const required = normalizePermissionCode(requiredCode);
  if (!required || !user) return false;

  const rawPermissions = user.permissionCodes ?? user.permission_codes ?? user.permissions ?? [];
  const permissions = new Set(rawPermissions.map(normalizePermissionCode).filter(Boolean));
  if (permissions.has('*') || permissions.has('*:*') || permissions.has(required)) return true;

  if (required.includes(':')) {
    const [resource] = required.split(':', 1);
    return permissions.has(`${resource}:*`);
  }
  return false;
}

export function isSuperAdminUser(user: User | null | undefined): boolean {
  return Boolean(user) && (
    userHasRoleName(user, 'Super Admin') ||
    userHasPermissionCode(user, '*:*')
  );
}
