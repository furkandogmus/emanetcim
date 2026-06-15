## MODIFIED Requirements

### Requirement: MobileNav visibility
MobileNav MUST be visible on shop detail and checkout pages.

#### Scenario: View shop detail
- **WHEN** user navigates to shop detail page on mobile
- **THEN** MobileNav displays a back button and contextual navigation
- **WHEN** user taps back
- **THEN** previous page (search or home) loads

#### Scenario: View checkout
- **WHEN** user is on checkout page on mobile
- **THEN** checkout step indicator is visible in header, MobileNav shows back/home

### Requirement: Back button behavior
Back button SHALL support history-based navigation with gesture support.

#### Scenario: Swipe back
- **WHEN** user swipes from left edge on any detail page
- **THEN** previous page in history loads

#### Scenario: System back (Android)
- **WHEN** user presses Android system back button
- **THEN** app navigates to previous page
