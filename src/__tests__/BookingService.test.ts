import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../services/BookingService';
import prisma from '@/lib/db';

vi.mock('@/lib/db', () => ({
  default: {
    shop: { findUnique: vi.fn() },
    booking: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
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
      capacity: 100,
    } as never);
    vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
    vi.mocked(prisma.booking.create).mockResolvedValue({
      id: 'booking-123',
      guestId: 'guest-1',
      shopId: 'shop-1',
      qrCodeToken: 'temp_x',
      status: 'PENDING',
    } as never);
    vi.mocked(prisma.booking.update).mockResolvedValue({
      id: 'booking-123',
      qrCodeToken: 'signed-jwt-token',
    } as never);
  });

  it('should create a booking with signed QR token', async () => {
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

    expect(result.qrCodeToken).toBe('signed-jwt-token');
    expect(prisma.booking.create).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalled();
  });
});
