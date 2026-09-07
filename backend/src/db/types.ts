import type { Db } from './client';

/** Either the root database or a transaction handle — repositories accept both. */
export type DbExecutor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
