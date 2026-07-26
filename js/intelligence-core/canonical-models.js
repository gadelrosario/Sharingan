'use strict';

const POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DST']);
const ENTITY_TYPES = Object.freeze([
  'Player', 'Team', 'League', 'Manager', 'Roster', 'DraftPick',
  'Projection', 'MarketSnapshot', 'ExpertSignal', 'EvidenceRecord',
]);

function required(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new TypeError(`${field} is required`);
  }
  return value;
}

function canonicalId(value, entity) {
  const id = String(required(value, `${entity}Id`)).trim();
  if (!/^fhq_[a-z0-9][a-z0-9_-]*$/i.test(id)) {
    throw new TypeError(`${entity}Id must be a canonical Fantasy HQ ID`);
  }
  return id;
}

function timestamp(value, field = 'timestamp') {
  const normalized = String(required(value, field));
  if (Number.isNaN(Date.parse(normalized))) throw new TypeError(`${field} must be an ISO timestamp`);
  return normalized;
}

function positiveNumber(value, field) {
  const number=Number(required(value,field));
  if(!Number.isFinite(number)||number<=0)throw new TypeError(`${field} must be a positive number`);
  return number;
}

function externalIds(input = {}) {
  const explicit = input.externalIds && typeof input.externalIds === 'object' ? input.externalIds : {};
  const aliases = {
    yahoo: input.yahooId, sleeper: input.sleeperId,
    fantasyPros: input.fantasyProsId, nfl: input.nflId,
  };
  const ids = {};
  Object.entries({...explicit, ...aliases}).forEach(([provider, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') ids[provider] = String(value);
  });
  return Object.freeze(ids);
}

function createPlayer(input = {}) {
  const rawPosition = String(required(input.position, 'position')).trim().toUpperCase();
  const position = ['D/ST','DEF','DEFENSE'].includes(rawPosition) ? 'DST' : rawPosition;
  if (!POSITIONS.has(position)) throw new TypeError(`unsupported position: ${position}`);
  return Object.freeze({
    entityType: 'Player', playerId: canonicalId(input.playerId, 'player'),
    name: String(required(input.name, 'name')).trim(), position,
    teamId: input.teamId ? canonicalId(input.teamId, 'team') : null,
    externalIds: externalIds(input), status: input.status || 'active',
    attributes: Object.freeze({...input.attributes}),
  });
}

function createTeam(input = {}) { return Object.freeze({entityType:'Team', teamId:canonicalId(input.teamId,'team'), name:String(required(input.name,'name')), abbreviation:String(required(input.abbreviation,'abbreviation')).toUpperCase(), externalIds:externalIds(input), attributes:Object.freeze({...input.attributes})}); }
function createLeague(input = {}) { return Object.freeze({entityType:'League', leagueId:canonicalId(input.leagueId,'league'), name:String(required(input.name,'name')), season:positiveNumber(input.season,'season'), settings:Object.freeze({...input.settings}), externalIds:externalIds(input)}); }
function createManager(input = {}) { return Object.freeze({entityType:'Manager', managerId:canonicalId(input.managerId,'manager'), displayName:String(required(input.displayName,'displayName')), externalIds:externalIds(input), attributes:Object.freeze({...input.attributes})}); }
function createRoster(input = {}) { return Object.freeze({entityType:'Roster', rosterId:canonicalId(input.rosterId,'roster'), leagueId:canonicalId(input.leagueId,'league'), managerId:canonicalId(input.managerId,'manager'), playerIds:Object.freeze((input.playerIds||[]).map(id=>canonicalId(id,'player'))), season:positiveNumber(input.season,'season')}); }
function createDraftPick(input = {}) { return Object.freeze({entityType:'DraftPick', draftPickId:canonicalId(input.draftPickId,'draftPick'), leagueId:canonicalId(input.leagueId,'league'), rosterId:canonicalId(input.rosterId,'roster'), playerId:canonicalId(input.playerId,'player'), overall:positiveNumber(input.overall,'overall'), round:positiveNumber(input.round,'round'), selectedAt:timestamp(input.selectedAt,'selectedAt')}); }
function createProjection(input = {}) { return Object.freeze({entityType:'Projection', projectionId:canonicalId(input.projectionId,'projection'), playerId:canonicalId(input.playerId,'player'), season:positiveNumber(input.season,'season'), scoringFormat:String(required(input.scoringFormat,'scoringFormat')), metrics:Object.freeze({...input.metrics}), evidenceId:input.evidenceId?canonicalId(input.evidenceId,'evidence'):null}); }
function createMarketSnapshot(input = {}) { return Object.freeze({entityType:'MarketSnapshot', marketSnapshotId:canonicalId(input.marketSnapshotId,'marketSnapshot'), playerId:canonicalId(input.playerId,'player'), market:String(required(input.market,'market')), values:Object.freeze({...input.values}), capturedAt:timestamp(input.capturedAt,'capturedAt'), evidenceId:input.evidenceId?canonicalId(input.evidenceId,'evidence'):null}); }
function boundedScore(value,field){const labels={LOW:25,MODERATE:50,HIGH:75,WEAK:25,STRONG:75};const score=labels[String(value).toUpperCase()]??Number(value);if(!Number.isFinite(score)||score<0||score>100)throw new TypeError(`${field} must be between 0 and 100`);return score;}
function optionalTimestamp(value,field){return value===undefined||value===null||value===''?null:timestamp(value,field);}
function stringList(value,field){if(value===undefined||value===null)return Object.freeze([]);if(!Array.isArray(value))value=[value];return Object.freeze(value.map(item=>String(required(item,field))));}
function createExpertSignal(input = {}) {
  const signalId=canonicalId(input.signalId||input.expertSignalId,'signal'),sourceId=String(required(input.sourceId||input.source,'sourceId')).toLowerCase(),category=String(required(input.category||input.signalType,'category')).trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_'),scope=String(input.scope|| (input.playerId?'PLAYER':'GLOBAL')).toUpperCase();
  if(!['GLOBAL','POSITION','TEAM','PLAYER'].includes(scope))throw new TypeError('unsupported signal scope');
  const status=String(input.status||'ACTIVE').toUpperCase();if(!['ACTIVE','EXPIRED','INVALIDATED','DRAFT'].includes(status))throw new TypeError('unsupported signal status');
  const position=input.position?String(input.position).toUpperCase():null,teamId=input.teamId?canonicalId(input.teamId,'team'):null,playerId=input.playerId?canonicalId(input.playerId,'player'):null;
  if(position&&!POSITIONS.has(position))throw new TypeError('unsupported signal position');
  if(scope==='POSITION'&&!position)throw new TypeError('position-scoped signals require position');
  if(scope==='TEAM'&&!teamId)throw new TypeError('team-scoped signals require teamId');
  if(scope==='PLAYER'&&!playerId)throw new TypeError('player-scoped signals require playerId');
  if(scope==='GLOBAL'&&(position||teamId||playerId))throw new TypeError('global signals must remain entity-neutral');
  const provenanceInput=input.provenance||{},provenance=Object.freeze({originalSource:String(provenanceInput.originalSource||sourceId),transcriptIdentifier:String(provenanceInput.transcriptIdentifier||''),localReference:String(provenanceInput.localReference||input.sourceReference||''),dateCodified:optionalTimestamp(provenanceInput.dateCodified,'dateCodified'),evidenceType:String(provenanceInput.evidenceType||input.sourceType||''),claimType:String(provenanceInput.claimType||'').toLowerCase()});
  return Object.freeze({entityType:'ExpertSignal',signalId,expertSignalId:signalId,sourceId,source:sourceId,sourceType:String(input.sourceType||'expert_transcript'),category,signalType:category,scope,position,teamId,playerId,strength:boundedScore(input.strength,'strength'),confidence:boundedScore(input.confidence,'confidence'),effectiveDate:optionalTimestamp(input.effectiveDate,'effectiveDate'),expirationDate:optionalTimestamp(input.expirationDate||input.expiration,'expirationDate'),expiration:optionalTimestamp(input.expirationDate||input.expiration,'expirationDate'),conditions:stringList(input.conditions,'conditions'),invalidationConditions:stringList(input.invalidationConditions,'invalidationConditions'),supportingNotes:stringList(input.supportingNotes,'supportingNotes'),sourceReference:String(input.sourceReference||provenance.localReference),status,provenance});
}
function createEvidenceRecord(input = {}) { return Object.freeze({entityType:'EvidenceRecord', evidenceId:canonicalId(input.evidenceId,'evidence'), subjectType:String(required(input.subjectType,'subjectType')), subjectId:canonicalId(input.subjectId,'subject'), metric:String(required(input.metric,'metric')), value:input.value, source:String(required(input.source,'source')), timestamp:timestamp(input.timestamp), freshness:String(required(input.freshness,'freshness')), confidence:String(required(input.confidence,'confidence')), reliability:String(required(input.reliability,'reliability')), metadata:Object.freeze({...input.metadata})}); }

module.exports = Object.freeze({POSITIONS, ENTITY_TYPES, canonicalId, timestamp, externalIds, createPlayer, createTeam, createLeague, createManager, createRoster, createDraftPick, createProjection, createMarketSnapshot, createExpertSignal, createEvidenceRecord});
