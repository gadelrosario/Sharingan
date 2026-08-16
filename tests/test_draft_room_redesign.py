import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class DraftRoomRedesignTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
        cls.html = (ROOT / 'index.html').read_text(encoding='utf-8')
        cls.css = (ROOT / 'css' / 'app.css').read_text(encoding='utf-8')

    def test_desktop_decision_structure(self):
        for name in ('fightControlPanel', 'searchPanel', 'recommendationCarousel', 'draftBoardNotesRow'):
            self.assertIn(name, self.html)
        self.assertNotIn('<footer class="draftActionBar"', self.html)

    def test_top_recommendations_render_five_clickable_players(self):
        render = self.app.split('function renderRecommendation', 1)[1].split('function commandScoreLabel', 1)[0]
        self.assertIn('recs.slice(0,5)', render)
        self.assertIn('onclick="viewRecommendationPlayer(${p.id})"', self.app)
        self.assertIn("active?'active':''", self.app)

    def test_selection_does_not_record_and_record_uses_fight_card_target(self):
        selection = self.app.split('function selectCandidate', 1)[1].split('function toggleMobileTeam', 1)[0]
        self.assertNotIn('selectPlayer(', selection)
        record = self.app.split('function recordFightCardPlayer', 1)[1].split('function renderBoard', 1)[0]
        self.assertIn('recordCurrentPick(player.id)', record)

    def test_search_selects_without_drafting(self):
        players = self.app.split('function renderPlayers', 1)[1].split('function renderAll', 1)[0]
        self.assertIn('class="searchResultPlayer"', players)
        self.assertIn('onclick="selectCandidate(${player.id})"', players)
        self.assertIn('No available players match.', players)

    def test_undo_and_persistence_paths_remain_active(self):
        self.assertIn('function undoLastPick()', self.app)
        self.assertIn('persistDraftSession()', self.app)
        self.assertIn("DraftSessionV1.loadNote()", self.app)

    def test_notes_are_advisory_and_round_reminders_are_deterministic(self):
        command = """
const notes=require('./js/draft-session-v1.js');
const text=`Round 5:\nTarget TE.\n\nRounds 10–12:\nUpside RBs.`;
const five=notes.remindersForRound(text,5),eleven=notes.remindersForRound(text,11),nine=notes.remindersForRound(text,9);
if(five.length!==1||five[0].text!=='Target TE.'||eleven.length!==1||nine.length!==0)process.exit(1);
"""
        result = subprocess.run([str(NODE), '-e', command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        intelligence = (ROOT / 'js' / 'jonin-decision-intelligence-v1.js').read_text(encoding='utf-8')
        self.assertNotIn('loadNote', intelligence)
        self.assertNotIn('NOTE_KEY', intelligence)

    def test_responsive_and_accessibility_contracts(self):
        self.assertIn('@media(max-width:760px)', self.css.replace(' ', ''))
        self.assertIn('aria-pressed="${active}"', self.app)
        self.assertIn('data-testid="view-details"', self.html)
        self.assertIn('aria-label="Fantasy HQ notebook"', self.html)

    def test_stable_surface_hooks_and_search_label(self):
        for hook in (
            'draft-status-header', 'board-instruction-strip', 'fight-card',
            'search-panel', 'recommendation-carousel', 'draft-board',
            'notes-panel', 'record-pick', 'undo-pick',
        ):
            self.assertEqual(self.html.count(f'data-testid="{hook}"'), 1)
        self.assertIn('<label class="srOnly" for="dSearch">Search any player</label>', self.html)

    def test_selection_and_record_target_share_canonical_id(self):
        render = self.app.split('function renderRecommendation', 1)[1].split('function commandScoreLabel', 1)[0]
        self.assertIn('selectedCandidateId', render)
        self.assertIn("DOM.recordPickBtn.dataset.playerId=displayed?.id??''", self.app)
        record = self.app.split('function recordFightCardPlayer', 1)[1].split('function renderBoard', 1)[0]
        self.assertIn("players.find(candidate=>candidate.id===id&&!drafted.includes(candidate.id))", record.replace(' ', ''))

    def test_desktop_workspace_has_three_equal_height_panels(self):
        self.assertIn('data-testid="live-team-tracker"', self.html)
        self.assertNotIn('<details class="card liveTeamTracker"', self.html)
        compact = ''.join(self.css.split())
        self.assertIn("grid-template-areas:'fightcommandtracker'", compact)
        self.assertIn('.fightControlPanel,#appScreen.searchPanel,#appScreen.liveTeamTracker{height:320px}', compact)

    def test_recommendations_offer_separate_view_and_shared_draft_actions(self):
        markup = self.app.split('function alternativeDecisionMarkup', 1)[1].split('function renderRecommendation', 1)[0]
        self.assertIn('>View</button>', markup)
        self.assertIn('>Draft</button>', markup)
        self.assertIn('onclick="viewRecommendationPlayer(${p.id})"', markup)
        self.assertIn('onclick="draftRecommendationPlayer(${p.id})"', markup)
        shared = self.app.split('function draftRecommendationPlayer', 1)[1].split('function renderBoard', 1)[0]
        self.assertIn('recordFightCardPlayer()', shared)
        self.assertIn('!drafted.includes(candidate.id)', shared)

    def test_live_tracker_uses_roster_assignment_and_refresh_path(self):
        tracker = self.app.split('function liveTeamTrackerMarkup', 1)[1].split('function renderWaitMeter', 1)[0]
        self.assertIn('state=rosterViewState()', tracker)
        self.assertIn('state.starters.map', tracker)
        self.assertNotIn('state.starters.filter', tracker)
        self.assertIn('state.bench||[]', tracker)
        self.assertIn('state.overflow||[]', tracker)
        self.assertIn('PlayerTierContract.getDecisionTier(p)', tracker)
        live = self.app.split('function renderLiveRoster', 1)[1].split('function renderWaitMeter', 1)[0]
        self.assertIn('desktopLiveTeamTracker', live)
        after_pick = self.app.split('function renderAfterPick', 1)[1].split('function selectPlayer', 1)[0]
        self.assertIn('renderLiveRoster()', after_pick)
        undo = self.app.split('function undoLastPick', 1)[1].split('function syncSearch', 1)[0]
        self.assertIn('renderAll()', undo)

    def test_board_is_full_width_and_notes_are_a_drawer(self):
        board_row = self.html.split('<section class="draftBoardNotesRow">', 1)[1].split('</section>', 1)[0]
        self.assertIn('data-testid="draft-board"', board_row)
        self.assertNotIn('data-testid="notes-panel"', board_row)
        self.assertIn('class="card scrollNotebook notesPanel notesDrawer hidden"', self.html)
        self.assertIn('onclick="openNotebook()"', self.html)
        self.assertIn('class="headerNotesButton"', self.html)
        self.assertIn('>📝 Notes</button>', self.html)
        self.assertIn('aria-label="Close notes"', self.html)
        self.assertIn('function openNotebook()', self.app)
        self.assertIn("event.key==='Escape'", self.app)

    def test_simulate_is_contained_and_board_control_is_semantic(self):
        strip = self.html.split('id="boardInstruction"', 1)[1].split('</section>', 1)[0]
        self.assertIn('id="practiceControls"', strip)
        self.assertIn('id="simulateBtn"', strip)
        self.assertEqual(self.html.count('id="simulateBtn"'), 1)
        self.assertIn("function boardControlState(score)", self.app)
        self.assertIn("score>=72?'HIGH':score>=55?'MEDIUM':'LOW'", self.app)
        self.assertNotIn('<small>COMMAND CENTER</small>', self.html)
        self.assertIn('Summarizes how much flexibility and leverage', self.html)
        render_meta = self.app.split('function renderMeta()', 1)[1].split('function teamPlayers', 1)[0]
        self.assertIn("classList.toggle('hidden', mode !== 'practice')", render_meta)

    def test_actions_live_in_fight_card_and_bottom_bar_is_removed(self):
        fight = self.html.split('data-testid="fight-card"', 1)[1].split('</div>\n\n  <div class="card desktopDraftCommand', 1)[0]
        self.assertIn('data-testid="record-pick"', self.html)
        self.assertIn('data-testid="record-pick"', fight)
        self.assertIn('data-testid="view-details"', fight)
        self.assertNotIn('<footer class="draftActionBar"', self.html)

    def test_header_contains_only_approved_controls_and_notes_is_labeled(self):
        header = self.html.split('data-testid="draft-status-header"', 1)[1].split('</section>', 1)[0]
        self.assertIn('📝 Notes', header)
        self.assertIn('Draft Mode', header)
        for removed in ('Rankings', 'Cheat Sheet', 'History', '>Board<', '>Rosters<', '>Sync<'):
            self.assertNotIn(removed, header)

    def test_recommendation_categories_use_live_existing_metrics(self):
        categories = self.app.split('function recommendationCategoryLabels', 1)[1].split('function alternativeDecisionMarkup', 1)[0]
        for label in ('Recommended Pick', 'Best Value', 'Best Team Fit', 'Highest Ceiling', 'Safest Pick'):
            self.assertIn(label, categories)
        self.assertIn('scoreComponents(model.player)', categories)

    def test_search_filters_are_pinned_before_results(self):
        search = self.html.split('data-testid="search-panel"', 1)[1].split('data-testid="live-team-tracker"', 1)[0]
        filters = search.index('class="desktopPositionFilters"')
        recent = search.index('class="recentSearches"')
        results = search.index('id="dPlayersList"')
        self.assertLess(filters, recent)
        self.assertLess(recent, results)
        for position in ('QB', 'RB', 'WR', 'TE', 'DST', 'K', 'ALL'):
            self.assertIn(f'data-pos="{position}"', search)
        compact = ''.join(self.css.split())
        self.assertIn('.desktopPositionFilters{display:flex!important;visibility:visible!important;position:static', compact)
        self.assertIn('.searchPanel#dPlayersList{flex:11auto;min-height:0;max-height:none;overflow-x:hidden;overflow-y:auto', compact)

    def test_search_filter_visibility_is_independent_of_query_and_recommendations(self):
        render_players = self.app.split('function renderPlayers()', 1)[1].split('function renderAll()', 1)[0]
        render_recommendations = self.app.split('function renderRecommendation()', 1)[1].split('function boardControlState', 1)[0]
        self.assertNotIn('desktopPositionFilters', render_players)
        self.assertNotIn('desktopPositionFilters', render_recommendations)
        self.assertIn('recs.slice(0,5)', render_recommendations)

    def test_board_uses_page_vertical_scroll_and_horizontal_wrapper_scroll(self):
        compact = ''.join(self.css.split())
        self.assertIn('.draftBoardNotesRow.boardWrap{height:auto!important;max-height:none;overflow-x:auto;overflow-y:visible', compact)
        self.assertIn('#mobileBoard.boardWrap{overflow-x:auto;overflow-y:auto;touch-action:pan-xpan-y', compact)
        board = self.app.split('function renderBoard()', 1)[1].split('function boardCellClasses', 1)[0]
        self.assertIn('r <= TOTAL_ROUNDS', board)
        self.assertIn('desktopBoard', board)

    def test_drawers_do_not_lock_document_scrolling(self):
        notes = self.app.split('function openNotebook()', 1)[1].split('function dismissRoundNoteReminder', 1)[0]
        details = self.app.split('function openScan(id)', 1)[1].split('function selectCandidate', 1)[0]
        for source in (notes, details):
            self.assertNotIn('document.body.style.overflow', source)
            self.assertNotIn('overflow =', source)
            self.assertNotIn("classList.add('scrollLock')", source)

    def test_persistence_contract_remains_shared(self):
        self.assertIn('draftSessionStore.save(currentDraftSessionState', self.app)
        self.assertIn('DraftSessionV1.saveNote(value)', self.app)
        self.assertIn('DraftSessionV1.loadNote()', self.app)
        self.assertIn('DraftSessionV1.remindersForRound', self.app)


if __name__ == '__main__':
    unittest.main()
