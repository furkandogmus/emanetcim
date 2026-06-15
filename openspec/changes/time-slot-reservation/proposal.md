## Why

The current booking system uses simple datetime pairs (checkIn/checkOut) with ceil-based daily pricing — every stay rounds up to a full day. Competitors (LuggageHero, Bounce) offer **time-slot-based reservation with hourly pricing**, which is critical for short-stay travelers who only need 3-4 hours between hotel checkout and flight. BagajPark cannot compete for this market segment (the majority of luggage storage demand) without time-slot granularity.

## What Changes

- **BREAKING**: Replace flat `DateTime`-pair `checkInTime`/`checkOutTime` with a time-slot reservation model where shops define 30-minute bookable slots and guests reserve individual slots
- **BREAKING**: Replace ceil-based daily pricing with per-slot hourly pricing (`pricePerHour` instead of `pricePerDay`)
- Add `ShopTimeSlot` model: each shop defines its operating hours as bookable 30-minute blocks with per-slot bag capacity
- Add `ReservationSlot` model: each booked slot links a booking to a specific time slot, enabling per-slot capacity tracking
- Add availability grid API: guests can see real-time slot availability (how many bags can be accepted at each 30-minute window)
- Add hourly pricing engine: `hourlyRate * (slot multiSlotier) * hours` instead of `dailyRate * ceil(days)`
- Update search to filter shops by slot availability (not just flat capacity)
- Update checkout UI to show time-slot availability grid and slot-based bag selection
- Migrate existing bookings to the new slot model (backward compat via migration)

## Capabilities

### New Capabilities
- `shop-time-slots`: Shop owners define bookable operating hours as 30-minute time slots with per-slot bag capacity
- `reservation-slots`: Bookings reserve specific time slots, enabling per-slot capacity tracking and real-time availability
- `hourly-pricing`: Per-hour pricing model replaces daily rounding with `pricePerHour * hours * bagMultiplier`
- `slot-availability-grid`: Real-time availability API and UI showing which time slots a shop has open
- `slot-based-search`: Search results filter shops by slot availability within the requested time range

### Modified Capabilities
- `booking-workflow`: Booking creation, modification, cancellation, check-in, and check-out now operate on time slots rather than a single datetime pair
- `checkout-flow`: Checkout step 1 now includes a time-slot availability grid with per-slot bag capacity selection

## Impact

- **Database**: New `ShopTimeSlot` and `ReservationSlot` tables; `Booking.checkInTime`/`checkOutTime` become derived from linked slots; shop `capacity` moves to per-slot granularity
- **Prisma schema**: Add `ShopTimeSlot` and `ReservationSlot` models; add `pricePerHour` to `Shop`; modify `Booking` relations
- **BookingService**: Rewrite `createInitialBooking`, `assertCapacityTx`, `modifyBooking`, `checkIn`, `checkOut` for slot-based logic
- **ShopService**: Rewrite `findShopsForSearch` for per-slot availability filtering
- **SearchClient & CheckoutClient**: New slot grid UI components
- **Mobile app**: Update checkout screen, search screen, booking detail screen for slot-based model
- **API routes**: All booking/shop/search endpoints affected
- **Pricing**: Entire pricing engine rewritten from daily to hourly
