/* Preseason draft evidence and local decisions. Never consumes actual-stat snapshots. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FantasyHQNBADraftV1=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const CATS=['FG%','FT%','3PTM','PTS','REB','AST','ST','BLK','TO'];
  const FIELD={'3PTM':'threePm',PTS:'pts',REB:'reb',AST:'ast',ST:'stl',BLK:'blk',TO:'to'};
  const FIELDS=[...Object.values(FIELD),'fgm','fga','ftm','fta'];
  const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const name=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const team=v=>({PHO:'PHX',BRK:'BKN',NO:'NOP',NY:'NYK',GS:'GSW',SA:'SAS'}[String(v||'').toUpperCase()]||String(v||'').toUpperCase());
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  function context(model){
    const s=model?.settings;
    if(model?.sport!=='nba'||s?.sport!=='nba'||!/^\d{4}$/.test(s.season)||!s.leagueKey||!model.players?.length||model.coverage!=='COMPLETE')throw Error('Complete Yahoo NBA league required');
    const cats=s.categories.filter(c=>c.enabled&&!c.displayOnly).map(c=>c.label);
    if(!isPoints(model)&& (cats.length!==9||new Set(cats).size!==9||!CATS.every(c=>cats.includes(c))))throw Error('This draft model requires the verified nine-category league');
    if(new Set(model.players.map(p=>p.canonicalId)).size!==model.players.length||model.players.some(p=>p.sport!=='nba'||p.canonicalId!==`nba:yahoo:${p.providerIds?.yahoo}`))throw Error('Yahoo universe identity conflict');
    return `${s.season}:${s.leagueKey}:${model.userTeam?.team_key||'unresolved'}`;
  }
  function validate(snapshot,season,now=Date.now()){
    const src=snapshot?.source;
    if(snapshot?.schemaVersion!==1||snapshot.sport!=='nba'||snapshot.season!==String(season)||snapshot.evidenceClass!=='PROJECTED_STATS'||src?.basis!=='PER_GAME'||!src.name||!/^https:\/\//.test(src.url||'')||!date(src.sourceDate)||!Number.isFinite(Date.parse(src.capturedAt))||Date.parse(src.sourceDate)>now||Date.parse(src.capturedAt)>now+300000||Number(src.sourceDate.slice(0,4))!==Number(season))throw Error('Unverified current preseason evidence/provenance');
    if(!Array.isArray(snapshot.records)||!snapshot.records.length||snapshot.records.length>1000)throw Error('Invalid draft evidence size');
    const ids=new Set();
    for(const r of snapshot.records){
      if(!/^espn-[1-9]\d*$/.test(r.providerId||'')||ids.has(r.providerId)||!name(r.name)||!team(r.team)||!Array.isArray(r.positions)||!r.positions.length||r.positions.some(p=>!['PG','SG','SF','PF','C'].includes(p)))throw Error('Duplicate/invalid draft identity');ids.add(r.providerId);
      for(const k of FIELDS)if(r.stats?.[k]!=null&&!finite(r.stats[k]))throw Error('Invalid category evidence');
      for(const k of ['adp','sourceRank','games','minutes'])if(r[k]!=null&&(!finite(r[k])||(['adp','sourceRank'].includes(k)&&r[k]===0)))throw Error('Invalid draft metric');
      for(const [m,a] of [['fgm','fga'],['ftm','fta']])if(r.stats?.[m]!=null&&r.stats?.[a]!=null&&r.stats[m]>r.stats[a])throw Error('Made exceeds attempts');
    }
    return snapshot;
  }
  function reconcile(model,snapshot){
    context(model);if(snapshot)validate(snapshot,model.settings.season);
    const records=snapshot?.records||[],claimed=new Map();
    const candidates=model.players.map(p=>{
      if(!snapshot)return {...p,evidence:null,mapping:'UNRESOLVED',mappingReason:'NO_DRAFT_EVIDENCE'};
      let matches,authority;
      if(p.providerIds?.espn){matches=records.filter(r=>r.providerId===`espn-${p.providerIds.espn}`);authority='DIRECT_ID';}
      else{
        // Points coverage: exact normalized full name plus independently equal NBA team.
        // Position is mutable metadata, not identity authority; uniqueness remains mandatory.
        const primary=p.identityMetadata?.primaryPosition;
        matches=records.filter(r=>name(r.name)===name(p.name)&&team(r.team)===team(p.team)&&(isPoints(model)||primary&&r.positions.includes(primary)));
        authority='MULTI_FIELD_CONFIRMED';
      }
      if(matches.length!==1)return {...p,evidence:null,mapping:matches.length>1?'CONFLICT':'UNRESOLVED',mappingReason:matches.length>1?'MULTIPLE_CANDIDATES':'NO_UNIQUE_NAME_TEAM_PRIMARY_POSITION_MATCH'};
      const r=matches[0],owners=claimed.get(r.providerId)||[];owners.push(p.canonicalId);claimed.set(r.providerId,owners);
      return {...p,evidence:r,mapping:authority,mappingReason:authority==='DIRECT_ID'?'Shared stable ESPN ID':isPoints(model)?'Unique full name + independently matching NBA team; Yahoo positions retained':'Unique full name + current team + Yahoo primary position',draftSource:snapshot.source};
    });
    return candidates.map(p=>p.evidence&&claimed.get(p.evidence.providerId).length!==1?{...p,evidence:null,mapping:'CONFLICT',mappingReason:'MANY_TO_ONE'}:p);
  }
  const average=a=>a.reduce((n,v)=>n+v,0)/a.length;
  const sd=a=>Math.sqrt(average(a.map(v=>(v-average(a))**2)));
  function projection(r){
    const s=r?.stats||{},v={};for(const c of CATS)v[c]=c==='FG%'?(finite(s.fgm)&&s.fga>0?s.fgm/s.fga:null):c==='FT%'?(finite(s.ftm)&&s.fta>0?s.ftm/s.fta:null):finite(s[FIELD[c]])?s[FIELD[c]]:null;
    return v;
  }
  function build(model,snapshot){
    if(isPoints(model))return buildPoints(model,snapshot);
    const key=context(model),players=reconcile(model,snapshot),usable=players.filter(p=>p.evidence&&p.evidence.games>0&&p.evidence.minutes>0&&FIELDS.every(f=>finite(p.evidence.stats?.[f])));
    const draftedSlots=model.settings.rosterSlots.filter(s=>!['IL','IL+'].includes(s.position)).reduce((a,s)=>a+s.count,0);
    const baseline=usable.slice().sort((a,b)=>(a.evidence.sourceRank??Infinity)-(b.evidence.sourceRank??Infinity)||a.canonicalId.localeCompare(b.canonicalId)).slice(0,Math.max(30,(model.settings.teamCount||16)*draftedSlots));
    const sum=k=>baseline.reduce((a,p)=>a+p.evidence.stats[k],0),fg=sum('fga')>0?sum('fgm')/sum('fga'):null,ft=sum('fta')>0?sum('ftm')/sum('fta'):null;
    const raw=(p,c)=>c==='FG%'?p.evidence.stats.fgm-fg*p.evidence.stats.fga:c==='FT%'?p.evidence.stats.ftm-ft*p.evidence.stats.fta:(c==='TO'?-1:1)*p.evidence.stats[FIELD[c]];
    const reference={};for(const c of CATS){const a=baseline.map(p=>raw(p,c));reference[c]={mean:a.length?average(a):null,sd:a.length?sd(a):null};}
    const supported=baseline.length>=30&&fg!==null&&ft!==null&&CATS.every(c=>reference[c].sd>0);
    for(const p of players){
      p.projected=projection(p.evidence);p.value=null;p.contributions=null;p.tier=null;p.rank=null;p.strengths=[];p.weaknesses=[];
      if(supported&&usable.includes(p)){
        p.contributions=Object.fromEntries(CATS.map(c=>[c,(raw(p,c)-reference[c].mean)/reference[c].sd]));
        p.value=CATS.reduce((a,c)=>a+p.contributions[c],0);
        p.strengths=CATS.filter(c=>p.contributions[c]>=.75);p.weaknesses=CATS.filter(c=>p.contributions[c]<=-.75);
      }
    }
    const rated=players.filter(p=>p.value!==null).sort((a,b)=>b.value-a.value||a.canonicalId.localeCompare(b.canonicalId));
    // A tier spans less than 0.35 population SD from its highest-value player.
    // Cumulative value loss matters even when individual adjacent gaps are small.
    const gap=rated.length?Math.max(.5,sd(rated.map(p=>p.value))*.35):null;let tier=1,anchor=rated[0]?.value;
    rated.forEach((p,i)=>{if(i&&anchor-p.value>=gap){tier++;anchor=p.value;}p.tier=tier;p.rank=i+1;});
    return {key,model,players,rated,source:snapshot?.source||null,reference,baselineCount:baseline.length,tierGap:gap,mode:supported?'NINE_CATEGORY_Z_SUM':'INSUFFICIENT_PROJECTIONS',snapshot};
  }
  function empty(board){return {version:1,key:board.key,picks:[]};}
  function restore(board,value){
    if(!value||value.version!==1||value.key!==board.key||!Array.isArray(value.picks))throw Error('Draft save belongs to another league/season/team');
    const ids=new Set();for(const p of value.picks){if(!['ME','OTHER'].includes(p.owner)||ids.has(p.id)||!board.players.some(r=>r.canonicalId===p.id))throw Error('Invalid or duplicate saved pick');ids.add(p.id);}
    return {version:1,key:board.key,picks:value.picks.map(p=>({id:p.id,owner:p.owner}))};
  }
  function pick(board,state,id,owner){
    restore(board,state);if(!['ME','OTHER'].includes(owner)||!board.players.some(p=>p.canonicalId===id)||state.picks.some(p=>p.id===id))throw Error('Invalid or already drafted player');
    return {...state,picks:[...state.picks,{id,owner}]};
  }
  const undo=state=>({...state,picks:state.picks.slice(0,-1)});
  function assignment(players,settings){
    const slots=settings.rosterSlots.filter(s=>!['IL','IL+'].includes(s.position)).flatMap(s=>Array.from({length:s.count},()=>s.position));
    const placed=new Map();
    const eligible=(p,s)=>s==='BN'||s==='UTIL'||p.positions.includes(s)||(s==='G'&&p.positions.some(x=>['PG','SG'].includes(x)))||(s==='F'&&p.positions.some(x=>['SF','PF'].includes(x)));
    function place(i,seen){for(let j=0;j<slots.length;j++){if(seen.has(j)||!eligible(players[i],slots[j]))continue;seen.add(j);if(!placed.has(j)||place(placed.get(j),seen)){placed.set(j,i);return true;}}return false;}
    players.forEach((_,i)=>place(i,new Set()));
    return {legal:placed.size===players.length,filled:placed.size,total:slots.length,slots:slots.map((position,i)=>({position,player:placed.has(i)?players[placed.get(i)].name:null}))};
  }
  function analyze(board,state,now=Date.now()){
    if(isPoints(board.model))return analyzePoints(board,state,now);
    restore(board,state);const selected=new Map(state.picks.map(p=>[p.id,p.owner]));
    const roster=board.players.filter(p=>selected.get(p.canonicalId)==='ME'),available=board.players.filter(p=>!selected.has(p.canonicalId)&&!['ROSTERED','WAIVERS'].includes(p.ownership));
    const measured=roster.filter(p=>p.contributions),complete=measured.length===roster.length;
    const profile=Object.fromEntries(CATS.map(c=>{const z=measured.length?average(measured.map(p=>p.contributions[c])):null;return [c,{z,label:z===null?'UNKNOWN':z>=.5?'STRONG':z<=-.5?'WEAK':'NEUTRAL'}];}));
    const fresh=board.source&&(now-Date.parse(board.source.sourceDate))/86400000<=21;
    const rated=fresh?available.filter(p=>p.value!==null).sort((a,b)=>b.value-a.value||a.canonicalId.localeCompare(b.canonicalId)):[];
    const health=p=>{const days=(now-Date.parse(p.ownershipFetchedAt||board.model.fetchedAt))/86400000;return days<=1&&p.fantasyStatus?p.fantasyStatus:'UNKNOWN';};
    const eligible=rated.filter(p=>!['INJ','O','OUT','SUSP'].includes(health(p))&&assignment([...roster,p],board.model.settings).legal);
    const topRated=rated[0]||null,top=eligible[0]||null;
    function fit(p){
      if(!roster.length||!complete)return 0;
      // Compensate deficits only; all nine categories stay active. Bounded 25% adjustment.
      const needs=CATS.filter(c=>profile[c].z<0);return needs.length?average(needs.map(c=>Math.min(1,-profile[c].z)*p.contributions[c])):0;
    }
    const adjusted=p=>p.value+.25*fit(p);
    const fitPool=top?eligible.filter(p=>p.tier===top.tier):[];
    const bestFit=fitPool.slice().sort((a,b)=>fit(b)-fit(a)||b.value-a.value||a.canonicalId.localeCompare(b.canonicalId))[0]||null;
    const bestPick=fitPool.slice().sort((a,b)=>adjusted(b)-adjusted(a)||a.canonicalId.localeCompare(b.canonicalId))[0]||null;
    // Compare ADP to model ranks over the SAME mapped ADP-covered cohort, not raw pick-vs-rank units.
    const market=board.rated.filter(p=>finite(p.evidence.adp)&&p.evidence.adp>0).slice().sort((a,b)=>a.evidence.adp-b.evidence.adp||a.canonicalId.localeCompare(b.canonicalId));
    const valueOrder=board.rated.filter(p=>market.includes(p));
    const marketEdge=p=>market.indexOf(p)-valueOrder.indexOf(p);
    const valuePool=eligible.filter(p=>market.includes(p)&&marketEdge(p)>0&&(!top||p.tier<=top.tier+1));
    const bestValue=valuePool.sort((a,b)=>marketEdge(b)-marketEdge(a)||b.value-a.value)[0]||null;
    const category=eligible.flatMap(p=>CATS.filter(c=>p.contributions[c]>=1.5).map(c=>({player:p,category:c,z:p.contributions[c]}))).sort((a,b)=>b.z-a.z||a.player.canonicalId.localeCompare(b.player.canonicalId))[0]||null;
    const percentages={};for(const [c,m,a] of [['FG%','fgm','fga'],['FT%','ftm','fta']]){const valid=roster.length&&roster.every(p=>finite(p.evidence?.stats[m])&&finite(p.evidence?.stats[a]));const attempts=valid?roster.reduce((n,p)=>n+p.evidence.stats[a],0):null;percentages[c]=valid&&attempts>0?roster.reduce((n,p)=>n+p.evidence.stats[m],0)/attempts:null;}
    return {roster,available,profile,complete,percentages,slots:assignment(roster,board.model.settings),health,fresh,topRated,bestPick,bestFit,bestValue,category,marketEdge,
      reason:!fresh?'Draft evidence missing or older than 21 days':!rated.length?'Insufficient complete category evidence':!eligible.length?'No supported candidate fits the remaining roster/status constraints':complete?'Balanced nine-category value; fit adjusts only within the best available tier':'Roster evidence incomplete; fit adjustment disabled'};
  }

  const isPoints=model=>['headpoint','point'].includes(model?.settings?.scoringType);
  const POINT_FIELDS={'12':['PTS','pts'],'15':['REB','reb'],'16':['AST','ast'],'17':['ST','stl'],'18':['BLK','blk'],'19':['TO','to']};
  function pointsRules(settings){
    const cats=settings.categories.filter(c=>c.enabled&&!c.displayOnly),rules=settings.pointRules||[],issues=[],seen=new Set();
    if(!rules.length||!cats.length)issues.push('Yahoo points multipliers unavailable');
    for(const r of rules){const cat=cats.find(c=>c.id===r.id),field=POINT_FIELDS[r.id];if(seen.has(r.id))issues.push('Duplicate scoring rule '+r.id);seen.add(r.id);
      if(!cat||!field||field[0]!==cat.label)issues.push('Unsupported scoring category '+(cat?.label||r.id));
      if(!Number.isFinite(r.weight))issues.push('Missing multiplier '+r.id);
      if(r.bonuses||r.unsupportedFields?.length)issues.push('Unsupported bonus or rule '+r.id);
    }
    for(const c of cats)if(!seen.has(c.id))issues.push('Missing multiplier '+c.label);
    return {rules:rules.map(r=>({...r,label:POINT_FIELDS[r.id]?.[0],field:POINT_FIELDS[r.id]?.[1]})),issues,formula:rules.map(r=>`${POINT_FIELDS[r.id]?.[0]||r.id} × ${r.weight}`).join(' + ')};
  }
  function buildPoints(model,snapshot){
    const key=context(model),players=reconcile(model,snapshot),scoring=pointsRules(model.settings);
    for(const p of players){p.projected=projection(p.evidence);p.value=null;p.totalPoints=null;p.contributions=null;p.tier=null;p.rank=null;p.strengths=[];p.weaknesses=[];
      p.pointsMissing=scoring.rules.filter(r=>!r.field||!finite(p.evidence?.stats?.[r.field])).map(r=>r.label||r.id);
      if(p.evidence&&!(p.evidence.games>0))p.pointsMissing.push('projected games');
      if(p.evidence&&!(p.evidence.minutes>0))p.pointsMissing.push('projected minutes');
      if(!scoring.issues.length&&!p.pointsMissing.length&&p.evidence&&p.evidence.games>0&&p.evidence.minutes>0){
        p.pointContributions=Object.fromEntries(scoring.rules.map(r=>[r.label,p.evidence.stats[r.field]*r.weight]));
        p.value=Object.values(p.pointContributions).reduce((a,b)=>a+b,0);p.totalPoints=p.value*p.evidence.games;
      }
    }
    const rated=players.filter(p=>p.value!==null).sort((a,b)=>b.value-a.value||a.canonicalId.localeCompare(b.canonicalId));
    const gap=rated.length?Math.max(1,sd(rated.map(p=>p.value))*.35):null;let tier=1,anchor=rated[0]?.value;
    rated.forEach((p,i)=>{if(i&&anchor-p.value>=gap){tier++;anchor=p.value;}p.tier=tier;p.rank=i+1;});
    const matched=new Set(rated.map(p=>p.evidence.providerId));
    // Audit the supplied source ranking without reordering by our points formula or
    // excluding incomplete records from the denominator.
    const sourceOrder=(snapshot?.records||[]).map((r,i)=>({...r,sourceOrder:i+1})).sort((a,b)=>(a.sourceRank??a.sourceOrder)-(b.sourceRank??b.sourceOrder)||a.sourceOrder-b.sourceOrder);
    const coverageAudit=[50,100,156].map(n=>({basis:'SOURCE_ORDER',targets:Math.min(n,sourceOrder.length),matched:sourceOrder.slice(0,n).filter(p=>matched.has(p.providerId)).length,missing:sourceOrder.slice(0,n).filter(p=>!matched.has(p.providerId)).map(p=>p.name)}));
    const importantSources=new Set(sourceOrder.slice(0,156).map(r=>r.providerId));
    for(const p of players){p.unrankedReason=p.value!==null?null:p.evidence?[...scoring.issues,...p.pointsMissing].join('; '):p.mappingReason;
      p.importantUnranked=p.value===null&&(importantSources.has(p.evidence?.providerId)||sourceOrder.slice(0,156).some(r=>name(r.name)===name(p.name)));
      // Name-only candidates can trigger a caution, never attach evidence/rank/ADP.
    }
    return {key,model,players,rated,source:snapshot?.source||null,scoring,coverageAudit,reference:null,baselineCount:0,tierGap:gap,mode:'YAHOO_POINTS',snapshot};
  }
  function analyzePoints(board,state,now){
    restore(board,state);const selected=new Map(state.picks.map(p=>[p.id,p.owner]));
    const roster=board.players.filter(p=>selected.get(p.canonicalId)==='ME'),available=board.players.filter(p=>!selected.has(p.canonicalId)&&!['ROSTERED','WAIVERS'].includes(p.ownership));
    const fresh=board.source&&(now-Date.parse(board.source.sourceDate))/86400000<=21;
    const health=p=>(now-Date.parse(p.ownershipFetchedAt||board.model.fetchedAt))/86400000<=1&&p.fantasyStatus?p.fantasyStatus:'UNKNOWN';
    const rated=fresh?available.filter(p=>p.value!==null).sort((a,b)=>b.value-a.value||a.canonicalId.localeCompare(b.canonicalId)):[];
    const slots=assignment(roster,board.model.settings),starters=a=>a.slots.filter(s=>s.position!=='BN'&&s.player).length;
    const eligible=rated.filter(p=>!['INJ','O','OUT','SUSP'].includes(health(p))&&assignment([...roster,p],board.model.settings).legal);
    const top=eligible[0]||null,pool=top?eligible.filter(p=>p.tier===top.tier):[];
    const fit=p=>starters(assignment([...roster,p],board.model.settings))-starters(slots);
    const bestFit=pool.slice().sort((a,b)=>fit(b)-fit(a)||b.value-a.value)[0]||null;
    const bestPick=pool.slice().sort((a,b)=>(b.value+fit(b)*board.tierGap*.1)-(a.value+fit(a)*board.tierGap*.1))[0]||null;
    const marketSupported=board.source?.adpFormat==='POINTS';
    const market=marketSupported?board.rated.filter(p=>finite(p.evidence.adp)&&p.evidence.adp>0).sort((a,b)=>a.evidence.adp-b.evidence.adp):[];
    const valueOrder=board.rated.filter(p=>market.includes(p)),marketEdge=p=>market.includes(p)?market.indexOf(p)-valueOrder.indexOf(p):null;
    const bestValue=eligible.filter(p=>market.includes(p)&&marketEdge(p)>=3&&p.tier<=top.tier+1).sort((a,b)=>marketEdge(b)-marketEdge(a)||b.value-a.value)[0]||null;
    const open=slots.slots.filter(s=>!s.player&&!['BN','UTIL'].includes(s.position));
    const positional=eligible.find(p=>open.some(s=>assignment([p],{rosterSlots:[{position:s.position,count:1}]}).legal))||top;
    const complete=roster.every(p=>p.value!==null);
    const importantUnranked=available.filter(p=>p.importantUnranked),qualified=importantUnranked.length>0;
    return {importantUnranked,bestPickLabel:qualified?'BEST PICK — AMONG PROJECTED PLAYERS':'BEST PICK',roster,available,profile:{},percentages:{},complete,slots,health,fresh,topRated:rated[0]||null,bestPick,bestFit,bestValue,category:null,positional,marketEdge,marketSupported,
      teamPoints:roster.length&&complete?roster.reduce((sum,p)=>sum+p.value,0):null,
      reason:board.scoring.issues.length?board.scoring.issues.join('; '):!fresh?'Draft evidence missing or older than 21 days':!rated.length?'Complete points projections unavailable':!top?'No supported candidate fits remaining roster/status constraints':'Yahoo fantasy points per game; starter fit bounded within the best available tier'};
  }
  function boardRows(board,state,{query='',position='ALL',scope='AVAILABLE'}={}){
    const taken=new Map(state.picks.map(p=>[p.id,p.owner]));
    const rows=board.players.filter(p=>(!query||name(p.name).includes(name(query))||String(p.yahooPlayerId||p.providerIds.yahoo)===query.trim())&&(position==='ALL'||p.positions.includes(position))&&(scope==='ALL'||scope==='ME'&&taken.get(p.canonicalId)==='ME'||scope==='UNRANKED'&&p.value===null&&!taken.has(p.canonicalId)&&!['ROSTERED','WAIVERS'].includes(p.ownership)||scope==='AVAILABLE'&&!taken.has(p.canonicalId)&&!['ROSTERED','WAIVERS'].includes(p.ownership)));
    const unranked=rows.filter(p=>p.value===null).sort((a,b)=>Number(b.importantUnranked)-Number(a.importantUnranked)||a.name.localeCompare(b.name));
    const ranked=rows.filter(p=>p.value!==null).sort((a,b)=>a.rank-b.rank);
    return {ranked,unranked,rows:scope==='UNRANKED'?unranked:[...unranked.filter(p=>p.importantUnranked),...ranked,...unranked.filter(p=>!p.importantUnranked)]};
  }
  return {boardRows,isPoints,pointsRules,CATS,FIELDS,context,validate,reconcile,projection,build,empty,restore,pick,undo,assignment,analyze};
});
