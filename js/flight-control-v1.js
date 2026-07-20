(function(root){
  'use strict';

  const neutral = 'Decision context is still developing.';
  const clean = value => {
    const text=String(value??'').trim();
    return text||neutral;
  };
  const short = value => {
    const text=clean(value).replace(/\s+/g,' ');
    const sentence=text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()||text;
    return sentence.length>86?`${sentence.slice(0,83).trim()}…`:sentence;
  };
  const shortLine = value => {
    const text=clean(value).replace(/\s+/g,' ');
    return text.length>118?`${text.slice(0,115).trim()}…`:text;
  };
  const actionLabel = opportunity => {
    const label=String(opportunity??'').toLowerCase();
    if(label.includes('draft now'))return 'DRAFT NOW';
    if(label.includes('risky'))return 'LEAN DRAFT';
    if(label.includes('safe'))return 'SAFE TO WAIT';
    if(label.includes('avoid'))return 'AVOID';
    return 'LEAN DRAFT';
  };
  const waitConclusion = availability => {
    const label=String(availability??'').toLowerCase();
    if(label.includes('unlikely'))return 'Unlikely to return next round.';
    if(label.includes('very likely'))return 'Likely to remain available next round.';
    if(label.includes('likely'))return 'May remain available next round.';
    return 'Availability next round is uncertain.';
  };
  const confidencePresentation = confidence => {
    const score=Number.isFinite(confidence?.score)?confidence.score:0;
    const label=score>=82?'High Confidence':score>=62?'Solid Lean':score>=42?'Close Call':'Very Close / Toss-Up';
    const reason=String(confidence?.reason||'').toLowerCase();
    const note=score<62&&(/separat(?:e|es) the top options|point lead/.test(reason))?'Top options are nearly equal.':'';
    return {score,label,note};
  };
  const normalizePosition = position => {
    const value=String(position??'').trim().toUpperCase().replace(/[.\s_-]/g,'');
    if(['DST','D/ST','DEF','DEFENSE'].includes(value))return 'dst';
    if(['WR','RB','TE','QB','K'].includes(value))return value.toLowerCase();
    return 'unknown';
  };
  const boardPositionClass = position => `board-pos-${normalizePosition(position)}`;
  function rosterConclusion(vision){
    const need=vision?.userNeed;
    if(!need||need.status==='Unavailable')return null;
    if(need.starterNeed){
      const slot=Number.isFinite(need.count)?`${need.position}${need.count+1}`:`starting ${need.position}`;
      return `Fills your ${slot} slot.`;
    }
    if(need.status==='Filled')return `${need.position} is already filled; this is a depth decision.`;
    return `${need.position} adds useful roster depth.`;
  }
  function tierConclusion(vision){
    const cliff=vision?.tierCliff;
    if(!cliff?.available)return null;
    const position=vision?.userNeed?.position||'position';
    if(cliff.nearCliff&&cliff.remainingInTier===0)return `Last ${cliff.currentTier}-tier ${position} available.`;
    if(cliff.nearCliff)return `Only one other ${cliff.currentTier}-tier ${position} remains.`;
    return null;
  }

  function decisionSummary({hero,vision,insight,comparison}){
    const opportunity=vision?.opportunity||insight?.opportunityWindow||{};
    const availability=vision?.availability||{};
    const primary=hero?.primary||{label:'Best Available',reason:neutral};
    const tier=tierConclusion(vision),roster=rosterConclusion(vision),primaryLabel=String(primary.label||'').toLowerCase();
    const primaryAddsContext=!((tier&&primaryLabel.includes('tier'))||(roster&&primaryLabel.includes('roster')));
    const candidates=[tier,roster,primaryAddsContext?short(primary.reason):null].filter(Boolean);
    const opportunityReason=short(opportunity.reason),availabilityReason=short(availability.reason);
    return {
      action:actionLabel(opportunity.label),
      confidence:confidencePresentation(insight?.confidence),
      opportunity:{label:clean(opportunity.label),reason:opportunityReason},
      availability:{label:clean(availability.label),reason:availabilityReason===opportunityReason?'':availabilityReason},
      primary:{label:clean(primary.label),reason:clean(primary.reason)},
      reasons:candidates.filter((item,index,list)=>list.indexOf(item)===index).slice(0,3),
      wait:{action:actionLabel(opportunity.label),availability:clean(availability.label),conclusion:waitConclusion(availability.label)},
      comparison:shortLine(comparison),
    };
  }

  function comparisonSummary(model){
    return {
      playerId:model?.hero?.playerId,
      name:clean(model?.hero?.name),
      identity:clean(model?.hero?.identity),
      confidence:Number.isFinite(model?.hero?.confidence)?model.hero.confidence:0,
      action:clean(model?.summary?.action),
      reason:short(model?.summary?.reasons?.[0]||model?.summary?.primary?.reason),
    };
  }

  root.FlightControlV1={decisionSummary,comparisonSummary,actionLabel,confidencePresentation,normalizePosition,boardPositionClass};
})(typeof window!=='undefined'?window:globalThis);
