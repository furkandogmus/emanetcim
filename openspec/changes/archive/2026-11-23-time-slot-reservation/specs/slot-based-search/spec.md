## ADDED Requirements

### Requirement: Search filters by slot availability
The shop search SHALL filter results to only shops with sufficient slot availability across the requested time range.

#### Scenario: Shop with full capacity is excluded from search
- **WHEN** a guest searches for 5 bags from 10:00 to 12:00
- **THEN** a shop with only 3 available bags in the 10:00-10:30 slot is excluded from results
- **THEN** a shop with ≥ 5 bags in every slot from 10:00 to 12:00 is included

#### Scenario: Shop with partial availability is excluded
- **WHEN** a guest needs 2 bags from 09:00 to 13:00 (8 slots)
- **THEN** a shop that has 10 bags in slots 09:00-12:00 but only 1 bag in slot 12:00-12:30 is excluded
- **THEN** the minimum available count across all requested slots determines shop eligibility

#### Scenario: Shop outside operating hours returns no results
- **WHEN** a guest searches for 06:00-08:00 at a shop that opens at 09:00
- **THEN** the shop is excluded from search results
- **THEN** the guest sees "no shops available for the selected time" message

### Requirement: Search results show per-slot pricing summary
Each search result SHALL display the hourly rate and the estimated total for the guest's requested window.

#### Scenario: Search card shows hourly rate
- **WHEN** a guest searches for 2 bags for 3 hours
- **THEN** each shop card displays: "₺50/saat" and estimated total "₺300 (2 bagaj, 3 saat)"

#### Scenario: Search card shows bag availability count
- **WHEN** a shop has 5 available bags in all requested slots
- **THEN** the card displays "5 bagaj müsait" (5 bags available) with the current `bagsAvailable` count

### Requirement: Backward compatibility for date-only search
The search SHALL still work when only a date range is provided without specific time slots selected.

#### Scenario: Search without time selection defaults to full operating hours
- **WHEN** a guest searches for a shop on a date without selecting specific time slots
- **THEN** the system checks availability across all slots during the shop's operating hours for that date
- **THEN** results show shops that have capacity across the entire day

### Requirement: Slot-aware distance sorting
Search results SHALL be sortable by proximity, minimum hourly price, and maximum slot availability.

#### Scenario: Sort by cheapest hourly rate
- **WHEN** the guest selects "sort by price (lowest)"
- **THEN** shops are ordered by `pricePerHour * bagSizeMultiplier` ascending

#### Scenario: Sort by most available slots
- **WHEN** the guest selects "sort by availability"
- **THEN** shops are ordered by minimum available bags across requested slots descending
