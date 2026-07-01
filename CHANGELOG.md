# Changelog

All notable changes to `@vulos/mail-ui` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added

- Calendar: week + day time-grid views (alongside month/agenda), and full
  create / edit / delete of events via a new `<EventEditor/>` modal — all-day,
  simple recurrence (daily/weekly/monthly/yearly → RRULE), location and notes.
  Click a day/time slot to add; click an event to edit. Wired to the CalDAV-backed
  `/v1` endpoints (`POST`/`PUT`/`DELETE /v1/calendar/events`).
- Contacts: add / edit / delete via a new `<ContactEditor/>` modal (name, org,
  title, multiple emails/phones, notes), backed by `GET /v1/contacts/cards` and
  the contact write endpoints. Falls back to the lean read-only search on older
  servers; compose autocomplete unchanged.
- API client: `updateEvent`, `listContactCards`, `createContact`,
  `updateContact`, `deleteContact`.

## [0.1.0] — 2026-06-28

### Added

- Initial release of `@vulos/mail-ui` — shared React webmail UI for Vulos.
- Talks to the lilmail `/v1` JSON API; compose, folder list, message list, sanitize.
- ESM + CJS dual build via Vite lib mode.
- Full test suite with Testing Library (172 tests across Compose, FolderList, MessageList, sanitize, reply).
