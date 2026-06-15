## 1. Database Schema & Migration

- [ ] 1.1 Add `ShopTimeSlot` model to `prisma/schema.prisma` with fields: id, shopId, startTime, endTime, capacity, isActive
- [ ] 1.2 Add `ReservationSlot` model to `prisma/schema.prisma` with fields: id, bookingId, slotId, bagCount
- [ ] 1.3 Add `pricePerHour` (Decimal, default 50) and `timezone` (String, default "Europe/Istanbul") fields to `Shop` model
- [ ] 1.4 Add `ShopTimeSlot` and `ReservationSlot` relations to `Booking` model (update checkInTime/checkOutTime as derived)
- [ ] 1.5 Create Prisma migration (`npx prisma migrate dev --name add_time_slots`)
- [ ] 1.6 Write migration script to generate ShopTimeSlot entries for existing shops (next 30 days, 30-min blocks)
- [ ] 1.7 Write migration script to convert existing active bookings (PAID/CHECKED_IN/APPROVED) to ReservationSlot entries
- [ ] 1.8 Write migration script to set `pricePerHour = ceil(pricePerDay / 24)` for all existing shops
- [ ] 1.9 Add Prisma `@@unique([shopId, startTime])` constraint on ShopTimeSlot
- [ ] 1.10 Add Prisma `@@unique([bookingId, slotId])` constraint on ReservationSlot

## 2. Slot Generation Service

- [ ] 2.1 Create `src/services/SlotService.ts` with `generateSlotsForShop(shopId, daysForward)`
- [ ] 2.2 Implement slot generation: split shop operating hours (open247 or openingTime-closingTime) into 30-min blocks
- [ ] 2.3 Add `fillMissingSlots()` — idempotent: only create slots that don't exist yet, skip existing ones
- [ ] 2.4 Add `updateSlotCapacity(slotId, newCapacity)` — change capacity for a specific slot without affecting reservations
- [ ] 2.5 Create `src/app/api/internal/generate-slots/route.ts` cron endpoint to daily append new slots
- [ ] 2.6 Add cron trigger in `src/app/api/internal/` (extend existing cron setup or vercel.json)

## 3. Slot Availability API

- [ ] 3.1 Create `GET /api/mobile/shops/[id]/slots` endpoint returning slot array with capacity/reserved/available
- [ ] 3.2 Implement availability calculation: group ReservationSlot by slotId, filter by active statuses only
- [ ] 3.3 Add `minBags` query parameter to filter `isBookable` flag
- [ ] 3.4 Add `Cache-Control: max-age=30` header with cache invalidation on booking creation
- [ ] 3.5 Create `GET /api/shops/[id]/slots` web endpoint (same logic, different auth)
- [ ] 3.6 Add OpenAPI/doc comments to slot endpoints

## 4. Slot-Based Booking Creation

- [ ] 4.1 Refactor `BookingService.createInitialBooking()` to accept `slotIds[]` instead of `checkInTime`/`checkOutTime`
- [ ] 4.2 Implement slot capacity check: for each slotId, verify `SUM(ReservationSlot.bagCount) + newBags ≤ ShopTimeSlot.capacity`
- [ ] 4.3 Create `ReservationSlot` entries during booking creation inside SERIALIZABLE transaction
- [ ] 4.4 Derive `checkInTime` from earliest slot startTime, `checkOutTime` from latest slot endTime
- [ ] 4.5 Update `assertCapacityTx()` to use slot-based capacity logic (remove overlapping-date-range check)
- [ ] 4.6 Update `createBookingAction` server action to accept slotIds from client
- [ ] 4.7 Update mobile `/api/mobile/checkout/intent` to accept slotIds

## 5. Booking Modification & Cancellation

- [ ] 5.1 Refactor `BookingService.modifyBooking()` for slot-based changes (add/remove ReservationSlot entries)
- [ ] 5.2 Re-validate capacity for only new/changed slots during modification
- [ ] 5.3 Update `BookingService.cancelBooking()` to bulk-delete ReservationSlot entries for the booking
- [ ] 5.4 Refactor checkIn/checkOut to reference slot times for validation
- [ ] 5.5 Update all BookingEvent records to include slot range context

## 6. Hourly Pricing Engine

- [ ] 6.1 Update `src/lib/bag-pricing.ts`: replace `computeServiceTotalForStay(ceil(days))` with `computeSlotTotal(slotCount, pricePerHour, bagCounts)`
- [ ] 6.2 Formula: `total = slotCount * pricePerHour * sum(bagCount[size] * bagMultiplier[size])`
- [ ] 6.3 Update `src/lib/booking-server-price.ts`: `computeAuthoritativeCheckoutTotals()` uses slot count instead of ceil(days)
- [ ] 6.4 Remove or deprecate `computeStayDaysFromWindow()` (replaced by slot count)
- [ ] 6.5 Update `PlatformSettings` defaults: add `minSlots=1`, `maxSlots=1440` (30 days), remove `maxBagsPerSlot`
- [ ] 6.6 Update bag-pricing tests in `src/__tests__/currency.test.ts`

## 7. Slot-Based Search

- [ ] 7.1 Refactor `ShopService.findShopsForSearch()` to use slot availability instead of flat capacity
- [ ] 7.2 For each shop, query all ShopTimeSlot rows in the requested date range, then check per-slot availability
- [ ] 7.3 Filter shops where min available bags across all requested slots ≥ requestedBags
- [ ] 7.4 Include `pricePerHour` in search result DTO (`ShopSearchHit`)
- [ ] 7.5 Add "sort by hourly price" sort option alongside existing distance/rating sorts
- [ ] 7.6 Update `refreshSearchShopsAction` to pass time-slot range params
- [ ] 7.7 Update mobile `/api/mobile/shops/nearby` for slot-based filtering

## 8. Web UI — Slot Availability Grid

- [ ] 8.1 Create `src/components/guest/SlotAvailabilityGrid.tsx` component
- [ ] 8.2 Implement mobile version: horizontal scrollable row of 30-min slot chips with capacity indicators
- [ ] 8.3 Implement desktop version: multi-row grid (24h × slots) with drag-to-select
- [ ] 8.4 Color-code slots: green (≥ 5 available), yellow (1-4), red (0), grey (outside hours / inactive)
- [ ] 8.5 Add tap-to-set-check-in, scroll/tap-to-set-check-out interaction
- [ ] 8.6 Disable slots that lack capacity for selected bag count
- [ ] 8.7 Show slot selection summary: "10:00 → 13:30 (7 slots, 3.5 hours)"

## 9. Web UI — Checkout Integration

- [ ] 9.1 Replace DateTimePicker in CheckoutClient step 1 with SlotAvailabilityGrid
- [ ] 9.2 Update bag selector to show per-slot cost: "₺40/saat × 7 slot = ₺280 (M bagaj)"
- [ ] 9.3 Update pricing summary: slotCount × pricePerHour × bagMultipliers + insuranceFee
- [ ] 9.4 Update draft save/restore for slot selection (localStorage `bagajpark_checkout_draft_*`)
- [ ] 9.5 Pass `slotIds[]` instead of `checkInLocal`/`checkOutLocal` to booking creation action
- [ ] 9.6 Add "selected slots became unavailable" error handling with slot re-selection prompt

## 10. Web UI — Search Integration

- [ ] 10.1 Update SearchClient to show `pricePerHour` in shop cards: "₺50/saat"
- [ ] 10.2 Update estimated price display in search list: slotCount × pricePerHour × requestedBags × bagMultiplier
- [ ] 10.3 Update `ShopListItem` to show "X bagaj müsait" from slot-based availability
- [ ] 10.4 Add "sort by hourly rate" option to sort dropdown
- [ ] 10.5 Update search filter panel to include time range selection alongside current date/time pickers

## 11. Web UI — Booking Detail

- [ ] 11.1 Create slot timeline view in booking detail page: chronological slot blocks with bag counts
- [ ] 11.2 Show per-slot occupancy alongside other bookings for partner dashboard
- [ ] 11.3 Update booking detail to derive checkIn/checkOut from slot range

## 12. Flutter Mobile App

- [ ] 12.1 Create `SlotAvailabilityGrid` widget in `mobile/lib/shared/widgets/`
- [ ] 12.2 Integrate slot grid into `checkout_screen.dart` replacing current date/time pickers
- [ ] 12.3 Update `checkout_screen.dart` to POST slotIds to `/api/mobile/checkout/intent`
- [ ] 12.4 Update bag selector to show per-slot pricing
- [ ] 12.5 Update `search_screen.dart` to display `pricePerHour` and slot-based availability
- [ ] 12.6 Update `booking_detail_screen.dart` to show slot timeline
- [ ] 12.7 Create Flutter slot data models in `mobile/lib/shared/models/`

## 13. Admin & Partner Panel

- [ ] 13.1 Add per-slot capacity management UI in admin partner edit page
- [ ] 13.2 Allow partners to set different capacities for specific time windows
- [ ] 13.3 Add slot occupancy view to partner booking dashboard
- [ ] 13.4 Add `pricePerHour` field to partner settings / admin shop edit

## 14. Testing

- [ ] 14.1 Unit test: slot generation for 24/7 shop produces 48 slots/day
- [ ] 14.2 Unit test: slot generation for 09:00-18:00 shop produces 18 slots/day
- [ ] 14.3 Unit test: capacity check rejects booking when any slot is full
- [ ] 14.4 Unit test: concurrent slot booking serialized correctly
- [ ] 14.5 Unit test: hourly pricing formula (`slotCount × pricePerHour × bagMultiplier`)
- [ ] 14.6 Unit test: booking modification adds/removes correct ReservationSlot entries
- [ ] 14.7 Unit test: booking cancellation releases all slots
- [ ] 14.8 Integration test: end-to-end slot booking flow (search → checkout → confirm → cancel)
- [ ] 14.9 Integration test: migration script correctly converts existing bookings
- [ ] 14.10 Run `npm run typecheck` and `npm run lint` — fix all issues
