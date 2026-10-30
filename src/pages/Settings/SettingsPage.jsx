import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Switch from '../../components/ui/Switch';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { useCan } from '../../hooks/useCan';
import { useTheme } from '../../context/ThemeContext';
import config from '../../config';
import BusinessTeamPage from '../Business/BusinessTeamPage';
import { businessService } from '../../services/businessService';
import { restaurantService } from '../../services/restaurantService';
import '../Business/BusinessPage.css';
import './SettingsPage.css';
import '../Page.css';

export default function SettingsPage() {
  const { user, activeView, updateUser, refreshUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [businessWorkspace, setBusinessWorkspace] = useState(null);
  const [businessError, setBusinessError] = useState('');
  const [deactivationOpen, setDeactivationOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivationError, setDeactivationError] = useState('');
  const [deactivationNotice, setDeactivationNotice] = useState('');
  const [reactivationOpen, setReactivationOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [reactivationError, setReactivationError] = useState('');
  const [reactivationNotice, setReactivationNotice] = useState('');
  const { isDarkMode, setTheme } = useTheme();
  const businessMemberships = user?.memberships?.filter((membership) => membership.status === 'active') || [];
  const restaurantId = user?.selected_restaurant_id || businessMemberships[0]?.restaurant_id || '';
  const selectedMembership = businessMemberships.find((membership) => String(membership.restaurant_id) === String(restaurantId));
  const showBusinessSettings = activeView === USER_ROLES.RESTAURANT_OWNER && Boolean(restaurantId);
  const businessAccessDenied = selectedMembership?.restaurant_status === 'inactive' && selectedMembership.role !== 'owner';
  const canDeactivateBusiness = useCan('restaurant.publish', restaurantId);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await restaurantService.getSettings();
        if (active) setSettings(data);
      } catch (loadError) {
        console.error('Unable to load account settings.', loadError);
        if (active) setSettingsError('We couldn’t load your settings. Please try again.');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showBusinessSettings || businessAccessDenied) return undefined;
    let active = true;
    businessService.getWorkspace(restaurantId, user)
      .then((workspace) => { if (active) setBusinessWorkspace(workspace); })
      .catch((loadError) => {
        console.error('Unable to load business settings.', loadError);
        if (active) setBusinessError(loadError.message || 'Business settings could not be loaded.');
      });
    return () => { active = false; };
  }, [businessAccessDenied, restaurantId, showBusinessSettings, user]);

  const updateSetting = async (key, value) => {
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSettingsError('');
    setSaving(true);
    try {
      setSettings(await restaurantService.updateSettings({ [key]: value }));
    } catch (saveError) {
      console.error('Unable to save account settings.', saveError);
      setSettings(previous);
      if (key === 'darkMode') setTheme(previous.darkMode ? 'dark' : 'light');
      setSettingsError('We couldn’t save this preference. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateBusiness = async () => {
    setDeactivating(true);
    setDeactivationError('');
    setDeactivationNotice('');
    setReactivationError('');
    setReactivationNotice('');
    try {
      const result = await businessService.deactivateRestaurant(restaurantId, user);
      setBusinessWorkspace((current) => {
        const currentRestaurant = String(current?.restaurant?.id || '') === String(restaurantId) ? current : null;
        return {
          ...currentRestaurant,
          restaurant: {
            ...currentRestaurant?.restaurant,
            id: String(restaurantId),
            status: result.status,
            is_published: false,
            is_read_only: true,
            is_deactivated: true,
          },
        };
      });
      const memberships = (user?.memberships || []).map((membership) => (
        String(membership.restaurant_id) === String(restaurantId)
          ? { ...membership, restaurant_status: result.status }
          : membership
      ));
      if (config.useMock) await updateUser({ memberships });
      else await refreshUser();
      setDeactivationOpen(false);
      setDeactivationNotice('Business deactivated. Staff access has been disabled.');
    } catch (actionError) {
      setDeactivationError(actionError.message || 'The business could not be deactivated.');
    } finally {
      setDeactivating(false);
    }
  };

  const reactivateBusiness = async () => {
    setReactivating(true);
    setReactivationError('');
    setReactivationNotice('');
    setDeactivationError('');
    setDeactivationNotice('');
    try {
      const result = await businessService.reactivateRestaurant(restaurantId, user);
      setBusinessWorkspace((current) => {
        const currentRestaurant = String(current?.restaurant?.id || '') === String(restaurantId) ? current : null;
        return {
          ...currentRestaurant,
          restaurant: {
            ...currentRestaurant?.restaurant,
            id: String(restaurantId),
            status: result.status,
            is_published: false,
            is_read_only: false,
            is_deactivated: false,
          },
        };
      });
      if (config.useMock) {
        const memberships = (user?.memberships || []).map((membership) => (
          String(membership.restaurant_id) === String(restaurantId)
            ? { ...membership, restaurant_status: result.status }
            : membership
        ));
        await updateUser({ memberships });
      } else {
        await refreshUser();
      }
      setReactivationOpen(false);
      setReactivationNotice('Business reactivated. It remains unpublished until you publish it again.');
    } catch (actionError) {
      setReactivationError(actionError.message || 'The business could not be reactivated.');
    } finally {
      setReactivating(false);
    }
  };

  const currentBusinessWorkspace = String(businessWorkspace?.restaurant?.id || '') === String(restaurantId)
    ? businessWorkspace
    : null;
  const businessStatus = currentBusinessWorkspace?.restaurant?.status || selectedMembership?.restaurant_status;
  const businessReadOnly = Boolean(currentBusinessWorkspace?.restaurant?.is_read_only) || businessStatus === 'inactive';

  if (settingsError && !settings) return <div className="section-shell data-page"><div className="empty-state empty-state--error" role="alert"><h2>Settings unavailable</h2><p>{settingsError}</p></div></div>;
  if (!settings) return <div className="section-shell data-page"><div className="skeleton-card" /></div>;

  return (
    <div className="section-shell settings-shell">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Keep your ordering and reservation preferences in sync.</p>
        </div>
        {settingsError ? <p className="form-error" role="alert">{settingsError}</p> : null}
        {saving ? <p className="settings-saving" role="status">Saving preferences…</p> : null}
      </div>

      <div className="settings-grid">
        <div className="info-card settings-panel">
          <div className="settings-list">
            <div className="setting-row">
              <div>
                <strong>Order notifications</strong>
                <div className="settings-description">Keep me updated on kitchen and delivery status.</div>
              </div>
              <Switch id="notif" label="Notifications" checked={settings.notifications} onChange={(value) => updateSetting('notifications', value)} />
            </div>
            <div className="setting-row">
              <div>
                <strong>Promotions and deals</strong>
                <div className="settings-description">Get local restaurant offers and surprise discounts.</div>
              </div>
              <Switch id="promo" label="Promotions" checked={settings.promotions} onChange={(value) => updateSetting('promotions', value)} />
            </div>
            <div className="setting-row">
              <div>
                <strong>Reservation reminders</strong>
                <div className="settings-description">Send reminders ahead of table bookings.</div>
              </div>
              <Switch id="reminder" label="Reservation reminders" checked={settings.reservationReminders} onChange={(value) => updateSetting('reservationReminders', value)} />
            </div>
          </div>
        </div>

        <aside className="summary-card">
          <h3>Privacy</h3>
          <div className="settings-list settings-list--privacy">
            <div className="setting-row">
              <div>
                <strong>Dark mode</strong>
              </div>
              <Switch id="dark-mode" label="Dark mode" checked={isDarkMode} onChange={(value) => { setTheme(value ? 'dark' : 'light'); updateSetting('darkMode', value); }} />
            </div>
            <div className="setting-row">
              <div>
                <strong>Sound alerts</strong>
              </div>
              <Switch id="sound-alerts" label="Sound alerts" checked={settings.soundAlerts} onChange={(value) => updateSetting('soundAlerts', value)} />
            </div>
          </div>
        </aside>
      </div>

      {showBusinessSettings ? (
        <section className="settings-business-section" aria-labelledby="business-settings-heading">
          <div className="settings-business-section__heading">
            <p className="business-eyebrow">Restaurant operations</p>
            <h2 id="business-settings-heading">Business Settings</h2>
            <p>{selectedMembership?.restaurant_name || businessWorkspace?.restaurant?.name || 'Selected restaurant'}</p>
          </div>
          {businessAccessDenied ? (
            <section className="business-empty business-access-denied" role="alert">
              <h3>Access Denied</h3>
              <p>This business account has been deactivated by its Owner. You no longer have access to this business.</p>
              <Link className="btn btn--secondary btn--md" to="/">Back to Home</Link>
            </section>
          ) : (
            <>
              <section className="info-card settings-business-info">
                <div>
                  <p className="business-eyebrow">Business information</p>
                  <h3>Restaurant profile</h3>
                  <p>Update your customer-facing information, photos, and operating hours.</p>
                </div>
                <Link className="btn btn--secondary btn--md" to="/business/profile/edit">Manage business information</Link>
              </section>
              {businessError ? <p className="form-error" role="alert">{businessError}</p> : null}
              <BusinessTeamPage
                key={`staff-settings-${restaurantId}`}
                restaurantId={restaurantId}
                user={user}
                readOnly={businessReadOnly}
                variant="settings"
              />
              <section className="info-card settings-business-danger">
                <p className="business-eyebrow">Danger zone</p>
                <h3>
                  {businessStatus === 'suspended'
                    ? 'Account Restricted by SALO Management'
                    : businessStatus === 'inactive'
                      ? 'Business Account Deactivated'
                      : 'Deactivate Business Account'}
                </h3>
                {businessStatus === 'suspended' ? (
                  <p>SALO management suspended this restaurant. Only an Admin can restore access.</p>
                ) : businessStatus === 'inactive' ? (
                  <p>This restaurant was deactivated by its Owner. Reactivation restores access but does not republish it.</p>
                ) : (
                  <p>Owner deactivation sets this restaurant to Inactive, unpublishes it, and blocks appointed staff from accessing its business workspace. Existing history is retained.</p>
                )}
                {deactivationNotice ? <p className="business-success" role="status">{deactivationNotice}</p> : null}
                {deactivationError ? <p className="form-error" role="alert">{deactivationError}</p> : null}
                {reactivationNotice ? <p className="business-success" role="status">{reactivationNotice}</p> : null}
                {reactivationError ? <p className="form-error" role="alert">{reactivationError}</p> : null}
                {businessStatus === 'suspended' ? (
                  <p className="business-readonly" role="status">This business was suspended by SALO management. Contact support; only an Admin can reinstate it.</p>
                ) : businessStatus === 'inactive' && selectedMembership?.role === 'owner' ? (
                  <>
                    <p className="business-readonly" role="status">You deactivated this business. Reactivating restores Owner access, but leaves the business unpublished.</p>
                    <Button type="button" disabled={reactivating} onClick={() => setReactivationOpen(true)}>
                      Reactivate Business
                    </Button>
                  </>
                ) : businessStatus === 'inactive' ? (
                  <p className="business-readonly" role="status">This business was deactivated by its Owner. Contact the Owner to restore access.</p>
                ) : canDeactivateBusiness ? (
                  <Button type="button" variant="danger" disabled={deactivating || businessReadOnly} onClick={() => setDeactivationOpen(true)}>
                    Deactivate Business
                  </Button>
                ) : (
                  <p className="settings-description">Only the Owner can deactivate this business.</p>
                )}
              </section>
              <ConfirmDialog
                open={deactivationOpen}
                title="Deactivate Business?"
                message="This sets the restaurant to Inactive, unpublishes it, disables access for appointed staff, and prevents normal business operations. Existing history is retained."
                confirmLabel="Deactivate Business"
                busy={deactivating}
                onCancel={() => !deactivating && setDeactivationOpen(false)}
                onConfirm={deactivateBusiness}
              />
              <ConfirmDialog
                open={reactivationOpen}
                title="Reactivate Business?"
                message="This restores the restaurant to Approved and restores business access. It will remain unpublished; publishing it again is a separate action."
                confirmLabel="Reactivate Business"
                busy={reactivating}
                onCancel={() => !reactivating && setReactivationOpen(false)}
                onConfirm={reactivateBusiness}
              />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
