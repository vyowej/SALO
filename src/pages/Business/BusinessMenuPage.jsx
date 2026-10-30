import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { useCan } from '../../hooks/useCan';
import { businessService } from '../../services/businessService';
import './BusinessMenuPage.css';

function tagLabel(tag) {
  return tag.name.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function compressMenuPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file?.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('The selected image could not be opened.');
  }
  try {
    let scale = Math.min(1, 1800 / bitmap.width, 1800 / bitmap.height);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable in this browser.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.45, 0.82 - attempt * 0.08);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('The image could not be compressed.'));
        }, 'image/webp', quality);
      });
      if (blob.size <= 2 * 1024 * 1024) return new File([blob], 'menu-item.webp', { type: 'image/webp' });
      scale *= 0.8;
    }
    throw new Error('The compressed image must be no larger than 2 MB.');
  } finally {
    bitmap.close();
  }
}

export default function BusinessMenuPage({ restaurantId, user, readOnly, onWorkspaceUpdated, onAccessDenied }) {
  const canManage = useCan('restaurant.menu.manage', restaurantId) && !readOnly;
  const canToggleAvailability = useCan('menu.availability.manage', restaurantId) && !readOnly;
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({});
  const [itemPhoto, setItemPhoto] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', sort_order: 0 });
  const [editingCategory, setEditingCategory] = useState(null);
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificateExpiry, setCertificateExpiry] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMenu(await businessService.getMenu(restaurantId, {}, user));
    } catch (loadError) {
      if (await onAccessDenied?.(loadError)) return;
      setError(loadError.message || 'The menu could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [onAccessDenied, restaurantId, user]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const activeCategories = (menu?.categories || []).filter((category) => category.status === 'active');
  const filteredItems = useMemo(() => (menu?.items || []).filter((item) => (
    (!search || `${item.name} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase()))
    && (!statusFilter || item.lifecycle_status === statusFilter)
    && (!categoryFilter || String(item.category_id) === String(categoryFilter))
  )), [categoryFilter, menu?.items, search, statusFilter]);

  const refreshAfterChange = useCallback(async () => {
    await loadMenu();
    await onWorkspaceUpdated?.();
  }, [loadMenu, onWorkspaceUpdated]);

  const runAction = useCallback(async (action, successMessage) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      await refreshAfterChange();
      setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      return result;
    } catch (actionError) {
      if (await onAccessDenied?.(actionError)) return null;
      setError(actionError.message || 'The change could not be saved.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [onAccessDenied, refreshAfterChange]);

  const startNewItem = () => {
    setEditingItem(null);
    setItemForm({
      category_id: activeCategories[0]?.id || '',
      name: '',
      description: '',
      price: '',
      lifecycle_status: 'draft',
      is_available: true,
      daily_quantity: '',
      prep_minutes: '',
      dietary_tag_ids: [],
    });
    setItemPhoto(null);
    setItemFormOpen(true);
  };

  const startEditItem = useCallback((item) => {
    setEditingItem(item);
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      lifecycle_status: item.lifecycle_status,
      is_available: item.is_available,
      daily_quantity: item.daily_quantity ?? '',
      prep_minutes: item.prep_minutes ?? '',
      dietary_tag_ids: item.dietary_tags.map((tag) => tag.id),
    });
    setItemPhoto(null);
    setItemFormOpen(true);
  }, []);

  const persistItem = async (priceAcknowledged = false) => {
    const data = {
      ...itemForm,
      category_id: Number(itemForm.category_id),
      price: Number(itemForm.price).toFixed(2),
      daily_quantity: itemForm.daily_quantity === '' ? null : Number(itemForm.daily_quantity),
      prep_minutes: itemForm.prep_minutes === '' ? null : Number(itemForm.prep_minutes),
      dietary_tag_ids: itemForm.dietary_tag_ids,
      ...(priceAcknowledged ? { price_change_acknowledged: true } : {}),
    };
    const response = await runAction(async () => {
      const saved = editingItem
        ? await businessService.updateMenuItem(restaurantId, editingItem.id, data, user)
        : await businessService.createMenuItem(restaurantId, data, user);
      const savedItem = saved.item;
      if (itemPhoto && savedItem?.id) {
        await businessService.uploadMenuPhoto(restaurantId, savedItem.id, await compressMenuPhoto(itemPhoto), user);
      }
      return saved;
    }, editingItem ? 'Menu item updated.' : 'Menu item added.');
    if (response) {
      setItemFormOpen(false);
      setEditingItem(null);
      setItemPhoto(null);
    }
  };

  const submitItem = (event) => {
    event.preventDefault();
    const priceChanged = editingItem && Number(itemForm.price).toFixed(2) !== Number(editingItem.price).toFixed(2);
    if (priceChanged) {
      setConfirm({
        title: 'Confirm price change',
        message: 'A price change may affect customer carts. Cart impact cannot be counted before the ordering phase. Continue with this change?',
        confirmLabel: 'Confirm price change',
        action: () => persistItem(true),
      });
      return;
    }
    persistItem(false);
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    const response = await runAction(
      () => editingCategory
        ? businessService.updateMenuCategory(restaurantId, editingCategory.id, categoryForm, user)
        : businessService.createMenuCategory(restaurantId, categoryForm, user),
      editingCategory ? 'Category updated.' : 'Category created.',
    );
    if (response) {
      setCategoryForm({ name: '', sort_order: 0 });
      setEditingCategory(null);
    }
  };

  const requestConfirmation = useCallback((details) => setConfirm(details), []);
  const confirmAction = async () => {
    if (!confirm?.action) return;
    setConfirmBusy(true);
    try {
      await confirm.action();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const publishSelected = async () => {
    const result = await runAction(
      () => businessService.publishMenuItems(restaurantId, selectedIds, user),
      (data) => data.failures.length
        ? `${data.items.length} item(s) published. ${data.failures.map((failure) => `${failure.item_id}: ${failure.message}`).join(' ')}`
        : `${data.items.length} item(s) published.`,
    );
    if (result) setSelectedIds([]);
  };

  const toggleSelection = useCallback((itemId) => {
    setSelectedIds((current) => current.includes(String(itemId))
      ? current.filter((id) => id !== String(itemId))
      : [...current, String(itemId)]);
  }, []);

  const columns = useMemo(() => [
    ...(canManage ? [{
      id: 'select',
      header: '',
      cell: ({ row }) => row.original.lifecycle_status === 'archived' ? null : (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.name}`}
          checked={selectedIds.includes(String(row.original.id))}
          onChange={() => toggleSelection(row.original.id)}
        />
      ),
    }] : []),
    {
      accessorKey: 'name',
      header: 'Item',
      cell: ({ row }) => (
        <div className="business-menu-item-name">
          {row.original.image_url ? <img src={row.original.image_url} alt="" /> : <span aria-hidden="true">🍽</span>}
          <div><strong>{row.original.name}</strong><small>{row.original.description || 'No description'}</small></div>
        </div>
      ),
    },
    { accessorKey: 'category_name', header: 'Category' },
    { accessorKey: 'price', header: 'Price', cell: ({ row }) => `₱${Number(row.original.price).toFixed(2)}` },
    {
      accessorKey: 'lifecycle_status',
      header: 'Status',
      cell: ({ row }) => <span className={`business-menu-status business-menu-status--${row.original.lifecycle_status}`}>{row.original.lifecycle_status}</span>,
    },
    {
      id: 'quantity',
      header: 'Daily quantity',
      cell: ({ row }) => row.original.daily_quantity === null ? 'Unlimited' : `${row.original.quantity_left} / ${row.original.daily_quantity}`,
    },
    {
      id: 'availability',
      header: 'Availability',
      cell: ({ row }) => canToggleAvailability && row.original.lifecycle_status !== 'archived' ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          aria-label={`${row.original.is_available ? 'Mark' : 'Make'} ${row.original.name} ${row.original.is_available ? 'unavailable' : 'available'}`}
          onClick={() => runAction(
            () => businessService.updateMenuAvailability(restaurantId, row.original.id, !row.original.is_available, user),
            `Availability changed for ${row.original.name}.`,
          )}
        >
          {row.original.is_available ? 'Available' : 'Sold out'}
        </Button>
      ) : <span>{row.original.is_available ? 'Available' : 'Sold out'}</span>,
    },
    ...(canManage ? [{
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => row.original.lifecycle_status === 'archived' ? null : (
        <div className="business-menu-row-actions">
          <Button variant="secondary" size="sm" onClick={() => startEditItem(row.original)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const input = document.getElementById(`menu-photo-${row.original.id}`);
            input?.click();
          }}>Photo</Button>
          <input
            id={`menu-photo-${row.original.id}`}
            className="business-menu-hidden-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={`Upload photo for ${row.original.name}`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              runAction(
                async () => businessService.uploadMenuPhoto(restaurantId, row.original.id, await compressMenuPhoto(file), user),
                `Photo updated for ${row.original.name}.`,
              );
              event.target.value = '';
            }}
          />
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => requestConfirmation({
            title: 'Archive menu item?',
            message: `${row.original.name} will no longer be visible or orderable. Past order snapshots are preserved.`,
            confirmLabel: 'Archive item',
            action: () => runAction(
              () => businessService.archiveMenuItem(restaurantId, row.original.id, user),
              `${row.original.name} archived.`,
            ),
          })}>Archive</Button>
        </div>
      ),
    }] : []),
  ], [canManage, canToggleAvailability, requestConfirmation, restaurantId, runAction, saving, selectedIds, startEditItem, toggleSelection, user]);

  // TanStack Table is required for this data-heavy view and is intentionally not compiler-memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: filteredItems, columns, getCoreRowModel: getCoreRowModel() });

  const uploadCertificate = async (event) => {
    event.preventDefault();
    if (!certificateFile) return;
    const response = await runAction(
      () => businessService.uploadHalalCertificate(restaurantId, certificateFile, certificateExpiry, user),
      'Halal certificate uploaded privately.',
    );
    if (response) {
      setCertificateFile(null);
      setCertificateExpiry('');
    }
  };

  const updateTag = (tagId, checked) => {
    setItemForm((current) => ({
      ...current,
      dietary_tag_ids: checked
        ? [...new Set([...(current.dietary_tag_ids || []), tagId])]
        : current.dietary_tag_ids.filter((id) => String(id) !== String(tagId)),
    }));
  };

  return (
    <div className="business-menu-page">
      {readOnly ? <p className="business-readonly" role="status">This restaurant is suspended. Menu changes are disabled.</p> : null}
      {error ? (
        <div className="business-error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" disabled={saving} onClick={loadMenu}>Try again</Button>
        </div>
      ) : null}
      {notice ? <p className="business-menu-notice" role="status">{notice}</p> : null}
      {loading ? <p className="business-loading" role="status">Loading menu…</p> : null}

      {!loading && menu ? (
        <>
          <section className="business-form-card business-menu-toolbar">
            <div>
              <h2>Menu items</h2>
              <p>Published items are orderable only when available and in stock.</p>
            </div>
            {canManage ? <Button onClick={startNewItem} disabled={readOnly || saving}>Add menu item</Button> : null}
          </section>

          {canManage ? (
            <section className="business-form-card">
              <h2>Categories</h2>
              <form className="business-menu-category-form" onSubmit={saveCategory}>
                <label>
                  Category name
                  <input value={categoryForm.name} maxLength="120" required onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label>
                  Display order
                  <input type="number" min="0" max="65535" value={categoryForm.sort_order} onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: Number(event.target.value) }))} />
                </label>
                <Button type="submit" variant="secondary" disabled={saving || readOnly}>{editingCategory ? 'Save category' : 'Add category'}</Button>
                {editingCategory ? <Button variant="ghost" onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', sort_order: 0 }); }}>Cancel edit</Button> : null}
              </form>
              {menu.categories.length ? (
                <ul className="business-menu-categories">
                  {menu.categories.map((category) => (
                    <li key={category.id}>
                      <span><strong>{category.name}</strong><small>{category.item_count} item(s) · {category.status}</small></span>
                      <div>
                        <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setEditingCategory(category); setCategoryForm({ name: category.name, sort_order: category.sort_order }); }}>Edit / reorder</Button>
                        {category.status === 'active' ? (
                          <Button variant="ghost" size="sm" disabled={saving} onClick={() => requestConfirmation({
                            title: 'Archive category?',
                            message: 'A category with published items cannot be archived. Archive or move those items first.',
                            confirmLabel: 'Archive category',
                            action: () => runAction(
                              () => businessService.archiveMenuCategory(restaurantId, category.id, user),
                              `${category.name} archived.`,
                            ),
                          })}>Archive</Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="business-menu-empty">Create a category before adding your first menu item.</p>}
            </section>
          ) : null}

          {canManage && !menu.halal_certificate_available ? (
            <section className="business-form-card">
              <h2>Halal certification</h2>
              <p>Upload a valid certificate privately before assigning the Halal-certified dietary tag.</p>
              <form className="business-menu-certificate-form" onSubmit={uploadCertificate}>
                <label>Certificate file (PDF, JPG, PNG, or WebP)
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={(event) => setCertificateFile(event.target.files?.[0] || null)} />
                </label>
                <label>Expiry date (optional)
                  <input type="date" value={certificateExpiry} onChange={(event) => setCertificateExpiry(event.target.value)} />
                </label>
                <Button type="submit" variant="secondary" disabled={!certificateFile || saving}>Upload certificate</Button>
              </form>
            </section>
          ) : null}

          <section className="business-form-card">
            <div className="business-menu-filters">
              <label>Search items
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or description" />
              </label>
              <label>Category
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">All categories</option>
                  {menu.categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.status})</option>)}
                </select>
              </label>
              <label>Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              {canManage ? <Button variant="secondary" disabled={selectedIds.length === 0 || saving} onClick={publishSelected}>Publish selected ({selectedIds.length})</Button> : null}
            </div>
            <div className="business-menu-table-wrap">
              <table className="business-menu-table">
                <thead>{table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>{headerGroup.headers.map((header) => (
                    <th key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}</tr>
                ))}</thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>{row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
              {!table.getRowModel().rows.length ? (
                <div className="business-menu-empty" role="status">
                  <strong>{menu.items.length ? 'No items match these filters.' : 'Your menu is empty.'}</strong>
                  <span>{menu.items.length ? 'Change the search or filters to see more items.' : 'Create a category, then add a draft item.'}</span>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      <Modal open={itemFormOpen} title={editingItem ? 'Edit menu item' : 'Add menu item'} onClose={() => !saving && setItemFormOpen(false)}>
        <form className="business-menu-item-form" onSubmit={submitItem}>
          <label>Category
            <select required value={itemForm.category_id || ''} onChange={(event) => setItemForm((current) => ({ ...current, category_id: event.target.value }))}>
              <option value="">Select category</option>
              {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>Item name
            <input required maxLength="160" value={itemForm.name || ''} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>Description
            <textarea rows="3" maxLength="5000" value={itemForm.description || ''} onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="business-menu-form-grid">
            <label>Price (₱)
              <input required type="number" min="0.01" step="0.01" value={itemForm.price || ''} onChange={(event) => setItemForm((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label>Daily quantity (blank = unlimited)
              <input type="number" min="1" step="1" value={itemForm.daily_quantity ?? ''} onChange={(event) => setItemForm((current) => ({ ...current, daily_quantity: event.target.value }))} />
            </label>
            <label>Preparation minutes (optional)
              <input type="number" min="1" max="1440" step="1" value={itemForm.prep_minutes ?? ''} onChange={(event) => setItemForm((current) => ({ ...current, prep_minutes: event.target.value }))} />
            </label>
            <label>Lifecycle
              <select value={itemForm.lifecycle_status || 'draft'} onChange={(event) => setItemForm((current) => ({ ...current, lifecycle_status: event.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>
          <label className="business-menu-checkbox">
            <input type="checkbox" checked={Boolean(itemForm.is_available)} onChange={(event) => setItemForm((current) => ({ ...current, is_available: event.target.checked }))} />
            Manually available
          </label>
          <fieldset>
            <legend>Dietary and allergen tags</legend>
            <div className="business-menu-tags">
              {(menu?.dietary_tags || []).map((tag) => {
                const disabled = tag.name === 'halal_certified' && !menu?.halal_certificate_available;
                return (
                  <label key={tag.id} className={disabled ? 'is-disabled' : ''}>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={(itemForm.dietary_tag_ids || []).some((id) => String(id) === String(tag.id))}
                      onChange={(event) => updateTag(tag.id, event.target.checked)}
                    />
                    {tagLabel(tag)}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label>Item photo (optional)
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setItemPhoto(event.target.files?.[0] || null)} />
          </label>
          <div className="business-form-actions">
            <Button type="button" variant="secondary" onClick={() => setItemFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || activeCategories.length === 0}>{saving ? 'Saving…' : 'Save item'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        busy={confirmBusy || saving}
        onCancel={() => !confirmBusy && setConfirm(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
