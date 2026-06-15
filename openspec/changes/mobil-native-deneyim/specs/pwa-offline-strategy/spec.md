## ADDED Requirements

### Requirement: Next.js page caching
Service worker SHALL cache Next.js page routes for offline access.

#### Scenario: Open app offline
- **WHEN** user opens the PWA while offline
- **THEN** previously visited pages are served from cache

#### Scenario: Fresh content on online
- **WHEN** user opens a page while online
- **THEN** latest content is fetched and cache is updated

### Requirement: API response caching
Mobile API responses SHALL be cached with StaleWhileRevalidate strategy.

#### Scenario: Search shops offline
- **WHEN** user opens search page while offline
- **THEN** last cached shop list is displayed with offline indicator

#### Scenario: View booking offline
- **WHEN** user opens booking detail while offline
- **THEN** cached booking data is displayed

### Requirement: Offline indicator
The system SHALL show an offline banner when network is unavailable.

#### Scenario: Show offline banner
- **WHEN** network becomes unavailable
- **THEN** orange banner appears at top of screen: "İnternet bağlantınız yok"

### Requirement: Static asset caching
Font, CSS, JS, and image assets SHALL be cached with CacheFirst strategy.

#### Scenario: Load cached assets offline
- **WHEN** user navigates while offline
- **THEN** static assets load from cache without errors
