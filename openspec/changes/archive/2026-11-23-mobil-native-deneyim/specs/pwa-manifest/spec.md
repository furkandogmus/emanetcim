## MODIFIED Requirements

### Requirement: PWA manifest metadata
The manifest.json SHALL include complete metadata for modern install prompts.

#### Scenario: Android install prompt
- **WHEN** Android user visits the PWA
- **THEN** manifest includes screenshots for install prompt
- **THEN** manifest includes shortcuts for Search and My Bookings

#### Scenario: iOS PWA
- **WHEN** iOS user adds to home screen
- **THEN** manifest has apple-touch-icon, status-bar-style, and capable flags

### Requirement: App shortcuts
The manifest SHALL define shortcuts for key app actions.

#### Scenario: Long press shortcut
- **WHEN** user long-presses the PWA icon
- **THEN** shortcuts appear: "Search Nearby", "My Bookings", "Partner Panel"

### Requirement: Screenshots for install
The manifest SHALL include screenshots for enhanced install prompt.

#### Scenario: Install prompt with screenshots
- **WHEN** browser shows install prompt
- **THEN** screenshots of mobile UI are displayed
