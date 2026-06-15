## Context

BagajPark currently books luggage storage as continuous datetime ranges (`checkInTime` → `checkOutTime`) with daily pricing (`pricePerDay * ceil(days)`). The capacity model is a flat sum of bags across all overlapping bookings against `shop.capacity`.

Competitors (LuggageHero, Bounce) use **time-slot granularity** — shops define bookable 30-minute blocks, each with its own bag capacity. Guests reserve specific slots (e.g., "2 bags at 09:00-09:30 plus 2 bags at 09:30-10:00"). Pricing is per-hour, not per-day. This 30-minute slot model serves the dominant use case: short 2-5 hour stays between hotel checkout and flight.

The current system's daily-ceil pricing makes short stays uneconomical (a 3-hour stay costs the same as 24 hours), and flat capacity creates false rejections (a shop at capacity at 10:00 blocks new bookings at 18:00 even if those slots are empty).

## Goals / Non-Goals

**Goals:**
- 30-minute bookable time slots per shop with independent capacity per slot
- Hourly pricing: `pricePerHour * hours * bagSizeMultiplier` replaces daily rounding
- Real-time availability grid: show how many bags are bookable in each slot
- Slot-based search: filter shops by per-slot availability across requested time range
- Migration path for existing bookings and shop data
- Both web (Next.js) and mobile (Flutter) support

**Non-Goals:**
- Dynamic/surge pricing based on demand (out of scope — static hourly rate per shop)
- Partial slot booking (e.g., 15 minutes within a 30-min slot) — minimum unit is 1 slot (30 min)
- Cross-shop slot pooling (each shop operates independently)
- Partner self-service slot editing in this change (admin-only config initially)

## Decisions

### Decision 1: 30-minute fixed slots per shop

Each shop has a `ShopTimeSlot` for every 30-minute block during its operating hours. Each slot has its own `capacity` (defaulting to the shop's overall capacity). This avoids continuous datetime range conflicts and enables simple "how many bags left at 14:30?" queries.

**Columns:**
```prisma
model ShopTimeSlot {
  id        String   @id @default(cuid())
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])
  startTime DateTime // 2026-06-15T09:00:00Z
  endTime   DateTime // 2026-06-15T09:30:00Z
  capacity  Int      // how many bags can be in this slot
  isActive  Boolean  @default(true)

  @@unique([shopId, startTime])
  @@index([shopId, startTime, endTime])
}
```
- Each daily operating window creates 2 * (operatingHours) slots per shop
- Slots are pre-generated for the next N days (configurable, default 30 days)
- A cron job fills new slots daily
- `capacity` can differ per slot (e.g., a shop might have 10 bags capacity 10:00-12:00 but only 5 bags during lunch 12:00-14:00)

**Alternative considered:** Dynamic time slots where guests pick any start/end time. Rejected because: (a) makes capacity math O(n²) — must check every minute against all overlapping bookings; (b) UX complexity for both guest and shop owner; (c) competitors use fixed slots.

### Decision 2: ReservationSlot links bookings to slots

```prisma
model ReservationSlot {
  id        String   @id @default(cuid())
  bookingId String
  booking   Booking  @relation(fields: [bookingId], references: [id])
  slotId    String
  slot      ShopTimeSlot @relation(fields: [slotId], references: [id])
  bagCount  Int      // bags reserved in this slot

  @@unique([bookingId, slotId])
  @@index([slotId])
}
```

Each booking reserves one or more `ReservationSlot` entries spanning its check-in to check-out time. A 2-hour booking (09:00-11:00) creates 4 ReservationSlot entries (09:00, 09:30, 10:00, 10:30). The `bagCount` per slot is the total bags from the booking.

Capacity check: `SUM(ReservationSlot.bagCount) WHERE slotId = X` ≤ `ShopTimeSlot.capacity`.

**Alternative considered:** Store slot references as an array on Booking (JSON). Rejected because: per-slot queries for availability require JOINs or array expansion anyway; ReservationSlot enables simple `GROUP BY slotId` with indexed lookups.

### Decision 3: pricePerHour replaces pricePerDay

```prisma
model Shop {
  pricePerHour  Decimal   @default(50) // was pricePerDay
  pricePerDay   Decimal   @default(50) // DEPRECATED, kept for migration period
}
```

Formula: `totalPrice = hourlyRate * numberOfSlots * bagSizeMultiplier`

Bag size multipliers remain: S=0.8, M=1.0, XL=1.5.

A 2-hour stay (4 slots) with 2 M-size bags at 50 TRY/hour:
```
= 50 * 4 * 1.0 + 50 * 4 * 1.0
= 400 TRY (both bags, 4 slots each)
```

For multi-size bookings, each bag size's slot cost is summed.

**Alternative considered:** Per-slot pricing (different prices for peak vs off-peak). Rejected for v1 — adds complexity without proven demand in Turkish market. Can layer on top later.

### Decision 4: Availability calculation

```typescript
function getSlotAvailability(shopId, from, to): SlotAvailability[] {
  const slots = await prisma.shopTimeSlot.findMany({
    where: { shopId, startTime: { gte: from }, endTime: { lte: to }, isActive: true }
  });

  const reservations = await prisma.reservationSlot.groupBy({
    by: ['slotId'],
    where: { slotId: { in: slots.map(s => s.id) } },
    _sum: { bagCount: true }
  });

  return slots.map(slot => ({
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    reserved: reservations.find(r => r.slotId === slot.id)?._sum.bagCount ?? 0,
    available: slot.capacity - (reservations.find(r => r.slotId === slot.id)?._sum.bagCount ?? 0),
    isBookable: reservation count filter applies (only PAID/CHECKED_IN + recent pending)
  }));
}
```

The availability is computed as a simple per-slot count, filtered to only active reservation statuses (PAID, CHECKED_IN, APPROVED, and PENDING within last 24h). This is a significant simplification from the current overlapping-date-range capacity check — we just count reservations per slot.

### Decision 5: Migration strategy

**Phase 1 — Schema migration (no downtime):**
- Add `ShopTimeSlot`, `ReservationSlot`, `Shop.pricePerHour` columns
- Create migration script that:
  1. Sets `pricePerHour = pricePerDay / 24` for all shops
  2. Generates `ShopTimeSlot` entries for each shop's operating hours for the next 30 days
  3. Converts existing active bookings (PAID, CHECKED_IN, APPROVED) into `ReservationSlot` entries
- Keep `checkInTime`/`checkOutTime` on Booking as computed/derived fields

**Phase 2 — New code deploys:**
- Search and checkout use slot-based queries
- Booking creation uses slot reservation
- Old booking views still work (they read checkInTime/checkOutTime from first/last slot)

**Phase 3 — Cleanup (future):**
- Remove `checkInTime`/`checkOutTime` from Booking (replace with computed fields)
- Remove `pricePerDay` from Shop

## Risks / Trade-offs

- **[Data volume]** 30 days × 2 slots/hour × 14 hours/day × 100 shops = 84,000 ShopTimeSlot rows. Acceptable for PostgreSQL with compound index `[shopId, startTime]`. Prune old inactive slots daily.
- **[Slot boundary UX]** If a guest needs 09:00-10:00 but arrives at 09:15, they've already "used" one slot. Consider a 15-min grace period in check-in logic (separate from slot booking).
- **[Race conditions]** Two guests trying to book the same slot simultaneously. Solved by SERIALIZABLE transactions on slot reservation (already used in current `assertCapacityTx`).
- **[Shop capacity changes]** If shop owner changes capacity mid-day, already-booked slots are unaffected (capacity only affects new reservations).
- **[Time zone]** All slot times stored as UTC. UI converts to shop's local timezone. Shop must have a `timezone` field.

## Open Questions (Resolved via Bounce.com Analysis)

- **Per-slot capacity variance?** Bounce doesn't expose this to customers. Decision: Uniform shop capacity across all slots initially. Admin can adjust per-slot later but MVP uses `shop.capacity` as default for every slot.
- **Maximum advance booking?** Bounce allows weeks ahead via date picker. Decision: 30 days (matches existing `maxStayDays`).
- **Buffer time between bookings?** Neither Bounce nor competitors use this. Decision: No buffer — the 30-min slot IS the buffer.
- **Pricing model?** Bounce charges daily rate (not hourly). LuggageHero does hourly. Decision: **Hybrid** — base pricing is daily, but prorate for partial-day stays: `pricePerDay × max(1, ceil(slotCount / 48))`. Full day = 48 slots. 3-hour stay = 6 slots = charged as 1 day. 26-hour stay = 52 slots = charged as 2 days.
- **Free cancellation?** Bounce offers free cancellation before drop-off. Decision: Add free cancellation window (up to 1 hour before check-in).
