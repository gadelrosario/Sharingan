'use strict';

const clean=value=>String(value??'').trim();
const number=value=>{if(value===null||value===undefined||clean(value)==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null};
const nonNegative=value=>{const parsed=number(value);return parsed!==null&&parsed>=0?parsed:null};
const divide=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null;
const NFLVERSE_PARTICIPATION_SEMANTICS=Object.freeze({
  usableForPlayerRouteCounts:false,
  routeField:'Route label for the primary receiver on a play; it is not a route-run flag for every offensive player.',
  decision:'SOURCE_LIMITATION',
});

function aggregateExplicitWeeklyRows(rows,{source='fixture-explicit-route-provider',snapshotDate=new Date().toISOString()}={}){
  if(!Array.isArray(rows))throw new TypeError('route rows must be an array');
  const grouped=new Map(),quarantined=[],seen=new Set();
  rows.forEach(row=>{
    const id=clean(row.canonicalPlayerId),season=number(row.season),week=number(row.week),routes=nonNegative(row.routes),targets=nonNegative(row.targets),yards=number(row.receivingYards),opportunities=nonNegative(row.passPlayOpportunities),snaps=nonNegative(row.snaps);
    const identityKey=`${id}|${season}|${week}`;
    if(!id||!Number.isInteger(season)||!Number.isInteger(week)){quarantined.push({reason:'MALFORMED_ROW'});return}
    if(seen.has(identityKey)){quarantined.push({canonicalPlayerId:id,season,week,reason:'DUPLICATE_PLAYER_SEASON_WEEK'});return}seen.add(identityKey);
    if(routes===null||targets===null||yards===null){quarantined.push({canonicalPlayerId:id,season,week,reason:'INVALID_ROUTE_NUMERIC'});return}
    if(targets>routes){quarantined.push({canonicalPlayerId:id,season,week,reason:'TARGETS_EXCEED_ROUTES'});return}
    if(opportunities!==null&&routes>opportunities){quarantined.push({canonicalPlayerId:id,season,week,reason:'ROUTES_EXCEED_PASS_PLAY_OPPORTUNITIES'});return}
    const key=`${id}|${season}`,group=grouped.get(key)||{canonicalPlayerId:id,position:clean(row.position),season,weeks:[]};group.weeks.push({week,routes,targets,receivingYards:yards,passPlayOpportunities:opportunities,snaps});grouped.set(key,group);
  });
  const records=[...grouped.values()].map(group=>{
    const weeks=group.weeks.sort((a,b)=>a.week-b.week),sum=field=>weeks.reduce((total,row)=>total+(row[field]??0),0),routes=sum('routes'),targets=sum('targets'),yards=sum('receivingYards'),opportunities=weeks.every(row=>row.passPlayOpportunities!==null)?sum('passPlayOpportunities'):null,snaps=weeks.every(row=>row.snaps!==null)?sum('snaps'):null;
    const active=weeks.filter(row=>row.routes>0),late=active.slice(-2),prior=active.slice(-4,-2),avg=(list,field)=>list.length?list.reduce((total,row)=>total+row[field],0)/list.length:null;
    const lateRoutes=avg(late,'routes'),previousRoutes=avg(prior,'routes'),lateTargets=late.reduce((total,row)=>total+row.targets,0),lateYards=late.reduce((total,row)=>total+row.receivingYards,0),lateRouteTotal=late.reduce((total,row)=>total+row.routes,0);
    return Object.freeze({recordType:'HISTORICAL_ROUTE_PARTICIPATION_SEASON',canonicalPlayerId:group.canonicalPlayerId,position:group.position,season:group.season,
      stats:Object.freeze({routes,targets,receivingYards:yards,passPlayOpportunities:opportunities,snaps}),
      metrics:Object.freeze({routesPerGame:divide(routes,weeks.length),routeParticipation:divide(routes,opportunities),tprr:divide(targets,routes),yprr:divide(yards,routes),lateRoutesPerGame:lateRoutes,routeGrowth:lateRoutes!==null&&previousRoutes!==null?lateRoutes-previousRoutes:null,lateTprr:divide(lateTargets,lateRouteTotal),lateYprr:divide(lateYards,lateRouteTotal)}),
      sample:Object.freeze({routeSample:routes,weeksObserved:weeks.length,gamesObserved:weeks.length,participationCoverage:opportunities===null?'PARTIAL_DENOMINATOR':'DENOMINATOR_PRESENT'}),
      provenance:Object.freeze({source,snapshotDate:new Date(snapshotDate).toISOString(),semantics:'explicit player-level routes supplied by provider'}),
    });
  });
  return Object.freeze({schemaVersion:1,recommendationAuthority:false,records:Object.freeze(records),quarantined:Object.freeze(quarantined),quarantinedCount:quarantined.length});
}

function attachToEvidence(featureRecord,routeRecord){
  if(!routeRecord)return Object.freeze({...featureRecord,routeParticipation:Object.freeze({status:'UNAVAILABLE'})});
  if(String(featureRecord.canonicalPlayerId)!==String(routeRecord.canonicalPlayerId)||Number(featureRecord.evidenceSeason)!==Number(routeRecord.season))throw new TypeError('route participation must match the evidence player and season');
  return Object.freeze({...featureRecord,routeParticipation:Object.freeze({status:'EVIDENCE_PRESENT',...routeRecord.metrics,sample:routeRecord.sample})});
}

module.exports=Object.freeze({NFLVERSE_PARTICIPATION_SEMANTICS,aggregateExplicitWeeklyRows,attachToEvidence});
