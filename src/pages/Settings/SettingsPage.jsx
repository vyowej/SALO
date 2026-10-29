import { useEffect, useState } from 'react';
import Switch from '../../components/ui/Switch';
import { useTheme } from '../../context/ThemeContext';
import { restaurantService } from '../../services/restaurantService';
import '../Page.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [saving, setSaving] = useState(false);
  const { isDarkMode, setTheme } = useTheme();

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
    </div>
  );
}
