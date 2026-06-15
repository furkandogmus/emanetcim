## ADDED Requirements

### Requirement: Real-time slot availability API
The system SHALL expose an API endpoint returning per-slot availability for a shop over a date range.

#### Scenario: Query availability for a shop
- **WHEN** the client requests `GET /api/mobile/shops/:id/slots?from=...&to=...`
- **THEN** the response returns an array of slots with `startTime`, `endTime`, `capacity`, `reserved`, `available`
- **THEN** each slot includes a boolean `isBookable` indicating capacity > reserved with active status filtering

#### Scenario: Slots outside operating hours are excluded
- **WHEN** a shop operates 09:00-18:00 and the client queries 07:00-20:00
- **THEN** only slots between 09:00 and 18:00 are returned
- **THEN** gaps outside operating hours are not returned as slots

#### Scenario: Slots filter by minimum requested bags
- **WHEN** the client requests availability with `minBags=3`
- **THEN** only slots with `available >= 3` return `isBookable=true`
- **THEN** slots with `available < 3` return `isBookable=false` but are still included for UI context

### Requirement: Availability grid UI on web
The checkout page SHALL display a time-slot availability grid showing per-slot bag counts.

#### Scenario: Availability grid shows reserved vs available
- **WHEN** a guest opens checkout for a shop
- **THEN** a horizontal scrollable grid shows each 30-minute slot
- **THEN** each slot cell shows: time, remaining bag count, and color-coded status (green ≥ 5, yellow 1-4, red 0/grey outside hours)

#### Scenario: Grid updates slot selection in real-time
- **WHEN** the guest changes bag counts or date range
- **THEN** the availability grid re-fetches and highlights the selected slot range
- **THEN** slots without enough capacity for the selected bags are visually disabled

#### Scenario: Desktop grid shows 24 hours at a glance
- **WHEN** on desktop (width > 768px)
- **THEN** the grid shows a full day of 48 slots with time labels every 2 hours

#### Scenario: Mobile grid scrolls horizontally
- **WHEN** on mobile (width ≤ 767px)
- **THEN** the grid shows ~8 slots visible at a time with horizontal scroll
- **THEN** the current time slot is auto-scrolled into view

### Requirement: Availability grid UI on Flutter
The Flutter mobile app SHALL display the same slot availability grid.

#### Scenario: Flutter checkout shows slot grid
- **WHEN** the user opens checkout in the Flutter app
- **THEN** a `SlotAvailabilityGrid` widget shows the same availability data as the web version
- **THEN** Android uses Material design, iOS shows the same data but styled natively

### Requirement: Cached availability with real-time refresh
Slot availability SHALL be served with short-lived caching (30 seconds) and refresh on booking.

#### Scenario: Cached availability for read requests
- **WHEN** multiple users check availability for the same shop within 30 seconds
- **THEN** the second request may serve cached data
- **THEN** the response includes a `Cache-Control: max-age=30` header

#### Scenario: Real-time update after booking
- **WHEN** a booking is created that reserves slots
- **THEN** the availability cache for affected slots is invalidated immediately
