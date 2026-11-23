## ADDED Requirements

### Requirement: Shop defines operating hours as time slots
Each shop SHALL have bookable time slots defined in 30-minute blocks during its operating hours.

#### Scenario: Shop with 09:00-18:00 hours generates slots
- **WHEN** a shop has `openingTime=09:00` and `closingTime=18:00` with `open247=false`
- **THEN** the system generates 18 slots for each operating day (09:00-09:30, 09:30-10:00, ..., 17:30-18:00)

#### Scenario: 24/7 shop generates 48 slots per day
- **WHEN** a shop has `open247=true`
- **THEN** the system generates 48 slots per day (00:00-00:30 through 23:30-00:00)

#### Scenario: Each slot has independent capacity
- **WHEN** a shop has overall capacity 10 bags but sets lunch-hour slot capacity to 5
- **THEN** the 12:00-12:30 and 12:30-13:00 slots show `capacity=5` while other slots show `capacity=10`

#### Scenario: Slots are pre-generated for the booking window
- **WHEN** the system creates slots for a shop
- **THEN** it generates slots for the next 30 days from the current date
- **THEN** a daily cron job appends slots for the next day as time advances

### Requirement: Slot capacity limits reservations
Each ShopTimeSlot SHALL track how many bags are reserved and prevent exceeding capacity.

#### Scenario: Capacity reached blocks new reservations
- **WHEN** a slot has `capacity=10` and 9 bags are already reserved
- **THEN** a new reservation request for 2 bags is rejected
- **THEN** a new reservation request for 1 bag is accepted

#### Scenario: Multi-bag booking requires all slots to have capacity
- **WHEN** a booking requires 3 slots (09:00-10:30) with 5 bags
- **THEN** the system checks all three slots (09:00, 09:30, 10:00) for at least 5 available bags each
- **THEN** if any single slot lacks capacity, the entire booking is rejected

### Requirement: Shop owner can configure slot capacity
Shop owners or admins SHALL be able to adjust per-slot capacity for specific time windows.

#### Scenario: Reduce capacity during staff lunch
- **WHEN** a partner sets `capacity=3` for slots 12:00-14:00 while other slots remain at `capacity=10`
- **THEN** only 3 bags may be booked during the lunch window
- **THEN** existing reservations in those slots are unaffected

#### Scenario: Set different capacities for weekend slots
- **WHEN** a partner configures Saturday-Sunday slots with `capacity=15` (higher than weekday `capacity=10`)
- **THEN** the weekend slots accept more reservations
