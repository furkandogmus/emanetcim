import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../services/BookingService';
import prisma from '@/lib/db';

vi.mock('@/lib/db', () => ({
  default: {
    shop: { findUnique: vi.fn() },
    booking: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/qr-token', () => ({
  createQrToken: vi.fn().mockResolvedValue('signed-jwt-token'),
}));

describe('BookingService', () => {
  const service = new BookingService();

  beforeEach(() => {
    vi.mocked(prisma.shop.findUnique).mockResolvedValue({
      id: 'shop-1',
      pricePerDay: 50,
    } as never);
    vi.mocked(prisma.booking.create).mockResolvedValue({
      id: 'booking-123',
      guestId: 'guest-1',
      shopId: 'shop-1',
      qrCodeToken: 'signed-jwt-token',
      status: 'PENDING',
    } as never);
  });

  it('should create a booking with signed QR token in a single atomic write', async () => {
    const result = await service.createInitialBooking({
      guestId: 'guest-1',
      shopId: 'shop-1',
      totalPrice: 100,
      bagCountS: 1,
      bagCountM: 0,
      bagCountXl: 0,
      checkInTime: new Date(),
      checkOutTime: new Date(),
    });

    // Real JWT is generated before the DB write and stored in a single create call.
    expect(result.qrCodeToken).toBe('signed-jwt-token');
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ qrCodeToken: 'signed-jwt-token' }) })
    );
    // No second update call — the token is set atomically at creation time.
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });
});
