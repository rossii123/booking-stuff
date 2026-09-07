'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ok } from './client';
import type {
  CreateRentalUnit,
  CreateReservation,
  RentalUnitsQuery,
  ReservationsQuery,
  UnitReservationsQuery,
  UpdateRentalUnit,
  UpdateReservation,
} from './types';

/**
 * Query keys are hierarchical so one invalidation covers every view of an
 * entity: writing a reservation invalidates `reservations.all` AND
 * `units.all` (a unit page embeds its reservations).
 */
export const keys = {
  units: {
    all: ['rental-units'] as const,
    list: (q: RentalUnitsQuery) => ['rental-units', 'list', q] as const,
    detail: (id: string) => ['rental-units', 'detail', id] as const,
    history: (id: string) => ['rental-units', 'detail', id, 'history'] as const,
    reservations: (id: string, q: UnitReservationsQuery) =>
      ['rental-units', 'detail', id, 'reservations', q] as const,
  },
  reservations: {
    all: ['reservations'] as const,
    list: (q: ReservationsQuery) => ['reservations', 'list', q] as const,
    detail: (id: string) => ['reservations', 'detail', id] as const,
    history: (id: string) => ['reservations', 'detail', id, 'history'] as const,
  },
};

/* ---------------- rental units ---------------- */

export function useRentalUnits(query: RentalUnitsQuery = {}) {
  return useQuery({
    queryKey: keys.units.list(query),
    queryFn: async () => ok(await api.GET('/v1/rental-units', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

/** For dropdowns: first 100 units by name. Good enough for a single host's portfolio. */
export function useAllRentalUnits() {
  return useRentalUnits({ pageSize: 100 });
}

export function useRentalUnit(id: string) {
  return useQuery({
    queryKey: keys.units.detail(id),
    queryFn: async () => ok(await api.GET('/v1/rental-units/{id}', { params: { path: { id } } })).data,
  });
}

export function useRentalUnitHistory(id: string) {
  return useQuery({
    queryKey: keys.units.history(id),
    queryFn: async () =>
      ok(await api.GET('/v1/rental-units/{id}/history', { params: { path: { id } } })).data,
  });
}

export function useUnitReservations(id: string, query: UnitReservationsQuery = {}) {
  return useQuery({
    queryKey: keys.units.reservations(id, query),
    queryFn: async () =>
      ok(await api.GET('/v1/rental-units/{id}/reservations', { params: { path: { id }, query } })),
    placeholderData: keepPreviousData,
  });
}

export function useCreateRentalUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRentalUnit) => ok(await api.POST('/v1/rental-units', { body })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.units.all }),
  });
}

export function useUpdateRentalUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateRentalUnit }) =>
      ok(await api.PATCH('/v1/rental-units/{id}', { params: { path: { id } }, body })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.units.all });
      void qc.invalidateQueries({ queryKey: keys.reservations.all }); // unit name is denormalised
    },
  });
}

export function useDeleteRentalUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      ok(await api.DELETE('/v1/rental-units/{id}', { params: { path: { id } } }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.units.all }),
  });
}

/* ---------------- reservations ---------------- */

export function useReservations(query: ReservationsQuery = {}) {
  return useQuery({
    queryKey: keys.reservations.list(query),
    queryFn: async () => ok(await api.GET('/v1/reservations', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: keys.reservations.detail(id),
    queryFn: async () => ok(await api.GET('/v1/reservations/{id}', { params: { path: { id } } })).data,
  });
}

export function useReservationHistory(id: string) {
  return useQuery({
    queryKey: keys.reservations.history(id),
    queryFn: async () =>
      ok(await api.GET('/v1/reservations/{id}/history', { params: { path: { id } } })).data,
  });
}

function invalidateReservations(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: keys.reservations.all });
  void qc.invalidateQueries({ queryKey: keys.units.all });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReservation) => ok(await api.POST('/v1/reservations', { body })).data,
    onSuccess: () => invalidateReservations(qc),
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateReservation }) =>
      ok(await api.PATCH('/v1/reservations/{id}', { params: { path: { id } }, body })).data,
    onSuccess: () => invalidateReservations(qc),
  });
}

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      ok(await api.DELETE('/v1/reservations/{id}', { params: { path: { id } } }));
    },
    onSuccess: () => invalidateReservations(qc),
  });
}
