(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FantasyHQLineupPreviewV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const id = player => String(player?.sourcePlayerKey || player?.yahooPlayerId || player?.identity?.canonicalPlayerId || player?.canonicalPlayerId || player?.playerId || player?.id || '');
  const slot = value => { const s = String(value || '').toUpperCase().replace(/[^A-Z]/g, ''); return ({ DEF:'DST', DEFENSE:'DST', WRT:'FLEX', QWRT:'SUPERFLEX', WRTQ:'SUPERFLEX', BENCH:'BN', BE:'BN' })[s] || s; };
  const reserves = s => ['BN', 'IR', 'IRPLUS', 'IRNA', 'NA'].includes(slot(s));
  function slots(model) {
    return (model?.snapshot?.settings?.rosterSlots || []).flatMap(row => Array.from({ length: typeof row === 'object' ? Number(row.count) || 1 : 1 }, () => slot(typeof row === 'object' ? row.position : row))).filter(s => s && !reserves(s));
  }
  function gate(model, lineup = model?.lineup) {
    if (!model?.profileId || model.manualAuthority || model.draftSnapshot || model.demo || model.reviewMode || model.sourceLabel !== 'Yahoo' || !lineup?.authoritative || model.userTeamResolution?.status !== 'RESOLVED') return 'An authoritative, resolved Yahoo lineup is required.';
    if (model.stale) return 'Sync Yahoo before previewing a stale lineup.';
    const expected = slots(model).sort(), actual = (lineup.starters || []).map(row => slot(row.slot)).sort();
    if (!expected.length || JSON.stringify(expected) !== JSON.stringify(actual)) return 'Yahoo roster-slot structure is incomplete or ambiguous.';
    const players = ['starters','bench','ir','unassigned'].flatMap(key => (lineup[key] || []).map(row => row.player).filter(Boolean)), ids = players.map(id);
    if (ids.some(key => !key) || new Set(ids).size !== ids.length) return 'Roster identities are missing or duplicated.';
    return null;
  }
  function movement(row, now = Date.now()) {
    if (!row) return 'Destination slot unavailable';
    if (reserves(row.slot) && slot(row.slot) !== 'BN') return 'IR • non-swappable';
    const p = row.player;
    if (!p) return null;
    const g = p.currentWeek?.game, state = g?.state || p.gameStatus || p.gameState;
    if (['FINAL','COMPLETED'].includes(state)) return 'COMPLETED • locked';
    if (row.locked || p.locked || g?.locked || ['LIVE','IN_PROGRESS','LOCKED_UNKNOWN'].includes(state)) return 'LOCKED';
    if (p.ineligible || p.irOnly || ['IR','PUP','NFI'].includes(String(p.injuryStatus || '').toUpperCase())) return 'IR / INELIGIBLE';
    const kickoff = Date.parse(g?.kickoff || p.gameStart || '');
    if (!g || g.actionable !== true || state !== 'PRE_GAME' || !Number.isFinite(kickoff)) return 'Game/lock evidence unavailable';
    if (kickoff <= now) return 'LOCKED • kickoff passed';
    return null;
  }
  function eligible(player, destination) {
    // Exact Yahoo eligibility, including its composite slot token. Never infer FLEX from a player's base position.
    return Array.isArray(player?.eligiblePositions) && player.eligiblePositions.map(slot).includes(slot(destination));
  }
  function validate(model, lineup, benchId, starterIndex, now = Date.now()) {
    const reason = gate(model, lineup);
    if (reason) return { ok:false, reason };
    const benchIndex = lineup.bench.findIndex(row => id(row.player) === benchId), source = lineup.bench[benchIndex], target = lineup.starters[starterIndex];
    if (!source?.player || !target || !Number.isInteger(starterIndex)) return { ok:false, reason:'Source player or destination slot unavailable.' };
    const currentRows = sections.flatMap(key => model.lineup?.[key] || []);
    const currentSource = currentRows.find(row => id(row.player) === benchId);
    const currentTarget = target.player ? currentRows.find(row => id(row.player) === id(target.player)) : target;
    const blocked = movement(source, now) || movement(target, now) || movement(currentSource, now) || movement(currentTarget, now);
    if (blocked) return { ok:false, reason:blocked };
    if (!eligible(currentSource.player, target.slot)) return { ok:false, reason:'INELIGIBLE • Yahoo eligibility does not support this slot.' };
    if (slot(source.slot) !== 'BN' || target.player?.ineligible || target.player?.irOnly) return { ok:false, reason:'The outgoing player cannot enter this bench slot.' };
    return { ok:true, benchIndex, starterIndex };
  }
  function swap(model, lineup, benchId, starterIndex, now) {
    const check = validate(model, lineup, benchId, starterIndex, now);
    if (!check.ok) return { ...check, lineup };
    const next = clone(lineup), bench = next.bench[check.benchIndex], starter = next.starters[starterIndex], incoming = bench.player, outgoing = starter.player;
    starter.player = incoming; bench.player = outgoing;
    for (const row of [bench, starter]) if (row.player) { row.player.rosterSlot = row.slot; if (row.player.currentWeek) row.player.currentWeek.lineupSlot = row.slot; }
    return { ok:true, lineup:freeze(next) };
  }
  const signature = model => JSON.stringify([model.profileId, model.week, model.snapshot?.fetchedAt, model.snapshot?.settings?.rosterSlots, model.lineup]);
  function create(model, message = '') { const authoritative = freeze(clone(model.lineup)); return freeze({ profileId:model.profileId, signature:signature(model), authoritative, lineup:authoritative, mode:'CURRENT', history:[], message }); }
  const assignment = lineup => ['starters','bench','ir','unassigned'].map(key => (lineup[key] || []).map(row => [row.slot, id(row.player)]));
  const differs = state => JSON.stringify(assignment(state.lineup)) !== JSON.stringify(assignment(state.authoritative));
  function reconcile(state, model) {
    if (!state || state.profileId !== model.profileId) return create(model);
    return state.signature === signature(model) ? state : create(model, differs(state) ? 'Preview reset because Yahoo state or current evidence changed. Current Lineup restored.' : '');
  }
  function reset(state, message = '') { return freeze({ ...state, lineup:state.authoritative, mode:'CURRENT', history:[], message }); }
  const LOCK_RESET = 'Preview reset because lineup lock status changed.';
  const sections = ['starters','bench','ir','unassigned'];
  function validity(model, lineup, now = Date.now()) {
    const source = model.lineup;
    if (JSON.stringify(assignment(source)) === JSON.stringify(assignment(lineup))) return { ok:true };
    const reason = gate(model, lineup);
    if (reason) return { ok:false, reason };
    const locations = new Map(), seen = new Set();
    for (const key of sections) {
      const rows = source[key] || [], proposed = lineup[key] || [];
      if (rows.length !== proposed.length || rows.some((row,i) => row.slot !== proposed[i]?.slot)) return { ok:false, reason:'Roster structure changed.' };
      rows.forEach((row,index) => { if (row.player) locations.set(id(row.player), { row, key, index }); });
    }
    for (const key of sections) for (const [index,row] of (lineup[key] || []).entries()) {
      if (!row.player) continue;
      const playerId = id(row.player), original = locations.get(playerId);
      if (!original || seen.has(playerId)) return { ok:false, reason:'Roster identity changed.' };
      seen.add(playerId);
      if (original.key === key && (original.index === index || key === 'bench')) continue;
      const blocked = movement(original.row, now);
      if (blocked) return { ok:false, reason:blocked };
      if (!['starters','bench'].includes(key) || !['starters','bench'].includes(original.key) ||
          (key === 'starters' && !eligible(original.row.player, row.slot))) return { ok:false, reason:'Current eligibility does not permit this move.' };
    }
    return seen.size === locations.size ? { ok:true } : { ok:false, reason:'Roster player missing.' };
  }
  function revalidate(state, model, now = Date.now()) {
    if (state.profileId !== model.profileId) return create(model, LOCK_RESET);
    if (!validity(model, state.lineup, now).ok) return create(model, LOCK_RESET);
    return state;
  }
  function nextBoundary(model, now = Date.now()) {
    const rows = [...sections.flatMap(key => model.lineup?.[key] || []), ...(model.opponentLineup?.starters || [])];
    const times = rows.map(row => Date.parse(row.player?.currentWeek?.game?.kickoff || row.player?.gameStart || '')).filter(time => Number.isFinite(time) && time > now);
    return times.length ? Math.min(...times) : null;
  }
  // Advance only known pregame kickoffs through the existing conservative lock authority.
  // Never synthesize actuals, remaining points, or a live projected final.
  function atClock(model, evidence, now = Date.now()) {
    const update = player => {
      const game = player?.currentWeek?.game, kickoff = Date.parse(game?.kickoff || player?.gameStart || '');
      if (!game || game.state !== 'PRE_GAME' || !Number.isFinite(kickoff) || kickoff > now) return player;
      const lockedGame = evidence.game({ locked:true, gameStart:game.kickoff || player.gameStart }, { now, fetchedAt:game.updatedAt });
      return { ...player, locked:true, gameStatus:lockedGame.state, currentWeek:{ ...player.currentWeek, game:lockedGame, outlookContribution:null } };
    };
    const mapLineup = lineup => {
      if (!lineup) return lineup;
      let changed = false;
      const mapped = Object.fromEntries(sections.map(key => [key, (lineup[key] || []).map(row => {
        const player = update(row.player);
        if (player === row.player) return row;
        changed = true; return { ...row, player };
      })]));
      return changed ? { ...lineup, ...mapped } : lineup;
    };
    const lineup = mapLineup(model.lineup), opponentLineup = mapLineup(model.opponentLineup);
    return { ...model, lineup, opponentLineup, roster:(model.roster || []).map(update), currentWeekEvidence:{ ...model.currentWeekEvidence, userOutlook:evidence.outlook(lineup), opponentOutlook:evidence.outlook(opponentLineup) } };
  }
  function custom(state, model, benchId, index, now) {
    const safe = revalidate(state, model, now);
    if (safe !== state) return safe;
    const result = swap(model, state.lineup, benchId, index, now);
    if (!result.ok) return freeze({ ...state, message:result.reason });
    return freeze({ ...state, lineup:result.lineup, mode:'CUSTOM', history:[...state.history, { lineup:state.lineup, mode:state.mode }].slice(-30), message:'Custom Preview only. Yahoo is unchanged.' });
  }
  function undo(state, model, now = Date.now()) {
    const safe = revalidate(state, model, now);
    if (safe !== state) return safe;
    const history = [...state.history];
    let skipped = false;
    while (history.length) {
      const previous = history.pop();
      if (!validity(model, previous.lineup, now).ok) { skipped = true; continue; }
      return freeze({ ...state, ...previous, history, message:skipped ? 'Locked or ineligible undo history discarded; restored the previous legal lineup.' : 'Last preview change undone. Yahoo is unchanged.' });
    }
    return skipped ? freeze({ ...state, history:[], message:'Undo unavailable: locked or ineligible preview history discarded.' }) : state;
  }
  function recommended(state, model, evaluation, now) {
    let next = state.authoritative, applied = 0;
    if (evaluation?.status === 'EVALUATED' && evaluation?.recommendation?.status === 'CHANGE') {
      for (const decision of evaluation.recommendation.changes || []) {
        if (decision.verdict !== 'ACTION' || id(decision.preferred) !== id(decision.alternative)) continue;
        const index = next.starters.findIndex(row => id(row.player) === id(decision.starter) && slot(row.slot) === slot(decision.lineupSlot));
        const result = swap(model, next, id(decision.alternative), index, now);
        if (result.ok) { next = result.lineup; applied++; }
      }
    }
    const message = applied ? `${applied} supported Start/Sit change${applied === 1 ? '' : 's'} previewed. Yahoo is unchanged.` : evaluation?.recommendation?.status === 'NO_CHANGE' ? 'Fantasy HQ recommends no lineup changes.' : 'No supported legal change can be applied. Current Yahoo starters retained.';
    return revalidate(freeze({ ...state, lineup:next, mode:'FANTASY_HQ', history:[], message }), model, now);
  }
  function consume(model, state, evidence, now = Date.now()) {
    state = revalidate(state, model, now);
    model = atClock(model, evidence, now);
    const baselineOutlook = model.currentWeekEvidence.userOutlook;
    const currentPlayers = new Map(sections.flatMap(key => (model.lineup[key] || []).filter(row => row.player).map(row => [id(row.player), row.player])));
    const lineup = { ...state.lineup, ...Object.fromEntries(sections.map(key => [key, (state.lineup[key] || []).map(row => ({ ...row, player:row.player ? currentPlayers.get(id(row.player)) : null }))])) }, userOutlook = evidence.outlook(lineup), summary = evidence.summarize(lineup.starters.map(row => row.player).filter(Boolean));
    return { ...model, lineup, previewBaselineOutlook:baselineOutlook, groups:{ starters:lineup.starters.map(row => row.player).filter(Boolean), bench:lineup.bench.map(row => row.player).filter(Boolean), ir:lineup.ir.map(row => row.player).filter(Boolean) }, currentWeekEvidence:{ ...model.currentWeekEvidence, userOutlook, weeklyRead:evidence.weeklyRead(summary, userOutlook, model.currentWeekEvidence?.opponentOutlook) } };
  }
  function changes(state) { return state.lineup.starters.flatMap((row,index) => id(row.player) === id(state.authoritative.starters[index]?.player) ? [] : [{ slot:row.slot, incoming:row.player, outgoing:state.authoritative.starters[index]?.player }]); }
  return freeze({ id, slot, slots, gate, movement, eligible, validate, swap, signature, create, differs, reconcile, reset, custom, undo, recommended, consume, changes, validity, revalidate, nextBoundary, atClock });
});
