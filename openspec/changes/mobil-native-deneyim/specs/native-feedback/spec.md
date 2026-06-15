## ADDED Requirements

### Requirement: Haptic feedback on interactions
Interactive elements SHALL trigger haptic feedback on supported mobile devices.

#### Scenario: Button press
- **WHEN** user taps a primary button
- **THEN** device vibrates with light intensity

#### Scenario: Success confirmation
- **WHEN** booking is successfully created
- **THEN** device vibrates with success (double-tap) pattern

#### Scenario: Error feedback
- **WHEN** an error toast is shown
- **THEN** device vibrates with error pattern

### Requirement: Micro-interactions
UI elements SHALL have micro-interaction animations for feedback.

#### Scenario: Button press animation
- **WHEN** user presses a button
- **THEN** button scales to 0.97 and springs back

#### Scenario: Card selection
- **WHEN** user selects a shop card
- **THEN** card highlights with border color and subtle scale

### Requirement: Toast notifications
Feedback messages SHALL use animated toast notifications.

#### Scenario: Success toast
- **WHEN** an operation succeeds
- **THEN** a green toast slides down with checkmark icon

#### Scenario: Error toast
- **WHEN** an operation fails
- **THEN** a red toast slides down with error icon
