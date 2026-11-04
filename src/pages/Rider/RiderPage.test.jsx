/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RiderPage from './RiderPage';
import { riderService } from '../../services/riderService';

vi.mock('../../services/riderService', () => ({
  riderService: {
    getHome: vi.fn(),
    getCurrent: vi.fn(),
    setAvailability: vi.fn(),
    respondToOffer: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Test Rider' } }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    riderService.getHome.mockResolvedValue({
      availability: 'online',
      can_go_online: true,
      disabled_reason: null,
      assignment: { zone: 'Central', shift: 'Day', start_time: '09:00', end_time: '17:00' },
      next_action: 'Wait for a delivery offer.',
    });
    riderService.getCurrent.mockResolvedValue({ type: 'offer', offer });
  });

  it('shows only approximate drop-off information before acceptance', async () => {
    render(<RiderPage />);

    expect(await screen.findByRole('dialog')).toBeTruthy();
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
});
