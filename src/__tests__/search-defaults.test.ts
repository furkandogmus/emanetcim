import { describe, expect, it } from 'vitest';
import { defaultSearchStayWindow, SEARCH_TIMEZONE } from '@/lib/search-defaults';

/** Bir Date'in Europe/Istanbul duvar saatini "HH:mm" olarak döndürür. */
function istanbulHm(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SEARCH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

describe('unit: defaultSearchStayWindow', () => {
  it('bırakışı Europe/Istanbul saatiyle 10:00 verir (sunucu TZ ne olursa olsun)', () => {
    const { checkIn } = defaultSearchStayWindow();
    expect(istanbulHm(checkIn)).toBe('10:00');
  });

  it('alış, bırakıştan tam 24 saat sonrasıdır', () => {
    const { checkIn, checkOut } = defaultSearchStayWindow();
    expect(checkOut.getTime() - checkIn.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('bırakış gelecektedir', () => {
    const { checkIn } = defaultSearchStayWindow();
    expect(checkIn.getTime()).toBeGreaterThan(Date.now());
  });
});
