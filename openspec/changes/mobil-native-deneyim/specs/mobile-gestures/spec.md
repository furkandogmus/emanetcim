## ADDED Requirements

### Requirement: Swipe-back gesture
The system SHALL support swipe-back gesture on mobile to navigate to previous page/screen.

#### Scenario: Shop detail back navigation
- **WHEN** user is on shop detail page and swipes from left edge to right
- **THEN** system navigates back to search page

#### Scenario: Checkout back navigation
- **WHEN** user is on checkout step 2 and swipes back
- **THEN** system returns to step 1

### Requirement: Pull-to-refresh on all list screens
List screens SHALL support pull-to-refresh gesture with visual indicator.

#### Scenario: Search results refresh
- **WHEN** user pulls down on search results list
- **THEN** system refreshes nearby shops and shows loading indicator

#### Scenario: Bookings list refresh
- **WHEN** user pulls down on my bookings list
- **THEN** system refreshes booking list from server

### Requirement: Swipe-to-dismiss modals
Modal overlays SHALL support swipe-down-to-dismiss gesture.

#### Scenario: Dismiss filter sheet
- **WHEN** filter bottom sheet is open and user swipes down
- **THEN** filter sheet dismisses

### Requirement: Gallery pinch-to-zoom
Shop image gallery SHALL support pinch-to-zoom and pan gestures.

#### Scenario: Zoom into shop image
- **WHEN** user pinches on a shop image in gallery
- **THEN** image zooms in/out proportionally
