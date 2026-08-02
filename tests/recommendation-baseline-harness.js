'use strict';

const fs=require('fs'),vm=require('vm');
const ROOT=require('path').resolve(__dirname,'..');
function read(file){return fs.readFileSync(require('path').join(ROOT,file),'utf8')}

function createHarness({unified=false}={}){
  const silent=()=>{};
  const element=()=>({classList:{add:silent,remove:silent,toggle:silent},appendChild:silent,append:silent,querySelectorAll:()=>[],querySelector:()=>null,setAttribute:silent,style:{},dataset:{},value:'',innerHTML:'',textContent:''});
  const context={console,performance,Date,Math,Map,Set,WeakMap,JSON,Object,Array,Number,String,Boolean,RegExp,Error,TypeError,Promise,Blob:global.Blob,URL:global.URL,addEventListener:silent,scrollTo:silent,
    setTimeout,clearTimeout,requestAnimationFrame:callback=>callback(),alert:silent,
    navigator:{},localStorage:{getItem:()=>null,setItem:silent},
    document:{getElementById:()=>null,createElement:element,querySelectorAll:()=>[],querySelector:()=>null},
    fetch:async()=>{throw new Error('Network is disabled in recommendation baselines.')}};
  context.window=context;context.globalThis=context;vm.createContext(context);
  const runtimeFiles=['js/player-tier-contract.js','js/roster-view-v1.js','js/roster-completion-constraint-v1.js','js/draft-grading-engine-v1.js'];
  if(unified)runtimeFiles.push('js/fantasy-hq-core.js','js/jonin-decision-intelligence-v1.js');
  runtimeFiles.push('js/command-center-v1.js','js/jonin-insight-engine-v1.js','js/sharingan-vision-v1.js','js/jonin-ux-polish.js','js/flight-control-v1.js');
  runtimeFiles.forEach(file=>vm.runInContext(read(file),context,{filename:file}));
  const app=read('js/app.js').replace(/\ninit\(\);\s*$/,'\n');
  vm.runInContext(app+`\nwindow.__RecommendationBaseline={
    load(runtimePlayers){players=JSON.parse(JSON.stringify(runtimePlayers));buildPlayerSearchIndex();slot=10;mode='practice';style='balanced';slotManagers={1:'Marc',2:'Kalani',3:'Ray',4:'Fritz',5:'Michael',6:'Josh',7:'Raoul',8:'Rob',9:'AJ',10:'Gerard'};aiProfiles={1:'Balanced',2:'Hero RB',3:'Value Drafter',4:'Balanced',5:'WR Heavy',6:'Rookie Chaser',7:'Balanced',8:'Elite TE',9:'Early QB',10:'Balanced'};applyDraftStructure();invalidateIntelligence()},
    configure(config){
      pick=Number(config.pick||1);drafted=[];history=[];decisionSnapshots=[];selectedCandidateId=null;
      const preserve=new Set((config.preserve||[]).map(String)),roster=[...(config.userRoster||[])],reserved=new Set([...preserve,...roster].map(String)),used=new Set();
      const byName=name=>players.find(player=>player.name===name);
      const pool=players.filter(player=>!reserved.has(player.name)).sort((a,b)=>a.overall-b.overall||a.id-b.id);
      let poolIndex=0,userIndex=0;
      for(let current=1;current<pick;current++){
        const team=teamForPick(current);let player;
        if(team===slot&&userIndex<roster.length){player=byName(roster[userIndex++]);}
        while(!player&&poolIndex<pool.length){const candidate=pool[poolIndex++];if(!used.has(candidate.id))player=candidate;}
        if(!player)throw new Error('Baseline fixture ran out of players.');
        used.add(player.id);drafted.push(player.id);history.push({pick:current,id:player.id,team});
      }
      invalidateIntelligence();
    },
    snapshot(name){
      const recs=recommendations(),model=recs.length?playerDecisionModel(recs[0],recs):null;
      return {name,currentPick:pick,roster:positionalCountsAll(),topFive:recs.map(player=>({id:player.id,name:player.name,finalPickScore:finalPickScore(player),mambaScore:mambaScore(player),decisionTier:tierLabel(player),sharinganStage:sharinganStage(player).key})),fightControl:model?{action:model.summary.action,primary:{id:model.player.id,name:model.player.name},pivot:model.summary.pivot?{id:model.summary.pivot.id,name:model.summary.pivot.name}:null,mission:model.summary.mission}:null};
    },
    playerState(name){const player=players.find(candidate=>candidate.name===name);return {id:player.id,name:player.name,currentPick:pick,finalPickScore:finalPickScore(player),mambaScore:mambaScore(player),decisionTier:tierLabel(player),sharinganStage:sharinganStage(player).key,eligible:recommendationEligible(player)}},
    fullPool(){return players.map(player=>({id:player.id,name:player.name,decisionTier:tierLabel(player),mambaScore:mambaScore(player),finalPickScore:finalPickScore(player),eligible:recommendationEligible(player)}))},
    configureFresh({pick:currentPick=1,slot:userSlot=10,startQB=1}={}){pick=Number(currentPick);slot=Number(userSlot);leagueContext={...leagueContext,teams:10,scoring:'half',startQB:Number(startQB),startRB:2,startWR:3,startTE:1,flex:2,strategy:'auto',risk:'balanced'};applyDraftStructure();drafted=[];history=[];decisionSnapshots=[];selectedCandidateId=null;slotManagers={1:'Marc',2:'Kalani',3:'Ray',4:'Fritz',5:'Michael',6:'Josh',7:'Raoul',8:'Rob',9:'AJ',10:'Gerard'};const oldGerard=Object.keys(slotManagers).find(key=>slotManagers[key]==='Gerard');if(oldGerard&&Number(oldGerard)!==slot)slotManagers[oldGerard]=slotManagers[slot];slotManagers[slot]='Gerard';invalidateIntelligence()},
    boundarySnapshot(){const recs=recommendations(),decision=championshipDecision();return{topFive:recs.map(player=>{const evaluation=decision.all.find(item=>item.playerId===player.id);return{id:player.id,name:player.name,overall:player.overall,overallTier:PlayerTierContract.getOverallTier(player),posRank:player.posRank,posTier:PlayerTierContract.getPositionTier(player),mamba:mambaScore(player),positionalSourceBlend:positionalSourceBlend(player),overallSourceBlend:overallSourceBlend(player),crossPositionBase:crossPositionValueBase(player),scores:evaluation.scores}}),josh:(()=>{const player=players.find(candidate=>candidate.name==='Josh Allen'),evaluation=decision.all.find(item=>item.playerId===player.id);return{id:player.id,name:player.name,overall:player.overall,overallTier:PlayerTierContract.getOverallTier(player),posRank:player.posRank,posTier:PlayerTierContract.getPositionTier(player),mamba:mambaScore(player),positionalSourceBlend:positionalSourceBlend(player),overallSourceBlend:overallSourceBlend(player),crossPositionBase:crossPositionValueBase(player),scores:evaluation.scores}})()}},
    completionSnapshot(){const state=rosterCompletionState(),raw=available().filter(recommendationEligible),rawDecision=championshipDecision(raw),rawTop=rawDecision.all.slice().sort((a,b)=>b.scores.championship-a.scores.championship).slice(0,10),recs=recommendations(),models=recs.map(candidate=>playerDecisionModel(candidate,recs)),labels=recommendationCategoryLabels(models),view=rosterViewState();return{pick,state:{mode:state.mode,userPicksRemaining:state.userPicksRemaining,unfilledRequiredSlots:state.unfilledRequiredSlots,requiredPositions:[...state.requiredPositions],message:state.message},roster:positionalCountsAll(),rbBench:view.bench.filter(row=>positionKey(row.player||{})==='RB').length,rawTop:rawTop.map(item=>({id:item.player.id,name:item.player.name,pos:positionKey(item.player),playerValue:item.scores.playerValue,rosterFit:item.scores.rosterFit,opportunityCost:item.scores.opportunityCost,futureValue:item.scores.expectedFutureValue,final:item.scores.championship,need:DraftCommandCenterV1.calculatePositionNeeds(positionalCountsAll(),TOTAL_ROUNDS,info().r)[positionKey(item.player)]??null,surplus:rosterFitModifier(item.player)})),cards:models.map(model=>({id:model.player.id,name:model.player.name,pos:positionKey(model.player),category:labels.get(model.player.id)}))}},
    runDeterministicMock(){this.configureFresh({pick:1,slot:10});const turns=[],recordDirect=(player,team)=>{drafted.push(player.id);history.push({pick,id:player.id,team});pick+=1;selectedCandidateId=null;invalidateIntelligence()};while(pick<=TOTAL_PICKS){const team=teamForPick(pick);if(team===slot){turns.push(this.completionSnapshot());const rec=recommendations()[0];if(!rec)throw new Error('No user recommendation at pick '+pick);recordDirect(rec,team)}else{const candidate=available().slice().sort((a,b)=>(a.overall??999)-(b.overall??999)||a.id-b.id)[0];if(!candidate)throw new Error('No CPU candidate at pick '+pick);recordDirect(candidate,team)}}return{turns,finalState:RosterViewV1.assignSlots({slots:rosterSlots,draftedEntries:myRosterEntries()}),roster:positionalCountsAll()}},
    undoReplay(){const before=this.snapshot('before-undo');const last=history.pop();drafted=drafted.filter(id=>id!==last.id);pick=last.pick;invalidateIntelligence();const undone=this.snapshot('undone');drafted.push(last.id);history.push(last);pick=last.pick+1;invalidateIntelligence();const replayed=this.snapshot('replayed');return {before,undone,replayed}}
  };`,context,{filename:'js/app.js'});
  const runtimePlayers=JSON.parse(read('data/players.json'));
  context.__RecommendationBaseline.load(runtimePlayers);
  return context.__RecommendationBaseline;
}

const SCENARIOS=Object.freeze([
  {name:'new-draft-slot-10',pick:1,preserve:['Jahmyr Gibbs','Bijan Robinson']},
  {name:'pick-1-10-gibbs-bijan',pick:10,preserve:['Jahmyr Gibbs','Bijan Robinson']},
  {name:'gibbs-eternal-1-10',pick:10,preserve:['Jahmyr Gibbs']},
  {name:'jsn-mangekyo-3-10',pick:30,preserve:['Jaxon Smith-Njigba']},
  {name:'early-wr-heavy',pick:30,userRoster:['Puka Nacua','CeeDee Lamb']},
  {name:'early-rb-heavy',pick:30,userRoster:['Bijan Robinson','Christian McCaffrey']},
  {name:'elite-qb-drafted',pick:30,userRoster:['Josh Allen','Puka Nacua']},
  {name:'elite-te-drafted',pick:30,userRoster:['Brock Bowers','Puka Nacua']},
  {name:'mid-draft-positional-run',pick:61,userRoster:['Puka Nacua','Christian McCaffrey','Josh Allen','Trey McBride','Chris Olave','James Cook']},
  {name:'late-round-upside',pick:121,userRoster:['Josh Allen','Christian McCaffrey','James Cook','Puka Nacua','CeeDee Lamb','Chris Olave','Brock Bowers','DK Metcalf','David Montgomery','Jaylen Waddle','Tetairoa McMillan','Jordan Addison']},
  {name:'k-dst-timing',pick:151,userRoster:['Josh Allen','Christian McCaffrey','James Cook','Puka Nacua','CeeDee Lamb','Chris Olave','Brock Bowers','DK Metcalf','David Montgomery','Jaylen Waddle','Tetairoa McMillan','Jordan Addison','Dak Prescott','Tony Pollard','Rashid Shaheed']},
  {name:'undo-replay',pick:31,userRoster:['Puka Nacua','Christian McCaffrey','Josh Allen']},
  {name:'saved-mock-restoration',pick:31,userRoster:['Puka Nacua','Christian McCaffrey','Josh Allen']}
]);

function captureBaselines(){const harness=createHarness(),scenarios=[];for(const scenario of SCENARIOS){harness.configure(scenario);const snapshot=harness.snapshot(scenario.name);if(scenario.name==='gibbs-eternal-1-10')snapshot.focus=harness.playerState('Jahmyr Gibbs');if(scenario.name==='jsn-mangekyo-3-10')snapshot.focus=harness.playerState('Jaxon Smith-Njigba');if(scenario.name==='undo-replay')snapshot.undoReplay=harness.undoReplay();scenarios.push(snapshot)}harness.configure(SCENARIOS[0]);return {scenarios,fullPool:harness.fullPool()}}

module.exports={createHarness,SCENARIOS,captureBaselines};
