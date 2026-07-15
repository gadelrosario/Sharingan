# Gerard Fantasy HQ — Version 2.0 Alpha 6

## Complete Pool Cache Fix

The Alpha 5 database already contained 32 D/STs and 32 kickers, but an older cached `players.json` could remain active on phones.

This release:
- Forces a fresh player database download
- Uses network-first loading for `players.json`
- Deletes older service-worker caches
- Adds a setup-screen pool verification count
- Retains all Alpha 5 Sharingan Scan and ranking features

Expected verification:
- 249 total players
- QB 27
- RB 57
- WR 76
- TE 25
- D/ST 32
- K 32

## Install
1. Replace the beta repository files with this full build.
2. Commit: `Version 2 Alpha 6 - Complete Pool Cache Fix`
3. Push origin.
4. Wait for GitHub Pages deployment.
5. Open the website in Safari and confirm the pool count before starting a draft.
