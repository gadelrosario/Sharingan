/** Explicit tier contracts for player data. */
const PlayerTierContract = (() => {
  'use strict';
  const OVERALL_TIERS=Object.freeze(['S','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','DST']);
  const POSITION_SKILL_TIERS=Object.freeze(['S','A','B','C','D','E','F','G','H','I','J','K','DEPTH']);
  const SPECIAL_TEAM_TIERS=Object.freeze(['1','2','3']);
  const DECISION_TIERS=Object.freeze(['S','A','B','C','D','E','F']);
  const SKILL_POSITIONS=new Set(['QB','RB','WR','TE']),SPECIAL_TEAM_POSITIONS=new Set(['K','DST']);
  const token=value=>value==null||(typeof value==='string'&&!value.trim())?null:String(value).trim().toUpperCase();
  function positionOf(player){const value=token(player?.pos??player?.position);return value==='DEF'||value==='D/ST'||value==='DEFENSE'?'DST':value}
  function normalizeOverallTier(value){const t=token(value);return t&&OVERALL_TIERS.includes(t)?t:null}
  function normalizePositionTier(value,position){const t=token(value),pos=positionOf({pos:position});if(!t)return null;if(SPECIAL_TEAM_POSITIONS.has(pos))return SPECIAL_TEAM_TIERS.includes(t)?t:null;if(SKILL_POSITIONS.has(pos)&&POSITION_SKILL_TIERS.includes(t))return t==='DEPTH'?'Depth':t;return null}
  const getOverallTier=player=>normalizeOverallTier(player?.overallTier);
  const getPositionTier=player=>normalizePositionTier(player?.posTier,positionOf(player));
  function getTierDiagnostic(player){
    const rawPositionTier=player?.posTier??null,rawOverallTier=player?.overallTier??null;
    const positionTier=getPositionTier(player),overallTier=getOverallTier(player);
    const positionalDecision=positionTier&&DECISION_TIERS.includes(String(positionTier).toUpperCase())?String(positionTier).toUpperCase():null;
    const overallDecision=overallTier&&DECISION_TIERS.includes(overallTier)?overallTier:null;
    let decisionTier,reason,fallbackUsed=false;
    if(positionalDecision){decisionTier=positionalDecision;reason='valid positional tier preserves the existing decision priority'}
    else if(overallDecision){decisionTier=overallDecision;reason='positional tier is missing or outside the decision domain; valid overall tier used';fallbackUsed=true}
    else if(overallTier||(SKILL_POSITIONS.has(positionOf(player))&&positionTier&&positionTier!=='Depth')){decisionTier='F';reason='source tier is below the S-F decision range; lowest decision tier used';fallbackUsed=true}
    else if(SPECIAL_TEAM_POSITIONS.has(positionOf(player))){decisionTier='F';reason='specialist tiers are position-only; conservative cross-position decision tier used';fallbackUsed=true}
    else{decisionTier='C';reason='no valid S-F decision tier is available; compatibility fallback C used';fallbackUsed=true}
    return {playerId:player?.id??null,playerName:player?.name??null,position:positionOf(player),rawPositionTier,rawOverallTier,positionTier,overallTier,decisionTier,reason,fallbackUsed,invalidPositionTier:token(rawPositionTier)!==null&&positionTier===null,invalidOverallTier:token(rawOverallTier)!==null&&overallTier===null,differingValidTiers:Boolean(positionTier&&overallTier&&String(positionTier).toUpperCase()!==overallTier),specialTeamNumericTier:SPECIAL_TEAM_POSITIONS.has(positionOf(player))&&SPECIAL_TEAM_TIERS.includes(token(rawPositionTier)),depthTier:positionTier==='Depth'};
  }
  const getDecisionTier=player=>getTierDiagnostic(player).decisionTier;
  const isEliteDecisionTier=value=>value==='S'||value==='A';
  return {DOMAINS:{overall:OVERALL_TIERS,positionSkill:POSITION_SKILL_TIERS,positionSpecialTeams:SPECIAL_TEAM_TIERS,decision:DECISION_TIERS},normalizeOverallTier,normalizePositionTier,getOverallTier,getPositionTier,getDecisionTier,getTierDiagnostic,isEliteDecisionTier};
})();
if(typeof window!=='undefined')window.PlayerTierContract=PlayerTierContract;
if(typeof module!=='undefined'&&module.exports)module.exports=PlayerTierContract;
