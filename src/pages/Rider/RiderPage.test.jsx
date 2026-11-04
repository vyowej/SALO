/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiderPage from './RiderPage';
import { riderService } from '../../services/riderService';

vi.mock('../../services/riderService', () => ({
  riderService: {
    getHome: vi.fn(),
    getCurrent: vi.fn(),
    setAvailability: vi.fn(),
    respondToOffer: vi.fn(),
    updateLocation: vi.fn(),
    clearLocation: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  USER_ROLES: { RIDER: 'rider' },
  useAuth: () => ({ user: { name: 'Test Rider' }, activeView: 'rider' }),
}));

vi.mock('../../components/location/DeliveryTrackingMap', () => ({
  default: () => <div data-testid="delivery-tracking-map" />,
}));

const offer = {
  id: 'offer-1',
  reference_code: 'ORDER-1',
  pickup_name: 'Demo Restaurant',
  pickup_distance_km: 2.4,
  dropoff_area: 'Quezon City',
  estimated_earning: '80.00',
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  ack_seconds: 60,
};

const activeDelivery = {
  id: 'delivery-1',
  status: 'accepted',
  reference_code: 'ORDER-1',
  pickup: { name: 'Demo Restaurant', address: 'Pickup address' },
  customer: {
    name: 'Private Customer',
    phone: '+639171234567',
    address: 'Exact customer address',
    delivery_note: 'Ring the bell',
  },
  items: [{ name: 'Meal', quantity: 1, note: '' }],
};

describe('RiderPage dispatch experience', () => {
  let positionSuccess;
  let positionError;

  beforeEach(() => {
    vi.clearAllMocks();
    positionSuccess = null;
    positionError = null;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((success, error) => {
          positionSuccess = success;
          positionError = error;
          return 17;
        }),
        clearWatch: vi.fn(),
      },
    });

    riderService.getHome.mockResolvedValue({
      availability: 'online',
      can_go_online: true,
      disabled_reason: null,
      assignment: { zone: 'Central', shift: 'Day', start_time: '09:00', end_time: '17:00' },
      next_action: 'Wait for a delivery offer.',
    });
    riderService.getCurrent.mockResolvedValue({ type: 'offer', offer });
    riderService.updateLocation.mockResolvedValue({ recorded_at: new Date().toISOString() });
    riderService.clearLocation.mockResolvedValue({ cleared: true });
  });

  afterEach(() => cleanup());

  it('shows only approximate drop-off information before acceptance', async () => {
    render(<RiderPage />);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
    expect(screen.getByText('Quezon City')).toBeTruthy();
    expect(screen.queryByText('Private Customer')).toBeNull();
    expect(screen.queryByText('Exact customer address')).toBeNull();
    expect(screen.queryByText('+639171234567')).toBeNull();
    expect(screen.getByRole('button', { name: 'Accept delivery' }).getAttribute('disabled')).toBeNull();
  });

  it('reveals customer details only after the rider accepts', async () => {
    riderService.respondToOffer.mockImplementation(async () => {
      riderService.getCurrent.mockResolvedValue({ type: 'active_delivery', delivery: activeDelivery });
      return { status: 'accepted' };
    });
    render(<RiderPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Accept delivery' }));

    expect(await screen.findByText('Private Customer')).toBeTruthy();
    expect(screen.getByText('Exact customer address')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+639171234567' })).toBeTruthy();
    await waitFor(() => expect(riderService.respondToOffer).toHaveBeenCalledWith('offer-1', true));
  });

  it('lets the active-delivery detail sheet snap by dragging or keyboard-accessible control', async () => {
    riderService.respondToOffer.mockImplementation(async () => {
      riderService.getCurrent.mockResolvedValue({ type: 'active_delivery', delivery: activeDelivery });
      return { status: 'accepted' };
    });
    render(<RiderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept delivery' }));

    await screen.findByText('Exact customer address');
    const sheet = screen.getByRole('region', { name: 'Delivery details' });
    const handle = screen.getByRole('button', { name: 'Toggle delivery details' });
    expect(sheet.className).toContain('rider-dispatch__sheet--half');

    fireEvent.pointerDown(handle, { clientY: 200 });
    fireEvent.pointerUp(handle, { clientY: 100 });
    expect(sheet.className).toContain('rider-dispatch__sheet--full');

    fireEvent.click(handle);
    fireEvent.click(handle);
    expect(sheet.className).toContain('rider-dispatch__sheet--collapsed');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(handle);
    expect(sheet.className).toContain('rider-dispatch__sheet--half');
  });

  it('shares location only for an active delivery and stops the watch when the page unmounts', async () => {
    riderService.respondToOffer.mockImplementation(async () => {
      riderService.getCurrent.mockResolvedValue({ type: 'active_delivery', delivery: activeDelivery });
      return { status: 'accepted' };
    });
    const { unmount } = render(<RiderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept delivery' }));

    await screen.findByText('Exact customer address');
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1));
    act(() => positionSuccess({ coords: { latitude: 14.6, longitude: 121.01 } }));
    await waitFor(() => expect(riderService.updateLocation).toHaveBeenCalledWith('delivery-1', 14.6, 121.01));

    unmount();
    await waitFor(() => expect(riderService.clearLocation).toHaveBeenCalledWith('delivery-1'));
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(17);
  });

  it('shows a permission error and allows the rider to retry location tracking', async () => {
    riderService.respondToOffer.mockImplementation(async () => {
      riderService.getCurrent.mockResolvedValue({ type: 'active_delivery', delivery: activeDelivery });
      return { status: 'accepted' };
    });
    render(<RiderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept delivery' }));

    await screen.findByText('Exact customer address');
    await waitFor(() => expect(positionError).toBeTruthy());
    act(() => positionError({ code: 1, PERMISSION_DENIED: 1 }));
    expect(await screen.findByText(/Location permission is blocked/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry location' }));
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2));
  });

  it('stops the GPS watch and rejects later callbacks when the server reports ineligibility', async () => {
    riderService.respondToOffer.mockImplementation(async () => {
      riderService.getCurrent.mockResolvedValue({ type: 'active_delivery', delivery: activeDelivery });
      return { status: 'accepted' };
    });
    riderService.updateLocation.mockRejectedValue({ status: 403, message: 'Rider is no longer eligible.' });
    render(<RiderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept delivery' }));

    await screen.findByText('Exact customer address');
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1));
    act(() => positionSuccess({ coords: { latitude: 14.6, longitude: 121.01 } }));

    expect(await screen.findByText(/Location sharing stopped because this delivery or rider is no longer eligible/)).toBeTruthy();
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(17);
    expect(riderService.clearLocation).toHaveBeenCalledWith('delivery-1');

    act(() => positionSuccess({ coords: { latitude: 14.61, longitude: 121.02 } }));
    expect(riderService.updateLocation).toHaveBeenCalledTimes(1);
  });

  it('keeps the GPS watch active after a temporary location network error', async () => {
    riderService.respondToOffer.mockImplementation(async () => {
      riderService.getCurrent.mockResolvedValue({ type: 'active_delivery', delivery: activeDelivery });
      return { status: 'accepted' };
    });
    riderService.updateLocation
      .mockRejectedValueOnce(new Error('Network unavailable.'))
      .mockResolvedValue({ recorded_at: new Date().toISOString() });
    render(<RiderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept delivery' }));

    await screen.findByText('Exact customer address');
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1));
    act(() => positionSuccess({ coords: { latitude: 14.6, longitude: 121.01 } }));
    expect(await screen.findByText(/Your location could not be shared/)).toBeTruthy();
    expect(navigator.geolocation.clearWatch).not.toHaveBeenCalled();

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 6000);
    act(() => positionSuccess({ coords: { latitude: 14.61, longitude: 121.02 } }));
    await waitFor(() => expect(riderService.updateLocation).toHaveBeenCalledTimes(2));
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('starts one fresh watcher when location eligibility is retried', async () => {
    riderService.respondToOffer.mockImplementation(async () => {
      riderService.getCurrent.mockResolvedValue({ type: 'active_delivery', delivery: activeDelivery });
      return { status: 'accepted' };
    });
    riderService.updateLocation
      .mockRejectedValueOnce({ status: 403, message: 'Rider is no longer eligible.' })
      .mockResolvedValue({ recorded_at: new Date().toISOString() });
    render(<RiderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept delivery' }));

    await screen.findByText('Exact customer address');
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1));
    act(() => positionSuccess({ coords: { latitude: 14.6, longitude: 121.01 } }));
    expect(await screen.findByText(/Location sharing stopped because this delivery or rider is no longer eligible/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry location' }));
    await waitFor(() => expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2));
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledTimes(1);
    act(() => positionSuccess({ coords: { latitude: 14.61, longitude: 121.02 } }));
    await waitFor(() => expect(riderService.updateLocation).toHaveBeenCalledTimes(2));
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2);
  });
});
