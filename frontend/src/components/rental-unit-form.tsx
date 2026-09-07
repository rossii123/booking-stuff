'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api/client';
import type { CreateRentalUnit, RentalUnit } from '@/lib/api/types';
import { ApiErrorAlert } from './api-error-alert';
import { Button, Field, Input, Textarea } from './ui';

const optional = (max: number) => z.string().trim().max(max, 'Too long');

export const rentalUnitFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Too long'),
  description: optional(2000),
  addressLine1: optional(200),
  addressLine2: optional(200),
  city: optional(100),
  postalCode: optional(20),
  country: optional(100),
});

export type RentalUnitFormValues = z.infer<typeof rentalUnitFormSchema>;

export const emptyRentalUnit: RentalUnitFormValues = {
  name: '',
  description: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  country: '',
};

export function unitToFormValues(u: RentalUnit): RentalUnitFormValues {
  return {
    name: u.name,
    description: u.description ?? '',
    addressLine1: u.addressLine1 ?? '',
    addressLine2: u.addressLine2 ?? '',
    city: u.city ?? '',
    postalCode: u.postalCode ?? '',
    country: u.country ?? '',
  };
}

export function toRentalUnitPayload(v: RentalUnitFormValues): CreateRentalUnit {
  return {
    name: v.name,
    description: v.description || null,
    addressLine1: v.addressLine1 || null,
    addressLine2: v.addressLine2 || null,
    city: v.city || null,
    postalCode: v.postalCode || null,
    country: v.country || null,
  };
}

export function RentalUnitForm({
  defaultValues,
  onSubmit,
  submitLabel,
  isPending,
  serverError,
  onReload,
  readOnly,
}: {
  defaultValues?: RentalUnitFormValues;
  onSubmit: (values: RentalUnitFormValues) => void;
  submitLabel: string;
  isPending?: boolean;
  serverError?: unknown;
  onReload?: () => void;
  readOnly?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<RentalUnitFormValues>({
    resolver: zodResolver(rentalUnitFormSchema),
    defaultValues: defaultValues ?? emptyRentalUnit,
  });

  useEffect(() => {
    if (!(serverError instanceof ApiError)) return;
    for (const [field, message] of Object.entries(serverError.fieldErrors)) {
      if (field in emptyRentalUnit) setError(field as keyof RentalUnitFormValues, { message });
    }
  }, [serverError, setError]);

  const disabled = readOnly || isPending;
  const text = (id: keyof RentalUnitFormValues, label: string, hint?: string) => (
    <Field label={label} htmlFor={id} error={errors[id]?.message} hint={hint}>
      <Input id={id} disabled={disabled} aria-invalid={!!errors[id]} {...register(id)} />
    </Field>
  );

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

      {text('name', 'Name')}
      <Field label="Description" htmlFor="description" error={errors.description?.message} hint="Optional">
        <Textarea id="description" disabled={disabled} aria-invalid={!!errors.description} {...register('description')} />
      </Field>
      <fieldset className="space-y-5 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Address (optional)</legend>
        {text('addressLine1', 'Street')}
        {text('addressLine2', 'Street, line 2')}
        <div className="grid gap-5 sm:grid-cols-3">
          {text('postalCode', 'Postal code')}
          {text('city', 'City')}
          {text('country', 'Country')}
        </div>
      </fieldset>

      {!readOnly && (
        <div className="pt-1">
          <Button type="submit" disabled={isPending || (defaultValues !== undefined && !isDirty)}>
            {isPending ? 'Saving…' : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
