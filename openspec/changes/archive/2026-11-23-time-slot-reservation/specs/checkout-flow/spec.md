## ADDED Requirements

### Requirement: Checkout shows slot availability grid
The checkout page SHALL display a time-slot availability grid replacing the current simple date/time picker.

#### Scenario: Mobile checkout with slot grid
- **WHEN** a guest opens the checkout page on mobile for a shop
- **THEN** step 1 displays a horizontally scrollable slot grid showing 30-minute blocks for the current day
- **THEN** the grid highlights the current time with a marker
- **THEN** the guest can tap to set check-in and scroll further to set check-out

#### Scenario: Desktop checkout with full grid
- **WHEN** a guest opens the checkout page on desktop for a shop
- **THEN** step 1 displays a multi-row grid showing 48 slots (24 hours) with time labels on the left
- **THEN** the guest drags across slots to select the check-in and check-out window
- **THEN** the selected range is highlighted in brand orange

#### Scenario: Grid shows per-slot bag capacity
- **WHEN** a shop has capacity=10 but slot 12:00 has only 3 bags remaining
- **THEN** the 12:00 slot cell shows "3/10" or a color indicator (yellow for limited)
- **THEN** if the guest selected 5 bags, the 12:00 slot is visually disabled (cannot select crossing it)

### Requirement: Bag selection with per-slot preview
The bag selector SHALL show estimated per-slot cost and total.

#### Scenario: Bag selection updates pricing in real-time
- **WHEN** the guest adjusts bag counts (S, M, XL) on the checkout page
- **THEN** the estimated total updates in real-time: `(hourlyRate * slotCount * sum(bagS*0.8 + bagM*1.0 + bagXL*1.5)) + insuranceFee`
- **THEN** a per-bag breakdown shows: "S: ₺160 (4 slot × ₺50 × 0.8), M: ₺200 (4 slot × ₺50 × 1.0)"

#### Scenario: Bag count exceeds slot capacity disables further increase
- **WHEN** a guest tries to increase bags beyond the minimum available across selected slots
- **THEN** the plus button is disabled
- **THEN** a warning message appears: "Only X bags available in this time window"

### Requirement: Selected slots display summary
Checkout SHALL show a clear summary of selected time slots and corresponding cost.

#### Scenario: Summary displays slot count and total hours
- **WHEN** a guest selects slots from 10:00 to 13:30 (7 slots)
- **THEN** the summary shows: "10:00 → 13:30 (3.5 hours / 7 slots)"
- **THEN** the total cost reflects 7 slots per bag

#### Scenario: Stay window validation shows warnings
- **WHEN** a guest selects a check-out time before check-in
- **THEN** the check-out field shows a validation error
- **THEN** the "Continue" button is disabled

### Requirement: Draft persistence for slot selection
The checkout SHALL save slot selections to localStorage for draft recovery.

#### Scenario: Saved draft restores slot selection
- **WHEN** a guest selects 10:00-12:00 with 2 bags and returns later
- **THEN** the checkout restores the same slot range and bag configuration
- **THEN** availability is re-checked and the grid re-validates the selection

#### Scenario: Draft expires if slots became unavailable
- **WHEN** a guest returns to a saved draft but the selected slots now lack capacity
- **THEN** the slot selection is cleared
- **THEN** the guest sees a notification: "Your previously selected time is no longer available"
