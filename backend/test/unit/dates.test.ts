import { describe, expect, it } from 'vitest';
import { isoDate, nightsBetween, rangesOverlap } from '../../src/lib/dates';

describe('isoDate', () => {
  it('accepts valid calendar dates', () => {
    expect(isoDate.parse('2024-02-29')).toBe('2024-02-29');
  });
  it.each(['2024-13-01', '2023-02-29', '2024-7-1', '20240701', 'tomorrow'])(
    'rejects %s',
    (value) => {
      expect(isoDate.safeParse(value).success).toBe(false);
    },
  );
});

describe('nightsBetween', () => {
  it('counts nights for a half-open stay', () => {
    expect(nightsBetween('2024-07-01', '2024-07-05')).toBe(4);
    expect(nightsBetween('2024-12-31', '2025-01-01')).toBe(1);
  });
});

describe('rangesOverlap', () => {
  it('detects intersecting stays', () => {
    expect(rangesOverlap('2024-07-01', '2024-07-05', '2024-07-03', '2024-07-08')).toBe(true);
    expect(rangesOverlap('2024-07-03', '2024-07-04', '2024-07-01', '2024-07-05')).toBe(true);
  });
  it('treats back-to-back stays as non-overlapping', () => {
    expect(rangesOverlap('2024-07-01', '2024-07-05', '2024-07-05', '2024-07-09')).toBe(false);
    expect(rangesOverlap('2024-07-05', '2024-07-09', '2024-07-01', '2024-07-05')).toBe(false);
  });
});
