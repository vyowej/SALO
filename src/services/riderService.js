import { riderDashboardSeed } from '../mock/dashboardData';
import { config } from '../config';

const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));

export const riderService = {
  async getOverview(range = 'Today') {
    await wait();
    const seed = riderDashboardSeed.overview;
    const multiplier = seed.rangeMultipliers[range] || seed.rangeMultipliers.Today;
    return {
      online: riderDashboardSeed.online,
      earnings: seed.earnings * multiplier,
      deliveries: seed.deliveries * multiplier,
      acceptanceRate: seed.acceptanceRate,
      cashToRemit: seed.cashToRemit,
      earningsChange: seed.earningsChange,
      averageRating: seed.averageRating,
      settlementDeadline: seed.settlementDeadline,
      weeklyEarnings: riderDashboardSeed.earnings,
      offers: riderDashboardSeed.offers,
      deliveriesList: riderDashboardSeed.deliveries,
      completedRoute: seed.completedRoute,
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
