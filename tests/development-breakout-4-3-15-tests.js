'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const childProcess=require('node:child_process');
const Development=require('../js/intelligence-core/breakout-backtest/development-analysis');

const root=path.resolve(__dirname,'..');
const usage=JSON.parse(fs.readFileSync(path.join(root,'data/historical_usage_2023_2025.json'),'utf8'));
const development=JSON.parse(fs.readFileSync(path.join(root,'data/historical_development_2023_2025.json'),'utf8'));
const players=JSON.parse(fs.readFileSync(path.join(root,'data/players.json'),'utf8'));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'outputs/historical_breakout/backtest_summary_4_3_13.json'),'utf8'));
const artifactPath=path.join(root,'outputs/historical_breakout/development_backtest_summary_4_3_15.json');
const artifact=JSON.parse(fs.readFileSync(artifactPath,'utf8'));
const report=Development.runDevelopmentBacktest({historicalSnapshot:usage,developmentSnapshot:development,players,usageBaseline:baseline});
const tests=[];const test=(name,fn)=>tests.push({name,fn});const assert=(value,message)=>{if(!value)throw new Error(message)};const throws=(fn,message)=>{let did=false;try{fn()}catch{did=true}assert(did,message)};

const outcome=(isBreakout,percentile=.5)=>({isBreakout,outcomePercentile:percentile});
const row=(id,value,age,isBreakout=false)=>({canonicalPlayerId:String(id),playerName:`P${id}`,position:'RB',evidenceSeason:2023,outcomeSeason:2024,features:{values:{targetsPerGame:value}},development:{ageAtSeason:age,yearInLeague:id,careerStage:Development.stage(id)},outcome:outcome(isBreakout,value/10)});

test('career-stage bands preserve unknown and Year 1 through Year 4+',()=>assert(Development.stage(null)==='UNKNOWN'&&Development.stage(1)==='YEAR_1'&&Development.stage(2)==='YEAR_2'&&Development.stage(3)==='YEAR_3'&&Development.stage(4)==='YEAR_4_PLUS'&&Development.stage(12)==='YEAR_4_PLUS','career-stage contract changed'));
test('development attaches only to the exact canonical identity position and evidence season',()=>{const example={canonicalPlayerId:'1',playerName:'Fixture',position:'RB',evidenceSeason:2023,outcomeSeason:2024,features:{values:{}},outcome:outcome(false)},attached=Development.attachDevelopment([example],{records:[{canonicalPlayerId:'1',position:'RB',season:2023,ageAtSeason:22,yearInLeague:2},{canonicalPlayerId:'1',position:'RB',season:2024,ageAtSeason:23,yearInLeague:3}]})[0];assert(attached.development.ageAtSeason===22&&attached.development.yearInLeague===2&&attached.development.sourceSeason===2023,'future development row attached')});
test('missing development evidence remains explicitly unknown',()=>{const example={canonicalPlayerId:'1',playerName:'Fixture',position:'RB',evidenceSeason:2023,outcomeSeason:2024,features:{values:{}},outcome:outcome(false)},attached=Development.attachDevelopment([example],{records:[]})[0];assert(attached.development.status==='DEVELOPMENT_UNKNOWN'&&attached.development.ageAtSeason===null&&attached.development.careerStage==='UNKNOWN','missing development was inferred')});
test('evidence season must strictly precede outcome season',()=>throws(()=>Development.attachDevelopment([{canonicalPlayerId:'1',position:'RB',evidenceSeason:2024,outcomeSeason:2024,features:{values:{}},outcome:outcome(false)}],{records:[]}),'same-season outcome accepted'));
test('future-only development records cannot backfill an evidence season',()=>{const example={canonicalPlayerId:'1',playerName:'Fixture',position:'RB',evidenceSeason:2023,outcomeSeason:2024,features:{values:{}},outcome:outcome(false)},attached=Development.attachDevelopment([example],{records:[{canonicalPlayerId:'1',position:'RB',season:2024,ageAtSeason:23,yearInLeague:3}]})[0];assert(attached.development.status==='DEVELOPMENT_UNKNOWN','future development leaked backward')});

test('interaction formula is fixed at 75 percent usage and 25 percent development',()=>assert(Development.INTERACTION_FORMULA.usageWeight===.75&&Development.INTERACTION_FORMULA.developmentWeight===.25&&Development.INTERACTION_FORMULA.id==='USAGE_75_DEVELOPMENT_25','interaction weights changed'));
test('interaction ranks are deterministic and direction-aware',()=>{const rows=[row(1,1,30),row(2,2,25),row(3,3,20)],evaluated=Development.evaluateInteractionRows(rows,'targetsPerGame','ageAtSeason');assert(evaluated[0].interaction.combined===0&&evaluated[1].interaction.combined===.5&&evaluated[2].interaction.combined===1,'aligned rank combination changed')});
test('development can temper high usage without changing the underlying usage rank',()=>{const rows=[row(1,3,31),row(2,2,21),row(3,1,25)],evaluated=Development.evaluateInteractionRows(rows,'targetsPerGame','ageAtSeason'),oldStar=evaluated[0];assert(oldStar.interaction.usageRank===1&&oldStar.interaction.developmentRank===0&&oldStar.interaction.combined===.75,'development did not remain a bounded modifier')});
test('outcome labels cannot alter interaction inputs',()=>{const a=[row(1,1,30,false),row(2,2,25,true),row(3,3,20,false)],b=a.map(item=>({...item,outcome:outcome(!item.outcome.isBreakout)})),left=Development.evaluateInteractionRows(a,'targetsPerGame','ageAtSeason').map(item=>item.interaction.combined),right=Development.evaluateInteractionRows(b,'targetsPerGame','ageAtSeason').map(item=>item.interaction.combined);assert(JSON.stringify(left)===JSON.stringify(right),'outcomes leaked into interaction score')});
test('missing development values are excluded rather than coerced to zero',()=>{const rows=[row(1,1,null),row(2,2,25)],evaluated=Development.evaluateInteractionRows(rows,'targetsPerGame','ageAtSeason');assert(evaluated.length===1&&evaluated[0].canonicalPlayerId==='2','missing age became zero')});

const adequate={sampleSize:30,positives:10,negatives:20,auc:.60,rankCorrelation:.10,bucketEffect:.15};
const split=(usageAuc,combinedAuc,delta,overrides={})=>({comparableUsage:{...adequate,auc:usageAuc},combined:{...adequate,auc:combinedAuc,...overrides},aucDelta:delta});
test('READY requires adequate repeated improvement',()=>assert(Development.classifyInteraction([split(.55,.60,.05),split(.56,.61,.05)])==='READY_FOR_SHADOW_MODEL','repeated improvement was not ready'));
test('PROMISING permits smaller repeated improvement without calling it ready',()=>assert(Development.classifyInteraction([split(.54,.55,.01,{rankCorrelation:0,bucketEffect:0}),split(.55,.57,.02,{rankCorrelation:0,bucketEffect:0})])==='PROMISING_NEEDS_MORE_DATA','promising evidence was misclassified'));
test('opposite transition effects are contradictory',()=>assert(Development.classifyInteraction([split(.54,.60,.06),split(.55,.52,-.03)])==='CONTRADICTORY','conflicting transitions were promoted'));
test('small transition samples remain insufficient',()=>assert(Development.classifyInteraction([split(.55,.65,.10,{sampleSize:14}),split(.55,.65,.10)])==='INSUFFICIENT_SAMPLE','small sample was promoted'));
test('weak interactions remain weak',()=>assert(Development.classifyInteraction([split(.56,.55,-.01),split(.56,.56,0)])==='WEAK','weak interaction was promoted'));

test('actual backtest retains exact paired samples by position and transition',()=>assert(JSON.stringify(report.sampleSizes)===JSON.stringify({RB:{'2023_2024':33,'2024_2025':36},WR:{'2023_2024':46,'2024_2025':58},TE:{'2023_2024':21,'2024_2025':26},QB:{'2023_2024':17,'2024_2025':19}}),'paired samples changed'));
test('development-only results report both transitions and both features',()=>{for(const position of ['QB','RB','WR','TE'])for(const feature of ['ageAtSeason','yearInLeague'])assert(report.developmentOnly[position][feature].splits.length===2,'development-only transition missing')});
test('development-only rates reconcile breakouts and non-breakouts',()=>{for(const position of ['QB','RB','WR','TE'])for(const feature of ['ageAtSeason','yearInLeague'])for(const split of report.developmentOnly[position][feature].splits)assert(Math.abs(split.breakoutRate+split.nonBreakoutRate-1)<.0002&&split.positives+split.negatives===split.sampleSize,'development-only rates do not reconcile')});
test('conditional stage rates reconcile to eligible samples',()=>{for(const position of ['QB','RB','WR','TE']){const total=Object.values(report.conditionalBreakoutRates[position].careerStage).reduce((sum,item)=>sum+item.overall.n,0),expected=Object.values(report.sampleSizes[position]).reduce((sum,value)=>sum+value,0);assert(total===expected,`${position} stage samples do not reconcile`)}});
test('age bands use within-position transition tertiles and disclose thresholds',()=>{for(const position of ['QB','RB','WR','TE'])for(const value of Object.values(report.conditionalBreakoutRates[position].ageBands))assert(value.method==='WITHIN_POSITION_TRANSITION_TERTILES'&&Number.isFinite(value.youngerMax)&&Number.isFinite(value.olderMin),'age band threshold missing')});
test('all required usage-development interactions are present exactly once',()=>{const expected={RB:4,WR:8,TE:2,QB:6};for(const [position,count] of Object.entries(expected)){const rows=report.interactions[position],keys=rows.map(item=>`${item.usageFeature}|${item.developmentFeature}`);assert(rows.length===count&&new Set(keys).size===count,`${position} interaction inventory changed`)}});
test('every interaction carries transition-level baseline combined and delta metrics',()=>{for(const rows of Object.values(report.interactions))for(const item of rows)assert(item.splits.length===2&&item.splits.every(split=>split.comparableUsage&&split.combined&&split.aucDelta!==undefined),'interaction metrics incomplete')});
test('actual readiness remains conservative and creates no current watchlist',()=>assert(!Object.values(report.interactions).flat().some(item=>item.readiness==='READY_FOR_SHADOW_MODEL')&&report.currentWatchlist.created===false&&report.finalDecision==='PROMISING DEVELOPMENT SIGNALS — MORE VALIDATION NEEDED','unsupported production-ready signal or watchlist created'));
test('TE late targets by career stage is promising but not ready',()=>{const item=report.interactions.TE.find(row=>row.usageFeature==='lateTargets'&&row.developmentFeature==='yearInLeague');assert(item.readiness==='PROMISING_NEEDS_MORE_DATA'&&item.meanAucDelta===.0176,'TE finding changed')});
test('QB development interactions do not improve the protected rushing signals',()=>assert(report.interactions.QB.every(item=>item.readiness==='WEAK'&&item.meanAucDelta<0),'QB development was overstated'));
test('WR age interactions improve rank separation but remain below useful absolute discrimination',()=>assert(report.interactions.WR.filter(item=>item.developmentFeature==='ageAtSeason').every(item=>item.meanAucDelta>0&&item.readiness==='WEAK'),'WR result changed or was promoted'));

test('named false-positive and false-negative audits remain complete',()=>assert(report.caseAudits.falsePositives.length===4&&report.caseAudits.falseNegatives.length===12&&report.caseAudits.falsePositives.every(item=>Development.FALSE_POSITIVE_NAMES.includes(item.playerName))&&report.caseAudits.falseNegatives.every(item=>Development.FALSE_NEGATIVE_NAMES.includes(item.playerName)),'named case audit incomplete'));
test('market-value appreciation is recommended but not fabricated',()=>assert(report.marketValueAppreciation.recommendedForFutureResearch&&report.marketValueAppreciation.implemented===false&&report.marketValueAppreciation.reason.includes('historical ADP'),'market-value outcome was fabricated'));
test('route source limitation remains explicit with no route proxy',()=>assert(report.routeDataStatus==='SOURCE LIMITATION'&&report.limitations.some(item=>item.includes('no routes')),'route limitation changed'));
test('temporal safety forbids future usage team role and depth chart',()=>assert(report.temporalSafety.evidenceBeforeOutcome&&report.temporalSafety.futureUsageConsumed===false&&report.temporalSafety.futureTeamConsumed===false&&report.temporalSafety.futureRoleConsumed===false&&report.temporalSafety.futureDepthChartConsumed===false,'future evidence entered the report'));
test('4.3.13 baseline values remain frozen',()=>{const auc=(position,feature)=>baseline.positions[position].signals.find(row=>row.feature===feature).splits.map(row=>row.auc);assert(JSON.stringify(auc('RB','targetsPerGame'))==='[0.5393,0.6404]'&&JSON.stringify(auc('RB','receivingYardsPerGame'))==='[0.5413,0.5764]'&&JSON.stringify(auc('TE','lateTargets'))==='[0.5865,0.5273]'&&JSON.stringify(auc('QB','lateRushingAttempts'))==='[0.55,0.6932]'&&JSON.stringify(auc('QB','interceptionRate'))==='[0.5833,0.6364]'&&JSON.stringify(auc('QB','rushingAttemptGrowth'))==='[0.575,0.5455]','4.3.13 baseline changed')});
test('research artifact embeds the exact frozen usage baselines it compares against',()=>assert(JSON.stringify(report.frozenBaseline.signals.RB.targetsPerGame.map(row=>row.auc))==='[0.5393,0.6404]'&&JSON.stringify(report.frozenBaseline.signals.TE.lateTargets.map(row=>row.auc))==='[0.5865,0.5273]'&&JSON.stringify(report.frozenBaseline.signals.QB.lateRushingAttempts.map(row=>row.auc))==='[0.55,0.6932]','frozen comparison values missing'));
test('4.3.15 remains shadow-only and absent from production imports',()=>{const core=fs.readFileSync(path.join(root,'js/intelligence-core/index.js'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(report.recommendationAuthority===false&&!core.includes('development-analysis')&&!app.includes('development_backtest_summary_4_3_15')&&!html.includes('development_backtest_summary_4_3_15'),'research acquired production authority')});
test('committed research artifact regenerates byte-identically',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'fhq-4-3-15-'));
  const target=path.join(directory,'report.json');
  try{
    childProcess.execFileSync(process.execPath,[path.join(root,'scripts/run_development_breakout_backtest.js'),'--output',target],{cwd:root,stdio:'pipe'});
    assert(fs.readFileSync(target,'utf8')===fs.readFileSync(artifactPath,'utf8'),'artifact regeneration was nondeterministic');
  }finally{
    fs.rmSync(directory,{recursive:true,force:true});
  }
});

async function run(){let passCount=0,failures=[];for(const item of tests){try{await item.fn();passCount++}catch(error){failures.push({name:item.name,error:error.message})}}return{passCount,failCount:failures.length,failures}}
if(require.main===module)run().then(result=>{console.log(JSON.stringify(result));if(result.failCount)process.exit(1)});
module.exports={run};
