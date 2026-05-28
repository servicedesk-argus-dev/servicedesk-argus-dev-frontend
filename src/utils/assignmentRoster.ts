export type AssignmentRosterUser = {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  name?: string;
  displayName?: string;
  role?: string;
  roleNames?: string[];
  role_names?: string[];
  isActive?: boolean;
  is_active?: boolean;
  isActiveMember?: boolean;
  is_active_member?: boolean;
  disabled?: boolean;
  organizationId?: string | null;
  organization_id?: string | null;
  organization?: { id?: string | null; name?: string } | null;
};

export type AssignmentRosterMember = { user?: AssignmentRosterUser | null } | AssignmentRosterUser;

export type AssignmentRosterTeam = {
  id: string;
  name: string;
  isActive?: boolean;
  is_active?: boolean;
  members?: AssignmentRosterMember[];
};

export function extractAssignmentList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as { data?: unknown; results?: unknown };
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.results)) return obj.results;
  }
  return [];
}

export function assignmentPersonLabel(value: unknown): string {
  if (!value) return 'Unassigned';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as AssignmentRosterUser;
    if (obj.displayName) return obj.displayName;
    const firstName = obj.firstName || obj.first_name || '';
    const lastName = obj.lastName || obj.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || obj.name || obj.email || obj.username || 'Unassigned';
  }
  return 'Unassigned';
}

function isActiveUser(user: AssignmentRosterUser): boolean {
  return user.isActive !== false && user.is_active !== false && user.isActiveMember !== false && user.is_active_member !== false;
}

function isResolverUser(user: AssignmentRosterUser): boolean {
  const roles = [...(user.roleNames || []), ...(user.role_names || []), user.role || '']
    .map((role) => String(role).toLowerCase());
  if (roles.some((role) => role.includes('client') || role.includes('viewer'))) {
    return false;
  }
  return true;
}

function memberUser(member: AssignmentRosterMember): AssignmentRosterUser | null {
  if (!member) return null;
  if ('user' in member) return member.user || null;
  return member as AssignmentRosterUser;
}

function userOrganizationId(user: AssignmentRosterUser): string | null {
  return user.organizationId || user.organization_id || user.organization?.id || null;
}

type AssignableUserOptions = {
  currentAssigned?: AssignmentRosterUser | null;
  organizationId?: string | null;
};

export function orderedAssignmentTeams(teams: AssignmentRosterTeam[]): AssignmentRosterTeam[] {
  return teams
    .filter((team) => team?.id && team?.name && team.isActive !== false && team.is_active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function assignableUsersForTeam(
  teams: AssignmentRosterTeam[],
  assignmentGroupId: string,
  options: AssignableUserOptions = {},
): AssignmentRosterUser[] {
  const selectedTeam = teams.find((team) => team.id === assignmentGroupId);
  const organizationId = options.organizationId || null;
  const usersById = new Map<string, AssignmentRosterUser>();

  (selectedTeam?.members || [])
    .map(memberUser)
    .filter(Boolean)
    .filter((user) => isActiveUser(user as AssignmentRosterUser) && isResolverUser(user as AssignmentRosterUser))
    .forEach((user) => {
      const candidate = user as AssignmentRosterUser;
      if (organizationId && userOrganizationId(candidate) !== organizationId) {
        return;
      }
      if (!candidate.id || usersById.has(candidate.id)) {
        return;
      }
      usersById.set(candidate.id, candidate);
    });

  const users = Array.from(usersById.values());

  const seen = new Set(users.map((user) => user.id));
  if (options.currentAssigned?.id && assignmentGroupId && !seen.has(options.currentAssigned.id)) {
    users.push({
      ...options.currentAssigned,
      displayName: `${assignmentPersonLabel(options.currentAssigned)} (not in selected team)`,
      disabled: true,
    });
  }

  return users.sort((a, b) => assignmentPersonLabel(a).localeCompare(assignmentPersonLabel(b)));
}
