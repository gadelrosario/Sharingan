'use strict';
const {canonicalId}=require('./canonical-models');

const PLAYER_FIELDS=Object.freeze(['opportunity','environment','risk','trend','market','confidence','lastUpdated']);
const TEAM_FIELDS=Object.freeze(['offensiveEnvironment','coaching','offensiveLine','qbStability','pace','impliedPoints','trend','lastUpdated']);

function checkedPatch(patch,allowed) {
  const unknown=Object.keys(patch).filter(key=>!allowed.includes(key));
  if(unknown.length)throw new TypeError(`unsupported intelligence fields: ${unknown.join(', ')}`);
  return Object.freeze({...patch});
}

class IntelligenceStore {
  constructor(){this.players=new Map();this.teams=new Map();this.projections=new Map();this.marketSnapshots=new Map();}
  upsertPlayer(playerId,patch){const id=canonicalId(playerId,'player'),next=Object.freeze({...this.players.get(id),...checkedPatch(patch,PLAYER_FIELDS),playerId:id});this.players.set(id,next);return next;}
  getPlayer(playerId){return this.players.get(playerId)||null;}
  upsertTeam(teamId,patch){const id=canonicalId(teamId,'team'),next=Object.freeze({...this.teams.get(id),...checkedPatch(patch,TEAM_FIELDS),teamId:id});this.teams.set(id,next);return next;}
  getTeam(teamId){return this.teams.get(teamId)||null;}
  putProjection(projection){this.projections.set(projection.projectionId,projection);return projection;}
  putMarketSnapshot(snapshot){this.marketSnapshots.set(snapshot.marketSnapshotId,snapshot);return snapshot;}
  snapshot(){return Object.freeze({players:Object.freeze([...this.players.values()]),teams:Object.freeze([...this.teams.values()]),projections:Object.freeze([...this.projections.values()]),marketSnapshots:Object.freeze([...this.marketSnapshots.values()])});}
}

module.exports=Object.freeze({IntelligenceStore,PLAYER_FIELDS,TEAM_FIELDS});
