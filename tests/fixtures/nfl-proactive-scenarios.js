'use strict';
// Synthetic scenarios shared with v1 acceptance; never live player statuses.
const now=Date.parse('2026-10-15T12:00:00Z'),stamp=new Date(now).toISOString();
const p=(id,name,slot='BN')=>({identity:{canonicalPlayerId:id,status:'MATCHED'},name,position:'RB',rosterSlot:slot,injuryStatus:'ACTIVE'});
const hall=p('hall','Breece Hall'),allen=p('allen','Braelon Allen','RB'),cmc={...p('cmc','Christian McCaffrey','RB'),byeWeek:8},dobbins=p('dobbins','J.K. Dobbins','FLEX'),barkley=p('barkley','Saquon Barkley'),charbonnet=p('charbonnet','Zach Charbonnet');
function model(profileId='a'){return {profileId,week:6,lastSuccessfulSyncAt:stamp,scoring:'half-ppr',status:'CURRENT',snapshot:{provider:'Yahoo',league:{leagueKey:'461.l.'+profileId,season:2026},userTeamKey:'team.'+profileId,ownership:{valid:true}},userTeamResolution:{status:'RESOLVED'},roster:[allen,cmc,dobbins,barkley,charbonnet],available:[],lineup:{starters:[{slot:'RB',player:allen},{slot:'RB',player:cmc},{slot:'FLEX',player:dobbins}],bench:[{player:barkley},{player:charbonnet}]}};}
function obs(id,field,value,time=now,more={}){return {playerId:id,field,value,provider:'official',fixture:true,observedAt:new Date(time).toISOString(),sourcePublishedAt:new Date(time).toISOString(),eventTime:null,...more};}

module.exports={now,stamp,p,hall,allen,cmc,dobbins,barkley,charbonnet,model,obs};
