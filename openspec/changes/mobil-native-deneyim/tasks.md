## 1. Web PWA Altyapı

- [x] 1.1 Install `@ducanh2912/next-pwa` package
- [x] 1.2 Configure next.config.ts with runtime caching rules
- [x] 1.3 Create offline fallback page (`public/offline.html`)
- [x] 1.4 Add PWA manifest screenshots and shortcuts
- [x] 1.5 Add standalone mode detection UI adaptation (created `useStandaloneMode` hook, integrated into PWAInstallBanner)
- [x] 1.6 Add `prefers-reduced-motion` support to globals.css
- [x] 1.7 Add iOS zoom prevention (`font-size: 16px` enforcement)
- [x] 1.8 Add `touch-action: manipulation` on interactive elements

## 2. Web PWA - Bottom Sheet Pattern

- [x] 2.1 Create reusable `BottomSheet` component (mobile bottom sheet with drag handle)
- [x] 2.2 Refactor `SearchClient.tsx` — replace mobile sidebar with bottom sheet
- [x] 2.3 Ensure desktop sidebar layout is preserved
- [x] 2.4 Add drag-to-expand/collapse behavior
- [x] 2.5 Add shop preview card at collapsed state
- [x] 2.6 Refactor filter panel to use bottom sheet on mobile

## 3. Web PWA - Touch Gesture Sistemi

- [x] 3.1 Create `useSwipeBack` hook (Web tarafı için)
- [x] 3.2 Create `usePullToRefresh` hook
- [x] 3.3 Create `useSwipeToDismiss` hook for modals
- [x] 3.4 Add swipe-back to ShopDetailClient.tsx
- [x] 3.5 Add pull-to-refresh to search results list
- [x] 3.6 Add pinch-to-zoom to ShopGallery

## 4. Web PWA - DateTimePicker Bottom Sheet

- [x] 4.1 Refactor DateTimePicker for mobile bottom sheet layout
- [x] 4.2 Add horizontal time chip selector
- [x] 4.3 Implement calendar in bottom sheet for mobile
- [x] 4.4 Preserve desktop inline dropdown behavior

## 5. Web PWA - Native Feedback & Mikro-Interactions

- [x] 5.1 Create `haptic.ts` utility with `navigator.vibrate()`
- [x] 5.2 Add haptic feedback to primary buttons
- [x] 5.3 Add haptic feedback to booking success
- [x] 5.4 Add button press scale animations (spring `whileTap` on ShopListItem, `active:scale` on CTAs)
- [x] 5.5 Add card selection animations (framer-motion spring transitions)

## 6. Web PWA - Keyboard Awareness

- [x] 6.1 Add VisualViewport API listener to checkout (`useKeyboardAware` hook)
- [x] 6.2 Adjust fixed CTA footer position when keyboard is open
- [x] 6.3 Add appropriate keyboard types to input fields (inputMode, autoComplete, `text-[16px]` on mobile inputs)

## 7. Web PWA - Share & Push

- [x] 7.1 Add native share button to ShopDetailClient
- [x] 7.2 Add native share button to booking success page
- [x] 7.3 Add push notification permission UI after first booking (`WebPushOptIn` on success page)
- [x] 7.4 Add notification preference toggle in profile (already exists, unmodified)

## 8. Web PWA - MobileNav İyileştirmeleri

- [x] 8.1 Remove `/shop/` and `/checkout/` from MobileNav hide list
- [x] 8.2 Add contextual back button to MobileNav on detail pages
- [x] 8.3 Ensure MobileNav doesn't cover CTA buttons on checkout (added `pb-[calc(...+4.5rem)]` to footer)

## 9. Flutter - Platform Adaptive Widget'lar

- [ ] 9.1 Add platform detection utility (iOS vs Android)
- [ ] 9.2 Add Cupertino-style navigation for iOS
- [ ] 9.3 Refactor bottom sheets to use platform-adaptive style
- [ ] 9.4 Add iOS-style action sheets where applicable

## 10. Flutter - Gesture İyileştirmeleri

- [ ] 10.1 Add swipe-back gesture support to detail pages
- [ ] 10.2 Enhance image gallery with pinch-to-zoom
- [ ] 10.3 Add hero animation between search list and detail

## 11. Test & Doğrulama

- [ ] 11.1 Test all flows on iOS Safari (iPhone SE, iPhone 15 Pro)
- [ ] 11.2 Test all flows on Android Chrome (Samsung, Pixel)
- [ ] 11.3 Test offline behavior (airplane mode)
- [ ] 11.4 Test PWA install prompt on Android
- [ ] 11.5 Test keyboard behavior on checkout form
- [ ] 11.6 Run `npm run lint` and fix any issues
- [ ] 11.7 Run `npm run typecheck`
