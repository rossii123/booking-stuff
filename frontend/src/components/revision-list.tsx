import type { Revision } from '@/lib/api/types';
import { ApiErrorAlert } from './api-error-alert';
import { Badge, Spinner, formatDateTime } from './ui';

const HIDDEN = new Set(['id', 'version', 'createdAt', 'updatedAt', 'rentalUnitId', 'nights']);

/** Shows what each record looked like *before* a change, newest first. */
export function RevisionList({
  revisions,
  isLoading,
  error,
}: {
  revisions: Revision[] | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (error) return <ApiErrorAlert error={error} />;
  if (isLoading) return <Spinner />;
  if (!revisions || revisions.length === 0) {
    return <p className="text-sm text-slate-500">No changes yet. The record is still in its original state.</p>;
  }
  return (
    <ol className="space-y-3">
      {revisions.map((rev) => (
        <li key={rev.version} className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-slate-600">
            <Badge tone={rev.changeType === 'delete' ? 'warning' : 'info'}>
              {rev.changeType === 'delete' ? 'deleted' : `v${rev.version} → v${rev.version + 1}`}
            </Badge>
            <span>{formatDateTime(rev.changedAt)}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-slate-700">
            {Object.entries(rev.snapshot)
              .filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== '')
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate font-mono text-xs">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}
