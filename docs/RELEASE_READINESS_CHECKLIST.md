# Release Readiness Checklist

## 1) Core User Flows
- Guest registration, email verification, login
- Partner login, panel access, shop settings save
- Search -> shop detail -> request booking
- Partner approval/reject flow
- Payment flow (request approved -> pay -> booking paid)
- Partner check-in (seal + photo) and check-out
- Guest booking detail, cancellation, dispute, review

## 2) Critical Security/Operations
- Rate limit smoke test (rapid page switches, auth, payment endpoints)
- `REDIS_URL` present in production (compose default `redis://redis:6379`)
- Webhook signature verification validated in production logs
- No dev credentials or `.env` leaks in repository

## 3) UX/Localization
- No blocking native `alert/confirm` in critical flows
- Error/success messaging uses unified toast + inline state
- Mobile bottom navigation does not overlap checkout/auth critical screens
- Turkish + English key screens reviewed for missing translation keys
- Address editing works (street/neighborhood/building/door/postal code)

## 4) Data Integrity
- Booking statuses transition correctly:
  - `WAITING_APPROVAL` -> `APPROVED/PENDING` -> `PAID` -> `CHECKED_IN` -> `CHECKED_OUT`
- Cancellation policy outputs expected refund/credit behavior
- Capacity checks prevent overselling on overlapping windows
- Seal assignment/check-in/check-out keeps serial consistency

## 5) Infrastructure
- Nginx health check returns 200 (`/api/health/live`)
- `web`, `nginx`, `postgres`, `redis` containers healthy
- Backup/restore procedure tested for database

## 6) Go-Live Gate
- No critical/blocker bug in staging smoke
- Known issues documented with owner + ETA
- Rollback plan written (image tag + DB rollback steps)
- On-call contact and escalation route confirmed
