/** Jōnin 4.3.8 recommendation archetypes. Labels describe evidence; they never rank players. */
(function(root){
  'use strict';
  const finite=value=>Number.isFinite(Number(value))?Number(value):null;
  const by=(rows,read)=>rows.slice().sort((a,b)=>(finite(read(b))??-Infinity)-(finite(read(a))??-Infinity)||Number(a.order)-Number(b.order))[0]||null;
  function qualifiesValue(row){return row.valueOverride===true||(finite(row.valueFall)??0)>=7}
  function qualifiesUpside(row){return row.leagueBreaker===true||(finite(row.upsideAdjustment)??0)>0||(row.upsideSignals||[]).some(signal=>['LEAGUE_BREAKER_UPSIDE','ROLE_GROWTH_PATH'].includes(signal))}
  function qualifiesFit(row){return (finite(row.starterImpact)??0)>0&&(finite(row.rosterFit)??0)>0}
  function qualifiesTiming(row){return row.meaningfulTierCliff===true||(finite(row.survivalRisk)??0)>=60||row.survival==='UNLIKELY_TO_SURVIVE'}
  function assign(input=[],options={}){
    const rows=input.map((row,index)=>({...row,order:index,id:String(row.id)})),labels=new Map(),secondary=new Map(),claim=(row,label)=>{if(!row)return;if(labels.has(row.id)){const values=secondary.get(row.id)||[];if(!values.includes(label))secondary.set(row.id,Object.freeze([...values,label]));return}labels.set(row.id,label)};
    if(rows[0])labels.set(rows[0].id,'Best Pick');
    const value=by(rows.filter(qualifiesValue),row=>(finite(row.valueFall)??0)*10+(finite(row.valueScore)??0));claim(value,'Best Value');
    const baselineUpside=by(rows.filter(qualifiesUpside),row=>(finite(row.upsideScore)??0)+(row.leagueBreaker===true?10:0)+(finite(row.upsideAdjustment)??0)),preferredUpside=rows.find(row=>row.id===String(options.preferredUpsideId||'')),upside=preferredUpside||baselineUpside;claim(upside,'Highest Upside');
    const fit=by(rows.filter(qualifiesFit),row=>(finite(row.starterImpact)??0)*10+(finite(row.rosterFit)??0));claim(fit,'Best Fit');
    const timing=by(rows.filter(qualifiesTiming),row=>(row.meaningfulTierCliff===true?100:0)+(finite(row.survivalRisk)??0));claim(timing,'Tier / Timing');
    rows.forEach(row=>{if(!labels.has(row.id))labels.set(row.id,'Alternative')});
    return Object.freeze({labels,secondary,valueFound:Boolean(value),upsideFound:Boolean(upside),baselineUpsideId:baselineUpside?.id??null,upsideId:upside?.id??null});
  }
  const api=Object.freeze({assign,qualifiesValue,qualifiesUpside,qualifiesFit,qualifiesTiming});root.RecommendationArchetypesV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
