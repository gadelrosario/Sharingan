(function(root){
  'use strict';

  const neutral = 'Decision context is still developing.';
  const clean = value => {
    const text=String(value??'').trim();
    return text||neutral;
  };

  function decisionSummary({hero,vision,insight}){
    const opportunity=vision?.opportunity||insight?.opportunityWindow||{};
    const availability=vision?.availability||{};
    const whyNow=(vision?.whyNow||[]).map(item=>clean(item?.text)).filter(Boolean);
    const primary=hero?.primary||{label:'Best Available',reason:neutral};
    const whyNot=vision?.whyNot||insight?.whyNot||{};
    return {
      opportunity:{label:clean(opportunity.label),reason:clean(opportunity.reason)},
      availability:{label:clean(availability.label),reason:clean(availability.reason)},
      primary:{label:clean(primary.label),reason:clean(primary.reason)},
      reasons:[clean(primary.reason),...whyNow].filter((item,index,list)=>list.indexOf(item)===index).slice(0,3),
      whyNot:clean(whyNot.preferred),
    };
  }

  function comparisonSummary(model){
    return {
      playerId:model?.hero?.playerId,
      name:clean(model?.hero?.name),
      identity:clean(model?.hero?.identity),
      confidence:Number.isFinite(model?.hero?.confidence)?model.hero.confidence:0,
      opportunity:clean(model?.summary?.opportunity?.label),
      availability:clean(model?.summary?.availability?.label),
      reason:clean(model?.summary?.primary?.reason),
    };
  }

  root.FlightControlV1={decisionSummary,comparisonSummary};
})(typeof window!=='undefined'?window:globalThis);
