import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, Loader2, Search, UserPlus, Users } from 'lucide-react';
import api from '../../lib/api';

const ROLE_OPTIONS = [
  { value: 'Super Admin', label: 'Super Admin' },
  { value: 'Org Admin', label: 'Admin' },
  { value: 'Engineer', label: 'Engineer' },
  { value: 'Client User', label: 'Client' },
];

const ROLE_HELP: Record<string, string> = {
  'Super Admin': 'Global platform owner: can manage all clients, admins, users, roles, settings, and every ticket.',
  'Org Admin': 'Internal service-desk admin: can manage clients, users, teams, queues, and ticket assignment, but cannot create Super Admin accounts.',
  Engineer: 'Internal resolver: works assigned incidents, problems, changes, and service requests.',
  'Client User': 'Client login: scoped to one client company and can only see that company data.',
};

interface AccountForm {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role_name: string;
  organization_id: string;
  team_ids: string[];
}

function extractList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function formatApiError(error: any): string {
  const payload = error?.response?.data;
  const detail = payload?.errors ?? payload?.detail ?? payload?.message ?? payload;
  const fieldLabels: Record<string, string> = {
    email: 'Email',
    username: 'Username',
    password: 'Temporary password',
    organization_id: 'Client company',
    organization: 'Client company',
    team_ids: 'Engineer teams',
    role_name: 'Role',
    non_field_errors: 'Account',
  };

  const formatValue = (value: any): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ');
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([field, nestedValue]) => {
          const label = fieldLabels[field] ?? field.replace(/_/g, ' ');
          const text = formatValue(nestedValue);
          return text ? `${label}: ${text}` : '';
        })
        .filter(Boolean)
        .join(' | ');
    }
    return String(value);
  };

  const text = formatValue(detail);
  if (text) {
    return text;
  }
  return 'Failed to create account. Please check the form and try again.';
}

function displayName(user: any) {
  return [user.firstName ?? user.first_name, user.lastName ?? user.last_name].filter(Boolean).join(' ') || user.email || 'Unnamed user';
}

function primaryRole(user: any) {
  return user.roleNames?.[0] ?? user.role_names?.[0] ?? user.role ?? 'User';
}

function displayRole(user: any) {
  const role = primaryRole(user);
  if (role === 'Org Admin') return 'Admin';
  return role;
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const random = new Uint32Array(14);
  window.crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
}

const initialForm: AccountForm = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role_name: 'Client User',
  organization_id: '',
  team_ids: [],
};

export default function UserList() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AccountForm>(initialForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [resetPasswordFor, setResetPasswordFor] = useState<any | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (roleFilter) params.set('role', roleFilter);
      const { data } = await api.get(`/auth/users/?${params.toString()}`);
      return extractList(data);
    },
    staleTime: 30000,
  });

  const clientsQuery = useQuery({
    queryKey: ['organizations', 'account-form'],
    queryFn: async () => {
      const { data } = await api.get('/organizations/');
      return extractList(data);
    },
    staleTime: 60000,
  });

  const teamsQuery = useQuery({
    queryKey: ['teams', 'account-form'],
    queryFn: async () => {
      const { data } = await api.get('/teams/?limit=200&is_active=true');
      return extractList(data);
    },
    staleTime: 60000,
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        ...form,
        username: form.email,
        must_change_password: true,
      };
      if (!form.organization_id) delete payload.organization_id;
      if (!form.team_ids.length) delete payload.team_ids;
      const { data } = await api.post('/auth/users/', payload);
      return data;
    },
    onSuccess: () => {
      setForm(initialForm);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Account created');
    },
    onError: (error: any) => {
      toast.error(formatApiError(error));
    },
  });

  const disableUser = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/auth/users/${id}/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Account disabled');
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/auth/users/${resetPasswordFor.id}/reset-password/`, {
        password: resetPassword,
        must_change_password: true,
      });
      return data;
    },
    onSuccess: () => {
      setResetPasswordFor(null);
      setResetPassword('');
      toast.success('Password reset');
    },
    onError: () => toast.error('Failed to reset password'),
  });

  const users = useMemo(() => {
    const items = usersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((user) => {
      const org = user.organization?.name ?? '';
      return `${displayName(user)} ${user.email || ''} ${org}`.toLowerCase().includes(q);
    });
  }, [usersQuery.data, search]);

  const selectedRoleNeedsClient = ['Client User', 'Viewer'].includes(form.role_name);
  const selectedRoleCanJoinTeams = form.role_name === 'Engineer';
  const hasRequiredClient = !selectedRoleNeedsClient || Boolean(form.organization_id);
  const hasRequiredTeams = !selectedRoleCanJoinTeams || form.team_ids.length > 0;
  const canCreateAccount = !createUser.isPending
    && form.email.trim().length > 0
    && form.password.trim().length >= 8
    && hasRequiredClient
    && hasRequiredTeams;

  return (
    <div className="min-h-full space-y-5 bg-slate-50 p-6">
      <div className="rounded-md border bg-white p-5" style={{ borderColor: '#d8dde6' }}>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" style={{ color: '#001d5b' }} />
          <h1 className="text-xl font-bold text-slate-900">Accounts</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Create login accounts. Client users must be attached to a client company so their tickets stay isolated.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.email.trim()) {
              toast.error('Enter the account email address.');
              return;
            }
            if (form.password.trim().length < 8) {
              toast.error('Temporary password must be at least 8 characters.');
              return;
            }
            if (selectedRoleNeedsClient && !form.organization_id) {
              toast.error('Select the client company for this client login. Create the client in Clients first if it is not listed.');
              return;
            }
            if (selectedRoleCanJoinTeams && form.team_ids.length === 0) {
              toast.error('Select at least one team for the engineer.');
              return;
            }
            createUser.mutate();
          }}
          className="mt-5 grid gap-3 lg:grid-cols-6"
        >
          <input className="rounded-md border px-3 py-2 text-sm lg:col-span-2" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="First name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Last name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={form.role_name}
            onChange={(event) => {
              const roleName = event.target.value;
              setForm({
                ...form,
                role_name: roleName,
                organization_id: roleName === 'Client User' ? form.organization_id : '',
                team_ids: roleName === 'Engineer' ? form.team_ids : [],
              });
            }}
          >
            {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
          <select className="rounded-md border px-3 py-2 text-sm" value={form.organization_id} onChange={(event) => setForm({ ...form, organization_id: event.target.value })} required={selectedRoleNeedsClient} aria-label={selectedRoleNeedsClient ? 'Client company' : 'Client company not required'}>
            <option value="">{selectedRoleNeedsClient ? 'Select client company' : 'Internal account - no client'}</option>
            {(clientsQuery.data ?? []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <div className="flex gap-2 lg:col-span-2">
            <input
              className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
              type="text"
              name="argus-temp-password"
              placeholder="Temporary password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="off"
              spellCheck={false}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setForm({ ...form, password: generateTemporaryPassword() })}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4" />
              Generate
            </button>
          </div>
          {selectedRoleCanJoinTeams ? (
            <div className="rounded-md border bg-slate-50 p-3 lg:col-span-4" style={{ borderColor: '#d8dde6' }}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Engineer teams</div>
                  <div className="text-xs text-slate-500">Choose where this engineer can receive assigned work.</div>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                  {form.team_ids.length} selected
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {teamsQuery.isLoading ? (
                  <div className="col-span-full flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading teams...
                  </div>
                ) : (teamsQuery.data ?? []).length === 0 ? (
                  <div className="col-span-full rounded-md border bg-white px-3 py-2 text-sm text-slate-500">No active teams found.</div>
                ) : (
                  (teamsQuery.data ?? []).map((team) => {
                    const selected = form.team_ids.includes(team.id);
                    return (
                      <label
                        key={team.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm transition ${selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'hover:border-slate-300'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...form.team_ids, team.id]
                              : form.team_ids.filter((id) => id !== team.id);
                            setForm({ ...form, team_ids: next });
                          }}
                        />
                        <span className="font-medium text-slate-800">{team.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="hidden lg:block lg:col-span-4" />
          )}
          {selectedRoleNeedsClient && (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 lg:col-span-6">
              Creating a client user here creates only the login. Create the client company in{' '}
              <Link to="/clients" className="font-semibold underline">Clients</Link>
              {' '}first, then select that company here.
            </div>
          )}
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 lg:col-span-6">
            {ROLE_HELP[form.role_name] ?? 'Choose the access level for this account.'}
          </div>
          <button type="submit" disabled={!canCreateAccount} className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 lg:col-span-6">
            {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create Account
          </button>
        </form>
      </div>

      <div className="rounded-md border bg-white" style={{ borderColor: '#d8dde6' }}>
        <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center" style={{ borderColor: '#d8dde6' }}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full text-sm outline-none" placeholder="Search accounts" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select className="rounded-md border px-3 py-2 text-sm" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            <option value="CLIENT">Clients</option>
            <option value="ENGINEER">Engineers</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>

        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Teams</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t" style={{ borderColor: '#eef2f7' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{displayName(user)}</div>
                      <div className="text-xs text-slate-500">{user.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">{displayRole(user)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {Array.isArray(user.teamMemberships) && user.teamMemberships.length > 0
                        ? user.teamMemberships.map((membership: any) => membership.team?.name).filter(Boolean).join(', ')
                        : 'None'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{user.organization?.name ?? 'Internal'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {user.status ?? 'ACTIVE'}
                      </span>
                      {user.mustChangePassword || user.must_change_password ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Temp password</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold" onClick={() => setResetPasswordFor(user)}>
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset
                        </button>
                        <button type="button" className="rounded-md border px-3 py-1.5 text-xs font-semibold text-red-700" onClick={() => disableUser.mutate(user.id)}>
                          Disable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">No accounts found.</div> : null}
          </div>
        )}
      </div>

      {resetPasswordFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              resetUserPassword.mutate();
            }}
            className="w-full max-w-sm rounded-md bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-slate-900">Reset password</h2>
            <p className="mt-1 text-sm text-slate-500">{resetPasswordFor.email}</p>
            <input className="mt-4 w-full rounded-md border px-3 py-2 text-sm" type="password" placeholder="New temporary password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} minLength={8} required />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-md border px-4 py-2 text-sm font-semibold" onClick={() => setResetPasswordFor(null)}>Cancel</button>
              <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Reset</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
