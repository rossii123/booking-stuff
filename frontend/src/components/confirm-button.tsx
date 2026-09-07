'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui';

/** Two-click delete: the first click arms, the second confirms. Disarms after 4s. */
export function ConfirmButton({
  label,
  confirmLabel = 'Confirm delete',
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      variant={armed ? 'danger' : 'secondary'}
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
