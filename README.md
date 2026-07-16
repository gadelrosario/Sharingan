# Gerard Fantasy HQ — Version 2.0 Alpha 12.3 Stability Build

Install this folder directly; no earlier version is required.

## Stability work
- Fixed the `rosterRows is not defined` startup crash by restoring the roster engine before the draft UI renders.
- Added a single guarded render cycle so one panel cannot silently stop the rest of the draft room.
- Added visible recovery messaging for runtime errors instead of dead buttons.
- Start Draft remains disabled until the complete player pool is loaded.
- Repaired alternate-player Sharingan Scan buttons without relying on the browser's global `event` object.
- Highlighting another option keeps recommendation order intact and opens the full comparison card.
- Once QB or TE is filled, those positions remain excluded from the Top 5, Draft Room Scan urgency, and Wait Meter guidance.
- Restored the full 17-round roster by adding the sixth bench slot.
- Updated cache versioning so the Stability Build replaces older Alpha 12 files cleanly.

Upload every file and folder together to GitHub Pages. After deployment, refresh once. If an older version remains, use a hard refresh or clear the site data one time.
