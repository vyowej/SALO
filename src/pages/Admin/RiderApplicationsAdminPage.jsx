import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import AdminShell from '../../components/admin/AdminShell';
import { config } from '../../config';
import { riderApplicationService } from '../../services/riderApplicationService';
import './RiderApplicationsAdminPage.css';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value))
  : '—';

export default function RiderApplicationsAdminPage() {
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [application, setApplication] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [documentUrls, setDocumentUrls] = useState({});

  const fetchQueue = useCallback(async () => {
    if (config.useMock) {
      throw new Error('Rider application review requires API mode.');
    }
    return riderApplicationService.listAdminApplications({ page: 1, per_page: 100 });
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchQueue();
      setApplications(response.data || []);
    } catch (requestError) {
      setError(requestError.message || 'The rider application queue could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [fetchQueue]);

  useEffect(() => {
    let active = true;
    fetchQueue()
      .then((response) => {
        if (active) setApplications(response.data || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'The rider application queue could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [fetchQueue]);

  const selectApplication = async (id) => {
    setSelectedId(id);
    setApplication(null);
    setDocumentUrls({});
    setMessage('');
    setError('');
    try {
      const detail = await riderApplicationService.getAdminApplication(id);
      setApplication(detail);
    } catch (requestError) {
      setError(requestError.message || 'The rider application could not be loaded.');
    }
  };

  const runAction = async (action) => {
    if (!application) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await riderApplicationService.reviewAction(application.id, action, { note });
      if (action === 'approve') {
        setApplication(result.profile);
        setMessage(result.email_delivery?.message || 'Application approved.');
      } else {
        setApplication(result);
        setMessage(action === 'start-review'
          ? 'Review started.'
          : action === 'request-revision'
            ? 'Revision requested.'
            : 'Application rejected.');
      }
      await loadQueue();
    } catch (requestError) {
      setError(requestError.message || 'The review action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const loadDocumentUrl = async (document) => {
    try {
      const result = await riderApplicationService.getAdminDocumentUrl(application.id, document.id);
      setDocumentUrls((current) => ({ ...current, [document.id]: result.url }));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'The private document link could not be created.');
    }
  };

  return (
    <AdminShell>
      <main className="admin-rider-applications">
        <header className="admin-rider-applications__header">
          <div><p>Applications</p><h2>Rider review queue</h2></div>
          <Button variant="secondary" onClick={loadQueue} disabled={loading}>Refresh</Button>
        </header>
        {error ? <p className="admin-rider-applications__alert" role="alert">{error}</p> : null}
        {message ? <p className="admin-rider-applications__message" role="status">{message}</p> : null}
        <div className="admin-rider-applications__layout">
          <Card className="admin-rider-applications__queue">
            <h3>Submitted applications</h3>
            {loading ? <div className="skeleton-card" role="status" aria-label="Loading rider applications" /> : null}
            {!loading && !applications.length ? <EmptyState title="No rider applications" description="Submitted applications will appear here." /> : null}
            <ul>
              {applications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={selectedId === item.id ? 'is-selected' : ''}
                    onClick={() => selectApplication(item.id)}
                    aria-current={selectedId === item.id ? 'true' : undefined}
                  >
                    <strong>{item.applicant.name}</strong>
                    <span>{item.application_status.replaceAll('_', ' ')} · {item.vehicle_type || 'vehicle not set'}</span>
                    <small>{formatDate(item.submitted_at)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="admin-rider-applications__detail">
            {!application ? (
              <EmptyState title="Select an application" description="Applicant details and private documents are shown here after selection." />
            ) : (
              <>
                <div className="admin-rider-applications__detail-heading">
                  <div><p>{application.application_status.replaceAll('_', ' ')}</p><h3>{application.applicant.name}</h3><span>{application.applicant.email} · {application.applicant.mobile}</span></div>
                  <span>{application.vehicle_type?.replaceAll('_', ' ') || 'Vehicle not set'}</span>
                </div>
                <dl className="admin-rider-applications__summary">
                  <div><dt>Birthday</dt><dd>{application.applicant.birthday || '—'}</dd></div>
                  <div><dt>Home</dt><dd>{application.address.formatted_address || 'Address incomplete'}</dd></div>
                  <div><dt>Preferred shifts</dt><dd>{application.preferred_shifts.map((shift) => shift.name).join(', ') || '—'}</dd></div>
                  <div><dt>E-wallet account name</dt><dd>{application.ewallet_account_name || '—'}</dd></div>
                  <div><dt>Clearance and TIN declaration</dt><dd>{application.declared_clearance_tin ? 'Confirmed' : 'Not confirmed'}</dd></div>
                </dl>
                <section className="admin-rider-applications__documents" aria-labelledby="admin-rider-documents-title">
                  <h4 id="admin-rider-documents-title">Private documents</h4>
                  {application.documents.map((document) => (
                    <div className="admin-rider-applications__document" key={document.id}>
                      <div><strong>{document.doc_type.replaceAll('_', ' ')}</strong><small>{document.verified ? 'Verified' : 'Pending review'}</small></div>
                      {documentUrls[document.id] ? (
                        document.mime_type === 'application/pdf' ? (
                          <a href={documentUrls[document.id]} target="_blank" rel="noreferrer">Open private PDF</a>
                        ) : (
                          <a href={documentUrls[document.id]} target="_blank" rel="noreferrer">
                            <img src={documentUrls[document.id]} alt={`${document.doc_type.replaceAll('_', ' ')} preview`} />
                          </a>
                        )
                      ) : <Button variant="ghost" onClick={() => loadDocumentUrl(document)}>Create secure preview link</Button>}
                    </div>
                  ))}
                </section>
                {application.review_notes ? <p className="admin-rider-applications__note"><strong>Previous note:</strong> {application.review_notes}</p> : null}
                {['submitted', 'under_review'].includes(application.application_status) ? (
                  <div className="admin-rider-applications__actions">
                    <Input id="rider-review-note" label="Review note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} hint="Required for rejection or revision request." />
                    <div>
                      {application.application_status === 'submitted' ? <Button variant="secondary" onClick={() => runAction('start-review')} disabled={busy}>Start review</Button> : null}
                      <Button onClick={() => runAction('approve')} disabled={busy}>{busy ? 'Saving…' : 'Approve'}</Button>
                      <Button variant="secondary" onClick={() => runAction('request-revision')} disabled={busy || !note.trim()}>Request revision</Button>
                      <Button variant="ghost" onClick={() => runAction('reject')} disabled={busy || !note.trim()}>Reject</Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        </div>
      </main>
    </AdminShell>
  );
}
