# Screenshots

The `@vulos/mail-ui` gallery is captured by a Playwright screenshotter that
boots the shared components against a **mock `/v1` backend** — the standalone
demo in `src/demo/` driven by `src/demo/mockClient.js` (seeded fixtures). No live
IMAP / SMTP / CalDAV / CardDAV server and **no credentials** are required.

## Gallery

| File | Description | Status |
|------|-------------|--------|
| `docs/screenshots/inbox.png` | Full layout: comprehensive sidebar \| list \| reading pane \| calendar panel \| rail | Real — mock `/v1` |
| `docs/screenshots/hero.png` | Open conversation alongside the right calendar side panel (hero) | Real — mock `/v1` |
| `docs/screenshots/mail.png` | `<MailApp/>` inbox (alias) | Real — mock `/v1` |
| `docs/screenshots/sidebar.png` | Left rail: primary mailboxes, More, Categories, Labels, storage | Real — mock `/v1` |
| `docs/screenshots/thread.png` | Conversation view (collapsible thread, latest expanded) | Real — mock `/v1` |
| `docs/screenshots/compose.png` | Docked compose with contact autocomplete + rich text | Real — mock `/v1` |
| `docs/screenshots/search.png` | Search results with active-query chip | Real — mock `/v1` |
| `docs/screenshots/calendar.png` | Right calendar panel: mini month + upcoming agenda | Real — mock `/v1` |
| `docs/screenshots/calendar-expanded.png` | Right calendar panel expanded to the full month grid | Real — mock `/v1` |
| `docs/screenshots/contacts.png` | `<Contacts/>` side panel | Real — mock `/v1` |
| `docs/screenshots/account.png` | Account surface (`settingsExtra`): identity, IMAP/SMTP setup, password | Real — mock `/v1` |
| `docs/screenshots/settings.png` | Settings: inbox type, theme, notifications, calendar, labels, storage | Real — mock `/v1` |
| `docs/screenshots/panel-thread.png` | Overlay panel + open conversation (list collapses) | Real — mock `/v1` |
| `docs/screenshots/mobile.png` | Mobile single-pane inbox (≤768px) | Real — mock `/v1` |
| `docs/screenshots/mobile-drawer.png` | Mobile drawer: full sidebar + tools | Real — mock `/v1` |

## Regenerate

```bash
npm install            # first time (installs Playwright)
npm run screenshots    # builds the demo SPA + captures all screens
```

This will:
1. Build the standalone demo SPA (`npm run build` → `dist/`) if not already built.
2. Serve `dist/` over a tiny in-process static server (no extra deps).
3. Launch headless Chromium (1280×800, dark, 2× DPI) and capture the Mail,
   Calendar, and Contacts tabs to `docs/screenshots/`.

Capture an already-running demo instead (e.g. `npm run dev`):

```bash
BASE_URL=http://localhost:5173 MAILUI_EXTERNAL=1 npm run screenshots
```

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Runs Vite + the Playwright script |
| Playwright Chromium | — | `npm install` pulls the `playwright` package; run `npx playwright install chromium` once if the browser is missing |

## Reproducibility

The demo seed lives in `src/demo/mockClient.js`. Calendar event dates are
relative to `Date.now()` at build time, so the visible month tracks the current
date; message and contact content are stable.
