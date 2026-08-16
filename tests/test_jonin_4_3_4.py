import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class Jonin434Tests(unittest.TestCase):
    def run_node(self, script):
        result = subprocess.run([str(NODE), script], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def test_draft_session_resilience(self):
        self.assertIn('Draft session resilience: 12 passed, 0 failed', self.run_node('tests/draft-session-resilience-tests.js'))

    def test_player_photo_contract(self):
        self.assertIn('Player photos: 5 passed, 0 failed', self.run_node('tests/player-photo-tests.js'))

    def test_bundled_photo_coverage_and_uniqueness(self):
        players = json.loads((ROOT / 'data/players.json').read_text())
        injuries = json.loads((ROOT / 'data/injuries_2026.json').read_text())
        canonical = {str(player['id']) for player in players}
        mapped = [row for row in injuries['records'] if str(row.get('playerId')) in canonical and str(row.get('sourcePlayerId', '')).strip()]
        self.assertEqual(len(mapped), 292)
        self.assertEqual(len({str(row['playerId']) for row in mapped}), 292)
        self.assertEqual(len({str(row['sourcePlayerId']) for row in mapped}), 292)

    def test_live_surfaces_use_lazy_canonical_photo_path_and_fallback(self):
        app = (ROOT / 'js/app.js').read_text()
        self.assertIn('PlayerPhotoV1?.createRegistry(snapshot)', app)
        self.assertIn('playerPhotoFor(player)', app)
        self.assertIn('searchResultPhoto', app)
        self.assertIn('trackerPlayerPhoto', app)
        self.assertGreaterEqual(app.count('loading="lazy"'), 4)
        self.assertIn('handlePlayerPortraitError(this)', app)
        self.assertIn('assets/player-placeholders/generic.svg', app)

    def test_photo_metadata_is_absent_from_decision_inputs(self):
        app = (ROOT / 'js/app.js').read_text()
        scoring = app.split('function playerDecisionModel', 1)[1].split('const playerCard =', 1)[0]
        self.assertNotIn('playerPhoto', scoring)
        self.assertNotIn('photoProvider', scoring)
        self.assertNotIn('photoUrl', scoring)

    def test_version_and_cache_are_434_without_state_key_rotation(self):
        version = (ROOT / 'js/app-version.js').read_text()
        worker = (ROOT / 'service-worker.js').read_text()
        session = (ROOT / 'js/draft-session-v1.js').read_text()
        self.assertIn("milestone:'4.3.6'", version)
        self.assertIn("fantasy-hq-jonin-4-3-6", worker)
        self.assertIn("fantasyHQ.activeDraft.v1", session)
        self.assertIn('DRAFT_STATE_VERSION=1', session)


if __name__ == '__main__':
    unittest.main()
