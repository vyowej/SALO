import { adminDashboardSeed } from '../mock/dashboardData';
import { config } from '../config';

const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));

export const adminService = {
  async getOverview(range = '30 days') {
    await wait();
    const multiplier = range === 'Today' ? 1 : range === '7 days' ? 7 : 30;
    return {
      metrics: [
        { label: 'GMV', value: 4200000 * multiplier / 30, delta: '+17.8%', format: 'currency' },
        { label: 'Orders', value: 18240 * multiplier / 30, delta: '+12%', format: 'number' },
        { label: 'Active restaurants', value: 248, delta: '+14 this month', format: 'number' },
        { label: 'Active users', value: 48200, delta: '+8.3%', format: 'number' },
        { label: 'Pending applications', value: adminDashboardSeed.applications.filter((application) => application.status === 'Pending').length, delta: 'Needs review', format: 'number' },
        { label: 'Open support tickets', value: adminDashboardSeed.supportTickets.filter((ticket) => ticket.status === 'Open').length, delta: '2 urgent', format: 'number' },
      ],
      trend: Array.from({ length: 7 }, (_, index) => ({ label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index], value: Math.round((840 + index * 97 + (index % 2) * 145) * multiplier / 30) })),
      topRestaurants: ['Mang Toma’s Kitchen', 'Dagat Kusina', 'Harana Grill House'],
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
