/* Season-only, in-memory preview UI. No storage writes or provider requests. */
let seasonLineupPreviewState = null;
let seasonLineupPreviewCleanup = () => {};
function clearSeasonLineupPreviewAfterSync(profileId) {
  if (seasonLineupPreviewState?.profileId === profileId) {
    const api = window.FantasyHQLineupPreviewV1;
    seasonLineupPreviewState = api.reset(seasonLineupPreviewState, api.differs(seasonLineupPreviewState) ? 'Preview reset after Yahoo refresh. Current Lineup restored; no preview was sent to Yahoo.' : 'Yahoo refreshed. Current Lineup restored.');
    // Reconciliation carries the notice onto the new authoritative snapshot.
    seasonLineupPreviewState = { ...seasonLineupPreviewState, signature:null };
  }
}
function renderSeasonLineupWorkspace(model, content) {
  seasonLineupPreviewCleanup();
  const api = window.FantasyHQLineupPreviewV1, evidence = window.FantasyHQCurrentWeekEvidenceV1;
  const priorNotice = seasonLineupPreviewState?.profileId === model.profileId && seasonLineupPreviewState?.signature === null ? seasonLineupPreviewState.message : '';
  seasonLineupPreviewState = api.reconcile(seasonLineupPreviewState, model);
  if (priorNotice) seasonLineupPreviewState = { ...seasonLineupPreviewState, message:priorNotice };
  const host = seasonEl('section', 'seasonLineupWorkspace');
  host.dataset.lineupWorkspace = 'preview-only';
  content.appendChild(host);
  let selected = null, lockTimer = null;
  const refreshLocks = () => {
    if (!host.isConnected) { cleanup(); return; }
    repaint();
  };
  const onVisible = () => { if (document.visibilityState === 'visible') refreshLocks(); };
  const cleanup = () => {
    if (lockTimer !== null) clearTimeout(lockTimer);
    lockTimer = null;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', refreshLocks);
  };
  seasonLineupPreviewCleanup = cleanup;
  const scheduleLockCheck = () => {
    if (lockTimer !== null) clearTimeout(lockTimer);
    lockTimer = null;
    if (seasonLineupPreviewState.mode === 'CURRENT') return;
    const now = Date.now(), next = api.nextBoundary(model, now);
    if (next !== null) lockTimer = setTimeout(refreshLocks, Math.min(2147483647, Math.max(1, next - now)));
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', refreshLocks);
  const authoritativeDecision = seasonStartSitEvaluation(model);
  const money = value => Number.isFinite(value) ? value.toFixed(2) : 'Unavailable';
  const repaint = () => {
    const now = Date.now(), safe = api.revalidate(seasonLineupPreviewState, model, now);
    if (safe !== seasonLineupPreviewState) selected = null;
    seasonLineupPreviewState = safe;
    const state = safe, preview = api.consume(model, state, evidence, now), changed = api.differs(state), blocked = api.gate(model), modes = [['CURRENT','Current Lineup'],['FANTASY_HQ','Fantasy HQ Lineup'],['CUSTOM','Custom Preview']];
    host.replaceChildren();
    const controls = seasonEl('div', 'seasonWorkspaceControls');
    controls.setAttribute('aria-label', 'Lineup preview modes');
    modes.forEach(([key,label]) => {
      const button = seasonButton(label, () => {
        selected = null;
        seasonLineupPreviewState = key === 'CURRENT' ? api.reset(state) : key === 'FANTASY_HQ' ? api.recommended(state, model, authoritativeDecision, Date.now()) : { ...state, mode:'CUSTOM', message:'Select a bench player, then a highlighted starter slot. Yahoo stays unchanged.' };
        repaint();
      }, 'seasonMiniButton');
      button.setAttribute('aria-pressed', String(state.mode === key));
      controls.appendChild(button);
    });
    const undo = seasonButton('Undo last change', () => { selected = null; seasonLineupPreviewState = api.undo(state, model, Date.now()); repaint(); }, 'seasonMiniButton');
    undo.disabled = !state.history.length;
    controls.append(undo, seasonButton('Reset to current', () => { selected = null; seasonLineupPreviewState = api.reset(state, 'Current Yahoo lineup restored.'); repaint(); }, 'seasonTextButton'));
    const notice = seasonEl('p', 'seasonTrustNote', blocked || state.message || 'PREVIEW ONLY • Select a bench player, then a legal starter slot. Apply desired changes manually in Yahoo.');
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    host.append(controls, notice);
    const dashboard = seasonEl('div', 'seasonV3Dashboard'), left = seasonEl('section', 'seasonPanel seasonWorkspaceRoster'), right = seasonEl('section', 'seasonPanel seasonWorkspaceMatchup');
    left.appendChild(seasonV3LandmarkHeader('MY LINEUP', '◈'));
    left.appendChild(seasonEl('p', 'seasonTrustNote', `${model.roster.length} players • ${modes.find(([key]) => key === state.mode)[1]} • Yahoo source preserved`));
    const playerCopy = player => {
      const box = seasonEl('span', 'seasonWorkspacePlayer');
      box.appendChild(seasonEl('strong', '', player?.name || 'Open slot'));
      if (!player) return box;
      const p = player.currentWeek?.projection, g = player.currentWeek?.game, actual = player.currentWeek?.actual;
      box.appendChild(seasonEl('small', '', `${player.position || '—'} • ${player.sourceTeam || '—'} • ${player.opponent || 'Opponent unavailable'}`));
      box.appendChild(seasonEl('small', 'seasonWorkspaceEvidence', g?.state === 'FINAL' && actual?.supported ? `${money(actual.value)} • Yahoo actual` : p?.supported ? `${money(p.value)} • ${p.label || p.source} • ${p.freshness}` : `Projection unavailable • ${p?.reason || 'Missing evidence'}`));
      box.appendChild(seasonEl('small', '', `${g?.state || 'UNKNOWN'}${player.injuryStatus ? ` • ${player.injuryStatus}` : ''}`));
      return box;
    };
    [['STARTERS','starters'],['BENCH','bench'],['IR • NON-SWAPPABLE','ir'],['UNASSIGNED • NON-SWAPPABLE','unassigned']].forEach(([title,key]) => {
      if (!state.lineup[key]?.length && key !== 'bench') return;
      left.appendChild(seasonEl('h3', 'seasonRosterGroup', title));
      (preview.lineup[key] || []).forEach((row,index) => {
        const reason = api.movement(row), choice = selected && key === 'starters' ? api.validate(model, state.lineup, selected, index) : null;
        const line = seasonEl('div', `seasonWorkspaceRow${choice?.ok ? ' legal' : ''}${selected === api.id(row.player) ? ' selected' : ''}`);
        line.append(seasonEl('b', 'seasonLineupSlot', row.slot), playerCopy(row.player));
        const action = seasonEl('span', 'seasonWorkspaceAction');
        if (key === 'bench') {
          const pick = seasonButton(selected === api.id(row.player) ? 'Cancel selection' : 'Select', () => { selected = selected === api.id(row.player) ? null : api.id(row.player); repaint(); }, 'seasonMiniButton');
          pick.disabled = Boolean(blocked || reason || !row.player);
          pick.setAttribute('aria-label', `Select ${row.player?.name || 'empty bench slot'} for preview`);
          pick.setAttribute('aria-pressed', String(selected === api.id(row.player)));
          action.appendChild(pick);
        } else if (key === 'starters' && selected) {
          const swap = seasonButton('Preview swap', () => { seasonLineupPreviewState = api.custom(state, model, selected, index, Date.now()); selected = null; repaint(); }, 'seasonMiniButton');
          swap.disabled = !choice?.ok;
          swap.setAttribute('aria-label', `Preview swap into ${row.slot} for ${row.player?.name || 'open slot'}`);
          action.appendChild(swap);
        }
        action.appendChild(seasonEl('small', '', key === 'ir' ? 'IR • non-swappable' : choice && !choice.ok ? choice.reason : reason || 'CHANGEABLE'));
        line.appendChild(action); left.appendChild(line);
      });
    });
    right.appendChild(seasonV3LandmarkHeader(`WEEK ${model.week} MATCHUP`, '◉'));
    right.appendChild(seasonEl('p', 'seasonTrustNote', `${modes.find(([key]) => key === state.mode)[1]} vs ${model.opponent?.name || 'Opponent unavailable'} • Opponent: Yahoo authoritative`));
    const current = preview.previewBaselineOutlook, after = preview.currentWeekEvidence?.userOutlook, opponent = preview.currentWeekEvidence?.opponentOutlook;
    const outlook = seasonEl('section', 'seasonV3CurrentOutlook');
    outlook.appendChild(seasonEl('b', '', 'FANTASY HQ CURRENT OUTLOOK'));
    const showOutlook = (label, own) => outlook.appendChild(seasonEl('strong', '', `${label}: ${own?.status === 'AVAILABLE' && opponent?.status === 'AVAILABLE' ? `${money(own.value)} – ${money(opponent.value)}` : 'Unavailable'}`));
    showOutlook('Current', current);
    if (changed) {
      showOutlook('Preview', after);
      const delta = current?.status === 'AVAILABLE' && after?.status === 'AVAILABLE' ? after.value - current.value : null;
      outlook.appendChild(seasonEl('strong', '', `Net: ${delta === null ? 'Unavailable' : `${delta >= 0 ? '+' : ''}${money(delta)}`}`));
    }
    outlook.appendChild(seasonEl('span', '', after?.status !== 'AVAILABLE' || opponent?.status !== 'AVAILABLE' ? after?.reason || opponent?.reason || 'Safe outlook unavailable.' : 'Completed: Yahoo actuals. Unstarted: supported projections. Live: unavailable without safe evidence. Bench excluded.'));
    right.appendChild(outlook);
    const yahoo = model.matchupComparison;
    if (yahoo?.userWeeklyProjectedPoints != null || yahoo?.opponentWeeklyProjectedPoints != null) right.appendChild(seasonEl('p', 'seasonTrustNote', `Yahoo weekly lineup projection (authoritative lineup only): ${money(yahoo.userWeeklyProjectedPoints)} – ${money(yahoo.opponentWeeklyProjectedPoints)}. Separate from Fantasy HQ Current Outlook.`));
    const opponents = [...(preview.opponentLineup?.starters || [])], used = new Set();
    preview.lineup.starters.forEach(row => {
      const index = opponents.findIndex((other,i) => !used.has(i) && api.slot(other.slot) === api.slot(row.slot));
      if (index >= 0) used.add(index);
      const pair = seasonEl('div', 'seasonWorkspacePair');
      pair.append(seasonEl('b', '', row.slot), playerCopy(row.player), playerCopy(opponents[index]?.player)); right.appendChild(pair);
    });
    opponents.forEach((row,index) => { if (!used.has(index)) { const pair = seasonEl('div', 'seasonWorkspacePair'); pair.append(seasonEl('b', '', row.slot), playerCopy(null), playerCopy(row.player)); right.appendChild(pair); } });
    right.appendChild(seasonV3PositionBattle(preview).node);
    const impacts = api.changes(state);
    if (impacts.length) {
      const panel = seasonEl('section', 'seasonWorkspaceImpacts'); panel.appendChild(seasonEl('h3', '', 'LINEUP IMPACT'));
      const decisions = authoritativeDecision?.decisions || [];
      impacts.forEach(change => {
        const decision = decisions.find(d => api.id(d.starter) === api.id(change.outgoing) && api.id(d.alternative) === api.id(change.incoming));
        const oldValue = change.outgoing?.currentWeek?.outlookContribution?.value, newValue = change.incoming?.currentWeek?.outlookContribution?.value, delta = Number.isFinite(oldValue) && Number.isFinite(newValue) ? newValue-oldValue : null;
        const item = seasonEl('article', 'seasonWorkspaceImpact');
        item.append(seasonEl('strong', '', `Start ${change.incoming?.name || 'Open slot'} • Bench ${change.outgoing?.name || 'Open slot'}`), seasonEl('span', '', `Fantasy HQ Outlook: ${delta === null ? 'Unavailable' : `${delta >= 0 ? '+' : ''}${money(delta)}`}`), seasonEl('small', '', decision ? `${decision.state} • ${decision.reason} ${decision.timingReason}` : 'Custom choice; no existing supported Start/Sit comparison for this pair.'));
        panel.appendChild(item);
      });
      right.appendChild(panel);
    }
    right.appendChild(seasonEl('p', 'seasonV3WeeklyRead', `${changed ? 'PREVIEW WEEKLY READ' : 'WEEKLY READ'} • ${preview.currentWeekEvidence.weeklyRead.text}`));
    dashboard.append(left,right); host.appendChild(dashboard);
    const intelligence = seasonStartSitEvaluation(preview);
    host.appendChild(seasonLineupOptimizerCard(preview, intelligence, { compact:true }));
    host.appendChild(seasonEl('p', 'seasonTrustNote', 'Start/Sit above uses the displayed lineup. Season record, Yahoo matchup totals, waiver advice, and the weekly action plan remain based on authoritative Yahoo state.'));
    const lower = seasonEl('section', 'seasonV3Lower'), swing = seasonV3SwingPlayers(preview), improvements = seasonV3RosterImprovements(model);
    if (swing) { swing.appendChild(seasonEl('p', 'seasonTrustNote', 'Swing Players: roster-wide evidence from the authoritative Yahoo roster; not reranked by preview starter placement.')); lower.appendChild(swing); }
    if (improvements) lower.appendChild(improvements);
    if (lower.childElementCount) host.appendChild(lower);
    const plan = seasonWeeklyPlan(model), actions = seasonV3Decisions(plan, model);
    actions.appendChild(seasonEl('p', 'seasonTrustNote', 'Weekly action plan: authoritative Yahoo state. Preview Start/Sit is shown above.'));
    host.appendChild(actions);
    scheduleLockCheck();
  };
  repaint();
}
