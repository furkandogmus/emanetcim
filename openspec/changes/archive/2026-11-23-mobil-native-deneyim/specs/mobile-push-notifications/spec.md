## ADDED Requirements

### Requirement: Push notification permission UI
The system SHALL prompt users to enable push notifications.

#### Scenario: Request permission
- **WHEN** user completes first booking
- **THEN** system prompts to enable push notifications

#### Scenario: Permission denied
- **WHEN** user denies push permission
- **THEN** system does not prompt again

### Requirement: Notification preferences
Users SHALL be able to manage notification preferences.

#### Scenario: Toggle notifications
- **WHEN** user is in profile settings
- **THEN** they can toggle: booking updates, promotional offers, partner updates
