'use strict';

const fs=require('fs'),vm=require('vm');
const ROOT=require('path').resolve(__dirname,'..');
function read(file){return fs.readFileSync(require('path').join(ROOT,file),'utf8')}

function createHarness(){
  const silent=()=>{};
  const element=()=>({classList:{add:silent,remove:silent,toggle:silent},appendChild:silent,append:silent,querySelectorAll:()=>[],querySelector:()=>null,setAttribute:silent,style:{},dataset:{},value:'',innerHTML:'',textContent:''});
  const context={console,performance,Date,Math,Map,Set,WeakMap,JSON,Object,Array,Number,String,Boolean,RegExp,Error,TypeError,Promise,Blob:global.Blob,URL:global.URL,addEventListener:silent,scrollTo:silent,
    setTimeout,clearTimeout,requestAnimationFrame:callback=>callback(),alert:silent,
    navigator:{},localStorage:{getItem:()=>null,setItem:silent},
    document:{getElementById:()=>null,createElement:element,querySelectorAll:()=>[]},
    fetch:async()=>{throw new Error('Network is disabled in recommendation baselines.')}};
  context.window=context;context.globalThis=context;vm.createContext(context);
  ['js/player-tier-contract.js','js/roster-view-v1.js','js/command-center-v1.js','js/jonin-insight-engine-v1.js','js/sharingan-vision-v1.js','js/jonin-ux-polish.js','js/flight-control-v1.js'].forEach(file=>vm.runInContext(read(file),context,{filename:file}));
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
