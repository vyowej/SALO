import { useState } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { ADMIN_COPY } from '../../constants/admin';

export function AdminDataTable({
  data,
  columns,
  search,
  onSearch,
  page = 1,
  lastPage = 1,
  onPageChange = () => {},
  caption,
  sorting,
  onSortingChange,
}) {
  const [localSearch, setLocalSearch] = useState('');
  const [localSorting, setLocalSorting] = useState([]);
  const searchValue = onSearch ? search : localSearch;
  const visibleData = onSearch
    ? data
    : data.filter((record) => JSON.stringify(record).toLocaleLowerCase().includes(localSearch.trim().toLocaleLowerCase()));
  const sortingValue = sorting || localSorting;
  const setSorting = onSortingChange || setLocalSorting;
  // TanStack's headless table instance is consumed directly by this renderer.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: visibleData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: sortingValue },
    onSortingChange: setSorting,
    manualPagination: true,
    manualSorting: Boolean(onSortingChange),
    enableMultiSort: false,
  });

  return (
    <section className="admin-table-card" aria-label={caption}>
      <div className="admin-table-card__toolbar">
        <label className="admin-search">
          <span className="sr-only">{ADMIN_COPY.searchRecords}</span>
          <input type="search" value={searchValue || ''} onChange={(event) => (onSearch ? onSearch(event.target.value) : setLocalSearch(event.target.value))} placeholder={ADMIN_COPY.searchPlaceholder} />
        </label>
      </div>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id} scope="col">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="admin-sort-button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`${String(header.column.columnDef.header)}${sorted ? `, ${sorted === 'asc' ? ADMIN_COPY.sortAsc : ADMIN_COPY.sortDesc}` : `, ${ADMIN_COPY.sortDefault}`}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ChevronUp aria-hidden="true" size={14} /> : sorted === 'desc' ? <ChevronDown aria-hidden="true" size={14} /> : <ChevronsUpDown aria-hidden="true" size={14} />}
                        </button>
                      ) : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            ))}
            {!visibleData.length ? <tr><td className="admin-table__empty" colSpan={columns.length}>{ADMIN_COPY.noResults}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <button type="button" className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{ADMIN_COPY.previous}</button>
        <span aria-live="polite">{ADMIN_COPY.pageOf.replace('{page}', page).replace('{total}', lastPage)}</span>
        <button type="button" className="btn btn--secondary btn--sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>{ADMIN_COPY.next}</button>
      </div>
    </section>
  );
}

export default AdminDataTable;
