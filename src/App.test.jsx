/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { authService } from './services/authService';

vi.mock('./config', () => ({ config: { useMock: false } }));
vi.mock('./services/authService', () => ({
  authService: {
    getDemoAccounts: () => [],
    getCurrentUser: vi.fn(),
  },
}));
vi.mock('./components/layout/Layout', () => ({ default: ({ children }) => children }));
vi.mock('./context/CartContext', () => ({ CartProvider: ({ children }) => children }));
vi.mock('./context/LocationContext', () => ({ LocationProvider: ({ children }) => children }));
vi.mock('./context/ThemeContext', () => ({ ThemeProvider: ({ children }) => children }));
vi.mock('./pages/Landing/Landing', () => ({ default: () => <div data-testid="landing-page">Landing</div> }));
vi.mock('./pages/CustomerHome/CustomerHomePage', () => ({ default: () => <div data-testid="customer-home">Customer home</div> }));
vi.mock('./pages/Restaurants/RestaurantsPage', () => ({ default: () => <div data-testid="restaurants-preview">Restaurants preview</div> }));
vi.mock('./pages/Reserve/ReservePage', () => ({ default: () => <div data-testid="reserve-promo">Reserve promo</div> }));
vi.mock('./pages/FeatureGate/FeatureGatePage', () => ({ default: () => <div data-testid="feature-gate">Feature gate</div> }));
vi.mock('./pages/Business/BusinessPage', () => ({ default: () => <div data-testid="protected-content">Protected business content</div> }));

const currentUser = {
  id: 8,
  name: 'Salo Customer',
  active_mode: 'customer',
  capabilities: ['customer'],
};

const openRoute = (path) => {
  window.history.replaceState({}, '', path);
  return render(<App />);
};

describe('session-check routing', () => {
  beforeEach(() => {
    authService.getCurrentUser.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('treats a 401 as a guest without an error message', async () => {
    authService.getCurrentUser.mockRejectedValueOnce({ status: 401 });

    openRoute('/');

    expect(await screen.findByTestId('landing-page')).not.toBeNull();
    await waitFor(() => expect(authService.getCurrentUser).toHaveBeenCalledOnce());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps public pages and feature gates visible while the session check is pending', async () => {
    authService.getCurrentUser.mockReturnValue(new Promise(() => {}));

    const publicRoutes = [
      ['/', 'landing-page'],
      ['/#how-it-works', 'feature-gate'],
      ['/restaurants', 'restaurants-preview'],
      ['/reserve', 'reserve-promo'],
      ['/cart', 'feature-gate'],
    ];

    for (const [path, testId] of publicRoutes) {
      cleanup();
      openRoute(path);
      expect(await screen.findByTestId(testId)).not.toBeNull();
    }
  });

  it('keeps public pages and feature gates visible after a failed session check', async () => {
    const publicRoutes = [
      ['/', 'landing-page'],
      ['/#how-it-works', 'feature-gate'],
      ['/restaurants', 'restaurants-preview'],
      ['/reserve', 'reserve-promo'],
      ['/cart', 'feature-gate'],
    ];

    for (const [path, testId] of publicRoutes) {
      cleanup();
      authService.getCurrentUser.mockRejectedValueOnce(new TypeError('Network unavailable'));
      openRoute(path);
      expect(await screen.findByTestId(testId)).not.toBeNull();
      expect(await screen.findByRole('button', { name: 'Retry' })).not.toBeNull();
    }
  });

  it('keeps public pages visible and shows a retry banner after a network failure', async () => {
    authService.getCurrentUser.mockRejectedValueOnce(new TypeError('Network unavailable'));

    openRoute('/');

    expect(screen.getByTestId('landing-page')).not.toBeNull();
    expect((await screen.findByRole('status')).textContent).toContain("We couldn't reach SALO right now.");
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
  });

  it('retries the session check and removes the banner after recovery', async () => {
    authService.getCurrentUser
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(currentUser);

    openRoute('/');

    await screen.findByRole('button', { name: 'Retry' });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByTestId('customer-home')).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(authService.getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('allows the connection banner to be dismissed without blocking the public page', async () => {
    authService.getCurrentUser.mockRejectedValueOnce(new TypeError('Network unavailable'));

    openRoute('/');

    await screen.findByRole('button', { name: 'Dismiss connection message' });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss connection message' }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByTestId('landing-page')).not.toBeNull();
  });

  it('never renders protected content before session confirmation or after a failed check', async () => {
    let rejectSession;
    authService.getCurrentUser.mockReturnValue(new Promise((resolve, reject) => {
      rejectSession = reject;
    }));

    openRoute('/business');

    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(document.querySelector('.skeleton-card')).not.toBeNull();

    rejectSession(new TypeError('Network unavailable'));

    await screen.findByRole('button', { name: 'Retry' });
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });
});
