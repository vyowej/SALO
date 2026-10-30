import apiRequest from './apiClient';
import config from '../config';
import { authService } from './authService';

const storageKey = 'salo.business.team.mock.v1';

const permissionMap = {
  owner: ['restaurant.view', 'restaurant.page.edit', 'restaurant.sensitive.edit', 'restaurant.publish', 'restaurant.photos.manage', 'restaurant.hours.manage', 'restaurant.menu.manage', 'menu.availability.manage', 'orders.view', 'orders.status.update', 'orders.cancel', 'reservations.view', 'reservations.manage', 'tables.manage', 'discounts.manage', 'reports.sales_reservations.view', 'reports.reservations.view', 'team.view', 'team.manage', 'audit.view'],
  manager: ['restaurant.view', 'restaurant.page.edit', 'restaurant.photos.manage', 'restaurant.hours.manage', 'restaurant.menu.manage', 'menu.availability.manage', 'orders.view', 'orders.status.update', 'orders.cancel', 'reservations.view', 'reservations.manage', 'tables.manage', 'discounts.manage', 'reports.sales_reservations.view', 'reports.reservations.view', 'team.view'],
  reservation_manager: ['restaurant.view', 'reservations.view', 'reservations.manage', 'tables.manage', 'reports.reservations.view'],
  staff: ['restaurant.view', 'menu.availability.manage', 'orders.view', 'orders.status.update'],
};

const positionMap = [
  { key: 'owner', name: 'Owner', description: 'Sets restaurant direction, manages the team, and owns the restaurant.', permissions: permissionMap.owner, assignable: false },
  { key: 'manager', name: 'Manager', description: 'Runs daily operations and manages restaurant content.', permissions: permissionMap.manager, assignable: true },
  { key: 'reservation_manager', name: 'Reservation Manager', description: 'Manages reservations and tables.', permissions: permissionMap.reservation_manager, assignable: true },
  { key: 'staff', name: 'Staff', description: 'Prepares orders and updates item availability.', permissions: permissionMap.staff, assignable: true },
];

function readStates() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch (error) {
    console.error('Unable to read mock team data.', error);
    throw new Error('Mock team data is unavailable. Clear site storage and try again.', { cause: error });
  }
}

function mockState(restaurantId, user) {
  const states = readStates();
  const id = String(restaurantId);
  if (!states[id]) {
    const membership = user?.memberships?.find((item) => String(item.restaurant_id) === id);
    const now = new Date().toISOString();
    states[id] = {
      members: [
        {
          id: `owner-${id}`,
          user_id: String(user?.id || 'owner-1'),
          name: user?.name || 'Restaurant Owner',
          email: user?.email || 'owner@salo.app',
          position: 'owner',
          position_name: 'Owner',
          status: 'active',
          joined_at: now,
          last_active_at: now,
          permissions: membership?.permissions || permissionMap.owner,
        },
        {
          id: `mock-manager-${id}`,
          user_id: `mock-manager-user-${id}`,
          name: 'Mika Santos',
          email: 'mika.santos@example.test',
          position: 'manager',
          position_name: 'Manager',
          status: 'active',
          joined_at: now,
          last_active_at: now,
          permissions: permissionMap.manager,
        },
        {
          id: `mock-staff-${id}`,
          user_id: `mock-staff-user-${id}`,
          name: 'Jo Reyes',
          email: 'jo.reyes@example.test',
          position: 'staff',
          position_name: 'Staff',
          status: 'active',
          joined_at: now,
          last_active_at: null,
          permissions: permissionMap.staff,
        },
      ],
      invitations: [],
      audit: [],
      restaurant_name: membership?.restaurant_name || 'My restaurant',
    };
    localStorage.setItem(storageKey, JSON.stringify(states));
  }
  const state = states[id];
  const save = () => {
    states[id] = state;
    localStorage.setItem(storageKey, JSON.stringify(states));
  };
  return { state, save };
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  return name && domain ? `${name[0]}•••@${domain}` : '•••';
}

function paginate(rows, filters) {
  const page = Number(filters.page || 1);
  const perPage = Number(filters.per_page || 15);
  return {
    data: rows.slice((page - 1) * perPage, page * perPage),
    meta: {
      current_page: page,
      per_page: perPage,
      total: rows.length,
      last_page: Math.max(1, Math.ceil(rows.length / perPage)),
    },
  };
}

function applyMemberFilters(rows, filters) {
  return rows.filter((member) => {
    if (filters.position && member.position !== filters.position) return false;
    if (filters.status && member.status !== filters.status) return false;
    const search = String(filters.search || '').trim().toLocaleLowerCase();
    const searchable = filters.search_email === false ? member.name : `${member.name} ${member.email}`;
    return !search || searchable.toLocaleLowerCase().includes(search);
  });
}

function expireMockInvitations(state) {
  let changed = false;
  state.invitations.forEach((invitation) => {
    if (invitation.status !== 'pending' || new Date(invitation.expires_at).getTime() > Date.now()) return;
    invitation.status = 'expired';
    const member = state.members.find((item) => item.user_id === invitation.user_id);
    if (member?.status === 'invited') member.status = 'removed';
    changed = true;
  });
  return changed;
}

function mockAudit(state, action, entityId, before, after) {
  state.audit.unshift({
    id: `mock-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: { id: 'mock-owner', name: 'Current user' },
    action,
    entity_type: 'restaurant_staff',
    entity_id: String(entityId),
    before,
    after,
    created_at: new Date().toISOString(),
  });
}

function mockFindInvitation(token) {
  const states = readStates();
  for (const [restaurantId, state] of Object.entries(states)) {
    if (expireMockInvitations(state)) localStorage.setItem(storageKey, JSON.stringify(states));
    const invitation = state.invitations.find((item) => item.token === token);
    if (invitation?.status === 'pending') return { restaurantId, state, invitation };
    if (invitation?.status === 'expired') throw new Error('This invitation has expired.');
  }
  throw new Error('This invitation is invalid or has already been used.');
}

export async function getTeam(restaurantId, user, filters = {}) {
  if (!config.useMock) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team?${query}`);
  }
  const { state, save } = mockState(restaurantId, user);
  if (expireMockInvitations(state)) save();
  const canManage = Boolean(user?.memberships?.find((item) => String(item.restaurant_id) === String(restaurantId))?.permissions?.includes('team.manage'));
  const members = applyMemberFilters(state.members, { ...filters, search_email: canManage }).map((member) => ({
    ...member,
    email: canManage ? member.email : maskEmail(member.email),
    can_manage_member: canManage && member.user_id !== String(user?.id) && member.status !== 'removed',
  }));
  const invitations = state.invitations
    .filter((item) => item.status === 'pending')
    .map((item) => ({ ...item, email: canManage ? item.email : maskEmail(item.email) }));
  const positionHolders = { owner: [] };
  state.members.filter((member) => member.status === 'active').forEach((member) => {
    positionHolders[member.position] ||= [];
    positionHolders[member.position].push(member.name);
  });
  const activeManagers = state.members
    .filter((member) => member.position === 'manager' && member.status === 'active')
    .map((member) => ({ user_id: member.user_id, name: member.name }));
  return {
    positions: positionMap,
    position_holders: positionHolders,
    active_managers: activeManagers,
    members: paginate(members, filters),
    invitations,
    can_manage: canManage,
  };
}

export async function checkTeamEmail(restaurantId, email, user) {
  if (!config.useMock) {
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team/email-check`, {
      method: 'POST',
      body: { email },
    });
  }
  const normalized = email.trim().toLowerCase();
  const account = authService.getMockAccount(normalized);
  const { state, save } = mockState(restaurantId, user);
  if (expireMockInvitations(state)) save();
  const existingMember = state.members.find((member) => member.user_id === String(account?.id));
  const alreadyMember = existingMember && ['active', 'suspended', 'invited'].includes(existingMember.status);
  const canInvite = ['active', 'invited'].includes(account?.status) && account.id !== user?.id && !alreadyMember;
  const result = account
    ? {
        exists: true,
        can_invite: canInvite,
        identity: {
          first_name: account.name?.split(' ')[0] || account.first_name || '',
          last_initial: `${account.name?.split(' ').at(-1)?.[0] || account.last_name?.[0] || ''}.`,
          email_masked: maskEmail(account.email),
          avatar_url: null,
        },
        message: account.id === user?.id
          ? 'You cannot invite yourself.'
          : alreadyMember ? 'This person already has a team membership.'
          : account.status === 'invited' ? 'This account must be activated before it can accept an invitation.'
            : !canInvite ? 'This account cannot accept an invitation right now.' : null,
      }
    : { exists: false, can_invite: true, identity: null };
  mockAudit(state, 'team.email_checked', 'email_lookup', null, { account_exists: Boolean(account) });
  save();
  return result;
}

export async function inviteTeamMember(restaurantId, user, details) {
  if (!config.useMock) {
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team/invitations`, {
      method: 'POST',
      body: details,
    });
  }
  const { state, save } = mockState(restaurantId, user);
  if (expireMockInvitations(state)) save();
  const email = details.email.trim().toLowerCase();
  if (state.invitations.some((item) => item.status === 'pending' && item.email === email)) {
    throw new Error('A pending invitation already exists for this email.');
  }
  const account = authService.getMockAccount(email);
  if (account?.id === user?.id) throw new Error('You cannot invite yourself.');
  if (account && !['active', 'invited'].includes(account.status)) {
    throw new Error('This account cannot accept an invitation right now.');
  }
  const existingMember = state.members.find((item) => item.user_id === String(account?.id));
  if (existingMember && existingMember.status !== 'removed') {
    throw new Error('This person already has a team membership.');
  }
  const token = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const requiresActivation = !account || account.status === 'invited';
  const invitee = !account
    ? await authService.createInvitedAccount({
        email,
        restaurantId: String(restaurantId),
        restaurantName: user?.memberships?.find((item) => String(item.restaurant_id) === String(restaurantId))?.restaurant_name || 'My restaurant',
        position: details.position,
        inviteeName: details.invitee_name,
      })
    : null;
  const member = existingMember || {
    id: `mock-member-${Date.now()}`,
    user_id: String(invitee?.id || account.id),
  };
  Object.assign(member, {
    name: invitee?.name || account?.name || `${account?.first_name || ''} ${account?.last_name || ''}`.trim(),
    email,
    position: details.position,
    position_name: positionMap.find((item) => item.key === details.position)?.name || details.position,
    status: 'invited',
    joined_at: null,
    last_active_at: null,
    permissions: [],
  });
  if (!existingMember) state.members.push(member);
  const invitation = {
    id: `mock-invitation-${Date.now()}`,
    token,
    user_id: member.user_id,
    email,
    name: member.name,
    position: details.position,
    status: 'pending',
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    activation_required: requiresActivation,
    invite_path: `/team-invitations/${token}/${requiresActivation ? 'activate' : 'accept'}`,
  };
  state.invitations.push(invitation);
  mockAudit(state, 'team.invitation_sent', invitation.id, null, { position: details.position });
  save();
  return invitation;
}

export async function resendTeamInvitation(restaurantId, invitationId, user) {
  if (!config.useMock) {
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team/invitations/${encodeURIComponent(invitationId)}/resend`, { method: 'POST', body: {} });
  }
  const { state, save } = mockState(restaurantId, user);
  if (expireMockInvitations(state)) save();
  const invitation = state.invitations.find((item) => String(item.id) === String(invitationId));
  if (!invitation || invitation.status !== 'pending') throw new Error('Invitation not found.');
  const token = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  invitation.token = token;
  invitation.invite_path = `/team-invitations/${token}/${invitation.activation_required ? 'activate' : 'accept'}`;
  invitation.expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  mockAudit(state, 'team.invitation_resent', invitation.id, null, { position: invitation.position });
  save();
  return invitation;
}

export async function cancelTeamInvitation(restaurantId, invitationId, user) {
  if (!config.useMock) {
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team/invitations/${encodeURIComponent(invitationId)}`, { method: 'DELETE' });
  }
  const { state, save } = mockState(restaurantId, user);
  if (expireMockInvitations(state)) save();
  const invitation = state.invitations.find((item) => String(item.id) === String(invitationId));
  if (!invitation || invitation.status !== 'pending') throw new Error('Invitation not found.');
  invitation.status = 'cancelled';
  const member = state.members.find((item) => item.user_id === invitation.user_id);
  if (member) member.status = 'removed';
  mockAudit(state, 'team.invitation_cancelled', invitation.id, { status: 'pending' }, { status: 'cancelled' });
  save();
}

export async function updateTeamMember(restaurantId, membershipId, data, user) {
  if (!config.useMock) {
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team/${encodeURIComponent(membershipId)}`, { method: 'PATCH', body: data });
  }
  const { state, save } = mockState(restaurantId, user);
  const member = state.members.find((item) => String(item.id) === String(membershipId));
  if (!member || member.position === 'owner') throw new Error('Membership not found.');
  if (data.position && !['manager', 'reservation_manager', 'staff'].includes(data.position)) {
    throw new Error('Choose a valid team position.');
  }
  if (member.status === 'invited' && data.status) {
    throw new Error('An invitee must accept their invitation before being activated.');
  }
  const before = { position: member.position, status: member.status };
  if (data.position) {
    member.position = data.position;
    member.position_name = positionMap.find((item) => item.key === data.position)?.name || data.position;
  }
  if (data.status) member.status = data.status;
  member.permissions = member.status === 'active' ? permissionMap[member.position] : [];
  mockAudit(state, 'team.member_updated', member.id, before, { position: member.position, status: member.status });
  save();
  return member;
}

export async function removeTeamMember(restaurantId, membershipId, user) {
  if (!config.useMock) {
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team/${encodeURIComponent(membershipId)}`, { method: 'DELETE' });
  }
  const { state, save } = mockState(restaurantId, user);
  const member = state.members.find((item) => String(item.id) === String(membershipId));
  if (!member || member.position === 'owner') throw new Error('Membership not found.');
  const before = { position: member.position, status: member.status };
  member.status = 'removed';
  state.invitations.filter((item) => item.user_id === member.user_id && item.status === 'pending')
    .forEach((item) => { item.status = 'cancelled'; });
  mockAudit(state, 'team.member_removed', member.id, before, { position: member.position, status: 'removed' });
  save();
}

export async function transferTeamOwnership(restaurantId, managerId, password, user) {
  if (!config.useMock) {
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/team/transfer-ownership`, {
      method: 'POST',
      body: { manager_id: managerId, password },
    });
  }
  const { state, save } = mockState(restaurantId, user);
  if (!authService.verifyMockPassword(user?.email, password)) {
    throw new Error('The password is incorrect.');
  }
  const target = state.members.find((item) => String(item.user_id) === String(managerId) && item.position === 'manager' && item.status === 'active');
  const owner = state.members.find((item) => item.position === 'owner');
  if (!target || !owner) throw new Error('Choose an active Manager.');
  const before = { owner_user_id: owner.user_id };
  owner.position = 'manager';
  owner.position_name = 'Manager';
  owner.permissions = permissionMap.manager;
  owner.id = `mock-former-owner-${restaurantId}`;
  target.position = 'owner';
  target.position_name = 'Owner';
  target.id = `owner-${restaurantId}`;
  target.permissions = permissionMap.owner;
  mockAudit(state, 'ownership.transferred', restaurantId, before, { owner_user_id: target.user_id });
  save();
  return { restaurant_id: String(restaurantId), owner_user_id: target.user_id, former_owner_position: 'manager' };
}

export async function getAuditLogs(restaurantId, filters = {}) {
  if (!config.useMock) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/audit?${query}`);
  }
  const { state } = mockState(restaurantId);
  const search = String(filters.search || '').toLocaleLowerCase();
  const rows = state.audit.filter((entry) => (
    (!filters.action || entry.action === filters.action)
    && (!search || JSON.stringify(entry).toLocaleLowerCase().includes(search))
    && (!filters.from || entry.created_at.slice(0, 10) >= filters.from)
    && (!filters.to || entry.created_at.slice(0, 10) <= filters.to)
  ));
  return paginate(rows, filters);
}

export async function acceptTeamInvitation(token, user) {
  if (!config.useMock) {
    return apiRequest(`/team-invitations/${encodeURIComponent(token)}/accept`, { method: 'POST', body: {} });
  }
  const { restaurantId, state, invitation } = mockFindInvitation(token);
  if (invitation.email !== user?.email) throw new Error('Sign in with the invited email address.');
  const member = state.members.find((item) => item.user_id === invitation.user_id);
  if (!member) throw new Error('The membership for this invitation no longer exists.');
  invitation.status = 'accepted';
  member.status = 'active';
  member.joined_at = new Date().toISOString();
  member.permissions = permissionMap[member.position];
  mockAudit(state, 'team.invitation_accepted', invitation.id, { status: 'pending' }, { status: 'accepted' });
  localStorage.setItem(storageKey, JSON.stringify({ ...readStates(), [restaurantId]: state }));
  return { restaurant_id: String(restaurantId), restaurant_name: state.restaurant_name || 'Restaurant', position: member.position, permissions: member.permissions };
}

export async function activateTeamInvitation(token, data) {
  if (!config.useMock) {
    return apiRequest(`/team-invitations/${encodeURIComponent(token)}/activate`, {
      method: 'POST',
      body: { ...data, password_confirmation: data.password_confirmation },
    });
  }
  const { restaurantId, state, invitation } = mockFindInvitation(token);
  await authService.activateInvitedAccount({
    email: invitation.email,
    restaurantId,
    restaurantName: state.restaurant_name || 'Restaurant',
    position: invitation.position,
    first_name: data.first_name,
    last_name: data.last_name,
    password: data.password,
  });
  const member = state.members.find((item) => item.user_id === invitation.user_id);
  invitation.status = 'accepted';
  member.name = `${data.first_name} ${data.last_name}`.trim();
  member.status = 'active';
  member.joined_at = new Date().toISOString();
  member.permissions = permissionMap[member.position];
  mockAudit(state, 'team.invitation_accepted', invitation.id, { status: 'pending' }, { status: 'accepted' });
  const states = readStates();
  states[restaurantId] = state;
  localStorage.setItem(storageKey, JSON.stringify(states));
  return { restaurant_name: state.restaurant_name || 'Restaurant', position: member.position };
}

export const teamService = {
  getTeam,
  checkTeamEmail,
  inviteTeamMember,
  resendTeamInvitation,
  cancelTeamInvitation,
  updateTeamMember,
  removeTeamMember,
  transferTeamOwnership,
  getAuditLogs,
  acceptTeamInvitation,
  activateTeamInvitation,
};
