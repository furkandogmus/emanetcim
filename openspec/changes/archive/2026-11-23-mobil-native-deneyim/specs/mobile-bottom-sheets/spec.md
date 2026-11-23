## ADDED Requirements

### Requirement: Search panel as bottom sheet
On mobile, the search panel SHALL be rendered as a bottom sheet instead of a sidebar overlay.

#### Scenario: Open search panel
- **WHEN** user opens search page on mobile
- **THEN** a drag-handle is visible at bottom of screen with map above

#### Scenario: Expand/collapse search panel
- **WHEN** user drags the handle upward
- **THEN** panel expands to show full shop list
- **WHEN** user drags the handle downward
- **THEN** panel collapses to show only drag handle and preview

#### Scenario: Desktop behavior unchanged
- **WHEN** user is on desktop (width > 768px)
- **THEN** sidebar layout is used (no bottom sheet)

### Requirement: Filter panel as bottom sheet
Filter controls SHALL be presented in a bottom sheet pattern on mobile.

#### Scenario: Open filters
- **WHEN** user taps filter button on mobile
- **THEN** a bottom sheet slides up with filter options

### Requirement: Date/time picker as bottom sheet
Date and time selection SHALL use a bottom sheet pattern on mobile web.

#### Scenario: Select check-in date
- **WHEN** user taps check-in field on mobile web
- **THEN** a bottom sheet with calendar and time chips slides up
