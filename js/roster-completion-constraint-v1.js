(function (root) {
  'use strict';
  const FLEX = new Set(['RB', 'WR', 'TE']);
  const normalizePosition = value => {
    const position = String(value || '').trim().toUpperCase();
    return ['DEF', 'D/ST', 'DEFENSE'].includes(position) ? 'DST' : position;
  };
  const slotKind = value => {
    const slot = String(value || '').trim().toUpperCase();
    if (slot.startsWith('BENCH')) return 'BENCH';
    if (slot.startsWith('FLEX')) return 'FLEX';
    if (slot.startsWith('DEF') || slot.startsWith('DST') || slot === 'D/ST') return 'DST';
    return ['QB', 'RB', 'WR', 'TE', 'K'].find(position => slot.startsWith(position)) || 'UNKNOWN';
  };
  const fills = (player, slot) => {
    const position = normalizePosition(player?.pos ?? player?.position);
    const kind = slotKind(slot?.kind ?? slot?.slot ?? slot);
    return kind === 'FLEX' ? FLEX.has(position) : kind === position;
  };
  const remainingUserPicks = ({ currentPick = 1, totalPicks = 0, userTeam, teamForPick }) => {
    let remaining = 0;
    for (let selection = Number(currentPick); selection <= Number(totalPicks); selection += 1)
      if (Number(teamForPick(selection)) === Number(userTeam)) remaining += 1;
    return remaining;
  };
  function canMatch(slots, candidates, picksAvailable = slots.length) {
    if (picksAvailable < slots.length) return false;
    if (!slots.length) return true;
    const ordered = slots.slice().sort((a, b) => candidates.filter(player => fills(player, a)).length - candidates.filter(player => fills(player, b)).length);
    const search = (index, used) => {
      if (index >= ordered.length) return true;
      for (const player of candidates) {
        const id = String(player?.id ?? player?.playerId);
        if (used.has(id) || !fills(player, ordered[index])) continue;
        used.add(id);
        if (search(index + 1, used)) return true;
        used.delete(id);
      }
      return false;
    };
    return search(0, new Set());
  }
  function afterSelectionIsFeasible(player, state) {
    const remainingCandidates = state.availablePlayers.filter(candidate => String(candidate.id) !== String(player.id));
    const nextPicks = Math.max(0, state.userPicksRemaining - 1);
    const fillableSlots = state.openRequiredSlots.filter(slot => fills(player, slot));
    if (!fillableSlots.length) return canMatch(state.openRequiredSlots, remainingCandidates, nextPicks);
    return fillableSlots.some(slot => {
      const remainingSlots = state.openRequiredSlots.filter(candidate => candidate !== slot);
      return canMatch(remainingSlots, remainingCandidates, nextPicks);
    });
  }
  function buildState({ rosterState, rosterSlots = [], draftedEntries = [], availablePlayers = [], currentPick, totalPicks, userTeam, teamForPick, rosterEngine } = {}) {
    const assigned = rosterState || rosterEngine?.assignSlots?.({ slots: rosterSlots, draftedEntries }) || { starters: [] };
    const openRequiredSlots = (assigned.starters || []).filter(row => !row.player && !['BENCH', 'UNKNOWN'].includes(slotKind(row.kind ?? row.slot)));
    const userPicksRemaining = remainingUserPicks({ currentPick, totalPicks, userTeam, teamForPick });
    const unfilledRequiredSlots = openRequiredSlots.length;
    const requiredPositions = [...new Set(openRequiredSlots.map(row => slotKind(row.kind ?? row.slot)))];
    const impossible = userPicksRemaining < unfilledRequiredSlots;
    const hard = unfilledRequiredSlots > 0 && userPicksRemaining <= unfilledRequiredSlots;
    const pressure = unfilledRequiredSlots > 0 && userPicksRemaining === unfilledRequiredSlots + 1;
    const state = { openRequiredSlots, unfilledRequiredSlots, requiredPositions, userPicksRemaining, availablePlayers, impossible, hard, pressure, mode: hard ? 'HARD' : pressure ? 'PRESSURE' : 'NORMAL' };
    state.message = impossible
      ? `Roster completion is no longer mathematically possible: ${unfilledRequiredSlots} required slots remain with ${userPicksRemaining} selections.`
      : hard
        ? `Every remaining selection must fill a required ${requiredPositions.join(' or ')} slot.`
        : pressure
          ? `Required ${requiredPositions.join(' and ')} options must lead the board; one flexible selection remains.`
          : unfilledRequiredSlots
            ? `${unfilledRequiredSlots} required starter slot${unfilledRequiredSlots === 1 ? '' : 's'} remain with ${userPicksRemaining} selections.`
            : 'All configured required starters are filled.';
    return Object.freeze(state);
  }
  function candidateAllowed(player, state) {
    if (!state || state.mode === 'NORMAL') return true;
    const fillsRequired = state.openRequiredSlots.some(slot => fills(player, slot));
    if (state.impossible) return fillsRequired;
    if (state.hard && !fillsRequired) return false;
    return afterSelectionIsFeasible(player, state);
  }
  function constrainPool(candidates, state) {
    if (!state || state.mode === 'NORMAL') return candidates.slice();
    return candidates.filter(player => candidateAllowed(player, state));
  }
  function finalizeRecommendations(ordered, state, limit = 5) {
    const unique = ordered.filter((player, index, list) => player && list.findIndex(candidate => String(candidate.id) === String(player.id)) === index);
    if (!state || state.mode === 'NORMAL') return unique.slice(0, limit);
    const eligible = unique.filter(player => candidateAllowed(player, state));
    const required = [], used = new Set();
    for (const slot of state.openRequiredSlots) {
      const player = eligible.find(candidate => !used.has(String(candidate.id)) && fills(candidate, slot));
      if (player) { required.push(player); used.add(String(player.id)); }
    }
    const remainder = eligible.filter(player => !used.has(String(player.id)));
    return [...required, ...remainder].slice(0, limit);
  }
  const api = Object.freeze({ normalizePosition, slotKind, fills, remainingUserPicks, canMatch, buildState, candidateAllowed, constrainPool, finalizeRecommendations });
  root.RosterCompletionConstraintV1 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
