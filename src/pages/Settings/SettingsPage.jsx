import { useEffect, useState } from 'react';
import Switch from '../../components/ui/Switch';
import { restaurantService } from '../../services/restaurantService';
import '../Page.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await restaurantService.getSettings();
      if (active) setSettings(data);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  if (!settings) return <div className="section-shell data-page"><div className="skeleton-card" /></div>;

  return (
    <div className="section-shell settings-shell">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Keep your ordering and reservation preferences in sync.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="info-card settings-panel">
          <div className="settings-list">
            <div className="setting-row">
              <div>
                <strong>Order notifications</strong>
                <div className="settings-description">Keep me updated on kitchen and delivery status.</div>
              </div>
              <Switch id="notif" label="Notifications" checked={settings.notifications} onChange={(value) => setSettings((current) => ({ ...current, notifications: value }))} />
            </div>
            <div className="setting-row">
              <div>
                <strong>Promotions and deals</strong>
                <div className="settings-description">Get local restaurant offers and surprise discounts.</div>
              </div>
              <Switch id="promo" label="Promotions" checked={settings.promotions} onChange={(value) => setSettings((current) => ({ ...current, promotions: value }))} />
            </div>
            <div className="setting-row">
              <div>
                <strong>Reservation reminders</strong>
                <div className="settings-description">Send reminders ahead of table bookings.</div>
              </div>
              <Switch id="reminder" label="Reservation reminders" checked={settings.reservationReminders} onChange={(value) => setSettings((current) => ({ ...current, reservationReminders: value }))} />
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
              <Switch id="dark-mode" label="Dark mode" checked={settings.darkMode} onChange={(value) => setSettings((current) => ({ ...current, darkMode: value }))} />
            </div>
            <div className="setting-row">
              <div>
                <strong>Sound alerts</strong>
              </div>
              <Switch id="sound-alerts" label="Sound alerts" checked={settings.soundAlerts} onChange={(value) => setSettings((current) => ({ ...current, soundAlerts: value }))} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
