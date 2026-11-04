import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import AdminDataTable from '../../components/admin/AdminDataTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { ADMIN_COPY } from '../../constants/admin';
import { adminService } from '../../services/admin';
import './AdminAccountsAdminPage.css';

const requestError = (error) => {
  const fieldErrors = Object.values(error?.fields || {}).flat();
  return fieldErrors[0] || error?.message || ADMIN_COPY.requestFailed;
};

function AdminAccountsAdminPage() {
  const [accounts, setAccounts] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const loadRequestSequence = useRef(0);

  const loadAccounts = useCallback(async () => {
    const requestId = ++loadRequestSequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await adminService.listAdminAccounts({
        page,
        per_page: 15,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      if (requestId !== loadRequestSequence.current) return;
      setAccounts(result.data || []);
      setMeta(result.meta || { current_page: 1, last_page: 1, total: result.data?.length || 0 });
      if (page > (result.meta?.last_page || 1)) setPage(result.meta.last_page || 1);
    } catch (loadError) {
      if (requestId !== loadRequestSequence.current) return;
      setError(requestError(loadError));
    } finally {
      if (requestId === loadRequestSequence.current) setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadAccounts();
    });
    return () => {
      active = false;
      loadRequestSequence.current += 1;
    };
  }, [loadAccounts, retry]);

  const closeForm = () => {
    if (saving) return;
    setForm(null);
    setFormValues({});
    setFormError('');
  };

  const openForm = useCallback((account = null) => {
    setForm({ mode: account ? 'edit' : 'create', account });
    setFormValues(account ? {
      name: account.name,
      email: account.email,
      phone: account.phone || '',
    } : {
      name: '',
      email: '',
      phone: '',
      password: '',
      password_confirmation: '',
    });
    setFormError('');
  }, []);

  const saveAccount = async () => {
    if (!formValues.name?.trim() || !formValues.email?.trim()) {
      setFormError('Name and email are required.');
      return;
    }
    if (form.mode === 'create' && (!formValues.password || !formValues.password_confirmation)) {
      setFormError('Enter and confirm a password.');
      return;
    }
    if (form.mode === 'create' && formValues.password !== formValues.password_confirmation) {
      setFormError('The password confirmation does not match.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const body = {
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        phone: formValues.phone || null,
      };
      if (form.mode === 'create') {
        body.password = formValues.password;
        body.password_confirmation = formValues.password_confirmation;
        await adminService.createAdminAccount(body);
        setNotice('Admin account created.');
        setPage(1);
      } else {
        await adminService.updateAdminAccount(form.account.id, body);
        setNotice('Admin account updated.');
      }
      setForm(null);
      setFormValues({});
      setRetry((value) => value + 1);
    } catch (saveError) {
      setFormError(requestError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    setStatusError('');
    try {
      await adminService.setAdminAccountStatus(statusTarget.id, { status: statusTarget.nextStatus });
      setNotice(statusTarget.nextStatus === 'active' ? 'Admin access reactivated.' : 'Admin access deactivated.');
      setStatusTarget(null);
      setRetry((value) => value + 1);
    } catch (statusActionError) {
      setStatusError(requestError(statusActionError));
    } finally {
      setStatusSaving(false);
    }
  };

  const columns = useMemo(() => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'status',
      header: 'Admin access',
      cell: ({ getValue }) => <span className={`admin-status admin-status--${getValue()}`}>{getValue()}</span>,
    },
    { accessorKey: 'account_status', header: 'User account' },
    {
      id: 'actions',
      header: ADMIN_COPY.actions,
      enableSorting: false,
      cell: ({ row }) => {
        const account = row.original;
        const nextStatus = account.status === 'active' ? 'suspended' : 'active';
        return (
          <div className="admin-row-actions">
            <button type="button" className="admin-icon-button" onClick={() => openForm(account)} aria-label={`Edit ${account.name}`} title={ADMIN_COPY.edit}>
              <Pencil aria-hidden="true" size={16} />
            </button>
            {account.account_status === 'active' ? (
              <button
                type="button"
                className={`admin-icon-button${nextStatus === 'suspended' ? ' admin-icon-button--danger' : ''}`}
                onClick={() => { setStatusTarget({ ...account, nextStatus }); setStatusError(''); }}
                aria-label={`${nextStatus === 'suspended' ? 'Deactivate' : 'Reactivate'} Admin access for ${account.name}`}
                title={nextStatus === 'suspended' ? 'Deactivate Admin access' : 'Reactivate Admin access'}
              >
                <RefreshCw aria-hidden="true" size={16} />
              </button>
            ) : null}
          </div>
        );
      },
    },
  ], [openForm]);

  return (
    <AdminShell>
      <section className="admin-screen-stack admin-account-management">
        <header className="admin-account-management__heading">
          <div>
            <h2>Admin accounts</h2>
            <p>Manage Admin access for existing SALO user accounts.</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => openForm()}>
            <Plus aria-hidden="true" size={17} />Create Admin
          </button>
        </header>

        {notice ? <p className="admin-account-management__notice" role="status">{notice}</p> : null}
        {error ? (
          <div className="admin-account-management__error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRetry((value) => value + 1)}>{ADMIN_COPY.retry}</button>
          </div>
        ) : null}

        <label className="admin-form-field admin-account-management__filter">
          <span>Admin access status</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="">All Admin accounts</option>
            <option value="active">Active</option>
            <option value="suspended">Deactivated</option>
          </select>
        </label>

        {loading ? <p className="admin-account-management__loading" role="status">{ADMIN_COPY.loading}</p> : null}
        {!loading && !error && !accounts.length ? (
          <p className="admin-account-management__empty" role="status">No Admin accounts match this view.</p>
        ) : null}
        {!loading && !error && accounts.length ? (
          <AdminDataTable
            data={accounts}
            columns={columns}
            search={search}
            onSearch={(value) => { setSearch(value); setPage(1); }}
            page={meta.current_page || page}
            lastPage={meta.last_page || 1}
            onPageChange={setPage}
            caption="SALO Admin accounts"
          />
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(form)}
        title={form?.mode === 'create' ? 'Create Admin account' : 'Edit Admin account'}
        message={form?.mode === 'create' ? 'This creates a normal SALO user account and grants it Admin capability.' : 'Only permitted account information can be edited here.'}
        confirmLabel={form?.mode === 'create' ? 'Create Admin' : ADMIN_COPY.save}
        onCancel={closeForm}
        onConfirm={saveAccount}
        busy={saving}
      >
        {form ? (
          <div className="admin-dialog-fields">
            <label className="admin-form-field">
              <span>Name *</span>
              <input autoComplete="name" maxLength={120} value={formValues.name || ''} onChange={(event) => setFormValues((values) => ({ ...values, name: event.target.value }))} />
            </label>
            <label className="admin-form-field">
              <span>Email *</span>
              <input type="email" autoComplete="email" maxLength={190} value={formValues.email || ''} onChange={(event) => setFormValues((values) => ({ ...values, email: event.target.value }))} />
            </label>
            <label className="admin-form-field">
              <span>Phone</span>
              <input type="tel" autoComplete="tel" maxLength={20} value={formValues.phone || ''} onChange={(event) => setFormValues((values) => ({ ...values, phone: event.target.value }))} />
            </label>
            {form.mode === 'create' ? (
              <>
                <label className="admin-form-field">
                  <span>Password *</span>
                  <input type="password" autoComplete="new-password" value={formValues.password || ''} onChange={(event) => setFormValues((values) => ({ ...values, password: event.target.value }))} />
                </label>
                <label className="admin-form-field">
                  <span>Confirm password *</span>
                  <input type="password" autoComplete="new-password" value={formValues.password_confirmation || ''} onChange={(event) => setFormValues((values) => ({ ...values, password_confirmation: event.target.value }))} />
                </label>
              </>
            ) : null}
            {formError ? <p className="admin-account-management__error" role="alert">{formError}</p> : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.nextStatus === 'suspended' ? 'Deactivate Admin access?' : 'Reactivate Admin access?'}
        message={statusTarget?.nextStatus === 'suspended'
          ? 'The user account remains intact, but this account will no longer have Admin access.'
          : 'This account will regain Admin access.'}
        confirmLabel={statusTarget?.nextStatus === 'suspended' ? 'Deactivate Admin' : 'Reactivate Admin'}
        onCancel={() => { if (!statusSaving) setStatusTarget(null); }}
        onConfirm={updateStatus}
        busy={statusSaving}
      >
        {statusError ? <p className="admin-account-management__error" role="alert">{statusError}</p> : null}
      </ConfirmDialog>
    </AdminShell>
  );
}

export default AdminAccountsAdminPage;
