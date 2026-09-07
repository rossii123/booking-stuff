'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api/client';
import type { CreateReservation, RentalUnit } from '@/lib/api/types';
import { ApiErrorAlert } from './api-error-alert';
import { Button, Field, Input, Select, Textarea } from './ui';

/**
 * Client-side schema mirrors the API's rules so most mistakes are caught before
 * a round trip; the API remains the authority and its field errors are mapped
 * back onto the form when they do occur.
 */
export const reservationFormSchema = z
  .object({
    rentalUnitId: z.string().min(1, 'Choose a rental unit'),
    guestName: z.string().trim().min(1, 'Guest name is required').max(200, 'Too long'),
    guestEmail: z.union([z.literal(''), z.email('Enter a valid email')]),
    guestCount: z.number({ error: 'Enter a number' }).int('Whole numbers only').min(1, 'At least 1 guest').max(50, 'At most 50 guests'),
    checkIn: z.string().min(1, 'Check-in date is required'),
    checkOut: z.string().min(1, 'Check-out date is required'),
    notes: z.string().trim().max(2000, 'Too long'),
  })
  .refine((v) => !v.checkIn || !v.checkOut || v.checkOut > v.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });

export type ReservationFormValues = z.infer<typeof reservationFormSchema>;

export const emptyReservation: ReservationFormValues = {
  rentalUnitId: '',
  guestName: '',
  guestEmail: '',
  guestCount: 1,
  checkIn: '',
  checkOut: '',
  notes: '',
};

export function toReservationPayload(v: ReservationFormValues): CreateReservation {
  return {
    rentalUnitId: v.rentalUnitId,
    guestName: v.guestName,
    guestEmail: v.guestEmail || null,
    guestCount: v.guestCount,
    checkIn: v.checkIn,
    checkOut: v.checkOut,
    notes: v.notes || null,
  };
}

export function ReservationForm({
  units,
  defaultValues,
  onSubmit,
  submitLabel,
  isPending,
  serverError,
  onReload,
  readOnly,
}: {
  units: RentalUnit[];
  defaultValues?: ReservationFormValues;
  onSubmit: (values: ReservationFormValues) => void;
  submitLabel: string;
  isPending?: boolean;
  serverError?: unknown;
  /** Shown when the server reports a version conflict. */
  onReload?: () => void;
  readOnly?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues: defaultValues ?? emptyReservation,
  });

  // Map API-side validation / conflict errors onto fields.
  useEffect(() => {
    if (!(serverError instanceof ApiError)) return;
    for (const [field, message] of Object.entries(serverError.fieldErrors)) {
      if (field in emptyReservation) setError(field as keyof ReservationFormValues, { message });
    }
    if (serverError.code === 'RESERVATION_OVERLAP') {
      setError('checkIn', { message: 'Overlaps an existing reservation for this unit' });
      setError('checkOut', { message: 'Overlaps an existing reservation for this unit' });
    }
    if (serverError.code === 'INVALID_DATE_RANGE') {
      setError('checkOut', { message: 'Check-out must be after check-in' });
    }
  }, [serverError, setError]);

  const disabled = readOnly || isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError ? (
        <ApiErrorAlert
          error={serverError}
          action={
            serverError instanceof ApiError && serverError.code === 'VERSION_CONFLICT' && onReload ? (
              <Button variant="secondary" onClick={onReload}>
                Reload
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <Field label="Rental unit" htmlFor="rentalUnitId" error={errors.rentalUnitId?.message}>
        <Select id="rentalUnitId" disabled={disabled} aria-invalid={!!errors.rentalUnitId} {...register('rentalUnitId')}>
          <option value="">Select a unit…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.city ? ` — ${u.city}` : ''}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Check-in" htmlFor="checkIn" error={errors.checkIn?.message}>
          <Input id="checkIn" type="date" disabled={disabled} aria-invalid={!!errors.checkIn} {...register('checkIn')} />
        </Field>
        <Field
          label="Check-out"
          htmlFor="checkOut"
          error={errors.checkOut?.message}
          hint="The day the guest leaves. Back-to-back stays on the same day are allowed."
        >
          <Input id="checkOut" type="date" disabled={disabled} aria-invalid={!!errors.checkOut} {...register('checkOut')} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_8rem]">
        <Field label="Guest name" htmlFor="guestName" error={errors.guestName?.message}>
          <Input id="guestName" autoComplete="off" disabled={disabled} aria-invalid={!!errors.guestName} {...register('guestName')} />
        </Field>
        <Field label="Guest email" htmlFor="guestEmail" error={errors.guestEmail?.message} hint="Optional">
          <Input id="guestEmail" type="email" disabled={disabled} aria-invalid={!!errors.guestEmail} {...register('guestEmail')} />
        </Field>
        <Field label="Guests" htmlFor="guestCount" error={errors.guestCount?.message}>
          <Input
            id="guestCount"
            type="number"
            min={1}
            max={50}
            disabled={disabled}
            aria-invalid={!!errors.guestCount}
            {...register('guestCount', { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={errors.notes?.message} hint="Optional — arrival time, special requests…">
        <Textarea id="notes" disabled={disabled} aria-invalid={!!errors.notes} {...register('notes')} />
      </Field>

      {!readOnly && (
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isPending || (defaultValues !== undefined && !isDirty)}>
            {isPending ? 'Saving…' : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
