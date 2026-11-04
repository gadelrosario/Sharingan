(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./nfl-proactive-orchestrator-v1'):r.NFLProactiveOrchestratorV1,typeof module==='object'&&module.exports?require('./nfl-change-detection-v1'):r.NFLChangeDetectionV1,typeof module==='object'&&module.exports?require('./nfl-source-registry-v1'):r.NFLSourceRegistryV1);if(typeof module==='object'&&module.exports)module.exports=a;r.NFLSeasonProactiveV1=a;})(globalThis,function(O,C,S){
'use strict';
const states=new Map();
function identityGaps(model){return (model.roster||[]).filter(p=>!C.canonical(p));}
function identityReport(model){return identityGaps(model).map(p=>`${p.name} [${p.rosterSlot||p.slot||'slot unavailable'}]: Yahoo ${p.yahooPlayerId||p.externalIds?.yahoo||'unknown'}, canonical ${p.identity?.canonicalPlayerId||p.canonicalPlayerId||'none'}, status ${p.identity?.status||p.identityStatus||'none'}, reason ${p.identity?.reason||'not supplied'}`).join('; ');}
function safeComparisons(model,input={}){
 const gaps=identityGaps(model),known=new Set((model.roster||[]).map(C.canonical).filter(Boolean));
 return (input.decisions||[]).filter(d=>{
  const a=C.canonical(d.starter),b=C.canonical(d.alternative);
  if(!a||!b||a===b||!known.has(a)||!known.has(b)||!(d.evidenceCoverage>0)||d.state==='WAIT'||!Number.isFinite(d.scores?.starter?.score)||!Number.isFinite(d.scores?.alternative?.score))return false;
  const slot=String(d.lineupSlot||d.starter?.rosterSlot||d.starter?.position||'').toUpperCase();
  const positions=slot.includes('FLEX')?['RB','WR','TE',...(slot.includes('SUPER')?['QB']:[])]:[slot];
  return Boolean(slot)&&!gaps.some(p=>!p.position||positions.includes(String(p.position).toUpperCase()));
 });
}
function lineupReadiness(model,intelligence={},now=Date.now()){
 const gaps=identityGaps(model),comparisons=safeComparisons(model,intelligence);
 if(model.stale||model.syncError||((model.lastSuccessfulSyncAt||model.snapshot?.fetchedAt)&&S.inspect('yahoo',model.lastSuccessfulSyncAt||model.snapshot.fetchedAt,now).freshness!=='CURRENT'))return {status:'BLOCKED',reason:'Analysis blocked: Yahoo roster evidence is stale or unavailable.',comparisons:[]};
 if(model.planningWeek)return {status:'PARTIAL',reason:model.planningWeek.reason,comparisons:[]};
 if(gaps.length)return {status:comparisons.length?'PARTIAL':'BLOCKED',reason:`Partial roster evaluation: ${gaps.map(p=>p.name).join(', ')} remain unresolved. No full-lineup readiness conclusion is available.`,comparisons};
 const eligible=[...(model.lineup?.starters||[]),...(model.lineup?.bench||[]).filter(r=>r.player?.currentWeek?.game?.state!=='BYE'&&!(r.player?.currentWeek?.injury?.current&&['O','OUT','IR','SUSP'].includes(r.player.currentWeek.injury.status)))];
 const unsupported=eligible.filter(r=>!r.player||!(r.player.currentWeek?.projection?.supported||r.player.currentWeek?.actual?.supported));
 if(unsupported.length||!comparisons.length)return {status:'PARTIAL',reason:'Partial evaluation: some projections or legal comparisons are unavailable; the entire lineup has not been evaluated.',comparisons};
 return {status:'COMPLETE',reason:'Supported roster comparisons evaluated.',comparisons};
}
function analyze(model,engineInput,now=Date.now()){
 const key=O.context(model);if(!key)return null;
 let reason=null;
 if(model.demo||model.reviewMode||model.draftSnapshot||model.manualAuthority||model.snapshot?.provider!=='Yahoo'||model.snapshot?.league?.gameCode!=='nfl')reason='Live NFL analysis requires the confirmed Yahoo NFL league; fixture and manual contexts are excluded.';
 const settings=model.snapshot?.settings;
 if(!reason&&(!settings?.scoringType||!Array.isArray(settings.rosterSlots)||!settings.rosterSlots.length))reason='Yahoo scoring and lineup settings are incomplete; sync the confirmed league before analysis.';

 if(reason){const state={key,status:'UNAVAILABLE',alerts:[],resolved:[],reason};states.set(key,state);return state;}
 let state=O.run({model,engineInput,previous:states.get(key),now});
 const gaps=identityGaps(model);
 if(gaps.length&&state.status==='CURRENT'){
  const safe=safeComparisons(model,engineInput?.startSit),pairs=safe.map(d=>new Set([C.canonical(d.starter),C.canonical(d.alternative)]));
  state={...state,status:'PARTIAL',reason:lineupReadiness(model,engineInput?.startSit,now).reason,identityDetails:identityReport(model),alerts:state.alerts.filter(a=>a.issue.includes(':engine:START_SIT')&&a.playerIds.length===2&&pairs.some(pair=>a.playerIds.every(id=>pair.has(String(id))))),resolved:[]};
 }
 if(state.status==='STALE')state={...state,reason:'Analysis blocked: Yahoo roster evidence is stale or unavailable.',identityDetails:identityReport(model)};
 states.set(key,state);return state;
}
function explain(model,input={},state){
 const rows=[],add=(feature,status,reason)=>rows.push({feature,status,reason});
 const blocked=!state||state.status!=='CURRENT';
 if(blocked){const stamp=model.lastSuccessfulSyncAt||'unknown';add('Roster authority','BLOCKED',(state?.reason||'Analysis unavailable.')+(state?.identityDetails?' '+state.identityDetails:'')+` Yahoo snapshot: ${stamp}. Fresh projections do not refresh Yahoo ownership or injury evidence.`);}
 const injury=(state?.alerts||[]).filter(a=>a.category==='INJURY'),designations=(model.roster||[]).filter(p=>['Q','D','O','OUT','IR','PUP','SUSP'].includes(String(p.injuryStatus).toUpperCase()));
 add('Injury',blocked?'WITHHELD':injury.length?'MONITOR':'NO_CHANGE',blocked?'Current injury recommendations withheld until roster identity and freshness are verified.':injury.length?`${injury.length} supported injury/status alerts generated.`:`No verified injury changes detected in this tab. ${designations.length} current injury designations; a designation is not a new workload trend.`);
 const byes=(state?.alerts||[]).filter(a=>a.action==='BYE_PREP'),known=(model.roster||[]).filter(p=>Number(p.byeWeek)>0);
 add('Bye planning',blocked?'WITHHELD':!known.length?'INSUFFICIENT_DATA':byes.length?'REVIEW':'NO_OPPORTUNITY',blocked?'Bye preparation withheld with stale/unresolved roster data.':!known.length?'Player bye-week evidence is missing.':byes.length?byes.map(a=>a.whyItMatters).join(' '):'No known starter bye within the next three weeks.');
 const readiness=lineupReadiness(model,input.startSit);
 const ss=input.startSit,compared=(ss?.decisions||[]).filter(d=>d.evidenceCoverage>0),changes=ss?.recommendation?.changes||[];
 add('Start/Sit',blocked?'WITHHELD':readiness.status!=='COMPLETE'?'PARTIAL':ss?.status!=='EVALUATED'||!compared.length?'INSUFFICIENT_DATA':changes.length?'REVIEW':'NO_OPPORTUNITY',blocked?'Lineup action withheld: unresolved identity or source authority prevents complete evaluation even when projections display.':readiness.status!=='COMPLETE'?readiness.reason:ss?.status!=='EVALUATED'||!compared.length?(ss?.reason||'No supported legal starter/bench comparison; projection, scoring or game-lock evidence is incomplete.') :changes.length?`${changes.length} supported lineup changes; check locks before acting.`:'No supported lineup improvement identified among evaluated legal comparisons.');
 const waiver=input.waiver,comparisons=waiver?.comparisons||[],watches=comparisons.filter(c=>c.action==='WATCH'&&(c.benefit?c.benefit.classification!=='NO ACTION':c.difference>=2));
 add('Waivers',blocked?'WITHHELD':!model.available?.length||!comparisons.length?'INSUFFICIENT_DATA':watches.length?'WATCH':'NO_OPPORTUNITY',blocked?'Waiver advice withheld with stale/unresolved ownership.':!model.available?.length?'Current free-agent data is missing.':!comparisons.length?(waiver?.reason||'No compatible current-week projection/availability comparison is supported.'):watches.length?`${watches.length} current-week WATCH comparisons; permanent drop value and FAAB remain unsupported.`:'No current-week waiver edge clears the materiality bar (at least 2 points and 20%); no transaction recommended.');
 const breakout=(input.discovery||[]).filter(r=>['ACT','WATCH'].includes(r.timing)&&!['INSUFFICIENT_EVIDENCE','NOISE','STABLE'].includes(r.classification));
 add('Breakout / workload',blocked?'WITHHELD':breakout.length?'MONITOR':'INSUFFICIENT_DATA',blocked?'Workload recommendations withheld until current roster authority is restored.':breakout.length?`${breakout.length} existing radar signals evaluated; only roster-relevant signals are shown.`:'No supported roster-specific workload trend available; no trend or handcuff effect inferred.');
 return rows;
}
return {analyze,explain,identityGaps,identityReport,safeComparisons,lineupReadiness,get:model=>states.get(O.context(model))||null};
});
