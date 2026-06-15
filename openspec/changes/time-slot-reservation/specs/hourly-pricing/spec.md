## ADDED Requirements

### Requirement: Hourly rate replaces daily rate
Shops SHALL charge per slot (30-minute block) instead of per day, using `pricePerHour`.

#### Scenario: 2-hour stay is cheaper than 24-hour stay
- **WHEN** a guest books 4 slots (2 hours) at `pricePerHour=50` for 1 M-size bag
- **THEN** the service total is `4 * 50 * 1.0 = 200` TRY
- **THEN** the same booking for 48 slots (24 hours) costs `48 * 50 * 1.0 = 2400` TRY

#### Scenario: Minimum charge is 1 slot
- **WHEN** a guest books fewer than 30 minutes
- **THEN** the system charges for at least 1 slot (30 min)

### Requirement: Bag size multipliers apply to hourly rate
Bag size multipliers (S=0.8, M=1.0, XL=1.5) SHALL be applied per slot.

#### Scenario: XL bag costs 50% more per slot
- **WHEN** a guest books 1 XL-size bag for 4 slots at `pricePerHour=50`
- **THEN** the XL bag line total is `4 * 50 * 1.5 = 300` TRY

#### Scenario: Mixed bag sizes in one booking
- **WHEN** a guest books 1 S bag and 1 XL bag for 4 slots at `pricePerHour=50`
- **THEN** total = `(4 * 50 * 0.8) + (4 * 50 * 1.5) = 160 + 300 = 460` TRY

### Requirement: Pricing is computed authoritatively on server
The server SHALL compute the final total price and the client SHALL use server-returned values.

#### Scenario: Client shows approximate price, server returns exact price
- **WHEN** the mobile app displays an estimated total of 198 TRY
- **THEN** the server computes and returns the authoritative total (e.g., 200 TRY)
- **THEN** the client updates its display to match the server's value

#### Scenario: Price discrepancy above threshold triggers confirmation
- **WHEN** the server price differs from client estimate by more than 1 TRY
- **THEN** the client displays the server's authoritative price

### Requirement: Insurance fee is per-booking not per-hour
The insurance fee SHALL remain a flat per-booking charge, not multiplied by hours.

#### Scenario: Same insurance fee regardless of stay duration
- **WHEN** a guest books a 30-minute stay and a 24-hour stay at the same shop
- **THEN** both bookings have the same `insuranceFee` (15 TRY)

### Requirement: Legacy daily pricing migration
During the transition period, shops that lack `pricePerHour` SHALL have it derived from `pricePerDay`.

#### Scenario: Auto-derive hourly rate from daily rate
- **WHEN** a shop has `pricePerDay=50` but no `pricePerHour`
- **THEN** the system sets `pricePerHour = ceil(pricePerDay / 24) = 3` TRY
