import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).meta({ description: '1-based page number' }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(20)
    .meta({ description: `Items per page (max ${MAX_PAGE_SIZE})` }),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const pageMetaSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .meta({ id: 'PageMeta' });

export type PageMeta = z.infer<typeof pageMetaSchema>;

export function toPageMeta(q: PaginationQuery, total: number): PageMeta {
  return {
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export function offsetOf(q: PaginationQuery): number {
  return (q.page - 1) * q.pageSize;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}
