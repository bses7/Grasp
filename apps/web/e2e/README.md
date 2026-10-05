# e2e

Playwright smoke tests. V1 (docs/16 full tree).

Planned coverage, none written in MVP:

- Consent to lesson flow in the mouse condition (no camera in CI).
- The privacy assertion from docs/15: intercept `fetch`, `sendBeacon`, `XMLHttpRequest`, IndexedDB and `localStorage` writes during a scripted lesson and assert no binary payloads leave the page.
- Security headers present on every page response (`proxy.ts`).

Unit tests are colocated `*.test.ts` files run with Vitest inside each package, not here.
