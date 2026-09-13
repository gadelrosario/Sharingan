(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FantasyHQManualSeasonStateV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'fantasy-hq-manual-season-state-1';
  const KEY_PREFIX = 'fantasyHQ.manualSeasonState.';
  const SOURCE = Object.freeze({
    YAHOO: 'YAHOO_AUTHORITATIVE',
    USER: 'USER_CONFIRMED',
    DEMO: 'DEMO',
    ARCHIVE: 'DRAFT_ARCHIVE',
    UNKNOWN: 'UNKNOWN',
  });
  const STATUS = Object.freeze({ ACTIVE: 'ACTIVE', REVOKED: 'REVOKED', SUPERSEDED: 'SUPERSEDED' });
  const FACT_TYPES = Object.freeze([
    'PLAYER_AVAILABILITY',
    'ROSTER_MEMBERSHIP',
    'LINEUP_SLOT',
    'TRANSACTION_STATUS',
    'INJURY_DESIGNATION',
    'TRANSACTION_LIMIT',
  ]);
  const VALID_VALUES = Object.freeze({
    PLAYER_AVAILABILITY: Object.freeze(['AVAILABLE', 'UNAVAILABLE']),
    ROSTER_MEMBERSHIP: Object.freeze(['ON_MY_ROSTER', 'NOT_ON_MY_ROSTER']),
    LINEUP_SLOT: Object.freeze(['STARTER', 'BENCH', 'IR']),
    TRANSACTION_STATUS: Object.freeze(['PENDING', 'COMPLETED']),
  });
  const clean = value => String(value ?? '').trim();
  const clone = value => JSON.parse(JSON.stringify(value));
  const keyFor = profileId => {
    const id = clean(profileId);
    if (!id) throw new Error('A league profile is required.');
    return `${KEY_PREFIX}${id}.v1`;
  };
  const validDate = value => Boolean(clean(value)) && !Number.isNaN(Date.parse(value));
  const stableId = value => clean(value).replace(/[^A-Za-z0-9_.:-]/g, '_');
  function validateFact(input) {
    const profileId = clean(input?.profileId),
      factType = clean(input?.factType).toUpperCase(),
      playerId = clean(input?.playerId),
      value = typeof input?.value === 'string' ? clean(input.value).toUpperCase() : input?.value;
    if (!profileId) throw new Error('A league profile is required.');
    if (!FACT_TYPES.includes(factType)) throw new Error('Unsupported manual fact type.');
    if (factType !== 'TRANSACTION_LIMIT' && !playerId) throw new Error('A canonical player ID is required.');
    if (VALID_VALUES[factType] && !VALID_VALUES[factType].includes(value))
      throw new Error('Unsupported manual fact value.');
    if (factType === 'TRANSACTION_LIMIT' && (!Number.isInteger(Number(value)) || Number(value) < 0))
      throw new Error('Transaction limit must be a non-negative integer.');
    if (!clean(value) && value !== 0) throw new Error('A manual fact value is required.');
    return { profileId, factType, playerId: playerId || null, value };
  }
  function sourceRank(source) {
    return { YAHOO_AUTHORITATIVE: 5, USER_CONFIRMED: 4, DRAFT_ARCHIVE: 3, DEMO: 2, UNKNOWN: 1 }[
      source
    ] || 0;
  }
  function domainKey(fact) {
    return `${clean(fact?.factType).toUpperCase()}:${clean(fact?.playerId) || 'LEAGUE'}`;
  }
  class ManualSeasonStateStore {
    constructor({ storage, now = () => new Date().toISOString(), idFactory } = {}) {
      if (!storage?.getItem || !storage?.setItem) throw new Error('A storage adapter is required.');
      this.storage = storage;
      this.now = now;
      this.idFactory = idFactory || ((fact, at) => `manual:${stableId(fact.profileId)}:${stableId(fact.factType)}:${stableId(fact.playerId || 'league')}:${Date.parse(at)}`);
    }
    read(profileId) {
      const empty = { schema: SCHEMA, profileId: clean(profileId), facts: [] };
      try {
        const parsed = JSON.parse(this.storage.getItem(keyFor(profileId)) || 'null');
        if (!parsed || parsed.schema !== SCHEMA || parsed.profileId !== clean(profileId) || !Array.isArray(parsed.facts)) return empty;
        return clone(parsed);
      } catch (_) {
        return empty;
      }
    }
    write(profileId, record) {
      const next = { schema: SCHEMA, profileId: clean(profileId), facts: clone(record.facts || []) };
      this.storage.setItem(keyFor(profileId), JSON.stringify(next));
      return clone(next);
    }
    create(input) {
      const fact = validateFact(input), confirmedAt = input?.confirmedAt || this.now();
      if (!validDate(confirmedAt)) throw new Error('Manual fact timestamp is invalid.');
      const record = this.read(fact.profileId), previous = record.facts.filter(row => row.status === STATUS.ACTIVE && domainKey(row) === domainKey(fact));
      previous.forEach(row => {
        row.status = STATUS.SUPERSEDED;
        row.supersededAt = confirmedAt;
        row.supersededBy = 'NEWER_USER_CONFIRMATION';
      });
      const created = {
        factId: this.idFactory(fact, confirmedAt), schema: SCHEMA, source: SOURCE.USER,
        confirmedAt, profileId: fact.profileId, factType: fact.factType, playerId: fact.playerId,
        value: fact.value, status: STATUS.ACTIVE, revalidationNeeded: true,
        provenance: { method: 'MANUAL_UI', actor: 'USER', note: clean(input?.note) || null },
        supersededAt: null, supersededBy: null,
      };
      record.facts.push(created);
      this.write(fact.profileId, record);
      return clone(created);
    }
    list(profileId, { history = true } = {}) {
      const facts = this.read(profileId).facts;
      return clone(history ? facts : facts.filter(row => row.status === STATUS.ACTIVE));
    }
    revoke(profileId, factId, revokedAt = this.now()) {
      const record = this.read(profileId), fact = record.facts.find(row => row.factId === factId);
      if (!fact || fact.status !== STATUS.ACTIVE) return null;
      fact.status = STATUS.REVOKED;
      fact.revokedAt = revokedAt;
      fact.revalidationNeeded = false;
      this.write(profileId, record);
      return clone(fact);
    }
    reconcileYahoo(profileId, yahooFacts = [], reconciledAt = this.now()) {
      const record = this.read(profileId), keys = new Set(yahooFacts.map(domainKey));
      let changed = false;
      record.facts.forEach(fact => {
        if (fact.status === STATUS.ACTIVE && keys.has(domainKey(fact))) {
          fact.status = STATUS.SUPERSEDED;
          fact.supersededAt = reconciledAt;
          fact.supersededBy = SOURCE.YAHOO;
          fact.revalidationNeeded = false;
          changed = true;
        }
      });
      if (changed) this.write(profileId, record);
      return this.list(profileId);
    }
  }
  function resolveFact({ yahooFact = null, manualFact = null, archiveFact = null, demoFact = null } = {}) {
    return [yahooFact, manualFact, archiveFact, demoFact]
      .filter(Boolean)
      .sort((a, b) => sourceRank(b.source) - sourceRank(a.source))[0] || { source: SOURCE.UNKNOWN, value: null };
  }
  function applyToModel(model, facts = []) {
    const active = facts.filter(fact => fact?.status === STATUS.ACTIVE && fact?.source === SOURCE.USER),
      byPlayer = new Map(), cloneModel = clone(model);
    active.forEach(fact => {
      if (!byPlayer.has(fact.playerId)) byPlayer.set(fact.playerId, {});
      byPlayer.get(fact.playerId)[fact.factType] = fact;
    });
    const roster = (cloneModel.roster || []).map(player => ({ ...player }));
    const available = (cloneModel.available || []).map(player => ({ ...player }));
    const idOf = player => clean(player?.canonicalPlayerId || player?.identity?.canonicalPlayerId || player?.playerId || player?.id);
    const known = new Map([...roster, ...available].map(player => [idOf(player), player]));
    byPlayer.forEach((state, id) => {
      const source = known.get(id);
      if (!source) return;
      const membership = state.ROSTER_MEMBERSHIP?.value;
      if (membership === 'ON_MY_ROSTER' && !roster.some(player => idOf(player) === id)) roster.push({ ...source });
      if (membership === 'NOT_ON_MY_ROSTER') {
        const index = roster.findIndex(player => idOf(player) === id);
        if (index >= 0) roster.splice(index, 1);
      }
      const availability = state.PLAYER_AVAILABILITY?.value;
      if (availability === 'AVAILABLE' && !available.some(player => idOf(player) === id)) available.push({ ...source, availability: 'FREE AGENT' });
      if (availability === 'UNAVAILABLE') {
        const index = available.findIndex(player => idOf(player) === id);
        if (index >= 0) available.splice(index, 1);
      }
    });
    roster.forEach(player => {
      const state = byPlayer.get(idOf(player));
      if (state?.LINEUP_SLOT) player.rosterSlot = { STARTER: player.position, BENCH: 'BN', IR: 'IR' }[state.LINEUP_SLOT.value];
      if (state?.INJURY_DESIGNATION) player.injuryStatus = state.INJURY_DESIGNATION.value;
      player.manualAuthority = Boolean(state && Object.keys(state).length);
    });
    available.forEach(player => { player.manualAuthority = Boolean(byPlayer.get(idOf(player))?.PLAYER_AVAILABILITY); });
    cloneModel.roster = roster;
    cloneModel.available = available;
    const rosterFacts = active.filter(fact => fact.factType === 'ROSTER_MEMBERSHIP'),
      availabilityFacts = active.filter(fact => fact.factType === 'PLAYER_AVAILABILITY'),
      rosterCoverage = cloneModel.roster?.length
        ? new Set(rosterFacts.map(fact => fact.playerId)).size / cloneModel.roster.length
        : 0;
    cloneModel.manualFacts = clone(active);
    cloneModel.manualAuthority = active.length
      ? {
          source: SOURCE.USER,
          count: active.length,
          current: true,
          rosterCoverage,
          availabilityCount: new Set(availabilityFacts.map(fact => fact.playerId)).size,
          complete: rosterCoverage >= 1 && availabilityFacts.length > 0,
        }
      : null;
    return cloneModel;
  }
  return Object.freeze({ SCHEMA, KEY_PREFIX, SOURCE, STATUS, FACT_TYPES, VALID_VALUES, keyFor, validateFact, sourceRank, resolveFact, domainKey, ManualSeasonStateStore, applyToModel });
});
