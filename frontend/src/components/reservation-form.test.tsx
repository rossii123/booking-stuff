import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { RentalUnit } from '@/lib/api/types';
import { ReservationForm, toReservationPayload } from './reservation-form';

const units: RentalUnit[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Sunny loft',
    description: null,
    addressLine1: null,
    addressLine2: null,
    city: 'Stockholm',
    postalCode: null,
    country: null,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Rental unit'), units[0].id);
  await user.type(screen.getByLabelText('Check-in'), '2024-07-01');
  await user.type(screen.getByLabelText('Check-out'), '2024-07-05');
  await user.type(screen.getByLabelText('Guest name'), 'Ada Lovelace');
}

describe('ReservationForm', () => {
  it('blocks submission and shows field errors when required fields are missing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReservationForm units={units} onSubmit={onSubmit} submitLabel="Create" />);

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Choose a rental unit')).toBeInTheDocument();
    expect(screen.getByText('Guest name is required')).toBeInTheDocument();
    expect(screen.getByText('Check-in date is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a check-out that is not after check-in', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReservationForm units={units} onSubmit={onSubmit} submitLabel="Create" />);

    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Check-out'));
    await user.type(screen.getByLabelText('Check-out'), '2024-07-01');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Check-out must be after check-in')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits typed values that convert to the API payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReservationForm units={units} onSubmit={onSubmit} submitLabel="Create" />);

    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Guests'));
    await user.type(screen.getByLabelText('Guests'), '3');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0];
    expect(toReservationPayload(values)).toEqual({
      rentalUnitId: units[0].id,
      guestName: 'Ada Lovelace',
      guestEmail: null,
      guestCount: 3,
      checkIn: '2024-07-01',
      checkOut: '2024-07-05',
      notes: null,
    });
  });

  it('surfaces a 409 overlap from the API on the date fields', () => {
    const overlap = new ApiError(409, 'RESERVATION_OVERLAP', 'The rental unit already has a reservation');
    render(<ReservationForm units={units} onSubmit={vi.fn()} submitLabel="Create" serverError={overlap} />);

    expect(screen.getByText('Those nights are already booked')).toBeInTheDocument();
    expect(screen.getAllByText('Overlaps an existing reservation for this unit')).toHaveLength(2);
  });

  it('maps server-side validation details to the matching field', () => {
    const invalid = new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      { path: 'body.guestEmail', message: 'Invalid email address' },
    ]);
    render(<ReservationForm units={units} onSubmit={vi.fn()} submitLabel="Create" serverError={invalid} />);
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('offers a reload action on a version conflict', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const conflict = new ApiError(409, 'VERSION_CONFLICT', 'Modified elsewhere');
    render(
      <ReservationForm units={units} onSubmit={vi.fn()} submitLabel="Save" serverError={conflict} onReload={onReload} />,
    );
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
  });

  it('renders read-only for viewers', () => {
    render(<ReservationForm units={units} onSubmit={vi.fn()} submitLabel="Save" readOnly />);
    expect(screen.getByLabelText('Guest name')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
