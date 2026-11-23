## ADDED Requirements

### Requirement: Slot-based booking creation
Booking creation SHALL reserve specific time slots with per-slot bag counts instead of a single datetime pair.

#### Scenario: Create booking with 2 bags for 2 hours
- **WHEN** a guest submits a booking for shop X, 2 M-size bags, from 09:00 to 11:00
- **THEN** the system creates 4 `ReservationSlot` entries (09:00, 09:30, 10:00, 10:30) each with `bagCount=2`
- **THEN** the booking status is set to `APPROVED`
- **THEN** the booking's `checkInTime` is derived as 09:00 and `checkOutTime` as 11:00

#### Scenario: Booking requires all slots to have sufficient capacity
- **WHEN** a guest requests 3 bags for 6 slots but slot 4 only has 2 available
- **THEN** the booking creation fails
- **THEN** the guest receives an error: "Not enough capacity for the selected time. Available: 2 bags in slot 10:30"

#### Scenario: Successful booking updates slot availability immediately
- **WHEN** a booking for 5 bags reserves 4 slots
- **THEN** each slot's `reserved` count increases by 5 immediately
- **THEN** subsequent availability queries reflect this change

### Requirement: Booking modification changes reserved slots
Modifying a booking SHALL update the set of reserved slots.

#### Scenario: Extend stay by 1 hour
- **WHEN** a guest modifies a booking from 09:00-11:00 to 09:00-12:00
- **THEN** the system adds 2 new `ReservationSlot` entries (11:00-11:30 and 11:30-12:00)
- **THEN** the system validates the two new slots have sufficient capacity
- **THEN** if the new slots lack capacity, modification fails and original slots are preserved

#### Scenario: Shorten stay
- **WHEN** a guest modifies a booking from 09:00-12:00 to 09:00-10:00
- **THEN** the system removes `ReservationSlot` entries for slots beyond 10:00
- **THEN** the removed slots become available for other guests

#### Scenario: Change bag count increases per-slot reservation
- **WHEN** a guest increases a booking from 2 bags to 4 bags
- **THEN** all existing `ReservationSlot` entries are updated to `bagCount=4`
- **THEN** each slot's capacity is re-checked for the new bag count

### Requirement: Booking cancellation releases all slots
Cancelling a booking SHALL release all reserved slots.

#### Scenario: Cancel a slot-based booking
- **WHEN** a guest cancels a booking that reserved 8 slots with 3 bags each
- **THEN** all 8 `ReservationSlot` entries are deleted
- **THEN** all 8 slots' available capacity increases by 3
- **THEN** a coupon credit is issued if the booking was paid (same as current behavior)

### Requirement: Booking detail shows slot timeline
The booking detail view SHALL display the reserved time slots as a timeline.

#### Scenario: Booking detail shows slot-by-slot breakdown
- **WHEN** a guest views a booking spanning 09:00-12:00
- **THEN** the detail page shows a timeline: "09:00 → 09:30 → 10:00 → 10:30 → 11:00 → 11:30 → 12:00"
- **THEN** each slot shows the bag count in that slot

#### Scenario: Partner booking detail shows slot occupancy
- **WHEN** a partner views a booking in their dashboard
- **THEN** the detail shows which slots this booking occupies and how many other bookings overlap at each slot
