import { Button } from './ui';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function Pagination({ meta, onPageChange }: { meta: PageMeta | undefined; onPageChange: (page: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const first = (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <p>
        Showing <span className="font-medium">{first}</span>–<span className="font-medium">{last}</span> of{' '}
        <span className="font-medium">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
          Previous
        </Button>
        <span>
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
