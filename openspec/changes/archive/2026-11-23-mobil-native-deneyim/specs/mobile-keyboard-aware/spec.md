## ADDED Requirements

### Requirement: Keyboard-aware checkout footer
The checkout CTA footer SHALL adjust when mobile keyboard opens.

#### Scenario: Keyboard opens during checkout
- **WHEN** user taps an input field in checkout on mobile
- **THEN** fixed bottom CTA bar moves above the keyboard

#### Scenario: Keyboard closes
- **WHEN** user dismisses keyboard in checkout
- **THEN** CTA bar returns to original bottom position

### Requirement: iOS zoom prevention
All input fields on mobile SHALL have minimum 16px font size.

#### Scenario: Input focus on iOS
- **WHEN** user taps any input field on iOS
- **THEN** page does NOT zoom in

### Requirement: Keyboard return key
Input fields SHALL have appropriate keyboard return key type.

#### Scenario: Email input
- **WHEN** user is entering email
- **THEN** keyboard shows @ and . shortcuts

#### Scenario: Phone input
- **WHEN** user is entering phone number
- **THEN** keyboard shows numeric keypad
