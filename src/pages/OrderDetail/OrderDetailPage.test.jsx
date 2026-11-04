/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderDetailPage from './OrderDetailPage';
import { customerOrderService } from '../../services/customerOrderService';
import { config } from '../../config';

vi.mock('../../services/customerOrderService', () => ({
  customerOrderService: {
    getOrderById: vi.fn(),
    getTracking: vi.fn(),
    advanceMockOrder: vi.fn(),
    cancelOrder: vi.fn(),
    confirmReceipt: vi.fn(),
    reviewRestaurant: vi.fn(),
  },
}));

vi.mock('../../components/location/DeliveryTrackingMap', () => ({
  default: () => <div role="region" aria-label="Delivery tracking map" />,
}));

const order = {
  id: 'order-1',
  restaurant: 'Test Restaurant',
  status: 'Out for Delivery',
  date: 'Today',
  deliveryMode: 'Delivery',
  address: 'Test delivery address',
  cartItems: [],
  items: '1 × Test meal',
  total: 25,
  subtotal: 25,
  deliveryFee: 0,
  serviceFee: 0,
  discount: 0,
};

const tracking = {
  order_id: 'order-1',
  status: 'out_for_delivery',
  timeline: [],
  delivery: { latitude: 14.61, longitude: 121.01 },
  live_location: {
    latitude: 14.6,
    longitude: 121.0,
    updated_at: new Date().toISOString(),
  },
  live_location_unavailable: false,
};

describe('OrderDetailPage live rider tracking', () => {
  let originalUseMock;

  beforeEach(() => {
    vi.useFakeTimers();
    originalUseMock = config.useMock;
    config.useMock = false;
    customerOrderService.getOrderById.mockResolvedValue(order);
    customerOrderService.getTracking.mockResolvedValue(tracking);
  });

  afterEach(() => {
    cleanup();
    config.useMock = originalUseMock;
    vi.useRealTimers();
  });

  it('shows the rider map only after an owned order tracking response provides a live point', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order-1']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await Promise.resolve();
    });

    expect(customerOrderService.getTracking).toHaveBeenCalledWith('order-1');
    expect(screen.getByRole('region', { name: 'Delivery tracking map' })).toBeTruthy();
    expect(screen.getByText(/Location sharing expires after two minutes/)).toBeTruthy();
  });

  it('shows an unavailable state without rendering a rider map when no point is available', async () => {
    customerOrderService.getTracking.mockResolvedValue({
      ...tracking,
      live_location: null,
      live_location_unavailable: true,
    });
    render(
      <MemoryRouter initialEntries={['/orders/order-1']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await Promise.resolve();
    });

    expect(screen.getByText('Live rider location is currently unavailable.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Delivery tracking map' })).toBeNull();
  });
});
