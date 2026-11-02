import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { customerSupportService } from '../../services/customerSupportService';
import '../Page.css';

const emptyForm = { subject: '', body: '', orderId: '' };

export default function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [ticketMessages, setTicketMessages] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');

  const messages = selectedTicketId ? (ticketMessages[selectedTicketId] ?? []) : [];

  useEffect(() => {
    let active = true;
    const fetchTickets = async () => {
      if (!active) return;
      setLoading(true);
      setError('');
      try {
        const nextTickets = await customerSupportService.getTickets();
        if (!active) return;
        setTickets(nextTickets);
        if (!selectedTicketId && nextTickets[0]) {
          setSelectedTicketId(String(nextTickets[0].id));
        }
      } catch (loadError) {
        console.error('Unable to load support tickets.', loadError);
        if (active) setError(loadError.message || 'We couldn’t load your support tickets.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchTickets();
    return () => { active = false; };
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicketId) {
      return undefined;
    }

    let active = true;
    const fetchMessages = async () => {
      try {
        const nextMessages = await customerSupportService.getMessages(selectedTicketId);
        if (active) {
          setTicketMessages((current) => ({
            ...current,
            [selectedTicketId]: nextMessages,
          }));
        }
      } catch (loadError) {
        console.error('Unable to load support ticket messages.', loadError);
        if (active) {
          setTicketMessages((current) => ({
            ...current,
            [selectedTicketId]: [],
          }));
        }
      }
    };

    void fetchMessages();
    return () => { active = false; };
  }, [selectedTicketId]);

  const createTicket = async (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) {
      setError('Add a subject and a short message before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const created = await customerSupportService.createTicket({
        subject: form.subject.trim(),
        body: form.body.trim(),
        orderId: form.orderId.trim(),
      });
      setForm(emptyForm);
      const nextTickets = await customerSupportService.getTickets();
      setTickets(nextTickets);
      setSelectedTicketId(String(created.id || nextTickets[0]?.id || ''));
    } catch (submitError) {
      console.error('Unable to create support ticket.', submitError);
      setError(submitError.message || 'We couldn’t submit your message.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;
    setMessageSending(true);
    try {
      await customerSupportService.replyToTicket(selectedTicketId, replyText.trim());
      setReplyText('');
      const nextMessages = await customerSupportService.getMessages(selectedTicketId);
      setTicketMessages((current) => ({
        ...current,
        [selectedTicketId]: nextMessages,
      }));
      const nextTickets = await customerSupportService.getTickets();
      setTickets(nextTickets);
    } catch (submitError) {
      console.error('Unable to send the support reply.', submitError);
      setError(submitError.message || 'We couldn’t send your reply.');
    } finally {
      setMessageSending(false);
    }
  };

  return (
    <div className="section-shell data-page">
      <div className="page-header">
        <div>
          <h1>Help & Support</h1>
          <p>Get help with orders, reservations, account access, and app issues.</p>
        </div>
        <Link className="btn btn--secondary btn--md" to="/settings">Back to Settings</Link>
      </div>

      <div className="settings-grid">
        <section className="info-card" aria-labelledby="support-faq-heading">
          <h2 id="support-faq-heading">Common help topics</h2>
          <ul>
            <li>Order status, delivery issues, and receipt confirmation.</li>
            <li>Reservation availability, booking changes, and cancellation.</li>
            <li>Account, profile, and password access problems.</li>
            <li>Restaurant or service concerns that need account review.</li>
          </ul>
        </section>

        <section className="summary-card" aria-labelledby="support-form-heading">
          <h2 id="support-form-heading">Contact support</h2>
          <form onSubmit={createTicket}>
            <div className="field-group">
              <label htmlFor="support-subject">Subject</label>
              <input id="support-subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Need help with my reservation" />
            </div>
            <div className="field-group">
              <label htmlFor="support-order-id">Order ID (optional)</label>
              <input id="support-order-id" value={form.orderId} onChange={(event) => setForm((current) => ({ ...current, orderId: event.target.value }))} placeholder="Optional order reference" />
            </div>
            <div className="field-group">
              <label htmlFor="support-body">Message</label>
              <textarea id="support-body" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} rows="6" placeholder="Tell us what happened and what you need help with." />
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Submit support request'}
            </Button>
          </form>
        </section>
      </div>

      <section className="info-card" aria-labelledby="support-ticket-history-heading">
        <h2 id="support-ticket-history-heading">Your support tickets</h2>
        {loading ? <p role="status">Loading support tickets…</p> : null}
        {!loading && tickets.length === 0 ? <p>There are no support requests yet.</p> : null}
        {!loading && tickets.length > 0 ? (
          <div className="settings-grid">
            <aside className="summary-card">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="btn btn--ghost"
                  style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: '0.75rem' }}
                  onClick={() => setSelectedTicketId(String(ticket.id))}
                >
                  <strong>{ticket.subject}</strong>
                  <div>{ticket.status}</div>
                  <small>{new Date(ticket.created_at).toLocaleDateString()}</small>
                </button>
              ))}
            </aside>
            <div className="info-card">
              {selectedTicketId ? (
                <>
                  <h3>{tickets.find((ticket) => String(ticket.id) === String(selectedTicketId))?.subject || 'Ticket'}</h3>
                  {messages.length === 0 ? <p>No messages yet.</p> : messages.map((message) => (
                    <div key={message.id} className="info-card" style={{ marginBottom: '0.75rem' }}>
                      <small>{new Date(message.created_at).toLocaleString()}</small>
                      <p>{message.body}</p>
                    </div>
                  ))}
                  <div className="field-group">
                    <label htmlFor="support-reply">Reply</label>
                    <textarea id="support-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} rows="4" placeholder="Write a reply to the support team." />
                  </div>
                  <Button variant="primary" onClick={sendReply} disabled={messageSending}>
                    {messageSending ? 'Sending…' : 'Send reply'}
                  </Button>
                </>
              ) : <p>Select a support ticket to view its updates.</p>}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
