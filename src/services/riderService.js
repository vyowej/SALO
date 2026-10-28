import { riderDashboardSeed } from '../mock/dashboardData';
import { config } from '../config';

const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));

export const riderService = {
  async getOverview(range = 'Today') {
    await wait();
    const multiplier = range === '30 days' ? 26 : range === '7 days' ? 7 : 1;
    return {
      online: riderDashboardSeed.online,
      earnings: 2480 * multiplier,
      deliveries: 12 * multiplier,
      acceptanceRate: 94,
      cashToRemit: 640,
      weeklyEarnings: riderDashboardSeed.earnings,
      offers: riderDashboardSeed.offers,
    };
  },

  async setOnline(value) {
    await wait();
    riderDashboardSeed.online = value;
    return value;
  },

  async respondToOffer(id, accepted) {
    await wait();
    const offerIndex = riderDashboardSeed.offers.findIndex((offer) => offer.id === id);
    if (offerIndex < 0) return { error: 'Delivery offer not found.' };
    const [offer] = riderDashboardSeed.offers.splice(offerIndex, 1);
    return { offer, accepted };
  },
};

export default riderService;
