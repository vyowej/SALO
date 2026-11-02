import { config } from '../config';
import { apiRequest } from './apiClient';

const STORAGE_KEY = 'salo-support-tickets-v1';

const readTickets = () => {
  if (!config.useMock) return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const writeTickets = (tickets) => {
  if (!config.useMock) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
};

const normalizeTicket = (ticket) => ({
  ...ticket,
  id: String(ticket.id),
  order_id: ticket.order_id ? String(ticket.order_id) : null,
  status: ticket.status || 'open',
  created_at: ticket.created_at || new Date().toISOString(),
  latest_message: ticket.latest_message || null,
});

export const customerSupportService = {
  async getTickets() {
    if (config.useMock) {
      return readTickets().map(normalizeTicket).sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
    }

    const result = await apiRequest('/customer/support/tickets');
    if (!Array.isArray(result)) throw new Error('The support tickets response is invalid.');
    return result.map(normalizeTicket);
  },

  async createTicket({ subject, body, orderId = '' }) {
    if (config.useMock) {
      const id = `ticket-${Date.now()}`;
      const ticket = normalizeTicket({
        id,
        subject,
        body,
        status: 'open',
        order_id: orderId || null,
        created_at: new Date().toISOString(),
        latest_message: {
          user_id: 'self',
          body,
          created_at: new Date().toISOString(),
        },
      });
      const tickets = [...readTickets(), ticket];
      writeTickets(tickets);
      return ticket;
    }

    return apiRequest('/customer/support/tickets', {
      method: 'POST',
      body: {
        subject,
        body,
        order_id: orderId || null,
      },
    });
  },

  async getMessages(ticketId) {
    if (config.useMock) {
      const ticket = readTickets().find((entry) => String(entry.id) === String(ticketId));
      if (!ticket) return [];
      return [{
        id: `${ticket.id}-message`,
        ticket_id: String(ticket.id),
        user_id: 'self',
        body: ticket.body,
        created_at: ticket.created_at,
      }];
    }

    const result = await apiRequest(`/customer/support/tickets/${encodeURIComponent(ticketId)}/messages`);
    if (!Array.isArray(result)) throw new Error('The ticket message response is invalid.');
    return result;
  },

  async replyToTicket(ticketId, body) {
    if (config.useMock) {
      const tickets = readTickets();
      const ticketIndex = tickets.findIndex((entry) => String(entry.id) === String(ticketId));
      if (ticketIndex === -1) throw new Error('Support ticket not found.');
      const message = {
        id: `${ticketId}-reply-${Date.now()}`,
        ticket_id: String(ticketId),
        user_id: 'self',
        body,
        created_at: new Date().toISOString(),
      };
      const ticket = tickets[ticketIndex];
      ticket.latest_message = { user_id: 'self', body, created_at: message.created_at };
      ticket.updated_at = message.created_at;
      ticket.status = 'in_review';
      tickets[ticketIndex] = ticket;
      writeTickets(tickets);
      return message;
    }

    return apiRequest(`/customer/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
      method: 'POST',
      body: { body },
    });
  },
};

export default customerSupportService;
