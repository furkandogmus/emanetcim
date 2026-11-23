## MODIFIED Requirements

### Requirement: Mobile date/time picker
On mobile devices, the DateTimePicker SHALL render as a bottom sheet.

#### Scenario: Open date picker on mobile web
- **WHEN** user taps date/time field on mobile web
- **THEN** a bottom sheet slides up containing:
  - Calendar grid (month view)
  - Horizontal time chip selector (20-minute intervals)
  - Confirm and cancel buttons

#### Scenario: Desktop behavior
- **WHEN** user taps date/time field on desktop
- **THEN** inline calendar dropdown is shown (current behavior)

#### Scenario: Select time
- **WHEN** user scrolls horizontally through time chips
- **THEN** selected time chip is highlighted with brand color

### Requirement: Prevent past date selection
Date picker SHALL prevent selecting past dates/times.

#### Scenario: Past time blocked
- **WHEN** user tries to select check-in time in the past
- **THEN** option is disabled with visual indicator
