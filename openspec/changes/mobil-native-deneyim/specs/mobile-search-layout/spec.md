## MODIFIED Requirements

### Requirement: Mobile search layout
On mobile, search page MUST use bottom sheet pattern instead of sidebar.

#### Scenario: Initial load on mobile
- **WHEN** user opens search page on mobile
- **THEN** full-screen map is displayed
- **THEN** a thin bottom sheet handle with "N shops nearby" label is visible

#### Scenario: Expand shop list
- **WHEN** user drags bottom sheet handle upward
- **THEN** shop list expands to fill 60% of screen
- **THEN** first shop card is highlighted on map

#### Scenario: Full screen list
- **WHEN** user continues dragging upward
- **THEN** list fills 90% of screen
- **THEN** map becomes visible as background through header

#### Scenario: Shop selection from list
- **WHEN** user taps a shop in the list
- **THEN** map centers on that shop
- **THEN** shop detail preview card appears
- **WHEN** user taps preview card
- **THEN** navigates to shop detail page

#### Scenario: Desktop behavior unchanged
- **WHEN** user is on desktop (width > 768px)
- **THEN** sidebar layout is used with map on right
