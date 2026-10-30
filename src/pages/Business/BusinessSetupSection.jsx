import { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useCan } from '../../hooks/useCan';
import { businessService } from '../../services/businessService';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function usePageData(loader) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loader());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setLoading(true);
        setError('');
        return loader();
      })
      .then((result) => { if (active && result !== undefined) setData(result); })
      .catch((loadError) => { if (active) setError(loadError.message || 'Unable to load this page.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loader]);

  return { data, setData, loading, error, setError, success, setSuccess, reload };
}

function useMutationFeedback() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const run = async (action, successMessage) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
    } catch (actionError) {
      setError(actionError.message || 'The change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, run };
}

function SensitiveUpdateForm({ restaurantId, user, profile, onSaved }) {
  const canEdit = useCan('restaurant.sensitive.edit', restaurantId);
  const { busy, error, success, run } = useMutationFeedback();
  const current = profile?.restaurant || {};
  const [changes, setChanges] = useState({});
  const [permitFiles, setPermitFiles] = useState([]);
  const [expiry, setExpiry] = useState('');
  const setField = (field, value) => setChanges((previous) => ({ ...previous, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const proposed = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== ''));
    await run(async () => {
      if (Object.keys(proposed).length === 0 && permitFiles.length === 0) {
        throw new Error('Provide at least one sensitive change or replacement permit.');
      }
      await businessService.proposeSensitiveUpdate(
        restaurantId,
        proposed,
        permitFiles,
        user,
        expiry || undefined,
      );
      await onSaved();
    }, 'Sensitive changes submitted for Admin review. Live restaurant details are unchanged until approval.');
  };

  if (!canEdit) return null;

  return (
    <section className="business-form-card">
      <h3>Legal details and address</h3>
      <p>Changes require Admin approval. Existing public details stay live until the proposal is approved.</p>
      {profile?.pending_sensitive_update ? (
        <p className="business-notice" role="status">
          A sensitive update is {profile.pending_sensitive_update.status || 'pending'} review.
        </p>
      ) : null}
      <form className="business-form-grid" onSubmit={submit}>
        <Input label="Legal name" value={changes.legal_name ?? current.legal_name ?? ''} onChange={(event) => setField('legal_name', event.target.value)} />
        <Input label="PSGC location code" value={changes.psgc_code ?? current.psgc_code ?? ''} onChange={(event) => setField('psgc_code', event.target.value)} />
        <Input label="Street address" value={changes.street ?? current.street ?? ''} onChange={(event) => setField('street', event.target.value)} />
        <Input label="Latitude" type="number" step="any" value={changes.latitude ?? current.latitude ?? ''} onChange={(event) => setField('latitude', event.target.value)} />
        <Input label="Longitude" type="number" step="any" value={changes.longitude ?? current.longitude ?? ''} onChange={(event) => setField('longitude', event.target.value)} />
        <Input label="Permit expiry date" type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
        <Input label="Replacement permit files" type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => setPermitFiles(Array.from(event.target.files || []))} />
        <div className="business-form-actions">
          <Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</Button>
        </div>
      </form>
      {error ? <p className="business-error" role="alert">{error}</p> : null}
      {success ? <p className="business-success" role="status">{success}</p> : null}
    </section>
  );
}

function ProfileSection({ restaurantId, user, readOnly }) {
  const canEdit = useCan('restaurant.page.edit', restaurantId);
  const loadProfile = useCallback(() => businessService.getProfile(restaurantId, user), [restaurantId, user]);
  const loadPreview = useCallback(() => businessService.getPreview(restaurantId, user), [restaurantId, user]);
  const page = usePageData(loadProfile);
  const previewPage = usePageData(loadPreview);
  const { busy, error: saveError, success, run } = useMutationFeedback();
  const profile = page.data?.restaurant || {};
  const [form, setForm] = useState({});
  const setField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    run(async () => {
      await businessService.updateProfile(restaurantId, {
        name: form.name ?? profile.name,
        category: form.category ?? profile.category,
        cuisine: form.cuisine ?? profile.cuisine,
        description: form.description ?? profile.description,
        contact_number: form.contact_number ?? profile.contact_number,
      }, user);
      await Promise.all([page.reload(), previewPage.reload()]);
    }, 'Restaurant profile saved.');
  };

  if (page.loading) return <p className="business-loading" role="status">Loading restaurant profile…</p>;
  if (page.error) return <p className="business-error" role="alert">{page.error}</p>;

  return (
    <div className="business-page-stack">
      <section className="business-form-card">
        <div className="business-card-heading"><div><h2>Restaurant profile</h2><p>These details appear on your public restaurant page.</p></div></div>
        {canEdit && !readOnly ? (
          <form className="business-form-grid" onSubmit={submit}>
            <Input label="Display name" value={form.name ?? profile.name ?? ''} onChange={(event) => setField('name', event.target.value)} required maxLength={160} />
            <Input label="Category" value={form.category ?? profile.category ?? ''} onChange={(event) => setField('category', event.target.value)} required maxLength={100} />
            <Input label="Cuisine" value={form.cuisine ?? profile.cuisine ?? ''} onChange={(event) => setField('cuisine', event.target.value)} maxLength={100} />
            <Input label="Contact number" value={form.contact_number ?? profile.contact_number ?? ''} onChange={(event) => setField('contact_number', event.target.value)} maxLength={40} />
            <Textarea className="business-form-wide" label="Description" value={form.description ?? profile.description ?? ''} onChange={(event) => setField('description', event.target.value)} maxLength={2000} rows={5} />
            <div className="business-form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button></div>
          </form>
        ) : (
          <dl className="business-profile-preview">
            <div><dt>Display name</dt><dd>{profile.name || 'Not set'}</dd></div>
            <div><dt>Category</dt><dd>{profile.category || 'Not set'}</dd></div>
            <div><dt>Cuisine</dt><dd>{profile.cuisine || 'Not set'}</dd></div>
            <div><dt>Contact number</dt><dd>{profile.contact_number || 'Not set'}</dd></div>
            <div><dt>Description</dt><dd>{profile.description || 'Not set'}</dd></div>
          </dl>
        )}
        {saveError ? <p className="business-error" role="alert">{saveError}</p> : null}
        {success ? <p className="business-success" role="status">{success}</p> : null}
      </section>
      <SensitiveUpdateForm restaurantId={restaurantId} user={user} profile={page.data} onSaved={page.reload} />
      <section className="business-form-card">
        <h3>Public page preview</h3>
        {previewPage.loading ? <p className="business-loading" role="status">Loading preview…</p> : null}
        {previewPage.error ? <p className="business-error" role="alert">{previewPage.error}</p> : null}
        {previewPage.data ? (
          <article className="business-public-preview">
            {previewPage.data.restaurant.cover_url ? <img className="business-preview-cover" src={previewPage.data.restaurant.cover_url} alt="" /> : null}
            <div className="business-preview-heading">
              {previewPage.data.restaurant.logo_url ? <img src={previewPage.data.restaurant.logo_url} alt="" /> : null}
              <div><h4>{previewPage.data.restaurant.name || 'Restaurant name'}</h4><p>{previewPage.data.restaurant.category || 'Category not set'} · {previewPage.data.restaurant.cuisine || 'Cuisine not set'}</p></div>
            </div>
            <p>{previewPage.data.restaurant.description || 'Add a description to introduce your restaurant.'}</p>
            <span>{previewPage.data.restaurant.open_now ? 'Open now' : previewPage.data.restaurant.is_24_7 ? 'Open 24/7' : 'Hours available in restaurant details'}</span>
            {previewPage.data.restaurant.photos?.length ? (
              <div className="business-preview-gallery">
                {previewPage.data.restaurant.photos.map((photo) => <img key={photo.id} src={photo.thumbnail_url || photo.url} alt={photo.alt_text || ''} />)}
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    </div>
  );
}

function PhotosSection({ restaurantId, user, readOnly }) {
  const canManage = useCan('restaurant.photos.manage', restaurantId);
  const loadPhotos = useCallback(() => businessService.getPhotos(restaurantId, user), [restaurantId, user]);
  const page = usePageData(loadPhotos);
  const feedback = useMutationFeedback();
  const [kind, setKind] = useState('gallery');
  const [altText, setAltText] = useState('');
  const [photoEdits, setPhotoEdits] = useState({});
  const [progress, setProgress] = useState(0);
  const photos = page.data?.photos || [];

  const upload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    feedback.run(async () => {
      setProgress(0);
      await businessService.uploadPhoto(restaurantId, file, kind, altText, user, setProgress);
      setAltText('');
      event.target.value = '';
      await page.reload();
    }, 'Photo uploaded.');
  };

  const deletePhoto = (id, label) => {
    if (!window.confirm(`Remove this ${label}? This cannot be undone.`)) return;
    feedback.run(async () => {
      await businessService.deletePhoto(restaurantId, id, user);
      await page.reload();
    }, 'Photo removed.');
  };

  const savePhoto = (photo) => feedback.run(async () => {
    const changes = photoEdits[photo.id] || {};
    await businessService.updatePhoto(restaurantId, photo.id, {
      alt_text: changes.alt_text ?? photo.alt_text ?? '',
      sort_order: Number(changes.sort_order ?? photo.sort_order ?? 0),
      is_primary: Boolean(changes.is_primary ?? photo.is_primary),
    }, user);
    await page.reload();
  }, 'Photo details saved.');

  if (page.loading) return <p className="business-loading" role="status">Loading restaurant photos…</p>;
  if (page.error) return <p className="business-error" role="alert">{page.error}</p>;
  const canChange = canManage && !readOnly;

  return (
    <div className="business-page-stack">
      <section className="business-form-card">
        <h2>Restaurant photos</h2>
        <p>Upload images for your logo, cover, or public photo gallery. Images are resized before upload.</p>
        {canChange ? (
          <div className="business-upload-row">
            <label className="business-inline-field"><span>Photo type</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="gallery">Gallery</option><option value="logo">Logo</option><option value="cover">Cover</option></select></label>
            <Input label="Image description (optional)" value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={255} />
            <Input label="Choose image" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={feedback.busy} />
          </div>
        ) : null}
        {feedback.busy ? <progress className="business-upload-progress" max="100" value={progress} aria-label="Photo upload progress" /> : null}
        {feedback.error ? <p className="business-error" role="alert">{feedback.error}</p> : null}
        {feedback.success ? <p className="business-success" role="status">{feedback.success}</p> : null}
      </section>
      <section className="business-form-card">
        <h3>Public photo preview</h3>
        <div className="business-photo-grid">
          {[['Logo', 'logo', page.data?.logo_url], ['Cover', 'cover', page.data?.cover_url], ...photos.map((photo) => [photo.alt_text || 'Gallery photo', photo.id, photo.url])].map(([label, id, url]) => (
            <article className="business-photo-card" key={id}>
              {url ? <img src={url} alt={label} /> : <div className="business-photo-empty">No {label.toLowerCase()} uploaded</div>}
              <span>{label}</span>
              {canChange && url && id !== 'logo' && id !== 'cover' ? (
                <div className="business-photo-edit">
                  <Input
                    label="Alt text"
                    value={photoEdits[id]?.alt_text ?? photos.find((photo) => String(photo.id) === String(id))?.alt_text ?? ''}
                    onChange={(event) => setPhotoEdits((previous) => ({ ...previous, [id]: { ...previous[id], alt_text: event.target.value } }))}
                    maxLength={255}
                  />
                  <Input
                    label="Display order"
                    type="number"
                    min="0"
                    value={photoEdits[id]?.sort_order ?? photos.find((photo) => String(photo.id) === String(id))?.sort_order ?? 0}
                    onChange={(event) => setPhotoEdits((previous) => ({ ...previous, [id]: { ...previous[id], sort_order: event.target.value } }))}
                  />
                  <label className="business-checkbox"><input type="checkbox" checked={Boolean(photoEdits[id]?.is_primary ?? photos.find((photo) => String(photo.id) === String(id))?.is_primary)} onChange={(event) => setPhotoEdits((previous) => ({ ...previous, [id]: { ...previous[id], is_primary: event.target.checked } }))} /> Primary photo</label>
                  <Button variant="secondary" size="sm" disabled={feedback.busy} onClick={() => savePhoto(photos.find((photo) => String(photo.id) === String(id)))}>Save photo details</Button>
                </div>
              ) : null}
              {canChange && url ? <Button variant="danger" size="sm" onClick={() => deletePhoto(id, label.toLowerCase())}>Remove</Button> : null}
            </article>
          ))}
          {photos.length === 0 && !page.data?.logo_url && !page.data?.cover_url ? <p className="business-empty-state">No photos yet. Add a logo, cover, or gallery photo.</p> : null}
        </div>
      </section>
    </div>
  );
}

function HoursSection({ restaurantId, user, readOnly }) {
  const canManage = useCan('restaurant.hours.manage', restaurantId);
  const loadHours = useCallback(async () => {
    const [hours, closures] = await Promise.all([
      businessService.getHours(restaurantId, user),
      businessService.getClosures(restaurantId, '', '', user),
    ]);
    return { ...hours, closures: closures.closures || closures };
  }, [restaurantId, user]);
  const page = usePageData(loadHours);
  const feedback = useMutationFeedback();
  const [form, setForm] = useState({ is_24_7: false, hours: {} });
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const hoursForm = form.initialized
    ? form
    : page.data
      ? { initialized: true, is_24_7: page.data.is_24_7, hours: page.data.hours }
      : form;
  const closures = useMemo(() => page.data?.closures || [], [page.data?.closures]);
  const events = useMemo(() => closures.map((closure) => ({
    id: String(closure.id),
    title: closure.reason || 'Closed',
    start: closure.closure_date,
    allDay: true,
  })), [closures]);
  const saveHours = (event) => {
    event.preventDefault();
    feedback.run(async () => {
      await businessService.updateHours(restaurantId, hoursForm, user);
      setForm({ initialized: true, is_24_7: hoursForm.is_24_7, hours: hoursForm.hours });
      await page.reload();
    }, 'Opening hours saved.');
  };
  const setShift = (day, index, field, value) => {
    setForm((previous) => {
      const currentForm = previous.initialized ? previous : hoursForm;
      const current = [...(currentForm.hours[day] || [])];
      current[index] = { ...current[index], [field]: value };
      return { ...currentForm, initialized: true, hours: { ...currentForm.hours, [day]: current } };
    });
  };
  const addShift = (day) => setForm((previous) => {
    const currentForm = previous.initialized ? previous : hoursForm;
    return {
      ...currentForm,
      initialized: true,
      hours: { ...currentForm.hours, [day]: [...(currentForm.hours[day] || []), { open_time: '09:00', close_time: '17:00', crosses_midnight: false }] },
    };
  });
  const removeShift = (day, index) => setForm((previous) => {
    const currentForm = previous.initialized ? previous : hoursForm;
    return {
      ...currentForm,
      initialized: true,
      hours: { ...currentForm.hours, [day]: currentForm.hours[day].filter((_, position) => position !== index) },
    };
  });
  const addClosure = (event) => {
    event.preventDefault();
    feedback.run(async () => {
      await businessService.createClosure(restaurantId, { closure_date: closureDate, reason: closureReason }, user);
      setClosureDate('');
      setClosureReason('');
      await page.reload();
    }, 'Closure date added.');
  };
  const removeClosure = (closure) => {
    if (!window.confirm(`Remove the closure on ${closure.start}?`)) return;
    feedback.run(async () => {
      await businessService.deleteClosure(restaurantId, closure.id, user);
      await page.reload();
    }, 'Closure date removed.');
  };

  if (page.loading) return <p className="business-loading" role="status">Loading opening hours…</p>;
  if (page.error) return <p className="business-error" role="alert">{page.error}</p>;
  const canChange = canManage && !readOnly;

  return (
    <div className="business-page-stack">
      <section className="business-form-card">
        <h2>Weekly opening hours</h2>
        {canChange ? (
          <form onSubmit={saveHours}>
            <label className="business-checkbox"><input type="checkbox" checked={Boolean(hoursForm.is_24_7)} onChange={(event) => setForm((previous) => ({ ...(previous.initialized ? previous : hoursForm), initialized: true, is_24_7: event.target.checked }))} /> Open 24/7</label>
            {!hoursForm.is_24_7 ? (
              <div className="business-hours-grid">
                {WEEKDAYS.map((day) => (
                  <fieldset key={day} className="business-day-fieldset">
                    <legend>{day}</legend>
                    {(hoursForm.hours?.[day] || []).map((shift, index) => (
                      <div className="business-shift-row" key={`${day}-${index}`}>
                        <Input label="Opens" type="time" value={shift.open_time} onChange={(event) => {
                          setShift(day, index, 'open_time', event.target.value);
                          setShift(day, index, 'crosses_midnight', shift.close_time <= event.target.value);
                        }} required />
                        <Input label="Closes" type="time" value={shift.close_time} onChange={(event) => {
                          setShift(day, index, 'close_time', event.target.value);
                          setShift(day, index, 'crosses_midnight', event.target.value <= shift.open_time);
                        }} required />
                        <Button variant="secondary" size="sm" onClick={() => removeShift(day, index)}>Remove shift</Button>
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => addShift(day)}>Add shift</Button>
                  </fieldset>
                ))}
              </div>
            ) : null}
            <div className="business-form-actions"><Button type="submit" disabled={feedback.busy}>{feedback.busy ? 'Saving…' : 'Save opening hours'}</Button></div>
          </form>
        ) : (
          <div className="business-readonly-hours">
            {hoursForm.is_24_7 ? <p>Open 24/7</p> : WEEKDAYS.map((day) => (
              <p key={day}><strong>{day}:</strong> {(hoursForm.hours?.[day] || []).map((shift) => `${shift.open_time}–${shift.close_time}${shift.crosses_midnight ? ' (next day)' : ''}`).join(', ') || 'Closed'}</p>
            ))}
          </div>
        )}
      </section>
      <section className="business-form-card">
        <h2>Closure calendar</h2>
        <p>Select a closure event to remove it; add planned closure dates using the form.</p>
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth' }}
          events={events}
          eventClick={({ event }) => {
            const closure = closures.find((item) => String(item.id) === event.id);
            if (closure && canChange) removeClosure({ ...closure, start: closure.closure_date });
          }}
          height="auto"
          timeZone="Asia/Manila"
        />
        {closures.length === 0 ? <p className="business-empty-state">No planned closure dates.</p> : null}
        {canChange ? (
          <form className="business-closure-form" onSubmit={addClosure}>
            <Input label="Closure date" type="date" value={closureDate} onChange={(event) => setClosureDate(event.target.value)} required />
            <Input label="Reason" value={closureReason} onChange={(event) => setClosureReason(event.target.value)} maxLength={255} required />
            <Button type="submit" variant="secondary" disabled={feedback.busy}>Add closure</Button>
          </form>
        ) : null}
        {feedback.error ? <p className="business-error" role="alert">{feedback.error}</p> : null}
        {feedback.success ? <p className="business-success" role="status">{feedback.success}</p> : null}
      </section>
    </div>
  );
}

function PublishSection({ restaurantId, user, workspace, readOnly, onWorkspaceUpdated }) {
  const canPublish = useCan('restaurant.publish', restaurantId);
  const loadChecklist = useCallback(() => businessService.getPublicationChecklist(restaurantId, user), [restaurantId, user]);
  const page = usePageData(loadChecklist);
  const feedback = useMutationFeedback();
  const restaurant = workspace?.restaurant || {};
  const [publishedOverride, setPublishedOverride] = useState(null);
  const [statusOverride, setStatusOverride] = useState(null);
  const published = publishedOverride ?? Boolean(restaurant.is_published);
  const status = statusOverride ?? restaurant.status;
  const checks = page.data?.checks
    ? Object.entries(page.data.checks).map(([key, check]) => ({ key, ...check }))
    : Object.entries(page.data || {}).filter(([, value]) => typeof value === 'boolean').map(([key, complete]) => ({ key, label: key.replaceAll('_', ' '), complete }));

  if (page.loading) return <p className="business-loading" role="status">Checking publication requirements…</p>;
  if (page.error) return <p className="business-error" role="alert">{page.error}</p>;
  const ready = Boolean(page.data?.can_publish ?? page.data?.ready);

  return (
    <section className="business-form-card">
      <h2>Publication checklist</h2>
      <p>Publishing is available only after all requirements are met.</p>
      <ul className="business-checklist">
        {checks.map((check) => (
          <li key={check.key} className={check.complete ? 'is-complete' : ''}>
            <span aria-hidden="true">{check.complete ? '✓' : '○'}</span>
            <span>{check.label}{check.blocked_until ? ` (available in ${check.blocked_until})` : ''}</span>
            <small>{check.complete ? 'Complete' : 'Not met'}</small>
          </li>
        ))}
      </ul>
      {canPublish && !readOnly && ready && !published ? (
        <Button disabled={feedback.busy} onClick={() => {
          if (!window.confirm('Publish this restaurant page?')) return;
          feedback.run(async () => {
          await businessService.updatePublication(restaurantId, true, user);
          setPublishedOverride(true);
          await onWorkspaceUpdated();
          await page.reload();
          }, 'Restaurant published.');
        }}>Publish restaurant</Button>
      ) : null}
      {canPublish && !readOnly && published ? (
        <Button variant="secondary" disabled={feedback.busy} onClick={() => {
          if (!window.confirm('Unpublish this restaurant?')) return;
          feedback.run(async () => {
            await businessService.updatePublication(restaurantId, false, user);
            setPublishedOverride(false);
            await onWorkspaceUpdated();
            await page.reload();
          }, 'Restaurant unpublished.');
        }}>Unpublish restaurant</Button>
      ) : null}
      {canPublish && !readOnly && status !== 'closed' ? (
        <Button variant="secondary" disabled={feedback.busy} onClick={() => {
          const reason = window.prompt('Reason for temporarily closing the restaurant (optional):');
          if (reason === null || !window.confirm('Temporarily close this restaurant?')) return;
          feedback.run(async () => {
            await businessService.setRestaurantClosed(restaurantId, true, reason, user);
            setStatusOverride('closed');
            await onWorkspaceUpdated();
          }, 'Restaurant temporarily closed.');
        }}>Temporarily close</Button>
      ) : null}
      {canPublish && !readOnly && status === 'closed' ? (
        <Button variant="secondary" disabled={feedback.busy} onClick={() => {
          if (!window.confirm('Reopen this restaurant?')) return;
          feedback.run(async () => {
            await businessService.setRestaurantClosed(restaurantId, false, undefined, user);
            setStatusOverride('approved');
            await onWorkspaceUpdated();
          }, 'Restaurant reopened.');
        }}>Reopen restaurant</Button>
      ) : null}
      {canPublish && !readOnly && !ready ? <p className="business-notice">Publishing is blocked. The orderable menu item requirement remains unmet until B4.</p> : null}
      {feedback.error ? <p className="business-error" role="alert">{feedback.error}</p> : null}
      {feedback.success ? <p className="business-success" role="status">{feedback.success}</p> : null}
    </section>
  );
}

export default function BusinessSetupSection({ path, restaurantId, user, workspace, readOnly, onWorkspaceUpdated }) {
  if (path === '/business/profile') return <ProfileSection restaurantId={restaurantId} user={user} readOnly={readOnly} />;
  if (path === '/business/photos') return <PhotosSection restaurantId={restaurantId} user={user} readOnly={readOnly} />;
  if (path === '/business/hours') return <HoursSection restaurantId={restaurantId} user={user} readOnly={readOnly} />;
  if (path === '/business/publish') return <PublishSection restaurantId={restaurantId} user={user} workspace={workspace} readOnly={readOnly} onWorkspaceUpdated={onWorkspaceUpdated} />;
  return null;
}
