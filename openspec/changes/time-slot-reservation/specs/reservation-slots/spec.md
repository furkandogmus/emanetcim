## ADDED Requirements

### Requirement: Booking reserves specific time slots
Each booking SHALL reserve one or more 30-minute time slots, linking via ReservationSlot entries.

#### Scenario: 2-hour booking creates 4 slot reservations
- **WHEN** a guest books 2 bags for 09:00-11:00
- **THEN** the system creates 4 `ReservationSlot` entries: slots 09:00-09:30, 09:30-10:00, 10:00-10:30, 10:30-11:00
- **THEN** each `ReservationSlot` has `bagCount=2`

#### Scenario: First and last slot define booking window
- **WHEN** a booking has ReservationSlot entries from 09:00 to 11:00
- **THEN** the booking's effective `checkInTime` is the start of the earliest slot
- **THEN** the booking's effective `checkOutTime` is the end of the latest slot

#### Scenario: Multi-bag booking preserves bag counts per slot
- **WHEN** a guest books 1 S-size bag and 2 M-size bags for 4 slots
- **THEN** each slot has `bagCount=3` (total bags in the booking)

### Requirement: Slot reservation prevents double-booking
The system SHALL use serializable transactions to prevent two guests from reserving the same slot capacity simultaneously.

#### Scenario: Concurrent slot reservations for limited capacity
- **WHEN** two guests simultaneously attempt to book the last available bag in slot 09:00-09:30
- **THEN** only one reservation succeeds
- **THEN** the other receives a "slot no longer available" error

#### Scenario: Partial slot reservation rolls back on failure
- **WHEN** a booking requires 4 slots but slot 3 is overbooked during reservation
- **THEN** the entire booking creation rolls back
- **THEN** no ReservationSlot entries are created

### Requirement: Expired pending reservations are released
Pending reservations that are not completed within 24 hours SHALL be excluded from capacity calculations.

#### Scenario: 25-hour old pending booking doesn't consume capacity
- **WHEN** a PENDING-status booking was created 25 hours ago and has not transitioned to PAID or APPROVED
- **THEN** its ReservationSlot entries are excluded from the available capacity count
- **THEN** those slots become bookable again

#### Scenario: Recent pending booking still consumes capacity
- **WHEN** a PENDING-status booking was created 2 hours ago
- **THEN** its ReservationSlot entries still count against slot capacity

### Requirement: Check-in validates slot times
At check-in, the system SHALL verify the current time falls within the booked slot window.

#### Scenario: Guest arrives during booked window
- **WHEN** a guest checks in at 09:15 for a booking spanning 09:00-11:00
- **THEN** check-in is accepted (within booked window)

#### Scenario: Guest arrives before booked window
- **WHEN** a guest attempts check-in at 08:45 for a 09:00 booking
- **THEN** check-in is rejected with "too early" message until the booked slot begins

#### Scenario: Guest arrives after late tolerance
- **WHEN** a guest arrives at 09:35 for a 09:00-11:00 booking
- **THEN** check-in is accepted with a 15-minute grace period
- **THEN** a "late arrival" note is recorded
