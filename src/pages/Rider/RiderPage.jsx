import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { riderService } from '../../services/riderService';
import './RiderPage.css';

const navigation = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'current', label: 'Current delivery', icon: '↗' },
  { id: 'earnings', label: 'Earnings', icon: '₱' },
  { id: 'profile', label: 'Profile', icon: '●' },
];

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser. Use a device with location services to go online.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission is needed to receive delivery offers. Allow access and try again.'
          : 'Unable to get your current location. Check location services and try again.',
      )),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}

function formatPeso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function OfferCard({ offer, now, busy, onRespond }) {
  const remaining = now === null
    ? offer.ack_seconds
    : Math.max(0, Math.ceil((new Date(offer.expires_at).getTime() - now) / 1000));
  const progress = Math.max(0, Math.min(100, (remaining / offer.ack_seconds) * 100));
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <div className="rider-dispatch__offer-backdrop">
      <section
        className="rider-dispatch__offer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rider-offer-title"
        aria-describedby="rider-offer-description"
      >
        <p className="rider-dispatch__eyebrow">New delivery offer</p>
        <div
          className="rider-dispatch__countdown"
          style={{ '--rider-offer-progress': `${progress}%` }}
          aria-label={`${minutes} minutes ${seconds} seconds to respond`}
        >
          <span>{minutes}:{seconds}</span>
        </div>
        <h2 id="rider-offer-title">{offer.pickup_name || 'Restaurant pickup'}</h2>
        <p className="rider-dispatch__offer-area" id="rider-offer-description">
          Drop-off area: <strong>{offer.dropoff_area}</strong>
        </p>
        <dl className="rider-dispatch__offer-details">
          <div><dt>Pickup distance</dt><dd>{offer.pickup_distance_km === null ? '—' : `${offer.pickup_distance_km} km`}</dd></div>
          <div><dt>Estimated earning</dt><dd>{formatPeso(offer.estimated_earning)}</dd></div>
          <div><dt>Order</dt><dd>{offer.reference_code}</dd></div>
        </dl>
        <div className="rider-dispatch__offer-actions">
          <Button
            variant="primary"
            className="rider-dispatch__accept"
            disabled={busy || remaining === 0}
            onClick={() => onRespond(true)}
          >
            {busy ? 'Sending…' : 'Accept delivery'}
          </Button>
          <Button
            variant="ghost"
            className="rider-dispatch__decline"
            disabled={busy || remaining === 0}
            onClick={() => onRespond(false)}
          >
            Decline
          </Button>
        </div>
      </section>
    </div>
  );
}

function CurrentDelivery({ delivery }) {
  if (!delivery) {
    return (
      <section className="rider-dispatch__panel rider-dispatch__empty">
        <h2>No current delivery</h2>
        <p>When you are online and assigned to an active shift, delivery offers will appear here.</p>
      </section>
    );
  }

  return (
    <section className="rider-dispatch__panel">
      <div className="rider-dispatch__panel-heading">
        <div><p className="rider-dispatch__eyebrow">Current delivery</p><h2>Order {delivery.reference_code}</h2></div>
        <span className="rider-dispatch__status">{delivery.status.replace('_', ' ')}</span>
      </div>
      <div className="rider-dispatch__stops">
        <article className="rider-dispatch__stop">
          <span className="rider-dispatch__stop-marker" aria-hidden="true">1</span>
          <div><p className="rider-dispatch__eyebrow">Pickup</p><h3>{delivery.pickup.name}</h3><p>{delivery.pickup.address}</p></div>
        </article>
        <article className="rider-dispatch__stop">
          <span className="rider-dispatch__stop-marker" aria-hidden="true">2</span>
          <div>
            <p className="rider-dispatch__eyebrow">Customer drop-off</p>
            <h3>{delivery.customer.name}</h3>
            <p>{delivery.customer.address}</p>
            {delivery.customer.delivery_note ? <p className="rider-dispatch__note">{delivery.customer.delivery_note}</p> : null}
            <a className="rider-dispatch__phone" href={`tel:${delivery.customer.phone}`}>{delivery.customer.phone}</a>
          </div>
        </article>
      </div>
      <div className="rider-dispatch__items">
        <h3>Order items</h3>
        <ul>{delivery.items.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <span>{item.quantity} × {item.name}</span>
            {item.note ? <small>{item.note}</small> : null}
          </li>
        ))}</ul>
      </div>
      <p className="rider-dispatch__notice">Delivery progress actions are part of a later phase.</p>
    </section>
  );
}

export default function RiderPage() {
  const { user } = useAuth();
  const [home, setHome] = useState(null);
  const [current, setCurrent] = useState(null);
  const [selectedTab, setSelectedTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => navigator.onLine);
  const audioContext = useRef(null);
  const previousOffer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [nextHome, nextCurrent] = await Promise.all([
        riderService.getHome(),
        riderService.getCurrent(),
      ]);
      setHome(nextHome);
      setCurrent(nextCurrent);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load Driver mode. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => refresh(), 0);
    const poll = window.setInterval(() => refresh(), 5000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(poll);
      window.clearInterval(clock);
      audioContext.current?.close();
    };
  }, [refresh]);

  const offer = current?.type === 'offer' ? current.offer : null;
  useEffect(() => {
    if (!offer) return undefined;
    document.body.classList.add('rider-dispatch--overlay-open');
    return () => document.body.classList.remove('rider-dispatch--overlay-open');
  }, [offer]);

  useEffect(() => {
    const handleOnline = () => {
      setNetworkOnline(true);
      setError('');
      refresh();
    };
    const handleOffline = () => {
      setNetworkOnline(false);
      setError('You are offline. Delivery offers and responses will resume when you reconnect.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refresh]);

  useEffect(() => {
    if (!offer || previousOffer.current === offer.id) return;
    previousOffer.current = offer.id;
    if (vibrationEnabled && navigator.vibrate) navigator.vibrate([180, 90, 180]);
    if (soundEnabled && audioContext.current?.state === 'running') {
      const oscillator = audioContext.current.createOscillator();
      const gain = audioContext.current.createGain();
      oscillator.frequency.value = 740;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(audioContext.current.destination);
      oscillator.start();
      oscillator.stop(audioContext.current.currentTime + 0.2);
    }
  }, [offer, soundEnabled, vibrationEnabled]);

  const toggleAvailability = async () => {
    if (!home || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (home.availability === 'online') {
        await riderService.setAvailability('offline');
        setNotice('You are offline and will not receive new offers.');
      } else {
        const location = await getBrowserLocation();
        await riderService.setAvailability('online', location.latitude, location.longitude);
        setNotice('You are online. Keep this page open to receive delivery offers.');
      }
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Unable to change availability. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const respondToOffer = async (accept) => {
    if (!offer || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await riderService.respondToOffer(offer.id, accept);
      if (response.status === 'accepted') {
        setSelectedTab('current');
        setNotice('Delivery accepted. Customer and exact delivery details are now available.');
      }
      else if (response.status === 'declined') setNotice('Offer declined. Another eligible rider may receive it.');
      else setNotice('This offer is no longer available.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Unable to respond to this offer. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const toggleSound = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!soundEnabled) {
      if (!AudioContextClass) {
        setError('Sound alerts are not supported by this browser.');
        return;
      }
      try {
        audioContext.current ||= new AudioContextClass();
        await audioContext.current.resume();
        setSoundEnabled(true);
      } catch {
        setError('Unable to enable sound alerts. Check your browser audio settings.');
      }
      return;
    }
    setSoundEnabled(false);
  };

  const toggleVibration = () => {
    if (!navigator.vibrate) {
      setError('Vibration alerts are not supported by this device.');
      return;
    }
    setVibrationEnabled((enabled) => !enabled);
  };

  const isOnline = home?.availability === 'online';
  const activeDelivery = current?.type === 'active_delivery' ? current.delivery : null;

  return (
    <main className="rider-dispatch">
      <header className="rider-dispatch__header">
        <div>
          <p className="rider-dispatch__eyebrow">Driver mode</p>
          <h1>Hi, {user?.name || 'Rider'}</h1>
          <p>{home?.assignment ? `${home.assignment.zone} · ${home.assignment.shift}, ${home.assignment.start_time}–${home.assignment.end_time}` : 'Your assigned shift'}</p>
        </div>
        <Button
          className={`rider-dispatch__availability ${isOnline ? 'is-online' : ''}`}
          variant={isOnline ? 'primary' : 'secondary'}
          role="switch"
          aria-checked={isOnline}
          disabled={busy || (!isOnline && home?.can_go_online === false)}
          onClick={toggleAvailability}
        >
          <span className="rider-dispatch__availability-dot" aria-hidden="true" />
          {busy ? 'Please wait…' : isOnline ? 'Online · Go offline' : 'Go online'}
        </Button>
      </header>

      {error ? <div className="rider-dispatch__banner rider-dispatch__banner--error" role="alert">{error}</div> : null}
      {!networkOnline ? <div className="rider-dispatch__banner rider-dispatch__banner--offline" role="status">Offline — reconnect to update your delivery status.</div> : null}
      {notice ? <div className="rider-dispatch__banner rider-dispatch__banner--success" role="status">{notice}</div> : null}
      {home?.disabled_reason && !isOnline ? <p className="rider-dispatch__hint">{home.disabled_reason}</p> : null}

      {loading ? (
        <section className="rider-dispatch__panel rider-dispatch__skeleton" aria-label="Loading Driver mode">
          <span /><span /><span />
        </section>
      ) : (
        <div className="rider-dispatch__content">
          {selectedTab === 'home' ? (
            <section className="rider-dispatch__panel rider-dispatch__home">
              <div>
                <p className="rider-dispatch__eyebrow">{isOnline ? 'You are online' : 'You are offline'}</p>
                <h2>{activeDelivery ? 'Continue your current delivery' : isOnline ? 'Waiting for an offer' : 'Ready when you are'}</h2>
                <p>{activeDelivery ? 'Your accepted order details are available in Current delivery.' : isOnline ? 'We will notify you when an eligible delivery is offered.' : home?.next_action}</p>
              </div>
              <div className="rider-dispatch__alerts" aria-label="Offer alerts">
                <button type="button" className={soundEnabled ? 'is-enabled' : ''} aria-pressed={soundEnabled} onClick={toggleSound}>Sound {soundEnabled ? 'on' : 'off'}</button>
                <button type="button" className={vibrationEnabled ? 'is-enabled' : ''} aria-pressed={vibrationEnabled} onClick={toggleVibration}>Vibration {vibrationEnabled ? 'on' : 'off'}</button>
              </div>
              {activeDelivery ? <Button variant="primary" className="rider-dispatch__current-action" onClick={() => setSelectedTab('current')}>Open current delivery</Button> : null}
            </section>
          ) : null}
          {selectedTab === 'current' ? <CurrentDelivery delivery={activeDelivery} /> : null}
          {selectedTab === 'earnings' || selectedTab === 'profile' ? (
            <section className="rider-dispatch__panel rider-dispatch__empty">
              <h2>{selectedTab === 'earnings' ? 'Earnings' : 'Rider profile'}</h2>
              <p>{selectedTab === 'earnings' ? 'Earnings history is planned for a later phase.' : 'Profile details are available in your account settings.'}</p>
            </section>
          ) : null}
        </div>
      )}

      <nav className="rider-dispatch__navigation" aria-label="Driver navigation">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.id}
            className={selectedTab === item.id ? 'is-active' : ''}
            aria-current={selectedTab === item.id ? 'page' : undefined}
            onClick={() => setSelectedTab(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {offer ? <OfferCard offer={offer} now={now} busy={busy} onRespond={respondToOffer} /> : null}
    </main>
  );
}
