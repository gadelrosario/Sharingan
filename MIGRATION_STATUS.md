# Migration status

## Preserved in this build

- Mission Briefing and league setup
- Practice Mock, Yahoo Live Mock, and Live Draft flows
- Complete recommendation and Mamba scoring logic
- Value Override
- Sharingan Scan and full Sharingan Vision
- Position Window
- Room Intel
- Peek Ahead
- Smart Draft Board and quick picks
- Visual snake board
- Roster construction and NFL team exposure
- Wait Meter
- Draft plan and strategy health
- Recently drafted and undo
- Draft report and league projections
- Yahoo JSON/CSV exports and archive
- Mobile and desktop layouts

## Foundation migration completed

The original giant `index.html` is now separated into HTML, CSS, JavaScript, data, and PWA files without replacing the established feature set. Further engine/component separation can now happen incrementally while this build remains usable for practice.
