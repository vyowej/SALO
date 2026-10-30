import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useCan } from '../../hooks/useCan';
import config from '../../config';
import { teamService } from '../../services/teamService';

const permissionLabels = {
  'restaurant.view': 'View the restaurant workspace',
  'restaurant.page.edit': 'Edit the restaurant page',
  'restaurant.sensitive.edit': 'Propose sensitive information changes',
  'restaurant.publish': 'Publish, unpublish, or close the restaurant',
  'restaurant.photos.manage': 'Manage restaurant photos',
  'restaurant.hours.manage': 'Manage hours and closures',
  'restaurant.menu.manage': 'Manage menu items and prices',
  'menu.availability.manage': 'Toggle item availability',
  'orders.view': 'View orders',
  'orders.status.update': 'Update order status',
  'orders.cancel': 'Cancel or reject orders',
  'reservations.view': 'View reservations',
  'reservations.manage': 'Manage reservations',
  'tables.manage': 'Manage tables',
  'discounts.manage': 'Manage discounts',
  'reports.sales_reservations.view': 'View sales and reservation reports',
  'reports.reservations.view': 'View reservation reports',
  'team.view': 'View the team',
  'team.manage': 'Manage the team',
  'audit.view': 'Read restaurant audit history',
};

const roleLabels = {
  manager: 'Manager',
  reservation_manager: 'Reservation Manager',
  staff: 'Staff',
};

function localDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function BusinessTeamPage({ restaurantId, user, readOnly, onAccessDenied, variant = 'team' }) {
  const { refreshUser, updateUser } = useAuth();
  const canManage = useCan('team.manage', restaurantId) && !readOnly;
  const [team, setTeam] = useState(null);
  const [filters, setFilters] = useState({ search: '', position: '', status: '', page: 1, per_page: 15 });
  const [selectedPosition, setSelectedPosition] = useState('manager');
  const [email, setEmail] = useState('');
  const [inviteeName, setInviteeName] = useState('');
  const [emailCheck, setEmailCheck] = useState(null);
  const [invitePosition, setInvitePosition] = useState('staff');
  const [transferManager, setTransferManager] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [localInviteLink, setLocalInviteLink] = useState('');
  const settingsMode = variant === 'settings';

  const loadTeam = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      setTeam(await teamService.getTeam(restaurantId, user, nextFilters));
    } catch (loadError) {
      if (await onAccessDenied?.(loadError)) return;
      setError(loadError.message || 'The team could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [filters, onAccessDenied, restaurantId, user]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const members = team?.members?.data || [];
  const positions = team?.positions || [];
  const preview = positions.find((position) => position.key === selectedPosition);
  const managers = team?.active_managers || [];

  const updateFilters = (key, value) => {
    const next = { ...filters, [key]: value, page: 1 };
    setFilters(next);
  };

  const withAction = useCallback(async (action, successMessage) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      await loadTeam();
      setNotice(successMessage);
    } catch (actionError) {
      if (await onAccessDenied?.(actionError)) return;
      setError(actionError.message || 'The change could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [loadTeam, onAccessDenied]);

  const checkEmail = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    setEmailCheck(null);
    try {
      setEmailCheck(await teamService.checkTeamEmail(restaurantId, email, user));
    } catch (checkError) {
      if (await onAccessDenied?.(checkError)) return;
      setError(checkError.message || 'The email could not be checked.');
    } finally {
      setSaving(false);
    }
  };

  const sendInvitation = async (event) => {
    event.preventDefault();
    if (!emailCheck?.can_invite || !window.confirm(`Invite ${email.trim()} as ${roleLabels[invitePosition]}?`)) return;
    let localPath = '';
    setLocalInviteLink('');
    await withAction(async () => {
      const invitation = await teamService.inviteTeamMember(restaurantId, user, {
        email: email.trim(),
        invitee_name: inviteeName.trim() || undefined,
        position: invitePosition,
      });
      setEmail('');
      setInviteeName('');
      setEmailCheck(null);
      localPath = invitation.invite_path || '';
    }, 'Invitation sent. The invitee must accept before joining.');
    if (localPath) setLocalInviteLink(`${window.location.origin}${localPath}`);
  };

  const copyLocalInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(localInviteLink);
      setNotice('Invitation link copied.');
      setError('');
    } catch (copyError) {
      console.error('Unable to copy the local team invitation link.', copyError);
      setError('The link could not be copied. Select and copy the link shown below.');
    }
  };

  const handleTransfer = async (event) => {
    event.preventDefault();
    const newOwner = managers.find((manager) => String(manager.user_id) === String(transferManager));
    if (!newOwner || !window.confirm(
      `Transfer Business Ownership?\n\nCurrent owner: ${user?.name || 'You'}\nNew owner: ${newOwner.name}\n\nYou will become a Manager and lose Owner permissions.`,
    )) return;
    await withAction(async () => {
      await teamService.transferTeamOwnership(restaurantId, transferManager, transferPassword, user);
      if (config.useMock) {
        const manager = team?.positions?.find((position) => position.key === 'manager');
        await updateUser({
          memberships: (user?.memberships || []).map((membership) => String(membership.restaurant_id) === String(restaurantId)
            ? { ...membership, role: 'manager', permissions: manager?.permissions || [] }
            : membership),
        });
      } else {
        await refreshUser();
      }
      setTransferPassword('');
    }, 'Ownership transferred.');
  };

  const columns = useMemo(() => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'position_name',
      header: 'Position',
      cell: ({ row }) => row.original.position_name || roleLabels[row.original.position] || 'Owner',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <span className={`team-status team-status--${getValue()}`}>{getValue()}</span>,
    },
    { accessorKey: 'joined_at', header: 'Joined', cell: ({ getValue }) => localDate(getValue()) },
    { accessorKey: 'last_active_at', header: 'Last active', cell: ({ getValue }) => getValue() ? localDate(getValue()) : '—' },
    {
      id: 'actions',
      header: 'Owner actions',
      enableSorting: false,
      cell: ({ row }) => {
        const member = row.original;
        if (!canManage || !member.can_manage_member) return '—';
        return (
          <div className="team-row-actions">
            {member.status === 'active' || member.status === 'suspended' ? (
              <>
                <select
                  aria-label={`Position for ${member.name}`}
                  value={member.position}
                  disabled={saving}
                  onChange={(event) => {
                    if (window.confirm(`Change ${member.name} to ${roleLabels[event.target.value]}?`)) {
                      withAction(() => teamService.updateTeamMember(restaurantId, member.id, { position: event.target.value }, user), 'Position updated.');
                    }
                  }}
                >
                  {Object.entries(roleLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    const status = member.status === 'active' ? 'suspended' : 'active';
                    const action = status === 'suspended' ? 'Suspend' : 'Reactivate';
                    if (window.confirm(`${action} ${member.name}?`)) {
                      withAction(
                        () => teamService.updateTeamMember(restaurantId, member.id, { status }, user),
                        status === 'suspended' ? 'Member suspended.' : 'Member reactivated.',
                      );
                    }
                  }}
                >
                  {member.status === 'active' ? 'Suspend' : 'Reactivate'}
                </Button>
              </>
            ) : null}
            <Button
              variant="danger"
              size="sm"
              disabled={saving}
              onClick={() => {
                if (window.confirm(`Remove ${member.name} from this restaurant?`)) {
                  withAction(() => teamService.removeTeamMember(restaurantId, member.id, user), 'Member removed.');
                }
              }}
            >
              Remove
            </Button>
          </div>
        );
      },
    },
  ], [canManage, restaurantId, saving, user, withAction]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <div className="business-team">
      <header className="business-team__heading">
        <div>
          <p className="business-eyebrow">{settingsMode ? 'Business settings' : 'Restaurant team'}</p>
          <h2>{settingsMode ? 'Staff & permissions' : 'Team'}</h2>
          <p>{settingsMode ? 'Invite staff and manage access for this restaurant.' : 'People currently appointed to this restaurant.'}</p>
        </div>
      </header>

      {error ? <p className="business-error" role="alert">{error}</p> : null}
      {notice ? <p className="business-success" role="status">{notice}</p> : null}
      {settingsMode && localInviteLink ? (
        <div className="team-local-invite-link">
          <a href={localInviteLink}>{localInviteLink}</a>
          <Button variant="secondary" size="sm" onClick={copyLocalInviteLink}>Copy invite link</Button>
        </div>
      ) : null}
      {readOnly ? <p className="business-readonly" role="status">This restaurant is read-only. Team data and access changes are disabled.</p> : null}

      {settingsMode && !canManage && !readOnly ? <p className="business-readonly" role="status">Only the Owner can invite or change restaurant staff.</p> : null}

      {!settingsMode ? <section className="team-hierarchy" aria-label="Team positions">
        {positions.map((position) => {
          const holders = team?.position_holders?.[position.key] || [];
          return (
            <article className={`team-position team-position--${position.key}`} key={position.key}>
              <h3>{position.name}</h3>
              <p>{position.description}</p>
              <ul>
                {holders.length ? holders.map((holder, index) => <li key={`${holder}-${index}`}>{holder}</li>) : <li>No active members</li>}
              </ul>
            </article>
          );
        })}
      </section> : null}

      {!settingsMode ? <section className="business-team__card">
        <div className="business-team__section-heading">
          <div>
            <h3>What can each position do?</h3>
            <p>Permissions come from the restaurant access policy.</p>
          </div>
          <label>
            <span className="sr-only">Position to preview</span>
            <select value={selectedPosition} onChange={(event) => setSelectedPosition(event.target.value)}>
              {positions.map((position) => <option key={position.key} value={position.key}>{position.name}</option>)}
            </select>
          </label>
        </div>
        <p>{preview?.description}</p>
        <ul className="team-permission-list">
          {(preview?.permissions || []).map((permission) => <li key={permission}>{permissionLabels[permission] || permission}</li>)}
        </ul>
      </section> : null}

      {settingsMode && canManage ? (
        <section className="business-team__card">
          <h3>Invite a team member</h3>
          <p>Search by exact email only. Existing accounts must accept; new invitees set their own name and password.</p>
          <form className="team-invite-form" onSubmit={emailCheck ? sendInvitation : checkEmail}>
            <div className="team-invite-form__row">
              <label>
                <span>Exact email address</span>
                <input type="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setEmailCheck(null); }} />
              </label>
              {!emailCheck ? (
                <Button type="submit" variant="primary" disabled={saving || !email.trim()}>{saving ? 'Checking…' : 'Check email'}</Button>
              ) : null}
            </div>
            {emailCheck ? (
              <div className="team-invite-confirmation">
                {emailCheck.exists ? (
                  <div className="team-invite-identity">
                    {emailCheck.identity.avatar_url ? (
                      <img src={emailCheck.identity.avatar_url} alt="" />
                    ) : (
                      <span aria-hidden="true">{emailCheck.identity.first_name?.[0] || '?'}</span>
                    )}
                    <p>{emailCheck.identity.first_name} {emailCheck.identity.last_initial} · {emailCheck.identity.email_masked}. Confirm this is the intended person.</p>
                  </div>
                ) : (
                  <>
                    <p>No account yet. We’ll create a pending account and email an activation link.</p>
                    <label>
                      <span>Name (optional)</span>
                      <input maxLength={160} value={inviteeName} onChange={(event) => setInviteeName(event.target.value)} />
                    </label>
                  </>
                )}
                {emailCheck.message ? <p role="status">{emailCheck.message}</p> : null}
                <label>
                  <span>Position</span>
                  <select value={invitePosition} onChange={(event) => setInvitePosition(event.target.value)}>
                    {positions.filter((position) => position.assignable).map((position) => <option key={position.key} value={position.key}>{position.name}</option>)}
                  </select>
                </label>
                <Button type="submit" variant="primary" disabled={saving || !emailCheck.can_invite}>
                  {saving ? 'Sending…' : 'Confirm and send invitation'}
                </Button>
              </div>
            ) : null}
          </form>
        </section>
      ) : null}

      {!settingsMode ? <section className="business-team__card">
        <div className="business-team__section-heading">
          <div>
            <h3>Members</h3>
            <p>Search and filter restaurant memberships.</p>
          </div>
        </div>
        <div className="team-filters">
          <label>
            <span>Search</span>
            <input type="search" value={filters.search} onChange={(event) => updateFilters('search', event.target.value)} />
          </label>
          <label>
            <span>Position</span>
            <select value={filters.position} onChange={(event) => updateFilters('position', event.target.value)}>
              <option value="">All positions</option>
              {positions.map((position) => <option key={position.key} value={position.key}>{position.name}</option>)}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilters('status', event.target.value)}>
              <option value="">All statuses</option>
              {['invited', 'active', 'suspended', 'removed'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        {loading ? <p role="status">Loading team…</p> : (
          <>
            <div className="team-table-scroll">
              <table className="team-table">
                <caption className="sr-only">Restaurant team members</caption>
                <thead>{table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>{group.headers.map((header) => <th key={header.id} scope="col">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
                ))}</thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
                  ))}
                  {!members.length ? <tr><td colSpan={columns.length}>No team members match these filters.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="team-pagination">
              <Button variant="secondary" size="sm" disabled={filters.page <= 1 || loading} onClick={() => updateFilters('page', filters.page - 1)}>Previous</Button>
              <span>Page {team?.members?.meta?.current_page || 1} of {team?.members?.meta?.last_page || 1}</span>
              <Button variant="secondary" size="sm" disabled={filters.page >= (team?.members?.meta?.last_page || 1) || loading} onClick={() => updateFilters('page', filters.page + 1)}>Next</Button>
            </div>
          </>
        )}
      </section> : null}

      {settingsMode && team?.invitations?.length ? (
        <section className="business-team__card">
          <h3>Pending invitations</h3>
          <ul className="team-invitations">
            {team.invitations.map((invitation) => (
              <li key={invitation.id}>
                <span><strong>{invitation.name || invitation.email}</strong> · {invitation.email} · {roleLabels[invitation.position]} · Expires {new Date(invitation.expires_at).toLocaleString()}</span>
                {canManage ? (
                  <span className="team-row-actions">
                    <Button variant="secondary" size="sm" disabled={saving} onClick={async () => {
                      let localPath = '';
                      await withAction(async () => {
                        const result = await teamService.resendTeamInvitation(restaurantId, invitation.id, user);
                        localPath = result.invite_path || '';
                      }, 'Invitation resent.');
                      setLocalInviteLink(localPath ? `${window.location.origin}${localPath}` : '');
                    }}>Resend</Button>
                    <Button variant="danger" size="sm" disabled={saving} onClick={() => {
                      if (window.confirm(`Cancel the invitation for ${invitation.email}?`)) {
                        setLocalInviteLink('');
                        withAction(() => teamService.cancelTeamInvitation(restaurantId, invitation.id, user), 'Invitation cancelled.');
                      }
                    }}>Cancel</Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {settingsMode && canManage && managers.length ? (
        <section className="business-team__card">
          <h3>Transfer ownership</h3>
          <p>Choose an active Manager. You will become a Manager after the transfer.</p>
          <form className="team-transfer-form" onSubmit={handleTransfer}>
            <label>
              <span>Active Manager</span>
              <select required value={transferManager} onChange={(event) => setTransferManager(event.target.value)}>
                <option value="">Choose a Manager</option>
                {managers.map((manager) => <option key={manager.user_id} value={manager.user_id}>{manager.name}</option>)}
              </select>
            </label>
            <label>
              <span>Confirm with your password</span>
              <input type="password" autoComplete="current-password" required value={transferPassword} onChange={(event) => setTransferPassword(event.target.value)} />
            </label>
            <Button type="submit" variant="secondary" disabled={saving || readOnly}>{saving ? 'Transferring…' : 'Transfer ownership'}</Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
