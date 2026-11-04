import config from '../config';
import { riderDashboardSeed } from '../mock/dashboardData';
import apiRequest, { setApiRequestContext } from './apiClient';

const delay = () => new Promise((resolve) => window.setTimeout(resolve, config.mockDelay));
const mockState = {
  availability: riderDashboardSeed.online ? 'online' : 'offline',
  current: null,
  location: null,
};

function createMockOffer() {
  const seed = riderDashboardSeed.offers[0];
  return {
    type: 'offer',
    offer: {
      id: seed.id,
      reference_code: seed.id,
      pickup_name: seed.pickup,
      pickup_distance_km: 3.2,
      dropoff_area: 'Quezon City',
      estimated_earning: String(seed.payout.toFixed(2)),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      ack_seconds: 60,
    },
  };
}

function setDriverContext() {
  setApiRequestContext('driver');
}

export const riderService = {
  async getHome() {
    if (config.useMock) {
      await delay();
      return {
        availability: mockState.availability,
        can_go_online: true,
        disabled_reason: null,
        assignment: { zone: 'Demo zone', shift: 'Demo shift', start_time: '09:00', end_time: '17:00' },
        next_action: mockState.availability === 'online' ? 'Wait for a delivery offer.' : 'Go online during an assigned shift.',
      };
    }

    setDriverContext();
    return apiRequest('/driver/home');
  },

  async setAvailability(availability, latitude = null, longitude = null) {
    if (config.useMock) {
      await delay();
      mockState.availability = availability;
      if (availability === 'online' && !mockState.current) mockState.current = createMockOffer();
      if (availability === 'offline') {
        mockState.current = null;
        mockState.location = null;
      }
      return this.getHome();
    }

    setDriverContext();
    return apiRequest('/driver/availability', {
      method: 'PATCH',
      body: { availability, latitude, longitude },
    });
  },

  async getCurrent() {
    if (config.useMock) {
      await delay();
      if (mockState.current?.type === 'offer'
        && new Date(mockState.current.offer.expires_at).getTime() <= Date.now()) {
        mockState.current = null;
      }
      if (mockState.current?.type === 'active_delivery') {
        return {
          ...mockState.current,
          delivery: { ...mockState.current.delivery, location: mockState.location },
        };
      }
      return mockState.current;
    }

    setDriverContext();
    return apiRequest('/driver/current-delivery');
  },

  async respondToOffer(offerId, accept) {
    if (config.useMock) {
      await delay();
      if (mockState.current?.offer?.id !== offerId) return { status: 'unavailable' };
      if (accept) {
        mockState.location = null;
        mockState.current = {
          type: 'active_delivery',
          delivery: {
            id: offerId,
            status: 'accepted',
            reference_code: offerId,
            pickup: {
              name: mockState.current.offer.pickup_name,
              address: 'Demo pickup address',
            },
            customer: {
              name: 'Demo customer',
              phone: '+63 900 000 0000',
              address: 'Demo delivery address',
              delivery_note: '',
            },
            items: [{ name: 'Demo meal', quantity: 1, note: '' }],
          },
        };
        mockState.availability = 'busy';
      } else {
        mockState.current = null;
      }
      return { status: accept ? 'accepted' : 'declined' };
    }

    setDriverContext();
    return apiRequest(`/driver/delivery-offers/${encodeURIComponent(offerId)}/${accept ? 'accept' : 'decline'}`, {
      method: 'POST',
      body: {},
    });
  },

  async updateLocation(deliveryId, latitude, longitude) {
    if (config.useMock) {
      await delay();
      mockState.location = { latitude, longitude, updated_at: new Date().toISOString() };
      return { recorded_at: mockState.location.updated_at };
    }

    setDriverContext();
    return apiRequest(`/driver/deliveries/${encodeURIComponent(deliveryId)}/location`, {
      method: 'POST',
      body: { latitude, longitude },
    });
  },

  async clearLocation(deliveryId) {
    if (config.useMock) {
      await delay();
      mockState.location = null;
      return { cleared: true };
    }

    setDriverContext();
    return apiRequest(`/driver/deliveries/${encodeURIComponent(deliveryId)}/location`, {
      method: 'DELETE',
    });
  },
};

export default riderService;
