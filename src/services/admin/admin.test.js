import { describe, expect, it } from 'vitest';
import { adminMock } from './mock';

describe('admin mock rider workflow', () => {
  it('continues to return demo rider fixtures with normal list filtering and pagination', async () => {
    const result = await adminMock.listRiders({ status: 'active', page: 1, per_page: 100 });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((rider) => rider.status === 'active')).toBe(true);
    expect(result.meta.current_page).toBe(1);
    expect(result.meta.total).toBe(result.data.length);
    expect(result.data.some((rider) => rider.name.startsWith('Sample Rider'))).toBe(true);
  });
});
