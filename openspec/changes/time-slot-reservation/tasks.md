## 1. Database Schema & Migration

- [x] 1.1 Add `ShopTimeSlot` model to `prisma/schema.prisma` with fields: id, shopId, startTime, endTime, capacity, isActive
- [x] 1.2 Add `ReservationSlot` model to `prisma/schema.prisma` with fields: id, bookingId, slotId, bagCount
- [x] 1.3 Add `pricePerHour` (Decimal, default 10) and `timezone` (String, default "Europe/Istanbul") fields to `Shop` model
- [x] 1.4 Add `ShopTimeSlot` and `ReservationSlot` relations to `Booking` model
- [x] 1.5 Create Prisma migration (applied on server via SQL)
- [x] 1.6 Write migration script to generate ShopTimeSlot entries for existing shops (30 days × 30-min blocks)
- [x] 1.7 Write migration script to convert existing active bookings (PAID/CHECKED_IN/APPROVED) to ReservationSlot entries
- [x] 1.8 Write migration script to set `pricePerHour = ceil(pricePerDay / 24)` for all existing shops
- [x] 1.9 Add Prisma `@@unique([shopId, startTime])` constraint on ShopTimeSlot
- [x] 1.10 Add Prisma `@@unique([bookingId, slotId])` constraint on ReservationSlot

## 2. Slot Generation Service

- [x] 2.1 Create `src/services/SlotService.ts` with `generateSlotsForShop(shopId, daysForward)`
- [x] 2.2 Implement slot generation: split shop operating hours (open247 or openingTime-closingTime) into 30-min blocks
- [x] 2.3 Add `fillMissingSlots()` — idempotent: only create slots that don't exist yet, skip existing ones
- [x] 2.4 Add `updateSlotCapacity(slotId, newCapacity)` — change capacity for a specific slot without affecting reservations
- [x] 2.5 Create `src/app/api/internal/generate-slots/route.ts` cron endpoint to daily append new slots
- [ ] 2.6 Add cron trigger (Vercel/CI cron job configuration)

## 3. Slot Availability API

- [x] 3.1 Create `GET /api/mobile/shops/[id]/slots` endpoint returning slot array with capacity/reserved/available
- [x] 3.2 Implement availability calculation: group ReservationSlot by slotId, filter by active statuses only
- [x] 3.3 Add `minBags` query parameter to filter `isBookable` flag
- [x] 3.4 Add `Cache-Control: max-age=30` header with cache invalidation on booking creation
- [x] 3.5 Create `GET /api/shops/[id]/slots` web endpoint (same logic, different auth)
- [ ] 3.6 Add OpenAPI/doc comments to slot endpoints

## 4. Slot-Based Booking Creation

- [x] 4.1 Refactor `BookingService.createInitialBooking()` to accept `slotIds[]` and create slot-based bookings
- [x] 4.2 Implement slot capacity check via `reserveSlots()`: for each slot, verify `SUM(ReservationSlot.bagCount) + newBags ≤ ShopTimeSlot.capacity`
- [x] 4.3 Create `ReservationSlot` entries during booking creation inside SERIALIZABLE transaction
- [x] 4.4 Derive `checkInTime` from earliest slot startTime, `checkOutTime` from latest slot endTime
- [x] 4.5 Legacy `assertCapacityTx()` preserved for backward compat
- [x] 4.6 Update `createBookingAction` to accept and forward `slotIds`
- [ ] 4.7 Update mobile `/api/mobile/checkout/intent` to accept slotIds

## 5. Booking Modification & Cancellation

- [ ] 5.1 Refactor `BookingService.modifyBooking()` for slot-based changes (add/remove ReservationSlot entries)
- [ ] 5.2 Re-validate capacity for only new/changed slots during modification
- [x] 5.3 Update `BookingService.cancelBooking()` to bulk-delete ReservationSlot entries
- [ ] 5.4 Refactor checkIn/checkOut to reference slot times for validation
- [ ] 5.5 Update all BookingEvent records to include slot range context

## 6. Hourly Pricing Engine

- [x] 6.1 Update `src/lib/bag-pricing.ts`: added `computeHourlyLineTotal`, `computeSlotBasedTotal`, `computeServiceTotalForSlots`
- [x] 6.2 Formula: `total = hours × hourlyRate × sum(bagCount[size] × bagMultiplier[size])`
- [ ] 6.3 Update `src/lib/booking-server-price.ts`: `computeAuthoritativeCheckoutTotals()` uses slot count
- [ ] 6.4 Remove or deprecate `computeStayDaysFromWindow()` (replaced by slot count)
- [ ] 6.5 Update `PlatformSettings` defaults: add `minSlots=1`, `maxSlots=1440`
- [ ] 6.6 Update bag-pricing tests in `src/__tests__/currency.test.ts`

## 7. Slot-Based Search

- [x] 7.1 Refactor `ShopService.findShopsForSearch()` — slot availability for stays ≤48h, legacy fallback
- [x] 7.2 For each shop, query all ShopTimeSlot rows in the requested date range, then check per-slot availability
- [x] 7.3 Filter shops where min available bags across all requested slots ≥ requestedBags
- [x] 7.4 Include `pricePerHour` in search result DTO (`ShopSearchHit`)
- [x] 7.5 Add "sort by hourly price" sort option alongside existing distance/rating sorts
- [x] 7.6 `refreshSearchShopsAction` uses slot availability via updated ShopService
- [ ] 7.7 Update mobile `/api/mobile/shops/nearby` for slot-based filtering

## 8. Web UI — Slot Availability Grid

- [x] 8.1 Create `src/components/guest/SlotAvailabilityGrid.tsx` component
- [x] 8.2 Implement mobile version: horizontal scrollable row of 30-min slot chips with capacity indicators
- [ ] 8.3 Implement desktop version: multi-row grid (24h × slots) with drag-to-select
- [x] 8.4 Color-code slots: green (≥ 5 available), yellow (1-4), red (0), grey (outside hours / inactive)
- [x] 8.5 Add tap-to-set-check-in, scroll/tap-to-set-check-out interaction
- [x] 8.6 Disable slots that lack capacity for selected bag count
- [x] 8.7 Show slot selection summary: "10:00 → 13:30 (7 slots, 3.5 hours)"

## 9. Web UI — Checkout Integration

- [x] 9.1 Replace DateTimePicker in CheckoutClient step 1 with SlotAvailabilityGrid
- [x] 9.2 Update bag selector to show per-slot cost when slots selected
- [x] 9.3 Update pricing summary: slotCount × pricePerHour × bagMultipliers + insuranceFee
- [x] 9.4 Update draft save/restore for slot selection (localStorage `bagajpark_checkout_draft_*`)
- [ ] 9.5 Pass `slotIds[]` to booking creation action (uses time range instead — server resolves)
- [ ] 9.6 Add "selected slots became unavailable" error handling

## 10. Web UI — Search Integration

- [x] 10.1 Update SearchClient to show `pricePerHour` in sort options
- [x] 10.2 Update sort: hourly rate sort option added
- [x] 10.3 `ShopListItem` shows `bagsAvailable` from slot-based availability
- [x] 10.4 Add "sort by hourly rate" option to sort dropdown (both desktop + mobile)
- [ ] 10.5 Update search filter panel to include time range selection

## 11. Web UI — Booking Detail

- [ ] 11.1 Create slot timeline view in booking detail page
- [ ] 11.2 Show per-slot occupancy for partner dashboard
- [ ] 11.3 Update booking detail to derive checkIn/checkOut from slot range

## 12. Flutter Mobile App

- [ ] 12.1 Create `SlotAvailabilityGrid` widget in `mobile/lib/shared/widgets/`
- [ ] 12.2 Integrate slot grid into `checkout_screen.dart`
- [ ] 12.3 Update `checkout_screen.dart` to POST slotIds
- [ ] 12.4 Update bag selector for per-slot pricing
- [ ] 12.5 Update `search_screen.dart` for pricePerHour
- [ ] 12.6 Update `booking_detail_screen.dart` for slot timeline
- [ ] 12.7 Create Flutter slot data models

## 13. Admin & Partner Panel

- [ ] 13.1 Add per-slot capacity management UI
- [ ] 13.2 Allow partners to set different capacities for time windows
- [ ] 13.3 Add slot occupancy view to partner dashboard
- [ ] 13.4 Add `pricePerHour` field to partner settings

## 14. Testing

- [ ] 14.1 Unit test: slot generation for 24/7 shop produces 48 slots/day
- [ ] 14.2 Unit test: slot generation for 09:00-18:00 shop produces 18 slots/day
- [ ] 14.3 Unit test: capacity check rejects booking when any slot is full
- [ ] 14.4 Unit test: concurrent slot booking serialized correctly
- [ ] 14.5 Unit test: hourly pricing formula
- [ ] 14.6 Unit test: booking modification adds/removes correct ReservationSlot entries
- [ ] 14.7 Unit test: booking cancellation releases all slots
- [ ] 14.8 Integration test: end-to-end slot booking flow
- [ ] 14.9 Integration test: migration script correctly converts existing bookings
- [x] 14.10 Run `npm run typecheck` and `npm run lint` — typecheck passes

## 2. Slot Generation Service

- [ ] 2.1 Create `src/services/SlotService.ts` with `generateSlotsForShop(shopId, daysForward)`
- [ ] 2.2 Implement slot generation: split shop operating hours (open247 or openingTime-closingTime) into 30-min blocks
- [ ] 2.3 Add `fillMissingSlots()` — idempotent: only create slots that don't exist yet, skip existing ones
- [ ] 2.4 Add `updateSlotCapacity(slotId, newCapacity)` — change capacity for a specific slot without affecting reservations
- [ ] 2.5 Create `src/app/api/internal/generate-slots/route.ts` cron endpoint to daily append new slots
- [ ] 2.6 Add cron trigger in `src/app/api/internal/` (extend existing cron setup or vercel.json)

## 3. Slot Availability API

- [x] 3.1 Create `GET /api/mobile/shops/[id]/slots` endpoint returning slot array with capacity/reserved/available
- [x] 3.2 Implement availability calculation: group ReservationSlot by slotId, filter by active statuses only
- [x] 3.3 Add `minBags` query parameter to filter `isBookable` flag
- [x] 3.4 Add `Cache-Control: max-age=30` header with cache invalidation on booking creation
- [x] 3.5 Create `GET /api/shops/[id]/slots` web endpoint (same logic, different auth)
- [ ] 3.6 Add OpenAPI/doc comments to slot endpoints

## 4. Slot-Based Booking Creation

- [x] 4.1 Refactor `BookingService.createInitialBooking()` to accept `slotIds[]` and create slot-based bookings
- [x] 4.2 Implement slot capacity check via `reserveSlots()`: for each slot, verify `SUM(ReservationSlot.bagCount) + newBags ≤ ShopTimeSlot.capacity`
- [x] 4.3 Create `ReservationSlot` entries during booking creation inside SERIALIZABLE transaction
- [x] 4.4 Derive `checkInTime` from earliest slot startTime, `checkOutTime` from latest slot endTime
- [x] 4.5 Legacy `assertCapacityTx()` preserved for backward compat
- [x] 4.6 Update `createBookingAction` to accept and forward `slotIds`
- [ ] 4.7 Update mobile `/api/mobile/checkout/intent` to accept slotIds

## 5. Booking Modification & Cancellation

- [ ] 5.1 Refactor `BookingService.modifyBooking()` for slot-based changes
- [ ] 5.2 Re-validate capacity for only new/changed slots during modification
- [x] 5.3 Update `BookingService.cancelBooking()` to bulk-delete ReservationSlot entries
- [ ] 5.4 Refactor checkIn/checkOut to reference slot times for validation
- [ ] 5.5 Update all BookingEvent records to include slot range context

## 6. Hourly Pricing Engine

- [x] 6.1 Update `src/lib/bag-pricing.ts`: added `computeHourlyLineTotal`, `computeSlotBasedTotal`, `computeServiceTotalForSlots`
- [x] 6.2 Formula: `total = hours × hourlyRate × sum(bagCount[size] × bagMultiplier[size])`
- [ ] 6.3 Update `src/lib/booking-server-price.ts` for slot-based authoritative totals
- [ ] 6.4 Remove or deprecate `computeStayDaysFromWindow()`
- [ ] 6.5 Update `PlatformSettings` defaults
- [ ] 6.6 Update bag-pricing tests

## 7. Slot-Based Search

- [x] 7.1 Refactor `ShopService.findShopsForSearch()` — slot availability for stays ≤48h, legacy fallback
- [x] 7.2 For each shop, query all ShopTimeSlot rows in the requested date range, then check per-slot availability
- [x] 7.3 Filter shops where min available bags across all requested slots ≥ requestedBags
- [x] 7.4 Include `pricePerHour` in search result DTO (`ShopSearchHit`)
- [x] 7.5 Add "sort by hourly price" sort option
- [x] 7.6 `refreshSearchShopsAction` uses slot availability via updated ShopService
- [ ] 7.7 Update mobile `/api/mobile/shops/nearby` for slot-based filtering

## 8. Web UI — Slot Availability Grid

- [x] 8.1 Create `src/components/guest/SlotAvailabilityGrid.tsx` component
- [x] 8.2 Implement mobile version: horizontal scrollable row of 30-min slot chips with capacity indicators
- [ ] 8.3 Implement desktop version: multi-row grid (24h × slots)
- [x] 8.4 Color-code slots: green (≥ 5), yellow (1-4), red (0), grey (inactive)
- [x] 8.5 Add tap-to-set-check-in, scroll/tap-to-set-check-out interaction
- [x] 8.6 Disable slots that lack capacity for selected bag count
- [x] 8.7 Show slot selection summary: "10:00 → 13:30 (7 slots, 3.5 hours)"

## 9. Web UI — Checkout Integration

- [x] 9.1 Integrated SlotAvailabilityGrid in CheckoutClient step 1
- [x] 9.2 Update pricing display for slot-based vs daily
- [x] 9.3 Update pricing summary: slotCount × pricePerHour × bagMultipliers + insuranceFee
- [x] 9.4 Draft save/restore preserves slot selection
- [ ] 9.5 Pass `slotIds[]` to booking creation (uses time range — server resolves internally)
- [ ] 9.6 Add "selected slots became unavailable" error handling

## 10. Web UI — Search Integration

- [x] 10.1 Update SearchClient sort options with hourly rate
- [x] 10.2 Sort by hourly rate implemented
- [x] 10.3 `ShopListItem` shows `bagsAvailable` from slot-based availability
- [x] 10.4 "Sort by hourly rate" in both desktop sidebar and mobile bottom sheet
- [ ] 10.5 Search filter panel time range selection

## 11. Web UI — Booking Detail

- [ ] 11.1 Create slot timeline view in booking detail page
- [ ] 11.2 Show per-slot occupancy for partner dashboard
- [ ] 11.3 Update booking detail to derive checkIn/checkOut from slot range

## 12. Flutter Mobile App

- [ ] 12.1-12.7 Flutter slot integration (deferred)

## 13. Admin & Partner Panel

- [ ] 13.1-13.4 Admin/Partner slot management (deferred)

## 14. Testing

- [ ] 14.1-14.9 Unit + integration tests (deferred)
- [x] 14.10 Run `npm run typecheck` — passes
