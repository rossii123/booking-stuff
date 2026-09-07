import type { components, paths } from './schema';

type Schemas = components['schemas'];

export type RentalUnit = Schemas['RentalUnit'];
export type CreateRentalUnit = Schemas['CreateRentalUnit'];
export type UpdateRentalUnit = Schemas['UpdateRentalUnit'];
export type Reservation = Schemas['Reservation'];
export type CreateReservation = Schemas['CreateReservation'];
export type UpdateReservation = Schemas['UpdateReservation'];
export type Revision = Schemas['Revision'];
export type PageMeta = Schemas['PageMeta'];
export type User = Schemas['User'];

export type RentalUnitsQuery = NonNullable<paths['/v1/rental-units']['get']['parameters']['query']>;
export type ReservationsQuery = NonNullable<paths['/v1/reservations']['get']['parameters']['query']>;
export type UnitReservationsQuery = NonNullable<
  paths['/v1/rental-units/{id}/reservations']['get']['parameters']['query']
>;
export type ReservationSort = NonNullable<ReservationsQuery['sort']>;
