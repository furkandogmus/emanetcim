## ADDED Requirements

### Requirement: Native share for shop details
Shop detail page SHALL have a share button that triggers native OS share sheet.

#### Scenario: Share shop link
- **WHEN** user taps share button on shop detail
- **THEN** native OS share sheet opens with shop name, address, and URL

#### Scenario: Share fallback
- **WHEN** navigator.share is not available
- **THEN** system copies shop link to clipboard and shows toast

### Requirement: Share booking confirmation
Booking success page SHALL have share capability.

#### Scenario: Share booking
- **WHEN** user taps share on booking success
- **THEN** native share sheet opens with booking ID and pickup info
