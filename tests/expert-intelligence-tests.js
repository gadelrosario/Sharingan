'use strict';
const Core=require('../js/intelligence-core');
const fs=require('fs'),path=require('path');

function run(){
  const results=[],assert=(condition,message)=>{if(!condition)throw new Error(message);},test=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}};
  const {ExpertStrategyRegistry,STRATEGY_CATEGORIES}=Core.experts,seeds=Core.expertSignals,registry=new ExpertStrategyRegistry();
  seeds.bundles.forEach(bundle=>registry.load(bundle));
  const signals=registry.snapshot(),active=registry.findActive('2026-07-26T00:00:00Z');

  test('all four transcript fixtures represented',()=>assert(seeds.bundles.length===4&&seeds.bundles.every(bundle=>bundle.transcriptIdentifier),'source fixture missing'));
  test('all three expert sources represented',()=>assert(new Set(signals.map(signal=>signal.sourceId)).size===3,'expert source missing'));
  test('required taxonomy categories exist',()=>assert(['PRICE_DISCIPLINE','VALUE_WINDOW','PRICE_FADE','OPPORTUNITY_COST','CONVICTION_TARGET','PLANT_FLAG','UPSIDE_PROFILE','OFFENSIVE_ENVIRONMENT','ENVIRONMENT_CONFIDENCE','CEILING_SUPPRESSION','FLOOR_SUPPORT','ROLE_STABILITY','PASS_CATCHING_PROTECTION','OFFENSE_IMPROVEMENT_PROBABILITY','PLATFORM_ADP_DIFFERENCE','LEAGUE_FORMAT_ADJUSTMENT'].every(category=>STRATEGY_CATEGORIES.includes(category)),'taxonomy incomplete'));
  test('future taxonomy category accepted',()=>{const custom=new ExpertStrategyRegistry();custom.register({...signals[0],signalId:'fhq_signal_future_001',expertSignalId:undefined,category:'FUTURE_CATEGORY'});assert(custom.get('fhq_signal_future_001').category==='FUTURE_CATEGORY','future category rejected');});
  test('signal IDs unique',()=>assert(new Set(signals.map(signal=>signal.signalId)).size===signals.length,'duplicate IDs'));
  test('expected deterministic seed count',()=>assert(signals.length===36,'seed count changed'));
  test('all active signals have provenance',()=>assert(active.every(signal=>signal.sourceReference&&signal.provenance.originalSource&&signal.provenance.transcriptIdentifier&&signal.provenance.dateCodified&&signal.provenance.evidenceType&&signal.provenance.claimType),'provenance missing'));
  test('all local provenance references resolve',()=>assert(active.every(signal=>{const [file,anchor]=signal.sourceReference.split('#'),full=path.join(__dirname,'..',file);if(!fs.existsSync(full)||!anchor)return false;const headings=fs.readFileSync(full,'utf8').split('\n').filter(line=>/^#{1,6} /.test(line)).map(line=>line.replace(/^#{1,6} /,'').trim().toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/ +/g,'-'));return headings.includes(anchor);}), 'local provenance reference missing'));
  test('all codified claims labeled summarized',()=>assert(signals.every(signal=>signal.provenance.claimType==='summarized'),'claim type overstated'));
  test('active signal without provenance rejected',()=>{let threw=false;try{new ExpertStrategyRegistry().register({signalId:'fhq_signal_bad',sourceId:'bdge',category:'PRICE_FADE',scope:'GLOBAL',strength:50,confidence:50,status:'ACTIVE'});}catch(_){threw=true;}assert(threw,'unproven signal accepted');});
  test('strength and confidence stored independently',()=>{const signal=signals.find(item=>item.strength!==item.confidence);assert(signal&&signal.strength!==signal.confidence,'scores coupled');});
  test('strength lower boundary accepted',()=>{const draft={...signals[0],signalId:'fhq_signal_boundary_0',expertSignalId:undefined,strength:0,status:'DRAFT'};assert(new ExpertStrategyRegistry().register(draft).strength===0,'zero rejected');});
  test('confidence upper boundary accepted',()=>{const draft={...signals[0],signalId:'fhq_signal_boundary_100',expertSignalId:undefined,confidence:100,status:'DRAFT'};assert(new ExpertStrategyRegistry().register(draft).confidence===100,'100 rejected');});
  test('strength above range rejected',()=>{let threw=false;try{new ExpertStrategyRegistry().register({...signals[0],signalId:'fhq_signal_bad_strength',expertSignalId:undefined,strength:101,status:'DRAFT'});}catch(_){threw=true;}assert(threw,'bad strength accepted');});
  test('confidence below range rejected',()=>{let threw=false;try{new ExpertStrategyRegistry().register({...signals[0],signalId:'fhq_signal_bad_confidence',expertSignalId:undefined,confidence:-1,status:'DRAFT'});}catch(_){threw=true;}assert(threw,'bad confidence accepted');});
  test('expired status excluded from active query',()=>{const r=new ExpertStrategyRegistry();r.register({...signals[0],signalId:'fhq_signal_expired',expertSignalId:undefined,status:'EXPIRED'});assert(r.findActive('2026-07-26T00:00:00Z').length===0,'expired active');});
  test('past expiration excluded from active query',()=>{const r=new ExpertStrategyRegistry();r.register({...signals[0],signalId:'fhq_signal_timed',expertSignalId:undefined,expirationDate:'2026-07-25T12:00:00Z'});assert(r.findActive('2026-07-26T00:00:00Z').length===0,'past expiration active');});
  test('invalidated signal excluded from active query',()=>{const r=new ExpertStrategyRegistry();r.register({...signals[0],signalId:'fhq_signal_invalidated',expertSignalId:undefined,status:'INVALIDATED'});assert(r.findActive('2026-07-26T00:00:00Z').length===0,'invalidated active');});
  test('draft signal excluded from active query',()=>{const r=new ExpertStrategyRegistry();r.register({...signals[0],signalId:'fhq_signal_draft',expertSignalId:undefined,status:'DRAFT'});assert(r.findActive('2026-07-26T00:00:00Z').length===0,'draft active');});
  test('WR position filtering exact',()=>{const found=registry.findActive('2026-07-26T00:00:00Z',{position:'WR'});assert(found.length===9&&found.every(signal=>signal.position==='WR'),'WR scope wrong');});
  test('RB position filtering exact',()=>{const found=registry.findActive('2026-07-26T00:00:00Z',{position:'RB'});assert(found.length===12&&found.every(signal=>signal.position==='RB'),'RB scope wrong');});
  test('global principles remain player neutral',()=>assert(signals.filter(signal=>signal.scope==='GLOBAL').every(signal=>signal.playerId===null&&signal.teamId===null&&signal.position===null),'global signal targets player'));
  test('platform-sensitive rules retain platform condition',()=>assert(signals.filter(signal=>signal.category==='PLATFORM_ADP_DIFFERENCE').every(signal=>signal.conditions.some(condition=>/platform/i.test(condition))),'platform condition missing'));
  test('price fades preserve recovery condition',()=>assert(signals.filter(signal=>signal.category==='PRICE_FADE').every(signal=>signal.invalidationConditions.some(condition=>/price|market|range/i.test(condition))),'fade became permanent'));
  test('FantasyLand role signal has invalidation',()=>assert(signals.find(signal=>signal.category==='ROLE_STABILITY').invalidationConditions.length>0,'role invalidation absent'));
  test('examples are isolated from principles',()=>assert(registry.sourceExamples().length===0&&signals.every(signal=>signal.playerId===null),'example leaked into active rules'));
  test('seed layer contains no recommendation output',()=>assert(!Object.keys(seeds).some(key=>/recommend/i.test(key)),'recommendation exposed'));
  test('source query deterministic',()=>assert(registry.find({sourceId:'bdge'}).map(signal=>signal.signalId).join(',')===registry.find({sourceId:'bdge'}).map(signal=>signal.signalId).join(','),'query changed'));
  test('full snapshot deterministic',()=>{const second=new ExpertStrategyRegistry();seeds.bundles.forEach(bundle=>second.load(bundle));assert(JSON.stringify(second.snapshot())===JSON.stringify(signals),'snapshot changed');});
  test('duplicate signal IDs rejected',()=>{let threw=false;try{registry.register(signals[0]);}catch(_){threw=true;}assert(threw,'duplicate accepted');});
  test('active query requires explicit time',()=>{let threw=false;try{registry.find({activeOnly:true});}catch(_){threw=true;}assert(threw,'implicit clock accepted');});

  const failCount=results.filter(result=>!result.passed).length;
  console.log(`Expert Intelligence: ${results.length-failCount} passed, ${failCount} failed`);
  results.filter(result=>!result.passed).forEach(result=>console.error(`FAIL: ${result.name}: ${result.error}`));
  return {results,passCount:results.length-failCount,failCount};
}

if(require.main===module){const result=run();if(result.failCount)process.exitCode=1;}
module.exports={run};
