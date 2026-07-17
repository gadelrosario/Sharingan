let players=[],mode="practice",style="chaotic",slot=10,pick=1,drafted=[],history=[],decisionSnapshots=[],currentYahooRecord=null,posFilter="ALL",aiProfiles={},slotManagers={},selectedCandidateId=null,mobileTeamExpanded=false,leagueContext={scoring:"half",startWR:3,flex:2,passTD:6,risk:"balanced",strategy:"auto"};
const managers=[
{name:"Gerard",archetype:"Championship Value",skill:9.6,predictability:7,homerTeam:"",homer:0,qbHoard:2,waiver:10},
{name:"Marc",archetype:"Calculated Ceiling",skill:8,predictability:8,homerTeam:"NYJ",homer:2,qbHoard:2,waiver:7},
{name:"Kalani",archetype:"Resource Controller",skill:8,predictability:6,homerTeam:"PIT",homer:5,qbHoard:10,waiver:9},
{name:"Ray",archetype:"Value Drafter",skill:8.3,predictability:9,homerTeam:"LAC",homer:4,qbHoard:3,waiver:9},
{name:"Fritz",archetype:"AI Consensus",skill:7.4,predictability:8,homerTeam:"",homer:0,qbHoard:3,waiver:6},
{name:"Michael",archetype:"Instinct / Eagles",skill:7.9,predictability:4,homerTeam:"PHI",homer:10,qbHoard:5,waiver:4},
{name:"Josh",archetype:"Reactionary Hype",skill:6.8,predictability:5,homerTeam:"",homer:0,qbHoard:5,waiver:8},
{name:"Raoul",archetype:"Balanced Value",skill:7.5,predictability:8,homerTeam:"LAC",homer:6,qbHoard:3,waiver:7},
{name:"Rob",archetype:"Conviction Drafter",skill:6.5,predictability:9,homerTeam:"DEN",homer:7,qbHoard:3,waiver:6},
{name:"AJ",archetype:"Balanced Variable",skill:7,predictability:4,homerTeam:"SF",homer:4,qbHoard:4,waiver:7}
];
const blueprint=["RB","WR","WR","RB","TE/QB","QB/TE"],strategies=["Balanced","Hero RB","Zero RB","WR Heavy","Early QB","Elite TE","Rookie Chaser","Value Drafter","Chaos"],rosterSlots=["QB","RB1","RB2","WR1","WR2","WR3","TE","FLEX1","FLEX2","K","DEF","BENCH1","BENCH2","BENCH3","BENCH4","BENCH5","BENCH6"];
const TOTAL_ROUNDS=rosterSlots.length,TOTAL_PICKS=TOTAL_ROUNDS*10;
const APP_VERSION="Jōnin 2.9 • Intelligence Foundation";
let renderInProgress=false,simulationInProgress=false,activeMobilePage="mobileDraft";
const dirtyViews={players:true,room:true,wait:true,team:true};
let heavyRenderTimer=null;
// Jōnin Unity Core: one cached evaluation layer powers every visible decision.
let intelligenceEpoch=0;
let scoreCache=new Map(),evaluationCache=new Map(),marketCache=new Map(),snapshotCache=null;
function invalidateIntelligence(){intelligenceEpoch++;scoreCache.clear();evaluationCache.clear();marketCache.clear();snapshotCache=null}
function validTier(value){let t=String(value||"").trim().toUpperCase();return ["S","A","B","C","D","E","F"].includes(t)?t:null}
function sourceTierSummary(p){return {fantasyHQ:tierLabel(p),gerard:validTier(p.posTier)||validTier(p.overallTier),bdge:validTier(p.bdgeTier),flock:validTier(p.flockTier),fantasyPros:null}}
function getPlayerEvaluation(playerOrId){
 const p=typeof playerOrId==="object"?playerOrId:players.find(x=>x.id===Number(playerOrId));
 if(!p)return null;
 const key=`${intelligenceEpoch}:${p.id}`;if(evaluationCache.has(key))return evaluationCache.get(key);
 const tier=tierLabel(p),mamba=mambaScore(p),final=finalPickScore(p),risk=survivalRisk(p),stage=sharinganStage(p);
 const out=Object.freeze({player:p,playerId:p.id,tier,sourceTiers:sourceTierSummary(p),mamba,final,risk,stage,roomBoost:roomBoost(p),rosterFit:rosterFitModifier(p)});
 evaluationCache.set(key,out);return out;
}
function getIntelligenceSnapshot(){
 if(snapshotCache&&snapshotCache.epoch===intelligenceEpoch)return snapshotCache;
 const recPlayers=recommendations(),recIds=recPlayers.map(p=>p.id);
 const markets={};["RB","WR","QB","TE"].forEach(pos=>markets[pos]=marketPressure(pos));
 const wait={};["QB","TE","DST","K"].forEach(pos=>wait[pos]=waitScore(pos));
 snapshotCache=Object.freeze({epoch:intelligenceEpoch,pick,round:info().r,recommendationIds:Object.freeze(recIds),markets:Object.freeze(markets),wait:Object.freeze(wait),createdAt:Date.now()});
 return snapshotCache;
}
function snapshotRecommendations(){return getIntelligenceSnapshot().recommendationIds.map(id=>players.find(p=>p.id===id)).filter(Boolean)}
function el(id){return document.getElementById(id)}
function safeText(id,value){const node=el(id);if(node)node.textContent=value}
function safeHTML(id,value){const node=el(id);if(node)node.innerHTML=value}
function reportRuntimeError(context,err){console.error(`[${APP_VERSION}] ${context}:`,err);const status=el("runtimeStatus");if(status){status.classList.remove("hidden");status.innerHTML=`<b>Fantasy HQ recovered from an interface error.</b><div class="meta">${context}: ${err.message}. Refresh once if a section does not update.</div>`}}
window.addEventListener("error",e=>reportRuntimeError("Browser runtime",e.error||new Error(e.message)));
window.addEventListener("unhandledrejection",e=>reportRuntimeError("Background task",e.reason instanceof Error?e.reason:new Error(String(e.reason))));
async function init(){
 try{
  const response=await fetch("data/players.json?v=jonin_2_9",{cache:"no-store"});
  if(!response.ok)throw new Error("Player database returned "+response.status);
  players=await response.json();
  poolStatus.innerHTML=`<b>Draft pool ready</b><div class="meta" style="margin-top:4px">${players.length} players loaded, including kickers and defenses.</div>`;const btn=el("startDraftBtn");if(btn){btn.disabled=false;btn.textContent="Start Draft";}
 }catch(err){
  console.error("Fantasy HQ player pool failed to load:",err);
  poolStatus.innerHTML=`<b style="color:#ff8c9a">Draft pool could not load</b><div class="meta" style="margin-top:4px">Open the installed/deployed website rather than the HTML file by itself, then refresh. Error: ${err.message}</div>`;const btn=el("startDraftBtn");if(btn){btn.disabled=true;btn.textContent="Player pool unavailable";}
 }
 for(let i=1;i<=10;i++){let o=document.createElement("option");o.value=i;o.textContent="Pick "+i;draftSlot.appendChild(o)}
 draftSlot.value=10;
 renderManagerSetup();
}

function renderManagerSetup(){const pref=["Kalani","Marc","Ray","Fritz","Michael","Gerard","Josh","Raoul","Rob","AJ"];managerSetup.innerHTML="";for(let i=1;i<=10;i++){let w=document.createElement("div");w.className="managerSlot";let b=document.createElement("b");b.textContent="Pick "+i;let s=document.createElement("select");s.id="mgr"+i;managers.forEach(m=>{let o=document.createElement("option");o.value=m.name;o.textContent=m.name+" — "+m.archetype;s.appendChild(o)});s.value=pref[i-1];w.append(b,s);managerSetup.appendChild(w)}}
function captureManagers(){slotManagers={};for(let i=1;i<=10;i++){let e=document.getElementById("mgr"+i);slotManagers[i]=e?e.value:"Team "+i}let old=Object.keys(slotManagers).find(k=>slotManagers[k]==="Gerard");if(old&&+old!==slot){let tmp=slotManagers[slot];slotManagers[old]=tmp}slotManagers[slot]="Gerard"}
function getManager(t){return managers.find(m=>m.name===slotManagers[t])||managers[0]}
function chooseMode(m){mode=m;practiceChoice.classList.toggle("selected",m==="practice");yahooChoice.classList.toggle("selected",m==="yahoo");liveChoice.classList.toggle("selected",m==="live");if(document.getElementById("mockRandomizer"))mockRandomizer.classList.toggle("hidden",m!=="practice")}
function startDraft(){
 try{
  if(!players.length){alert("The player pool has not loaded yet. Refresh the installed website and wait for ‘Draft pool ready.’");return}
  mobileTeamExpanded=false;const rs=el("runtimeStatus");if(rs){rs.classList.add("hidden");rs.innerHTML="";}
  slot=+(document.getElementById("draftSlot")?.value||10);
  style=document.getElementById("roomStyle")?.value||"chaotic";
  leagueContext={
   scoring:document.getElementById("scoring")?.value||"half",
   startWR:+(document.getElementById("startWR")?.value||3),
   flex:+(document.getElementById("flexSpots")?.value||2),
   passTD:+(document.getElementById("passTD")?.value||6),
   teams:10,completionPoint:.1,firstDownPoint:.1,bigPlayBonuses:true,enhancedDST:true,customKicker:true,
   risk:document.getElementById("riskProfile")?.value||"balanced",
   strategy:document.getElementById("strategyPreset")?.value||"auto"
  };
  captureManagers();pick=1;drafted=[];history=[];decisionSnapshots=[];currentYahooRecord=null;selectedCandidateId=null;invalidateIntelligence();buildProfiles();if(typeof rosterRows!=="function")throw new Error("Roster engine did not initialize");
  setupScreen.classList.add("hidden");appScreen.classList.remove("hidden");draftReport.classList.add("hidden");document.querySelector('.appgrid').classList.remove('hidden');changeBtn.classList.remove("hidden");tabs.classList.remove("hidden");
  let modeName=mode==="practice"?"🟢 PRACTICE MOCK DRAFT":mode==="yahoo"?"🟣 YAHOO LIVE MOCK • REAL PEOPLE":"🔵 LIVE DRAFT DAY";
  modeBanner.innerHTML=`<div class="banner ${mode==="practice"?"practiceBanner":"liveBanner"}"><span>${modeName}</span><span>Draft Slot ${slot} • ${slotManagers[slot]}</span></div>`;
  renderLeagueDnaBar();
  practiceControls.classList.toggle("hidden",mode!=="practice");liveHelp.classList.toggle("hidden",mode==="practice");renderAll();
 }catch(err){console.error("Unable to start draft:",err);alert("Fantasy HQ could not start the draft. Please refresh the Chūnin Reforged 2.1 build. Technical detail: "+err.message)}
}
function backToSetup(){appScreen.classList.add("hidden");setupScreen.classList.remove("hidden");changeBtn.classList.add("hidden");tabs.classList.add("hidden")}
function buildProfiles(){aiProfiles={};for(let t=1;t<=10;t++){if(t!==slot)aiProfiles[t]=getManager(t).archetype}}
function teamForPick(p){let r=Math.ceil(p/10),x=(p-1)%10+1;return r%2?x:11-x}
function info(){let r=Math.ceil(pick/10),ip=(pick-1)%10+1,next=pick;while(next<=TOTAL_PICKS&&teamForPick(next)!==slot)next++;return{r,ip,until:Math.max(0,Math.min(TOTAL_PICKS,next)-pick)}}
function available(){return players.filter(p=>!drafted.includes(p.id))}
function myPlayers(){return history.filter(h=>h.team===slot).map(h=>players.find(p=>p.id===h.id)).filter(Boolean)}
function counts(){let c={QB:0,RB:0,WR:0,TE:0,K:0,DST:0};myPlayers().forEach(p=>{if(c[p.pos]!==undefined)c[p.pos]++});return c}
function userPositionFilled(pos){let c=counts();return (pos==="QB"&&c.QB>=1)||(pos==="TE"&&c.TE>=1)}
function tierLabel(p){let t=String(p?.posTier||p?.overallTier||"C").toUpperCase();return ["S","A","B","C","D","E","F"].includes(t)?t:"C"}
function tierWeight(t){return ({S:5,A:4,B:3,C:2,D:1,E:0,F:0})[t]??2}
function tierBadge(p){let t=tierLabel(p);return `<span class="tierBadge tier-${t}">${t} Tier</span>`}
function positionTierCounts(pos,team=slot){let out={S:0,A:0,B:0,C:0,D:0};managerRoster(team).filter(p=>(p.pos==="DEF"?"DST":p.pos)===pos).forEach(p=>{let t=tierLabel(p);out[t]=(out[t]||0)+1});return out}
function positionStrength(pos){let tc=positionTierCounts(pos),score=tc.S*5+tc.A*4+tc.B*2.5+tc.C;let starters=pos==="RB"?2:pos==="WR"?3:1;let count=managerPositionCounts(slot)[pos]||0;if(score>=starters*4)return "Elite";if(score>=starters*3)return "Strong";if(count>=starters)return "Adequate";if(count>0)return "Thin";return "Critical"}
function rosterFitModifier(p){if(!["RB","WR","QB","TE"].includes(p.pos))return 0;let strength=positionStrength(p.pos),t=tierLabel(p),m=0;if(strength==="Critical")m+=5;else if(strength==="Thin")m+=4;else if(strength==="Adequate")m+=2;else if(strength==="Strong")m-=1;else if(strength==="Elite")m-=2;if((t==="S"||t==="A")&&["RB","WR"].includes(p.pos))m+=1;return m}
function roomBoost(p){if(!["RB","WR","QB","TE"].includes(p.pos))return 0;let x=marketPressure(p.pos);return x.pressure>=82?5:x.pressure>=65?4:x.pressure>=45?2:x.pressure>=22?1:0}
function baseFinalScore(p){return Math.max(1,Math.min(110,mambaScore(p)+roomBoost(p)+rosterFitModifier(p)))}
function valueGap(p){let pool=available().filter(x=>x.id!==p.id&&recommendationEligible(x)).map(x=>mambaScore(x)).sort((a,b)=>b-a);return mambaScore(p)-(pool[0]||0)}
function valueOverride(p){let fall=Math.max(0,pick-(p.overall||pick)),gap=valueGap(p),t=tierLabel(p);return (gap>=7)||((t==="S"||t==="A")&&fall>=20)}
function eternalValue(p){let fall=Math.max(0,pick-(p.overall||pick)),t=tierLabel(p);return (t==="S"||t==="A")&&fall>=40&&mambaScore(p)>=90}
function finalPickScore(p){let key=`f:${intelligenceEpoch}:${p.id}`;if(scoreCache.has(key))return scoreCache.get(key);let score=baseFinalScore(p);if(valueOverride(p))score+=3;if(eternalValue(p))score+=4;score=Math.round(Math.max(1,Math.min(115,score)));scoreCache.set(key,score);return score}
function sharinganIconMarkup(stage="three"){
 const key=["one","two","three","mangekyo","eternal"].includes(stage)?stage:"three";
 let inner="";
 if(key==="mangekyo"){
  inner='<path class="ms-core" d="M12 2.2c1.5 3.5 3.7 5.7 7.4 7.4-3.5 1.4-5.7 3.7-7.4 7.4-1.5-3.7-3.8-6-7.4-7.4C8.2 8 10.5 5.7 12 2.2Z"/><path class="ms-cut" d="M12 4.1 14.2 10 20 12l-5.8 2L12 19.9 9.8 14 4 12l5.8-2L12 4.1Z"/>';
 }else if(key==="eternal"){
  inner='<path class="ems-outer" d="M12 1.9 15 7.5l6.1.8-4.4 4.3 1 6.1-5.7-2.9-5.7 2.9 1-6.1-4.4-4.3 6.1-.8L12 1.9Z"/><path class="ems-inner" d="M12 4.3c1.1 3 2.9 4.8 5.8 5.8-2.9 1.1-4.7 2.9-5.8 5.8-1.1-2.9-2.9-4.7-5.8-5.8C9.1 9 10.9 7.2 12 4.3Z"/><circle cx="12" cy="12" r="2.1" class="pupil"/>';
 }else{
  const count=key==="one"?1:key==="two"?2:3;
  let tomoe="";
  for(let i=0;i<count;i++){
   const a=i*(360/count);
   tomoe+=`<g transform="rotate(${a} 12 12)"><circle cx="12" cy="5.6" r="1.65" class="tomoeDot"/><path d="M13.2 6.1c2 .8 2.9 2.1 3 3.8-1.1-1.2-2.2-1.7-3.7-1.8Z" class="tomoeTail"/></g>`;
  }
  inner=tomoe+'<circle cx="12" cy="12" r="2.15" class="pupil"/>';
 }
 return `<span class="sharinganIcon sharingan-${key}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="10.5" class="iris"/><circle cx="12" cy="12" r="8.6" class="ring"/>${inner}</svg></span>`;
}
function renderLeagueDnaBar(){
 const node=document.getElementById("leagueDnaBar");if(!node)return;
 node.innerHTML=`<div><b>Royal Rumble League DNA</b><span>10 teams • Half-PPR • 3 WR • 2 FLEX • 6-point pass TD</span></div><div class="leagueDnaSignals"><span>Elite QB ↑</span><span>WR depth ↑</span><span>Explosive upside ↑</span><span>D/ST above average</span></div>`;
}
function leagueSpecificModifier(p){
 let m=0,t=tierLabel(p),pr=+(p.posRank||99);
 if(p.pos==="QB"){
  if(pr<=4)m+=5;else if(pr<=8)m+=2;else if(pr>12)m-=2;
  if(p.leagueBreaker)m+=2;
 }
 if(["RB","WR"].includes(p.pos)){
  if(p.leagueBreaker)m+=3;
  if(t==="S"||t==="A")m+=2;
  m+=1;
 }
 if(p.pos==="TE"&&(t==="S"||t==="A"))m+=2;
 if(p.pos==="DST")m+=2;
 return m;
}
function sharinganStage(p){if(eternalValue(p))return{key:"eternal",label:"ETERNAL MANGEKYŌ",meaning:"Season-Changing Value"};if(valueOverride(p))return{key:"mangekyo",label:"MANGEKYŌ",meaning:"Value Override"};let s=finalPickScore(p);if(s>=96)return{key:"three",label:"THREE TOMOE",meaning:"Elite Value"};if(s>=90)return{key:"two",label:"TWO TOMOE",meaning:"Excellent Value"};return{key:"one",label:"ONE TOMOE",meaning:"Good Pick"}}
function recommendationEligible(p){if(userPositionFilled(p.pos))return false;return true}
function expected(){return blueprint[Math.min(info().r-1,5)]||"BPA"}
function fit(p){let e=expected();return e==="BPA"?0:e===p.pos?18:e.includes(p.pos)?15:-4}
function sourceBlend(p){
 let fp=p.fantasyProsPosRank||p.posRank||50, fl=p.posRank||fp, bd=p.bdgeRank||fl, fk=p.flockRank||fl;
 // Gerard trusts analyst intelligence more than generic consensus.
 return 100-((bd*.35+fl*.30+fk*.25+fp*.10)*1.35);
}
function formatModifier(p){let m=0;if(leagueContext.scoring==="full"&&p.pos==="WR")m+=4;if(leagueContext.scoring==="full"&&p.pos==="RB"&&p.opportunityTrend&&/receiv|target/i.test(p.opportunityTrend))m+=3;if(leagueContext.scoring==="standard"&&p.pos==="RB")m+=5;if(leagueContext.startWR===3&&p.pos==="WR")m+=5;if(leagueContext.flex===2&&["RB","WR"].includes(p.pos))m+=3;if(leagueContext.passTD===6&&p.pos==="QB")m+=2;if(leagueContext.risk==="aggressive"&&(p.leagueBreaker||p.rookie))m+=5;if(leagueContext.risk==="safe"&&p.availabilityRisk==="high")m-=10;m+=leagueSpecificModifier(p);return m}
function draftPhase(){let r=info().r;return r<=5?{name:"Foundation",text:"Take value and build dependable starters."}:r<=9?{name:"Structure",text:"Balance the roster, monitor tiers, and use stacks as tie-breakers."}:{name:"Endgame Hunter",text:"Chase upside, paths to larger roles, and premium handcuffs."}}
function strategyHealth(){let c=counts(),r=info().r,msg="Stay flexible — value can override the plan.";if(r<=3&&c.WR>=1&&c.RB>=2)msg="Anchor WR + Double RB is on track.";else if(r<=4&&c.RB>=2)msg="Strong RB foundation. Add WR value next.";else if(r>=5&&c.WR<2)msg="WR depth is behind. Prefer WR when value is close.";else if(r>=7&&c.QB===0)msg="Late-QB plan active; draft only when the tier starts thinning.";return msg}
function renderDraftPlan(){let d=draftPhase(),html=`<div class="strategy"><span><b>${d.name} Mode</b><small style="display:block;color:var(--muted);margin-top:3px">${d.text}</small></span><span class="pill">R${info().r}</span></div>`;["mobileDraftPhase","desktopDraftPhase"].forEach(id=>{let e=document.getElementById(id);if(e)e.innerHTML=html});["mobileStrategyHealth","desktopStrategyHealth"].forEach(id=>{let e=document.getElementById(id);if(e)e.textContent=strategyHealth()})}
function gerardScore(p){let c=counts(),round=info().r,s=150-p.overall*.82+sourceBlend(p)+(p.bdgeBoost||0)+(p.flockBoost||0)+formatModifier(p)+fit(p);if(p.pos==="RB"&&c.RB<2)s+=13;if(p.pos==="WR"&&c.WR<3)s+=13;if(p.pos==="QB"&&c.QB>=1)s-=120;if(p.pos==="TE"&&c.TE>=1)s-=120;if(p.pos==="QB"&&round<3)s-=20;if(p.pos==="TE"&&round<2)s-=10;if(p.pos==="DST"){s-=round<15?95:round===15?25:0;if(c.DST>=1)s-=80}else if(p.pos==="K"){s-=round<16?105:round===16?20:0;if(c.K>=1)s-=80}if(p.bdgeAvoid)s-=10;if(p.priceFade)s-=7;if(p.coreTarget)s+=5;if(p.leagueBreaker&&round>=7)s+=5;if(p.availabilityRisk==="high")s-=9;if(p.ambiguity==="high")s-=3;if(["RB","WR","QB","TE"].includes(p.pos)){let mp=marketPressure(p.pos);s+=mp.pressure*.16}
 let bp=blueprintFactors(p);s+=bp.stack.points+bp.hand.points;if(bp.exp?.severity==="moderate")s-=2;if(bp.exp?.severity==="heavy")s-=5;if(bp.exp?.severity==="heavy"&&p.offenseQuality==="weak")s-=3;if(bp.bye)s-=2;
return s}
function recommendations(){
 let pool=available().filter(recommendationEligible);
 if(!pool.length)pool=available().filter(p=>!["QB","TE"].includes(p.pos)||!userPositionFilled(p.pos));
 return [...pool].sort((a,b)=>finalPickScore(b)-finalPickScore(a)||mambaScore(b)-mambaScore(a)).slice(0,5)
}
function rationale(p){let b=[],e=expected();if(e===p.pos||e.includes(p.pos))b.push("fits Gerard Blueprint");let fall=Math.max(0,pick-p.overall);if(fall>=8)b.push(`value fall: ${fall} picks`);if(p.bdgeLabels?.length)b.push(`BDGE: ${p.bdgeLabels[0]}`);if(p.overallTier==="S"||p.overallTier==="A")b.push("top-tier talent");if(["RB","WR"].includes(p.pos))b.push("weekly-ceiling core");return b.slice(0,3).join(" • ")||"best blended value available"}

function survivalRisk(p){let risk=0,n=pick+1,seen=0;while(seen<10&&n<=TOTAL_PICKS){let t=teamForPick(n);if(t===slot)break;let m=getManager(t);if(p.team===m.homerTeam)risk+=m.homer*2.5;if(p.pos==="QB")risk+=m.qbHoard*1.7;risk+=(10-m.predictability)*.7;seen++;n++}return Math.min(95,Math.round(risk))}
function mambaScore(p){let key=`m:${intelligenceEpoch}:${p.id}`;if(scoreCache.has(key))return scoreCache.get(key);let raw=gerardScore(p),canonicalTier=tierLabel(p),tier=canonicalTier==="S"?10:canonicalTier==="A"?6:0,fall=Math.max(0,pick-p.overall),risk=survivalRisk(p),score=Math.round(Math.max(1,Math.min(99,55+raw/5+tier+Math.min(10,fall/2)-risk/8)));scoreCache.set(key,score);return score}
function recommendationState(p){let st=sharinganStage(p);if(st.key==="eternal")return{cls:"state-value",label:"🖤 ETERNAL MANGEKYŌ • SEASON-CHANGING VALUE"};if(st.key==="mangekyo")return{cls:"state-value",label:"👁 MANGEKYŌ • VALUE OVERRIDE"};if(st.key==="three")return{cls:"state-confidence",label:"👁 THREE TOMOE • ELITE VALUE"};if(st.key==="two")return{cls:"state-confidence",label:"👁 TWO TOMOE • EXCELLENT VALUE"};return{cls:"state-normal",label:"👁 ONE TOMOE • GOOD PICK"}}
function runSignal(){let r=history.slice(-6).map(h=>players.find(p=>p.id===h.id)?.pos).filter(Boolean),t={QB:0,RB:0,WR:0,TE:0};r.forEach(x=>t[x]++);let top=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];return top&&top[1]>=3?top[0]+" run detected":"No major positional run"}
function markHeavyViewsDirty(){dirtyViews.players=true;dirtyViews.room=true;dirtyViews.wait=true;dirtyViews.team=true}
function updateBoardIncremental(record){
 const roots=[desktopBoard,draftBoard].filter(Boolean),oldPick=record.pick,newPick=pick,pl=players.find(x=>x.id===record.id);
 roots.forEach(root=>{
  root.querySelectorAll('.pickCell.current').forEach(cell=>cell.classList.remove('current'));
  const used=root.querySelector(`[data-pick="${oldPick}"]`);
  if(used){used.classList.toggle('mine',record.team===slot);const name=used.querySelector('.name');if(name)name.textContent=pl?.name||'Unknown';}
  const next=root.querySelector(`[data-pick="${newPick}"]`);
  if(next&&newPick<=TOTAL_PICKS){next.classList.add('current');const name=next.querySelector('.name');if(name&&!history.some(x=>x.pick===newPick))name.textContent='ON CLOCK';}
 });
}
function scheduleHeavyRefresh(delay=80){
 clearTimeout(heavyRenderTimer);
 heavyRenderTimer=setTimeout(()=>{
  try{
   if(dirtyViews.room){renderRoomScan();dirtyViews.room=false}
   if(dirtyViews.wait){renderWaitMeter();dirtyViews.wait=false}
   if(dirtyViews.players&&activeMobilePage==='mobilePlayers'){renderPlayers();dirtyViews.players=false}
   if(dirtyViews.team&&activeMobilePage==='mobileTeam'){renderRoster();renderLiveRoster();renderExposure();dirtyViews.team=false}
  }catch(err){reportRuntimeError('Deferred interface refresh',err)}
 },delay);
}
function renderAfterPick(record,{full=false}={}){
 renderMeta();
 updateBoardIncremental(record);
 renderRecommendation();
 renderQuickDraftBoard();
 markHeavyViewsDirty();
 if(record.team===slot){renderRoster();renderLiveRoster();renderExposure();renderDraftPlan();dirtyViews.team=false}
 if(full){renderRoomScan();renderWaitMeter();renderPlayers();dirtyViews.room=dirtyViews.wait=dirtyViews.players=false}
 else if(!simulationInProgress)scheduleHeavyRefresh();
}
function selectPlayer(id,team,options={}){
 try{
  if(drafted.includes(id)||pick>TOTAL_PICKS)return false;
  const player=players.find(p=>p.id===id);if(!player)return false;
  if(mode==="yahoo"&&team===slot){
    decisionSnapshots.push({
      beforePick:pick,
      selectedPlayerId:id,
      topOptions:recommendations().map((x,i)=>({rank:i+1,id:x.id,name:x.name,pos:x.pos,tier:tierLabel(x),mamba:mambaScore(x),finalPickScore:finalPickScore(x)})),
      positionWindows:["QB","RB","WR","TE"].map(pos=>{const x=marketPressure(pos);return {pos,window:positionWindow(x),pressure:x.pressure,starterNeedsBeforeNextPick:x.starterNeed,recentDrafted:x.recent}}),
      rosterBefore:myPlayers().map(x=>({id:x.id,name:x.name,pos:x.pos,tier:tierLabel(x)}))
    });
  }
  const record={pick,id,team};drafted.push(id);history.push(record);pick++;selectedCandidateId=null;invalidateIntelligence();
  if(pick>TOTAL_PICKS){finishDraft();return true}
  renderAfterPick(record,{full:options.full===true});
  return true;
 }catch(err){reportRuntimeError("Recording draft pick",err);return false}
}
function aiScore(p,team){let profile=aiProfiles[team]||"Balanced",m=getManager(team),s=150-p.overall+Math.random()*(style==="chaotic"?35:style==="conservative"?8:18),owned=history.filter(h=>h.team===team).map(h=>players.find(p=>p.id===h.id)).filter(Boolean),c={QB:0,RB:0,WR:0,TE:0,K:0,DST:0};owned.forEach(x=>{if(c[x.pos]!==undefined)c[x.pos]++});if(profile==="Hero RB"&&p.pos==="RB"&&c.RB<1)s+=30;if(profile==="Zero RB"&&p.pos==="WR"&&c.WR<4)s+=25;if(profile==="WR Heavy"&&p.pos==="WR")s+=20;if(profile==="Early QB"&&p.pos==="QB"&&c.QB<1&&Math.ceil(pick/10)<=5)s+=28;if(profile==="Elite TE"&&p.pos==="TE"&&c.TE<1)s+=25;if(profile==="Rookie Chaser"&&p.rookie)s+=25;if(profile==="Chaos")s+=Math.random()*45;if(p.team===m.homerTeam)s+=m.homer*3;if(p.pos==="QB"&&c.QB>=1)s+=m.qbHoard*2-12;if(m.archetype.includes("AI"))s+=Math.max(0,25-p.overall/8);if(m.archetype.includes("Reactionary")&&p.rookie)s+=12;if(m.archetype.includes("Conviction"))s+=Math.random()*18;if(c[p.pos]>=3&&["QB","TE"].includes(p.pos))s-=Math.max(10,45-m.qbHoard*3);let rd=Math.ceil(pick/10);if(p.pos==="DST"){s-=rd<15?90:0;if(c.DST>=1)s-=100;if(rd>=16&&c.DST<1)s+=55}if(p.pos==="K"){s-=rd<16?100:0;if(c.K>=1)s-=100;if(rd>=17&&c.K<1)s+=65}return s}
async function simulateToMe(){
 if(mode!=="practice"||simulationInProgress||teamForPick(pick)===slot)return;
 simulationInProgress=true;
 const btn=el("simulateBtn"),original=btn?.textContent||"Simulate until my pick";
 if(btn){btn.disabled=true;btn.textContent="Simulating…"}
 try{
  while(teamForPick(pick)!==slot&&pick<=TOTAL_PICKS){
   let team=teamForPick(pick),pool=available().slice(0,Math.min(28,available().length));
   pool.sort((a,b)=>aiScore(b,team)-aiScore(a,team));
   if(!pool.length)break;
   selectPlayer(pool[0].id,team);
   await new Promise(requestAnimationFrame);
   await new Promise(r=>setTimeout(r,35));
  }
 }finally{
  simulationInProgress=false;
  if(btn){btn.disabled=false;btn.textContent=original}
  renderRoomScan();renderWaitMeter();renderPlayers();renderRoster();renderLiveRoster();renderExposure();renderDraftPlan();
  dirtyViews.players=dirtyViews.room=dirtyViews.wait=dirtyViews.team=false;
 }
}
function rosterRows(){let ps=myPlayers(),used=[],rows=[];function take(pos){let p=ps.find(x=>x.pos===pos&&!used.includes(x.id));if(p)used.push(p.id);return p}for(let s of rosterSlots){let p=null;if(s==="QB")p=take("QB");else if(s.startsWith("RB"))p=take("RB");else if(s.startsWith("WR"))p=take("WR");else if(s==="TE")p=take("TE");else if(s==="K")p=take("K");else if(s==="DEF")p=take("DST");else if(s.startsWith("FLEX")){p=ps.find(x=>["RB","WR","TE"].includes(x.pos)&&!used.includes(x.id));if(p)used.push(p.id)}else if(s.startsWith("BENCH")){p=ps.find(x=>!used.includes(x.id));if(p)used.push(p.id)}rows.push([s,p])}return rows}

function positionalCountsAll(){let c={QB:0,RB:0,WR:0,TE:0,K:0,DST:0};myPlayers().forEach(p=>{let key=p.pos==="DEF"?"DST":p.pos;if(c[key]!==undefined)c[key]++});return c}
function rosterNeeds(){let c=positionalCountsAll(),needs=[];if(c.QB<1)needs.push("QB");if(c.RB<2)needs.push("RB");if(c.WR<3)needs.push("WR");if(c.TE<1)needs.push("TE");if(c.K<1)needs.push("K");if(c.DST<1)needs.push("D/ST");return needs}
function waitScore(pos){
 let c=positionalCountsAll(),roundNow=Math.ceil(pick/10),avail=available().filter(p=>positionKey(p)===pos).sort((a,b)=>finalPickScore(b)-finalPickScore(a));
 if(c[pos]>=1)return 96;
 let before=teamsBeforeMyNextPick().length,projectedLoss=Math.min(avail.length,expectedDraftedBeforeNext(pos));
 let eliteNow=avail.filter(p=>["S","A"].includes(tierLabel(p))).length;
 let eliteAfter=avail.slice(projectedLoss).filter(p=>["S","A"].includes(tierLabel(p))).length;
 let recent=history.slice(-8).map(h=>players.find(p=>p.id===h.id)).filter(Boolean).filter(p=>positionKey(p)===pos).length;
 let score;
 if(pos==="QB"){
  score=roundNow<=3?90:roundNow<=5?80:roundNow<=7?68:roundNow<=9?55:42;
  if(roundNow<=4&&eliteNow>0&&eliteAfter===0)score=Math.min(score,58);
  else if(roundNow<=5&&eliteNow>0&&eliteAfter<eliteNow)score-=8;
 }else if(pos==="TE"){
  score=roundNow<=3?91:roundNow<=5?78:roundNow<=7?64:roundNow<=9?52:40;
  if(roundNow<=4&&eliteNow>0&&eliteAfter===0)score=Math.min(score,56);
  else if(roundNow<=5&&eliteNow>0&&eliteAfter<eliteNow)score-=8;
 }else{
  score=88-before*3-recent*6;
 }
 return Math.max(10,Math.min(98,Math.round(score)));
}
function renderLiveRoster(){let rows=rosterRows(),keySlots=["QB","RB1","RB2","WR1","WR2","WR3","TE","FLEX1","FLEX2","K","DEF"],htmlRows=rows.filter(([s])=>keySlots.includes(s)).map(([s,p])=>`<div class="liveRosterSlot ${p?"filled":"need"}"><div class="slot">${s}</div><div class="player">${p?p.name:"NEEDED"}</div></div>`).join(""),c=positionalCountsAll(),summary=["QB","RB","WR","TE","K","DST"].map(x=>`<div class="rosterCount"><b>${c[x]||0}</b>${x}</div>`).join(""),needs=rosterNeeds(),needsText=needs.length?`Remaining needs: ${needs.join(", ")}`:"Starting lineup requirements filled — focus on upside and bench value.";let lr=document.getElementById("mobileLiveRoster"),rs=document.getElementById("mobileRosterSummary"),mn=document.getElementById("mobileNeeds");if(lr)lr.innerHTML=htmlRows;if(rs)rs.innerHTML=summary;if(mn)mn.textContent=needsText}
function renderWaitMeter(){
 let snap=getIntelligenceSnapshot(),positions=["QB","TE","DST","K"],roundNow=Math.ceil(pick/10),c=positionalCountsAll();
 let boxes=positions.map(pos=>{
   if((pos==="QB"&&c.QB>=1)||(pos==="TE"&&c.TE>=1)){
     return `<div class="waitBox filledPosition"><div class="pos">${pos}</div><div class="meter"><span style="width:100%"></span></div><div><b>FILLED</b></div><div class="decision">FOCUS ELSEWHERE</div></div>`;
   }
   let locked=(pos==="DST"&&roundNow<15)||(pos==="K"&&roundNow<16);
   if(locked){
     let unlock=pos==="DST"?15:16;
     return `<div class="waitBox locked"><div class="pos">${pos==="DST"?"D/ST":pos}</div><div class="meter"><span style="width:100%"></span></div><div><b>WAIT</b></div><div class="decision">TOO EARLY • R${unlock}+</div></div>`;
   }
   let score=snap.wait[pos],cls=score>=70?"wait":score>=48?"now":"urgent";
   let label=score>=70?"SAFE TO WAIT":score>=48?(roundNow<=4?"ELITE ONLY":"MONITOR TIER"):"DRAFT SOON";
   return `<div class="waitBox ${cls}"><div class="pos">${pos==="DST"?"D/ST":pos}</div><div class="meter"><span style="width:${score}%"></span></div><div><b>${score}%</b></div><div class="decision">${label}</div></div>`;
 }).join("");
 let el=document.getElementById("waitMeter");if(el)el.innerHTML=boxes;
}
function scoreComponents(p){
 let value=Math.max(45,Math.min(99,Math.round(102-(p.overall||200)/3)));
 let ceiling=Math.max(45,Math.min(99,value+(p.bdgeBoost||0)*2+(p.overallTier==="S"?8:p.overallTier==="A"?5:0)));
 let floor=Math.max(40,Math.min(98,value-(p.rookie?7:0)-(p.bdgeAvoid?10:0)));
 let fit=mambaScore(p);
 return {value,ceiling,floor,fit};
}
function coverageText(p){
 const n=Number(p.analystCoverage||0);
 return n>=4?"4-source coverage":n===3?"3-source coverage":n===2?"2-source coverage":n===1?"1-source coverage":"Baseline coverage";
}
function sourceRankLabel(p,source){
 if(source==="Fantasyland"){
   if(p.fantasyland==="N/A"||p.fantasyland==="Depth pool")return "—";
   return p.pos==="K"||p.pos==="DST"?"—":`${p.pos}${p.posRank||"—"} / Tier ${p.posTier||p.overallTier||"—"}`;
 }
 if(source==="BDGE"){
   return p.bdgeRank?`${p.pos}${p.bdgeRank}${p.bdgeTier?` • ${p.bdgeTier}`:""}`:"—";
 }
 if(source==="Flock"){ return p.flockRank?`${p.pos}${p.flockRank} • Tier ${p.flockTier||"—"}`:"—"; }
 if(source==="FantasyPros"){
   return `${p.pos==="DST"?"D/ST":p.pos}${p.fantasyProsPosRank||p.posRank||"—"}`;
 }
 return "—";
}
function openScan(id){
 const modal=document.getElementById("scanModal"),content=document.getElementById("scanContent");
 let p=players.find(x=>x.id===Number(id));if(!p||!modal||!content)return;
 let ev=getPlayerEvaluation(p),s=scoreComponents(p),risk=ev.risk,state=recommendationState(p),market=["QB","RB","WR","TE"].includes(p.pos)?getIntelligenceSnapshot().markets[p.pos]:null;
 let windowLabel=market?positionWindow(market):"Late Round";
 let fitLabel=s.fit>=92?"Elite":s.fit>=84?"Strong":s.fit>=75?"Good":"Neutral";
 let verdict=risk>=70||valueOverride(p)?{label:"DRAFT NOW",cls:"go",text:`${p.name} is strong value and is unlikely to survive to your next selection.`}:risk>=42||windowLabel==="Closing"?{label:"GOOD VALUE — CONSIDER NOW",cls:"wait",text:`The value is solid, but the position window is beginning to tighten.`}:{label:"SAFE TO WAIT",cls:"wait",text:`The board still offers alternatives and the current position window remains manageable.`};
 let alternatives=available().filter(x=>x.id!==p.id&&recommendationEligible(x)).sort((a,b)=>finalPickScore(b)-finalPickScore(a));
 let alt=alternatives[0];
 let labels=(p.bdgeLabels||[]).length?p.bdgeLabels.join(" • "):"No additional BDGE flag";
 let notes=[p.rankingRole,labels,p.opportunityTrend&&p.opportunityTrend!=="Pending"?p.opportunityTrend:null,p.gerardPreference&&p.gerardPreference!=="neutral"?`Gerard preference: ${p.gerardPreference}`:null].filter(Boolean).join(". ");
 let why=[];
 if(valueOverride(p))why.push("Value Override is active — talent gap outweighs roster balance.");
 if(tierLabel(p)==="S"||tierLabel(p)==="A")why.push(`${tierLabel(p)}-tier talent is still available.`);
 if(risk>=60)why.push(`${risk}% steal risk before your next selection.`); else why.push(`${100-risk}% estimated chance to remain available.`);
 if(windowLabel==="Closing"||windowLabel==="Thinning")why.push(`${p.pos} position window is ${windowLabel.toLowerCase()}.`);
 why.push(fitLabel==="Elite"||fitLabel==="Strong"?`Strong fit with your current roster and draft blueprint.`:`Board value remains the primary reason for this recommendation.`);
 content.innerHTML=`
 <div class="scanHeader"><div><div class="scanEye">${sharinganIconMarkup(sharinganStage(p).key)} SHARINGAN SCAN</div><div class="scanName">${p.name}</div><div class="tagrow">${tierBadge(p)}<span class="tag">${p.pos==="DST"?"D/ST":p.pos}${p.posRank||""}</span><span class="tag">${p.team}</span><span class="tag">Bye ${p.bye}</span><span class="tag">${coverageText(p)}</span></div></div><button class="ghost" onclick="closeScan()">Close</button></div>
 <div class="scanVerdict"><div class="scanVerdictLabel ${verdict.cls}">${verdict.label}</div><div class="scanVerdictText">${verdict.text}</div></div>
 <div class="scanQuickGrid">
   <div class="scanQuickMetric"><span>Mamba</span><b>${s.fit}</b></div>
   <div class="scanQuickMetric"><span>Chance Gone</span><b>${risk}%</b></div>
   <div class="scanQuickMetric"><span>Roster Fit</span><b>${fitLabel}</b></div>
   <div class="scanQuickMetric"><span>Window</span><b>${windowLabel}</b></div>
 </div>
 <div class="scanWhy"><b>Why this matters</b><ul>${why.slice(0,4).map(x=>`<li>${x}</li>`).join("")}</ul></div>
 ${alt?`<div class="scanAlternative"><div><b>Best alternative: ${alt.name}</b><div class="meta">${alt.pos} • ${alt.team} • ${tierLabel(alt)} Tier • ${finalPickScore(alt)}/100</div></div><button class="scanBtn" onclick="openScan(${alt.id})">Compare</button></div>`:""}
 <button class="primary scanPrimaryAction" onclick="selectPlayer(${p.id},${slot});closeScan()">Draft ${p.name}</button>
 <details class="scanDetails"><summary>Show Full Sharingan Analysis</summary>
   <div class="scanGrid">
     <div class="scanMetric"><span>Final Pick Score</span><b>${finalPickScore(p)}/100</b></div><div class="scanMetric"><span>Weekly Ceiling</span><b>${s.ceiling}/100</b></div><div class="scanMetric"><span>Floor</span><b>${s.floor}/100</b></div>
     <div class="scanMetric"><span>Board Rank</span><b>#${p.overall||"—"}</b></div><div class="scanMetric"><span>Sharingan State</span><b>${sharinganStage(p).meaning}</b></div><div class="scanMetric"><span>Confidence</span><b>${p.ambiguity==="high"?"Low":p.ambiguity==="medium"?"Medium":"High"}</b></div>
   </div>
   <b>Source breakdown</b>
   <div class="sourceGrid"><div class="sourceBox"><div class="source">FANTASYLAND</div><b>${sourceRankLabel(p,"Fantasyland")}</b></div><div class="sourceBox"><div class="source">BDGE</div><b>${sourceRankLabel(p,"BDGE")}</b></div><div class="sourceBox"><div class="source">FLOCK</div><b>${sourceRankLabel(p,"Flock")}</b></div><div class="sourceBox"><div class="source">FANTASYPROS</div><b>${sourceRankLabel(p,"FantasyPros")}</b></div></div>
   <div class="scanNotes"><b>Full explanation</b><br>${notes}. ${rationale(p)}.</div>
   <button class="ghost" style="width:100%;margin-top:9px" onclick="selectPlayer(${p.id},${teamForPick(pick)});closeScan()">Record for Current Team</button>
 </details>`;
 modal.classList.remove("hidden");modal.setAttribute("aria-hidden","false");
}
function closeScan(e){const modal=document.getElementById("scanModal");if(!modal)return;if(e&&e.target!==modal)return;modal.classList.add("hidden");modal.setAttribute("aria-hidden","true")}


function selectCandidate(id){
 if(drafted.includes(id))return;
 selectedCandidateId=(selectedCandidateId===id?null:id);
 renderRecommendation();
}


function toggleMobileTeam(){
 mobileTeamExpanded=!mobileTeamExpanded;
 let panel=document.getElementById("mobileRosterExpandable");
 let btn=document.getElementById("teamToggleBtn");
 if(panel)panel.classList.toggle("hidden",!mobileTeamExpanded);
 if(btn)btn.textContent=mobileTeamExpanded?"Collapse":"Expand";
}


function randomizeManagerOrder(){if(mode!=="practice"){alert("Randomization is for Practice Mock Drafts. Yahoo Live Mock and Live Draft keep manual assignments.");return}let names=managers.map(m=>m.name).filter(n=>n!=="Gerard");for(let i=names.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[names[i],names[j]]=[names[j],names[i]]}let idx=0;for(let i=1;i<=10;i++){let el=document.getElementById("mgr"+i);if(!el)continue;el.value=(i===+draftSlot.value)?"Gerard":names[idx++]}}
function teamExposure(){let map={};myPlayers().forEach(p=>{if(!p.team||p.pos==="DST")return;map[p.team]=(map[p.team]||0)+1});return Object.entries(map).sort((a,b)=>b[1]-a[1])}
function byeExposure(){let map={};myPlayers().forEach(p=>{if(p.bye)map[p.bye]=(map[p.bye]||0)+1});return Object.entries(map).sort((a,b)=>b[1]-a[1])}
function exposureWarningFor(p){if(!p.team||p.pos==="DST")return null;let count=(teamExposure().find(([t])=>t===p.team)||[null,0])[1],after=count+1,severity=after>=4?"heavy":after===3?"moderate":"normal",quality=p.offenseQuality||"average",text=after>=4?`Heavy ${p.team} exposure (${after} players).`:after===3?`Moderate ${p.team} exposure (${after} players).`:"";if(text&&quality==="weak")text+=" Weaker offense increases the risk.";if(text&&quality==="strong")text+=" Strong offense softens the risk.";return text?{severity,text}:null}
function stackBonusFor(p){if(p.pos==="QB"){let mates=myPlayers().filter(x=>x.team===p.team&&["WR","TE"].includes(x.pos));if(mates.length)return{points:3,label:`Creates QB stack with ${mates[0].name}`}}if(["WR","TE"].includes(p.pos)){let qb=myPlayers().find(x=>x.team===p.team&&x.pos==="QB");if(qb)return{points:3,label:`Adds pass catcher to ${qb.name} stack`}}return{points:0,label:"No stack bonus"}}
function handcuffBonusFor(p){let r=Math.ceil(pick/10);if(r<11||p.pos!=="RB")return{points:0,label:"No handcuff bonus"};let owned=myPlayers().map(x=>x.name),protects=(p.handcuffFor||[]).find(n=>owned.includes(n));return protects?{points:4,label:`Protects ${protects}`}:{points:0,label:"No handcuff bonus"}}
function byeWarningFor(p){let existing=(byeExposure().find(([b])=>String(b)===String(p.bye))||[null,0])[1];return existing>=3?`Would create ${existing+1} players on Week ${p.bye} bye.`:null}
function blueprintFactors(p){let stack=stackBonusFor(p),hand=handcuffBonusFor(p),exp=exposureWarningFor(p),bye=byeWarningFor(p);return{stack,hand,exp,bye}}
function renderExposure(){let rows=teamExposure(),markup=rows.length?`<div class="exposureList">${rows.slice(0,6).map(([team,count])=>{let cls=count>=4?"heavy":count===3?"warn":"",label=count>=4?"Heavy":count===3?"Caution":"Normal";return `<div class="exposureRow ${cls}"><b>${team}</b><div class="exposureBar"><span style="width:${Math.min(100,count*25)}%"></span></div><span>${count} • ${label}</span></div>`}).join("")}</div>`:`<div class="meta">No team concentration yet.</div>`;let bye=byeExposure().find(([,c])=>c>=4);if(bye)markup+=`<div class="exposureNote">Bye warning: ${bye[1]} players are off in Week ${bye[0]}.</div>`;["mobileExposure","desktopExposure"].forEach(id=>{let el=document.getElementById(id);if(el)el.innerHTML=markup})}
function simpleMarketLabel(x){if(x.pressure>=82)return"Likely gone";if(x.pressure>=65)return"Draft soon";if(x.pressure>=45)return"Monitor";return"Safe to wait"}
function comparisonCardMarkup(p,primary){
 let state=recommendationState(p),score=mambaScore(p),risk=survivalRisk(p),bp=blueprintFactors(p);
 return `<div class="comparisonCard">
   <div class="comparisonHeader"><div><div class="eyebrow">HIGHLIGHTED COMPARISON</div><div class="meta">Top recommendation remains ${primary.name}</div></div><button class="ghost" onclick="selectCandidate(${p.id})">Clear</button></div>
   <h3 class="scanLink" onclick="openScan(${p.id})">${p.name}</h3>
   <div class="tagrow">${tierBadge(p)}<span class="tag">${p.pos==="DST"?"D/ST":p.pos}${p.posRank||""}</span><span class="tag">${p.team}</span><span class="tag">Bye ${p.bye}</span>${p.bdgeRank?`<span class="tag">BDGE ${p.pos}${p.bdgeRank}</span>`:""}${p.flockRank?`<span class="tag">Flock ${p.pos}${p.flockRank}</span>`:""}<span class="tag">FP ${p.fantasyProsPosRank||p.posRank}</span></div>
   <div class="tagrow" style="margin-top:7px">${tierBadge(p)}<span class="sharinganStage stage-${sharinganStage(p).key}">${sharinganIconMarkup(sharinganStage(p).key)}${sharinganStage(p).meaning}</span></div><div class="comparisonGrid"><div class="comparisonMetric"><span>Mamba</span><b>${score}/100</b></div><div class="comparisonMetric"><span>Final Pick</span><b>${finalPickScore(p)}/100</b></div><div class="comparisonMetric"><span>Steal Risk</span><b>${risk}%</b></div><div class="comparisonMetric"><span>Stack</span><b>${bp.stack.label}</b></div><div class="comparisonMetric"><span>Exposure</span><b>${bp.exp?bp.exp.text:"No concern"}</b></div></div>
   <div class="scoreLine"><div class="scoreChip"><span>Mamba</span><b>${score}</b></div><div class="scoreChip"><span>Room Boost</span><b>+${roomBoost(p)}</b></div><div class="scoreChip"><span>Roster Fit</span><b>${rosterFitModifier(p)>=0?"+":""}${rosterFitModifier(p)}</b></div></div><div class="reason">${valueOverride(p)?"<b>Value Override:</b> superior value beats roster balance. ":""}${rationale(p)}</div>
   <div style="display:grid;grid-template-columns:1fr auto;gap:8px"><button class="primary" onclick="selectPlayer(${p.id},${slot})">Draft ${p.name}</button><button type="button" class="sharinganBtn" onclick="openScan(${p.id})">${sharinganIconMarkup(sharinganStage(p).key)} Sharingan Scan</button></div>
 </div>`;
}
function renderRecommendation(){
 let recs=snapshotRecommendations();
 if(!recs.length){
   recommendation.innerHTML="<b>Draft complete.</b>";
   alternatives.innerHTML="";
   return;
 }
 let p=recs[0];
 let ev=getPlayerEvaluation(p),state=recommendationState(p),score=ev.mamba,risk=ev.risk;
 recommendation.className="rec "+state.cls;
 recommendation.innerHTML=`
   <div style="font-weight:900">${state.label}</div>
   <div class="mambaScore">Mamba ${score}/100 • Final Pick ${finalPickScore(p)}/100 • Steal Risk ${risk}%</div>
   <div class="confbar"><span style="width:${score}%"></span></div>
   <h2 class="scanLink" onclick="openScan(${p.id})">${p.name}</h2><div class="tagrow">${tierBadge(p)}<span class="sharinganStage stage-${sharinganStage(p).key}">${sharinganIconMarkup(sharinganStage(p).key)}${sharinganStage(p).meaning}</span></div>
   <div class="tagrow">
     <span class="tag">${p.pos==="DST"?"D/ST":p.pos}${p.posRank||""}</span>
     <span class="tag">${p.team}</span>
     <span class="tag">Bye ${p.bye}</span>
     ${p.bdgeRank?`<span class="tag">BDGE ${p.pos}${p.bdgeRank}</span>`:""}${p.flockRank?`<span class="tag">Flock ${p.pos}${p.flockRank}</span>`:""}${p.coreTarget?`<span class="tag">Core Target</span>`:""}${p.priceFade?`<span class="tag">Price Caution</span>`:""}
     <span class="tag">FP ${p.pos==="DST"?"D/ST":p.pos}${p.fantasyProsPosRank||p.posRank}</span>
   </div>
   <div class="scoreLine"><div class="scoreChip"><span>Mamba</span><b>${score}</b></div><div class="scoreChip"><span>Room Boost</span><b>+${roomBoost(p)}</b></div><div class="scoreChip"><span>Roster Fit</span><b>${rosterFitModifier(p)>=0?"+":""}${rosterFitModifier(p)}</b></div></div><div class="reason">${valueOverride(p)?"<b>Value Override:</b> superior value beats roster balance. ":""}${rationale(p)}<br><span class="meta">${runSignal()}</span></div>${(()=>{let bp=blueprintFactors(p);return `<div class="blueprintBreakdown"><div class="blueprintFactor"><span>Value</span><b>Primary driver</b></div><div class="blueprintFactor"><span>Stack</span><b>${bp.stack.label}</b></div><div class="blueprintFactor"><span>Handcuff</span><b>${bp.hand.label}</b></div><div class="blueprintFactor"><span>Exposure</span><b>${bp.exp?bp.exp.text:"No concern"}</b></div></div>${bp.bye?`<div class="roomAlert">${bp.bye}</div>`:""}`})()}
   <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
     <button class="primary" onclick="selectPlayer(${p.id},${slot})">Draft ${p.name}</button>
     <button type="button" class="sharinganBtn" onclick="openScan(${p.id})">${sharinganIconMarkup(sharinganStage(p).key)} Sharingan Scan</button>
   </div>`;

 let highlightedPlayer=selectedCandidateId?players.find(x=>x.id===selectedCandidateId&&!drafted.includes(x.id)):null;
 alternatives.innerHTML=(highlightedPlayer?comparisonCardMarkup(highlightedPlayer,p):"")+recs.slice(1,5).map((x,i)=>{
   let highlighted=selectedCandidateId===x.id;
   return `<div class="alt selectable ${highlighted?"highlightedOption":""}" onclick="selectCandidate(${x.id})">
     <div class="rank">${i+2}</div>
     <div class="info">
       <b>${x.name}</b>
       <div class="meta">${tierLabel(x)} Tier • ${x.pos==="DST"?"D/ST":x.pos}${x.posRank||""} • ${x.team} • FP ${x.fantasyProsPosRank||x.posRank} • ${rationale(x)}</div>
       ${highlighted?`<span class="highlightFlag">Highlighted for comparison</span>`:""}
     </div>
     <button type="button" class="scanBtn" onclick="openScan(${x.id});return false">${sharinganIconMarkup(sharinganStage(x).key)} Sharingan Scan</button>
     <button type="button" class="autoPickBtn" onclick="recordCurrentPick(${x.id});return false">Record Current Pick</button>
   </div>`;
 }).join("");
}
function renderBoard(){let byPick=new Map(history.map(x=>[x.pick,x])),cols=[];for(let t=1;t<=10;t++){let cells=[];for(let r=1;r<=TOTAL_ROUNDS;r++){let pnum=(r-1)*10+(r%2?t:11-t),h=byPick.get(pnum),pl=h?players.find(x=>x.id===h.id):null;cells.push(`<div data-pick="${pnum}" class="pickCell ${pnum===pick?"current":""} ${h&&h.team===slot?"mine":""}"><span class="pn">${pnum}</span><span class="name">${pl?pl.name:(pnum===pick?"ON CLOCK":"—")}</span></div>`)}cols.push(`<div class="teamCol ${t===slot?"you":""}"><div class="teamHead">${t===slot?"⭐ YOU":slotManagers[t]||("Team "+t)}<small>${t===slot?"Gerard Mode":aiProfiles[t]||"Manual"}</small></div>${cells.join("")}</div>`)}desktopBoard.innerHTML=cols.join("");draftBoard.innerHTML=cols.join("")}
function teamTierMarkup(){let positions=["QB","RB","WR","TE"],lines=positions.map(pos=>{let c=positionTierCounts(pos),bits=["S","A","B","C"].filter(t=>c[t]).map(t=>`${t}×${c[t]}`).join("  ")||"—";return `<div class="tierLine"><b>${pos}</b><span class="tierDots">${bits}</span><span>${positionStrength(pos)}</span></div>`}).join("");let rb=positionStrength("RB"),wr=positionStrength("WR"),advice=rb==="Elite"||rb==="Strong"?"RB quality is secure. Shift toward WR when values are close. Value Override still wins.":wr==="Elite"||wr==="Strong"?"WR quality is secure. Add RB when values are close. Value Override still wins.":"Build the best available starting tier. Value remains the priority.";return `<div class="teamTierSummary"><b>Team Tier Quality</b>${lines}<div class="teamAdvice">${advice}</div></div>`}
function renderRoster(){let rows=rosterRows().map(([s,p])=>`<div class="rosterRow"><span>${s}</span><span class="${p?"":"empty"}">${p?`${p.name} <small>(${tierLabel(p)})</small>`:"—"}</span></div>`).join("")+teamTierMarkup();roster.innerHTML=rows;mRoster.innerHTML=rows;let ss=[];for(let t=1;t<=10;t++)ss.push(`<div class="strategy"><span>${t===slot?"⭐ YOU":slotManagers[t]||("Team "+t)}</span><span class="pill">${t===slot?"Gerard Blueprint":aiProfiles[t]||"Manual"}</span></div>`);strategies.innerHTML=ss.join("");mStrategies.innerHTML=ss.join("")}
function renderMeta(){let i=info();round.textContent=`${Math.min(i.r,TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`;mRound.textContent=`${Math.min(i.r,TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`;pickLabel.textContent=i.r+"."+String(i.ip).padStart(2,"0");mPickLabel.textContent=pickLabel.textContent;until.textContent=i.until;mUntil.textContent=i.until}

function teamPlayers(team){return history.filter(h=>h.team===team).map(h=>players.find(p=>p.id===h.id)).filter(Boolean)}
function gradeFromScore(s){return s>=94?'A+':s>=90?'A':s>=87?'A-':s>=83?'B+':s>=80?'B':s>=77?'B-':s>=73?'C+':s>=70?'C':s>=67?'C-':s>=63?'D+':s>=60?'D':'F'}
function evaluateTeam(team){
 const ps=teamPlayers(team),c={QB:0,RB:0,WR:0,TE:0,K:0,DST:0};ps.forEach(p=>{let k=p.pos==='DEF'?'DST':p.pos;if(c[k]!=null)c[k]++});
 const starters=[];const take=(pos,n)=>ps.filter(p=>(p.pos==='DEF'?'DST':p.pos)===pos).sort((a,b)=>(a.overall||999)-(b.overall||999)).slice(0,n);
 starters.push(...take('QB',1),...take('RB',2),...take('WR',3),...take('TE',1),...take('K',1),...take('DST',1));
 starters.push(...ps.filter(p=>['RB','WR','TE'].includes(p.pos)&&!starters.includes(p)).sort((a,b)=>(a.overall||999)-(b.overall||999)).slice(0,2));
 const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:220, sr=starters.map(p=>p.overall||220), ar=ps.map(p=>p.overall||240);
 const starterStrength=Math.max(35,Math.min(100,100-(avg(sr)-40)*.42));const value=Math.max(35,Math.min(100,100-(avg(ar)-75)*.27));
 let construction=100;if(c.QB<1)construction-=18;if(c.RB<2)construction-=18;if(c.WR<3)construction-=18;if(c.TE<1)construction-=15;if(c.K<1)construction-=7;if(c.DST<1)construction-=7;if(c.QB>2)construction-=8*(c.QB-2);if(c.TE>2)construction-=6*(c.TE-2);if(c.K>1)construction-=8*(c.K-1);if(c.DST>1)construction-=7*(c.DST-1);construction=Math.max(30,construction);
 const ceilingPlayers=ps.filter(p=>(p.overallTier==='S'||p.overallTier==='A'||(p.bdgeBoost||0)>2)&&['QB','RB','WR','TE'].includes(p.pos)).length;
 const ceiling=Math.max(40,Math.min(100,56+ceilingPlayers*7+(c.RB>=4?5:0)+(c.WR>=5?5:0)));const bench=ps.filter(p=>!starters.includes(p));const benchUpside=Math.max(40,Math.min(100,50+bench.filter(p=>p.rookie||p.overallTier==='A'||(p.bdgeBoost||0)>1).length*8));
 let score=Math.round(starterStrength*.34+value*.22+construction*.18+ceiling*.17+benchUpside*.09);if(team===slot){if(c.QB===1)score+=2;if(c.TE===1)score+=2;if(ceilingPlayers>=3)score+=3}score=Math.max(45,Math.min(99,score));
 let strengths=[],weaknesses=[];if(starterStrength>=85)strengths.push('strong starting lineup');if(ceiling>=85)strengths.push('elite weekly ceiling');if(value>=85)strengths.push('excellent draft value');if(construction>=90)strengths.push('clean roster construction');if(benchUpside>=80)strengths.push('high-upside bench');if(starterStrength<75)weaknesses.push('starting lineup quality');if(c.RB<4)weaknesses.push('RB depth');if(c.WR<5)weaknesses.push('WR depth');if(c.QB>2)weaknesses.push('too many QBs');if(c.TE>2)weaknesses.push('too many TEs');if(c.K>1)weaknesses.push('duplicate kickers');if(c.DST>1)weaknesses.push('duplicate defenses');if(!strengths.length)strengths.push('balanced overall roster');if(!weaknesses.length)weaknesses.push('no major structural weakness');
 const bp=ps.map(p=>({p,v:(history.find(h=>h.team===team&&h.id===p.id)?.pick||999)-(p.overall||999)})).sort((a,b)=>b.v-a.v)[0]?.p;
 return {team,name:slotManagers[team]||('Team '+team),score,grade:gradeFromScore(score),starterStrength:Math.round(starterStrength),value:Math.round(value),construction:Math.round(construction),ceiling:Math.round(ceiling),benchUpside:Math.round(benchUpside),strengths,weaknesses,bestPick:bp};
}
function renderDraftReport(){
 const es=[];for(let t=1;t<=10;t++)es.push(evaluateTeam(t));es.sort((a,b)=>b.score-a.score);const me=es.find(x=>x.team===slot);const min=Math.min(...es.map(x=>x.score));const weights=es.map(x=>Math.max(1,(x.score-min+6)**2));const tw=weights.reduce((a,b)=>a+b,0);es.forEach((x,i)=>{x.rank=i+1;x.titleOdds=Math.round(weights[i]/tw*100)});
 myDraftReport.innerHTML=`<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><div class="meta">YOUR DRAFT GRADE</div><div class="reportGrade">${me.grade}</div><b>${me.score}/100</b></div><div style="text-align:right"><div class="meta">PROJECTED FINISH</div><div style="font-size:28px;font-weight:950">#${me.rank}</div><div class="meta">${me.titleOdds}% draft-day title odds</div></div></div><div class="reportGrid"><div class="reportMetric"><b>${me.starterStrength}</b>Starters</div><div class="reportMetric"><b>${me.ceiling}</b>Ceiling</div><div class="reportMetric"><b>${me.value}</b>Value</div><div class="reportMetric"><b>${me.construction}</b>Construction</div><div class="reportMetric"><b>${me.benchUpside}</b>Bench Upside</div><div class="reportMetric"><b>${me.bestPick?me.bestPick.name:'—'}</b>Best Value</div></div><div class="scanNotes" style="margin-top:10px"><b>Summary</b><br>Strengths: ${me.strengths.join(', ')}.<br>Watch: ${me.weaknesses.join(', ')}.</div></div>`;
 leagueProjection.innerHTML=`<table class="leagueTable"><thead><tr><th>Rank</th><th>Manager</th><th>Grade</th><th>Score</th><th>Title odds</th></tr></thead><tbody>${es.map(x=>`<tr class="${x.team===slot?'youRow':''}"><td><span class="rankBadge">${x.rank}</span></td><td><b>${x.name}</b>${x.rank===1?' <span style="color:#f4d35e">Projected Champion</span>':''}</td><td><span class="gradeBadge">${x.grade}</span></td><td>${x.score}</td><td>${x.titleOdds}%</td></tr>`).join('')}</tbody></table>`;
 allTeamReports.innerHTML=es.map(x=>`<div class="teamReport ${x.team===slot?'youRow':''}"><div class="teamReportHead"><div><b>#${x.rank} ${x.name}</b><div class="meta">${x.team===slot?'Your roster':'Draft slot '+x.team}</div></div><div><span class="gradeBadge">${x.grade}</span> <b>${x.score}</b></div></div><div class="meta" style="margin-top:7px">Starters ${x.starterStrength} • Ceiling ${x.ceiling} • Value ${x.value} • Construction ${x.construction}</div><div style="margin-top:6px"><span class="strength">Strength:</span> ${x.strengths.join(', ')}<br><span class="weakness">Watch:</span> ${x.weaknesses.join(', ')}</div></div>`).join('');
}
function finishDraft(){
 document.querySelector('.appgrid').classList.add('hidden');draftReport.classList.remove('hidden');tabs.classList.add('hidden');renderDraftReport();
 if(mode==="yahoo"){currentYahooRecord=buildYahooRecord();saveYahooRecord(currentYahooRecord);yahooExportCard.classList.remove("hidden");updateArchiveCount()}else{yahooExportCard.classList.add("hidden")}
 window.scrollTo({top:0,behavior:'smooth'})
}
function yahooArchive(){try{return JSON.parse(localStorage.getItem("fantasyHQYahooMocks")||"[]")}catch(e){return []}}
function buildYahooRecord(){
 const now=new Date();
 return {
  schemaVersion:"fantasy-hq-yahoo-mock-1",
  appVersion:APP_VERSION,
  id:`yahoo-${now.toISOString()}-${Math.random().toString(36).slice(2,8)}`,
  createdAt:now.toISOString(),
  source:"Yahoo public mock draft against real people",
  league:{id:164770,name:"SQUAAA! ROYAL RUMBLE 2025–2026",teams:10,draftSlot:slot,scoring:leagueContext.scoring,receptions:.5,passingTD:leagueContext.passTD,completionPoint:.1,startingWR:leagueContext.startWR,flex:leagueContext.flex,firstDownPoint:.1,bigPlayBonuses:true,enhancedDST:true,customKicker:true,riskProfile:leagueContext.risk,strategy:leagueContext.strategy},
  managers:slotManagers,
  picks:history.map(h=>{const p=players.find(x=>x.id===h.id)||{};return {overallPick:h.pick,round:Math.ceil(h.pick/10),pickInRound:(h.pick-1)%10+1,teamSlot:h.team,isGerard:h.team===slot,playerId:h.id,playerName:p.name||"Unknown",position:p.pos||"",nflTeam:p.team||"",tier:tierLabel(p),mambaAtExport:mambaScore(p)} }),
  gerardDecisions:decisionSnapshots,
  finalRoster:myPlayers().map(p=>({id:p.id,name:p.name,pos:p.pos,nflTeam:p.team,tier:tierLabel(p)}))
 }
}
function saveYahooRecord(record){let a=yahooArchive();a.unshift(record);a=a.slice(0,75);localStorage.setItem("fantasyHQYahooMocks",JSON.stringify(a))}
function downloadBlob(filename,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function safeDateName(){return new Date().toISOString().replace(/[:.]/g,"-")}
function exportCurrentYahooJSON(){if(!currentYahooRecord){alert("Finish a Yahoo Live Mock first.");return}downloadBlob(`FantasyHQ_YahooMock_${safeDateName()}.json`,JSON.stringify(currentYahooRecord,null,2),"application/json")}
function exportAllYahooJSON(){const a=yahooArchive();if(!a.length){alert("No saved Yahoo mocks yet.");return}downloadBlob(`FantasyHQ_All_Yahoo_Mocks_${safeDateName()}.json`,JSON.stringify({schemaVersion:"fantasy-hq-yahoo-archive-1",exportedAt:new Date().toISOString(),mockCount:a.length,mocks:a},null,2),"application/json")}
function csvEscape(v){const x=String(v??"");return /[",\n]/.test(x)?`"${x.replace(/"/g,'""')}"`:x}
function exportCurrentYahooCSV(){if(!currentYahooRecord){alert("Finish a Yahoo Live Mock first.");return}const headers=["overallPick","round","pickInRound","teamSlot","isGerard","playerName","position","nflTeam","tier"];const rows=[headers.join(","),...currentYahooRecord.picks.map(p=>headers.map(h=>csvEscape(p[h])).join(","))];downloadBlob(`FantasyHQ_YahooMock_Picks_${safeDateName()}.csv`,rows.join("\n"),"text/csv")}
function updateArchiveCount(){const a=yahooArchive();if(archiveCount)archiveCount.textContent=`Saved locally in this browser: ${a.length} Yahoo mock${a.length===1?"":"s"}. Use “Download All Yahoo Mocks” before clearing browser data or switching devices.`}

function startAnotherMock(){draftReport.classList.add('hidden');document.querySelector('.appgrid').classList.remove('hidden');backToSetup()}


function managerRoster(team){
 return history.filter(h=>h.team===team).map(h=>players.find(p=>p.id===h.id)).filter(Boolean);
}
function managerPositionCounts(team){
 let c={QB:0,RB:0,WR:0,TE:0,K:0,DST:0};
 managerRoster(team).forEach(p=>{let k=p.pos==="DEF"?"DST":p.pos;if(c[k]!==undefined)c[k]++});
 return c;
}
function positionStarterNeed(pos,c){
 if(pos==="QB")return c.QB<1;
 if(pos==="RB")return c.RB<2;
 if(pos==="WR")return c.WR<3;
 if(pos==="TE")return c.TE<1;
 return false;
}
function managerPositionStatus(team,pos){
 let c=managerPositionCounts(team),count=c[pos]||0,m=getManager(team);
 let starterNeed=positionStarterNeed(pos,c);
 let depthTarget=pos==="RB"?4:pos==="WR"?5:pos==="QB"?1:pos==="TE"?1:1;
 let hoard=(pos==="QB"&&count>=2)||(pos==="RB"&&count>=5)||(pos==="WR"&&count>=6)||(pos==="TE"&&count>=3);
 if(hoard)return{cls:"hoard",label:count+" ⚠",need:true};
 if(starterNeed)return{cls:"pressure",label:count,need:true};
 if(count<depthTarget)return{cls:"open",label:count,need:true};
 return{cls:"filled",label:count,need:false};
}
function recentPositionCount(pos,n=8){
 return history.slice(-n).map(h=>players.find(p=>p.id===h.id)).filter(Boolean).filter(p=>(p.pos==="DEF"?"DST":p.pos)===pos).length;
}
function teamsBeforeMyNextPick(){
 let teams=[],n=pick;
 while(n<=170){
  let t=teamForPick(n);
  if(t===slot&&n!==pick)break;
  if(t!==slot&&!teams.includes(t))teams.push(t);
  n++;
 }
 return teams;
}
function marketPressure(pos){let cacheKey=`${intelligenceEpoch}:${pos}`;if(marketCache.has(cacheKey))return marketCache.get(cacheKey);
 let before=teamsBeforeMyNextPick(),starterNeed=0,depthNeed=0,hoardRisk=0;
 before.forEach(t=>{
  let c=managerPositionCounts(t),s=managerPositionStatus(t,pos),m=getManager(t);
  if(positionStarterNeed(pos,c))starterNeed++;
  else if(s.need)depthNeed++;
  if(pos==="QB"&&m.qbHoard>=7)hoardRisk+=1;
 });
 let recent=recentPositionCount(pos,8);
 let avail=available().filter(p=>(p.pos==="DEF"?"DST":p.pos)===pos).length;
 let pressure=starterNeed*15+depthNeed*6+recent*9+hoardRisk*10;
 if(avail<8)pressure+=12;if(avail<4)pressure+=18;
 pressure=Math.max(0,Math.min(100,Math.round(pressure)));
 let level=pressure>=82?"Critical":pressure>=65?"Hot":pressure>=45?"Rising":pressure>=22?"Calm":"Cold";
 let result={pos,pressure,level,starterNeed,depthNeed,recent,teams:before.length,avail};marketCache.set(cacheKey,result);return result;
}
function marketBoxMarkup(x){
 const levelClass=String(x.level||"cold").toLowerCase();
 const windowLabel=positionWindow(x);
 return `<div class="marketBox ${levelClass}"><div class="marketPos">${x.pos}</div><div class="marketLevel">${windowLabel}</div><div class="marketMeta">${x.recent} in last 8 • ${x.starterNeed} need starter</div></div>`;
}
function highestRoomPressure(){
 let positions=["RB","WR","QB","TE"].filter(pos=>!userPositionFilled(pos));
 return positions.map(marketPressure).sort((a,b)=>b.pressure-a.pressure)[0]||marketPressure("RB");
}
function roomAlertText(){let top=highestRoomPressure();if(top.pressure>=65)return `<div class="roomAlert"><b>${top.pos} Position Window: ${positionWindow(top)}</b><div class="meta">${top.recent} drafted in the last 8 picks • ${top.starterNeed} upcoming teams still need a starter.</div></div>`;return""}
function positionWindow(x){return x.pressure>=82?"Closing Fast":x.pressure>=65?"Starting to Thin":x.pressure>=45?"Watch Closely":"Still Open"}
function roomInsightText(){let vals=["RB","WR","QB","TE"].filter(p=>!userPositionFilled(p)).map(marketPressure).sort((a,b)=>b.pressure-a.pressure),top=vals[0];if(!top)return "Starting positions filled. Best value wins.";if(top.pressure>=82)return `Take ${top.pos} now if value is close.`;if(top.pressure>=65)return `${top.pos} is thinning. Do not wait too long.`;return `No urgent run. Best value wins.`}
function managerTendency(team){
 let c=managerPositionCounts(team),m=getManager(team);
 if(c.QB>=2)return"QB hoarding";
 if(c.RB>=5)return"RB heavy";
 if(c.WR>=6)return"WR heavy";
 if(c.TE>=3)return"TE hoarding";
 let filled=(c.QB>=1)+(c.RB>=2)+(c.WR>=3)+(c.TE>=1);
 if(filled>=4)return"Balanced";
 if(c.RB>c.WR+1)return"RB leaning";
 if(c.WR>c.RB+1)return"WR leaning";
 return m.archetype;
}
function managerTableMarkup(clickable=true){
 let rows=[];
 for(let t=1;t<=10;t++){
  let cells=["QB","RB","WR","TE"].map(pos=>{let s=managerPositionStatus(t,pos);return`<td class="needCell ${s.cls}">${s.label}</td>`}).join("");
  let name=t===slot?"Gerard":slotManagers[t]||("Team "+t);
  rows.push(`<tr ${clickable?`onclick="showManagerRoster(${t})" style="cursor:pointer"`:""} class="${t===slot?"youRow":""}"><td><b>${name}</b></td>${cells}<td><span class="tendencyPill">${managerTendency(t)}</span></td></tr>`);
 }
 return`<table class="managerTable"><thead><tr><th>Manager</th><th>QB</th><th>RB</th><th>WR</th><th>TE</th><th>Live read</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}
function showManagerRoster(team){
 let ps=managerRoster(team),name=team===slot?"Gerard":slotManagers[team]||("Team "+team),c=managerPositionCounts(team);
 managerRosterDetail.innerHTML=`<div class="teamReport" style="margin-top:12px"><div class="teamReportHead"><div><b>${name}</b><div class="meta">${managerTendency(team)} • QB ${c.QB} • RB ${c.RB} • WR ${c.WR} • TE ${c.TE}</div></div><button class="ghost" onclick="managerRosterDetail.innerHTML=''">Hide</button></div><div class="managerDetail">${ps.length?ps.map(p=>`<div class="managerPlayer"><b>${p.name}</b><div class="meta">${p.pos==="DST"?"D/ST":p.pos} • ${p.team}</div></div>`).join(""):`<div class="meta">No players drafted yet.</div>`}</div></div>`;
 managerRosterDetail.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function expectedDraftedBeforeNext(pos){let x=marketPressure(pos),picks=teamsBeforeMyNextPick().length;if(!picks)return 0;let est=Math.round((x.pressure/100)*Math.max(1,picks*.75));return Math.max(0,Math.min(picks,est))}
function availableTierCounts(pos){let c={S:0,A:0,B:0,C:0,D:0,E:0,F:0};available().filter(p=>positionKey(p)===pos).forEach(p=>{let t=tierLabel(p);c[t]=(c[t]||0)+1});return c}
function projectedTierRemaining(pos){let pool=available().filter(p=>positionKey(p)===pos).sort((a,b)=>finalPickScore(b)-finalPickScore(a)),lost=expectedDraftedBeforeNext(pos),remain=pool.slice(lost),c={S:0,A:0,B:0,C:0,D:0,E:0,F:0};remain.forEach(p=>{let t=tierLabel(p);c[t]=(c[t]||0)+1});return c}
function tierCountText(c){return ["S","A","B","C"].filter(t=>(c[t]||0)>0).map(t=>`${t}: ${c[t]}`).join(" • ")||"No S–C players"}
function roomIntelMarkup(){return ["RB","WR","QB","TE"].filter(pos=>!userPositionFilled(pos)).map(pos=>{let x=marketPressure(pos),run=x.recent>=4?"Run is happening":x.recent>=2?"Some movement":"No run";return `<div class="intelItem"><b>${pos} — ${run}</b><span>${x.recent} drafted in the last 8 picks. ${x.starterNeed} teams before your next pick still need a starter.</span></div>`}).join("")}
function peekAheadMarkup(){return ["RB","WR","QB","TE"].filter(pos=>!userPositionFilled(pos)).map(pos=>{let n=expectedDraftedBeforeNext(pos),now=availableTierCounts(pos),later=projectedTierRemaining(pos);return `<div class="peekItem"><b>${pos}: ${n} expected before your next pick</b><span>Available now — ${tierCountText(now)}</span><span>Projected then — ${tierCountText(later)}</span></div>`}).join("")}
function renderRoomScan(){let snap=getIntelligenceSnapshot(),markets=["RB","WR","QB","TE"].map(pos=>snap.markets[pos]),grid=`<div class="visionPanel">${markets.map(marketBoxMarkup).join("")}</div><div style="margin-top:10px"><b>Room Intel</b><div class="roomIntelList">${roomIntelMarkup()}</div></div><div style="margin-top:10px"><b>Peek Ahead</b><div class="peekList">${peekAheadMarkup()}</div></div>`,insight=roomInsightText(),alert=roomAlertText(),table=managerTableMarkup(true);["mobileMarketGrid","desktopMarketGrid","sheetMarketGrid"].forEach(id=>{let e=document.getElementById(id);if(e)e.innerHTML=grid});["mobileRoomInsight","desktopRoomInsight","sheetRoomInsight"].forEach(id=>{let e=document.getElementById(id);if(e)e.textContent=`Sharingan says: ${insight}`});["mobileRoomAlert","desktopRoomAlert"].forEach(id=>{let e=document.getElementById(id);if(e)e.innerHTML=alert});if(document.getElementById("desktopManagerTable"))desktopManagerTable.innerHTML=managerTableMarkup(false);if(document.getElementById("sheetManagerTable"))sheetManagerTable.innerHTML=table}
function openRoomScan(){renderRoomScan();let sheet=document.getElementById("roomScanSheet");if(sheet)sheet.classList.remove("hidden")}
function closeRoomScan(e){let sheet=document.getElementById("roomScanSheet");if(!sheet)return;if(e&&e.target!==sheet)return;sheet.classList.add("hidden");let detail=document.getElementById("managerRosterDetail");if(detail)detail.innerHTML=""}


function currentPickOwner(){return teamForPick(pick)}
function currentPickLabel(){let i=info(),team=currentPickOwner(),name=team===slot?"YOU":(slotManagers[team]||("Team "+team));return {team,name,label:`${i.r}.${String(i.ip).padStart(2,"0")}`}}
function positionKey(p){return p.pos==="DEF"?"DST":p.pos}
function publicPickScore(p){
 const owner=currentPickOwner(), c=managerPositionCounts(owner), rd=info().r, adp=p.overall||999;
 let score=180-Math.abs(adp-pick)*1.25-adp*.08;
 const pos=positionKey(p);
 if(positionStarterNeed(pos,c))score+=18;
 if(pos==="RB"&&c.RB<3)score+=5;if(pos==="WR"&&c.WR<4)score+=5;
 if(pos==="QB"&&rd<4)score-=18;if(pos==="TE"&&rd<3)score-=10;
 if(pos==="DST"&&rd<14)score-=90;if(pos==="K"&&rd<15)score-=100;
 return score;
}
function likelyNextPicks(){return available().slice().sort((a,b)=>publicPickScore(b)-publicPickScore(a)||(a.overall||999)-(b.overall||999)).slice(0,16)}
function quickPickMarkup(p){return `<button class="quickPick" onclick="recordCurrentPick(${p.id})"><div><div class="qname">${p.name}</div><div class="qmeta">${positionKey(p)} • ${p.team} • ${tierLabel(p)} Tier • Rank ${p.overall||'—'}</div></div><span>＋</span></button>`}
function clockStripMarkup(){let x=currentPickLabel();return `<div class="clockStrip"><div><div class="meta">ON THE CLOCK • PICK ${x.label}</div><b>${x.name}</b></div><span class="pill">${x.team===slot?'MY PICK':'OTHER PICK'}</span></div>`}
function recentPicksMarkup(){let rows=history.slice(-10).reverse();if(!rows.length)return `<div class="meta">No picks recorded yet.</div>`;return rows.map(h=>{let p=players.find(x=>x.id===h.id),nm=h.team===slot?'YOU':(slotManagers[h.team]||('Team '+h.team));return `<div class="recentPick"><span class="meta">${h.pick}</span><div><b>${p?.name||'Unknown'}</b><div class="meta">${positionKey(p||{pos:''})} • ${nm}</div></div><span class="meta">${Math.ceil(h.pick/10)}.${String((h.pick-1)%10+1).padStart(2,'0')}</span></div>`}).join('')}
function renderQuickDraftBoard(){
 const q=likelyNextPicks().map(quickPickMarkup).join(''), clock=clockStripMarkup(), recent=recentPicksMarkup();
 ['mobileQuickPicks','desktopQuickPicks'].forEach(id=>{let e=el(id);if(e)e.innerHTML=q});
 ['mobileClockStrip','desktopClockStrip','mobilePlayersClock'].forEach(id=>{let e=el(id);if(e)e.innerHTML=clock});let boardClock=el('desktopBoardClock');if(boardClock){let x=currentPickLabel();boardClock.textContent=`${x.name} • Pick ${x.label}`;}
 ['mobileRecentPicks','desktopRecentPicks'].forEach(id=>{let e=el(id);if(e)e.innerHTML=recent});
}
function recordCurrentPick(id){selectPlayer(id,currentPickOwner())}
function undoLastPick(){
 if(!history.length)return;
 const last=history.pop();drafted=drafted.filter(id=>id!==last.id);pick=Math.max(1,last.pick);selectedCandidateId=null;invalidateIntelligence();renderAll();
}
function syncSearch(source){let a=el('search'),b=el('dSearch');if(source==='mobile'&&b)b.value=a?.value||'';if(source==='desktop'&&a)a.value=b?.value||'';renderPlayers()}
function setPos(pos){posFilter=pos;document.querySelectorAll('[data-pos]').forEach(b=>b.classList.toggle('filterActive',b.dataset.pos===pos));renderPlayers()}
function renderPlayers(){
 let q=((el('search')?.value||el('dSearch')?.value||'')).trim().toLowerCase();
 let pool=available().filter(p=>posFilter==='ALL'||positionKey(p)===posFilter).filter(p=>!q||p.name.toLowerCase().includes(q)||(p.team||'').toLowerCase().includes(q)).sort((a,b)=>(a.overall||999)-(b.overall||999)).slice(0,q?80:55);
 let owner=currentPickOwner(),ownerLabel=owner===slot?'Draft for Me':'Record Pick';
 let html=pool.map(p=>`<div class="playerRow fast"><div class="meta">${p.overall||'—'}</div><div><b class="scanLink" onclick="openScan(${p.id})">${p.name}</b><div class="meta">${positionKey(p)} • ${p.team} • ${tierLabel(p)} Tier</div></div><button class="autoPickBtn" onclick="recordCurrentPick(${p.id})">${ownerLabel}</button></div>`).join('')||'<div class="meta" style="padding:12px">No available players match.</div>';
 ['playersList','dPlayersList'].forEach(id=>{let e=el(id);if(e)e.innerHTML=html});
}

function renderAll(){
 if(renderInProgress)return;
 renderInProgress=true;
 try{
  renderMeta();renderRecommendation();renderBoard();renderRoster();renderLiveRoster();renderExposure();renderRoomScan();renderWaitMeter();renderQuickDraftBoard();renderPlayers();renderDraftPlan();
  dirtyViews.players=dirtyViews.room=dirtyViews.wait=dirtyViews.team=false;
 }catch(err){reportRuntimeError("Rendering draft room",err);throw err}
 finally{renderInProgress=false}
}
function showPage(id){
 activeMobilePage=id;
 document.querySelectorAll(".mobilePage").forEach(x=>x.classList.remove("active"));
 const page=document.getElementById(id);if(page)page.classList.add("active");
 requestAnimationFrame(()=>{
  try{
   if(id==='mobilePlayers'&&dirtyViews.players){renderPlayers();dirtyViews.players=false}
   else if(id==='mobileTeam'&&dirtyViews.team){renderRoster();renderLiveRoster();renderExposure();dirtyViews.team=false}
   else if(id==='mobileDraft'){renderMeta();renderRecommendation();if(dirtyViews.wait){renderWaitMeter();dirtyViews.wait=false}}
  }catch(err){reportRuntimeError('Opening mobile tab',err)}
 });
}


// Jōnin 2.9 — canonical league-state and sync-ready foundation.
function fantasyHQPlayerIndex(){return new Map(players.flatMap(p=>[[Number(p.id),p],[String(p.id),p]]))}
function updateSyncFoundationUI(){
 if(!window.FantasyHQCore)return;
 const state=FantasyHQCore.getState(),badge=el('syncStatusBadge'),text=el('syncStatusText');
 if(badge){badge.textContent=(state.sync?.status||'local').toUpperCase();badge.title=`Schema v${state.schemaVersion}`}
 if(text){const stamp=state.sync?.lastSyncedAt?new Date(state.sync.lastSyncedAt).toLocaleString():'Not connected';text.textContent=`${state.name} • ${state.provider.toUpperCase()} • ${stamp} • ${state.sync?.message||'Ready'}`}
}
function downloadLeagueSnapshot(){
 const blob=new Blob([FantasyHQCore.exportSnapshot()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fantasy-hq-league-snapshot.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importLeagueSnapshot(event){
 try{const file=event.target.files?.[0];if(!file)return;FantasyHQCore.importSnapshot(await file.text());updateSyncFoundationUI();alert('League snapshot imported. Fantasy HQ is now using the updated canonical league state.')}catch(err){alert('Snapshot import failed: '+err.message)}finally{event.target.value=''}
}
function prepareYahooConnection(){FantasyHQCore.markSyncAttempt('Yahoo');updateSyncFoundationUI();alert('Yahoo sync foundation is ready. Live OAuth requires the secure backend connector planned for the next integration stage.')}
function syncDraftIntoLeagueState(){
 if(!window.FantasyHQCore||!players.length)return;
 const teams=Array.from({length:10},(_,i)=>({id:String(i+1),name:slotManagers[i+1]||`Team ${i+1}`,isUser:i+1===slot}));
 const rosters={};teams.forEach(t=>rosters[t.id]=history.filter(h=>String(h.team)===t.id).map(h=>h.id));
 FantasyHQCore.updateDraftContext({settings:{...leagueContext,rosterSlots:[...rosterSlots]},teams,rosters,availablePlayerIds:available().map(p=>p.id),playerMeta:Object.fromEntries(players.map(p=>[p.id,{name:p.name,pos:positionKey(p),team:p.team,overall:p.overall}]))});
 updateSyncFoundationUI();
}
if(window.FantasyHQCore){FantasyHQCore.subscribe(()=>updateSyncFoundationUI());window.addEventListener('load',updateSyncFoundationUI)}
const originalStartDraft=startDraft;startDraft=function(){const result=originalStartDraft.apply(this,arguments);syncDraftIntoLeagueState();return result};
const originalSelectPlayer=selectPlayer;selectPlayer=function(id,team){const result=originalSelectPlayer.apply(this,arguments);syncDraftIntoLeagueState();return result};
const originalUndoLastPick=undoLastPick;undoLastPick=function(){const result=originalUndoLastPick.apply(this,arguments);syncDraftIntoLeagueState();return result};

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js?v=jonin_2_9").then(reg=>reg.update()).catch(err=>console.warn("Service worker update skipped",err)))}
init();
