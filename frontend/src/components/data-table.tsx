import type { ReactNode } from 'react';
import { cx, EmptyState, Spinner } from './ui';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyTitle = 'Nothing here yet',
  emptyHint,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyHint?: ReactNode;
}) {
  if (isLoading && !rows) return <Spinner />;
  if (!rows || rows.length === 0) return <EmptyState title={emptyTitle}>{emptyHint}</EmptyState>;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx('px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cx('divide-y divide-slate-100', isLoading && 'opacity-60')}>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-slate-50/70">
              {columns.map((c) => (
                <td key={c.key} className={cx('px-4 py-3 text-slate-800', c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
