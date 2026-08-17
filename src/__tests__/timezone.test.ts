import { describe, expect, it } from 'vitest';
import { zoneOffsetMinutes, zonedWallClockToUtc } from '@/lib/timezone';

function hmIn(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

describe('unit: timezone', () => {
  it('Europe/Istanbul için +180 dakika döndürür', () => {
    expect(zoneOffsetMinutes(new Date('2026-06-15T00:00:00Z'), 'Europe/Istanbul')).toBe(180);
    // İstanbul 2016'dan beri DST uygulamıyor: kışın da +03:00.
    expect(zoneOffsetMinutes(new Date('2026-01-15T00:00:00Z'), 'Europe/Istanbul')).toBe(180);
  });

  it('dükkan duvar saatini doğru UTC anına çevirir', () => {
    const utc = zonedWallClockToUtc(2026, 6, 15, 9, 0, 'Europe/Istanbul');
    expect(utc.toISOString()).toBe('2026-06-15T06:00:00.000Z');
    expect(hmIn(utc, 'Europe/Istanbul')).toBe('09:00');
  });

  it('sunucu saat diliminden bağımsızdır', () => {
    const utc = zonedWallClockToUtc(2026, 6, 15, 9, 30, 'Europe/Istanbul');
    // Hangi dilimde çalışırsak çalışalım, İstanbul duvar saati 09:30 olmalı.
    expect(hmIn(utc, 'Europe/Istanbul')).toBe('09:30');
  });

  it('DST uygulayan dilimlerde yaz/kış farkını dikkate alır', () => {
    const summer = zonedWallClockToUtc(2026, 7, 15, 12, 0, 'Europe/Berlin');
    const winter = zonedWallClockToUtc(2026, 1, 15, 12, 0, 'Europe/Berlin');
    expect(hmIn(summer, 'Europe/Berlin')).toBe('12:00');
    expect(hmIn(winter, 'Europe/Berlin')).toBe('12:00');
    // Yaz UTC+2, kış UTC+1 → UTC karşılıkları farklı olmalı.
    expect(summer.toISOString()).toBe('2026-07-15T10:00:00.000Z');
    expect(winter.toISOString()).toBe('2026-01-15T11:00:00.000Z');
  });
});
