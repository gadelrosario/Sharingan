'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../js/lineup-preview-v1'),E=require('../js/season-current-week-evidence-v1');
class Element { constructor(tag,cls,text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.dataset={};this.attrs={};this.isConnected=true;} append(...nodes){this.children.push(...nodes);} appendChild(node){this.children.push(node);return node;} setAttribute(k,v){this.attrs[k]=v;} replaceChildren(){this.children=[];} get childElementCount(){return this.children.length;} }
const all=(node)=>[node,...node.children.flatMap(all)], text=node=>all(node).map(n=>n.textContent).join(' ');
const p=(name,points)=>({playerId:name,name,position:'WR',eligiblePositions:['WR'],currentWeek:{projection:{supported:true,value:points,label:'Sleeper Estimate',freshness:'CURRENT'},game:{state:'PRE_GAME',actionable:true,kickoff:'2099-01-01T00:00:00Z'},actual:{value:null},injury:{current:false},outlookContribution:{value:points}}});
const a=p('Alpha',10),b=p('Bravo',12),model={profileId:'p',sourceLabel:'Yahoo',week:3,userTeamResolution:{status:'RESOLVED'},snapshot:{fetchedAt:'2026-09-24',settings:{rosterSlots:['WR','BN']}},roster:[a,b],lineup:{authoritative:true,starters:[{slot:'WR',player:a}],bench:[{slot:'BN',player:b}],ir:[],unassigned:[]},opponent:{name:'Other'},opponentLineup:{starters:[{slot:'WR',player:a}]}};
model.currentWeekEvidence={userOutlook:E.outlook(model.lineup),opponentOutlook:E.outlook(model.opponentLineup)};
let clock=Date.parse('2098-12-31T23:59:59Z'), timerId=0, timers=new Map(), events={};
const FakeDate=class extends Date { static now(){return clock;} };
let network=0;const el=(...args)=>new Element(...args),context={Date:FakeDate,document:{visibilityState:"visible",addEventListener(n,f){events[n]=f;},removeEventListener(n){delete events[n];}},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),window:{addEventListener(n,f){events[n]=f;},removeEventListener(n){delete events[n];},FantasyHQLineupPreviewV1:P,FantasyHQCurrentWeekEvidenceV1:E},seasonEl:el,seasonButton:(label,fn,cls)=>{const n=el('button',cls,label);n.click=fn;return n;},seasonStartSitEvaluation:()=>({status:'EVALUATED',recommendation:{status:'NO_CHANGE'}}),seasonV3LandmarkHeader:title=>el('h2','',title),seasonV3PositionBattle:m=>({node:el('div','',`battle ${E.outlook(m.lineup).value}`)}),seasonLineupOptimizerCard:()=>el('div','','optimizer'),seasonV3SwingPlayers:()=>null,seasonV3RosterImprovements:()=>null,seasonWeeklyPlan:()=>({}),seasonV3Decisions:()=>el('div','','plan'),fetch:()=>{network++;throw Error('Unexpected network');},localStorage:{setItem:()=>{throw Error('Unexpected persistence');}}};
vm.createContext(context);vm.runInContext(fs.readFileSync('js/lineup-workspace-ui.js','utf8'),context);const root=el('main');context.renderSeasonLineupWorkspace(model,root);let host=root.children[0];const click=label=>{const n=all(host).find(x=>x.textContent===label&&x.click);assert.ok(n,label);assert.ok(!n.disabled,label);n.click();};
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('all three modes exposed',()=>{for(const label of ['Current Lineup','Fantasy HQ Lineup','Custom Preview'])assert.ok(all(host).some(n=>n.textContent===label));});
test('HQ no-change truth',()=>{click('Fantasy HQ Lineup');assert.match(text(host),/Fantasy HQ recommends no lineup changes/);});
test('click swap updates outlook battle and mode locally',()=>{click('Select');click('Preview swap');assert.match(text(host),/Preview: 12.00 – 10.00/);assert.match(text(host),/Net: \+2.00/);assert.match(text(host),/battle 12/);assert.ok(all(host).some(n=>n.textContent==='Custom Preview'&&n.attrs['aria-pressed']==='true'));});
test('undo restores previous HQ state',()=>{click('Undo last change');assert.ok(all(host).some(n=>n.textContent==='Fantasy HQ Lineup'&&n.attrs['aria-pressed']==='true'));assert.doesNotMatch(text(host),/Preview: 12.00/);});
test('reset returns current',()=>{click('Select');click('Preview swap');click('Reset to current');assert.ok(all(host).some(n=>n.textContent==='Current Lineup'&&n.attrs['aria-pressed']==='true'));});
test('sync clears custom and explains reset',()=>{click('Select');click('Preview swap');context.clearSeasonLineupPreviewAfterSync('p');const next={...model,snapshot:{...model.snapshot,fetchedAt:'new'}};const root2=el('main');context.renderSeasonLineupWorkspace(next,root2);host=root2.children[0];assert.match(text(host),/Preview reset after Yahoo refresh/);assert.ok(all(host).some(n=>n.textContent==='Current Lineup'&&n.attrs['aria-pressed']==='true'));});
test('all interactions issue zero fetch or persistence calls',()=>assert.equal(network,0));
test('source player assignments survive UI operations',()=>{assert.equal(model.lineup.starters[0].player.name,'Alpha');assert.equal(model.lineup.bench[0].player.name,'Bravo');});
test('one local timeout resets at exact kickoff and clears preview outputs',()=>{
 click('Select');click('Preview swap');assert.equal(timers.size,1);
 const scheduled=[...timers.values()][0];assert.equal(scheduled.at,Date.parse('2099-01-01T00:00:00Z'));
 clock=scheduled.at;timers.clear();scheduled.fn();
 assert.match(text(host),/Preview reset because lineup lock status changed/);
 assert.doesNotMatch(text(host),/Preview:|Net:/);assert.match(text(host),/Current: Unavailable/);
 assert.equal(timers.size,0);assert.equal(network,0);
 assert.ok(all(host).some(n=>n.textContent==='Current Lineup'&&n.attrs['aria-pressed']==='true'));
 assert.ok(all(host).find(n=>n.textContent==='Undo last change').disabled);
});
test('background resume revalidates an overdue boundary without fetch',()=>{
 clock=Date.parse('2098-12-31T23:59:59Z');const root3=el('main');context.renderSeasonLineupWorkspace(model,root3);host=root3.children[0];
 click('Select');click('Preview swap');clock+=1001;events.visibilitychange();
 assert.match(text(host),/Preview reset because lineup lock status changed/);assert.equal(network,0);
});
test('detached workspace cancels callbacks without repaint',()=>{
 clock=Date.parse('2098-12-31T23:59:59Z');const root4=el('main');context.renderSeasonLineupWorkspace(model,root4);host=root4.children[0];
 click('Custom Preview');assert.equal(timers.size,1);host.isConnected=false;
 const scheduled=[...timers.values()][0];scheduled.fn();assert.equal(timers.size,0);
});
let failures=0;for(const [name,fn] of tests){try{fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e);}}console.log(`${tests.length-failures}/${tests.length} passed`);if(failures)process.exit(1);
