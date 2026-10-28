import { adminDashboardSeed } from '../mock/dashboardData';
import { config } from '../config';

const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));

export const adminService = {
  async getOverview(range = '30 days') {
    await wait();
    const multiplier = range === 'Today' ? 1 : range === '7 days' ? 7 : 30;
    const seed = adminDashboardSeed.overview;
    return {
      metrics: [
        { label: 'GMV', value: seed.gmv * multiplier / 30, delta: seed.metricDeltas[0], format: 'currency' },
        { label: 'Orders', value: seed.orders * multiplier / 30, delta: seed.metricDeltas[1], format: 'number' },
        { label: 'Active restaurants', value: seed.activeRestaurants, delta: seed.metricDeltas[2], format: 'number' },
        { label: 'Active users', value: seed.activeUsers, delta: seed.metricDeltas[3], format: 'number' },
        { label: 'Pending applications', value: adminDashboardSeed.applications.filter((application) => application.status === 'Pending').length, delta: seed.pendingApplicationsDelta, format: 'number' },
        { label: 'Open support tickets', value: adminDashboardSeed.supportTickets.filter((ticket) => ticket.status === 'Open').length, delta: seed.openTicketsDelta, format: 'number' },
      ],
      trend: seed.trendValues.map((value, index) => ({ label: seed.trendLabels[index], value: Math.round(value * multiplier / 30) })),
      topRestaurants: seed.topRestaurants,
      workspaceStats: [
        { label: 'Restaurants', value: seed.activeRestaurants, detail: seed.workspaceDeltas[0] },
        { label: 'Active riders', value: seed.activeRiders, detail: seed.workspaceDeltas[1] },
        { label: 'Disputes', value: seed.disputes, detail: seed.workspaceDeltas[2] },
        { label: 'GMV', value: seed.gmv, detail: seed.workspaceDeltas[3], format: 'currency' },
      ],
      operations: seed.operations,
      vendorHealth: seed.vendorHealth,
      applications: adminDashboardSeed.applications,
      supportTickets: adminDashboardSeed.supportTickets,
    };
  },

  async reviewApplication(id, status, note) {
    await wait();
    if (!note.trim()) return { error: 'Add a note to document this decision.' };
    const application = adminDashboardSeed.applications.find((item) => item.id === id);
    if (!application) return { error: 'Application not found.' };
    application.status = status;
    application.history = [...(application.history || []), { status, note, at: new Date().toISOString() }];
    return { application };
  },
};

export default adminService;
