'use strict';

global.window=global;
global.localStorage={getItem:()=>null,setItem:()=>{}};
require('../js/fantasy-hq-core.js');

let passed=0;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const test=(name,fn)=>{fn();passed+=1;console.log(`✓ ${name}`)};
const slots=['QB','RB1','RB2','WR1','WR2','WR3','TE','FLEX1','FLEX2','K','DEF'];
const player=(id,pos,overall)=>({id,name:`${pos} ${id}`,pos,overall});
const players=[
  player(1,'QB',20),player(2,'RB',18),player(3,'RB',25),player(4,'WR',12),
  player(5,'WR',28),player(6,'WR',45),player(7,'TE',35),player(8,'RB',50),
  player(9,'WR',55),player(10,'K',150),player(11,'DST',145),player(12,'RB',75),
  player(13,'WR',250),player(14,'TE',65)
];
const index=new Map(players.map(item=>[item.id,item]));
const strength=ids=>FantasyHQCore.calculateTeamStrength(ids,index,{starterSlots:slots});

test('filling an open WR slot cannot reduce strength',()=>assert(strength([1,2,3,4])<=strength([1,2,3,4,5]),'WR fill reduced strength'));
test('filling an open RB slot cannot reduce strength',()=>assert(strength([1,2,4,5])<=strength([1,2,3,4,5]),'RB fill reduced strength'));
test('filling an open TE slot cannot reduce strength',()=>assert(strength([1,2,3,4,5])<=strength([1,2,3,4,5,7]),'TE fill reduced strength'));
test('filling an open FLEX slot cannot reduce strength',()=>{const base=[1,2,3,4,5,6,7];assert(strength(base)<=strength([...base,8]),'FLEX fill reduced strength')});
test('bench-only addition has a smaller delta than an open starter',()=>{const partial=[1,2,3,4],full=[1,2,3,4,5,6,7,8,9,10,11],starterDelta=strength([...partial,5])-strength(partial),benchDelta=strength([...full,12])-strength(full);assert(benchDelta>=0&&benchDelta<starterDelta,`starter=${starterDelta}, bench=${benchDelta}`)});
test('genuinely weak starter receives only a small contribution',()=>{const base=[1,2,3,4,5],delta=strength([...base,13])-strength(base);assert(delta>=0&&delta<=1.1,`weak delta ${delta}`)});
test('legacy calculation remains unchanged without configured slots',()=>assert(FantasyHQCore.calculateTeamStrength([1,2,3],index)===FantasyHQCore.calculateTeamStrength([1,2,3],index,{}),'legacy default changed'));
test('Pick 91 WR fill produces a positive rather than collapsed fit',()=>{const before=strength([1,2,3,4,7,8,9,12]),after=strength([1,2,3,4,7,8,9,12,5]),rawFit=55+(after-before)*10+16;assert(after>=before&&rawFit>0,`before=${before}, after=${after}, fit=${rawFit}`)});

console.log(`Team strength comparison tests: ${passed}/${passed} passed`);
