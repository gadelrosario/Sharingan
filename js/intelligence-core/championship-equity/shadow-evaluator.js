'use strict';
const Contract=require('./contract');

class ChampionshipEquityShadowEvaluator{
  constructor({enabled=true}={}){this.enabled=enabled!==false}
  evaluate(player,context={}){return this.enabled?Contract.shadowRecord({...context,player}):Object.freeze({mode:'SHADOW_DISABLED',recommendationAuthority:false,identity:Contract.identity(player),status:'UNKNOWN'})}
  analyze(recommendations=[],contextFactory=()=>({})){const before=JSON.stringify(recommendations),records=this.enabled?recommendations.map((player,index)=>this.evaluate(player,contextFactory(player,index))):[];if(JSON.stringify(recommendations)!==before)throw new Error('Championship Equity shadow analysis mutated production recommendations');return Object.freeze({mode:this.enabled?'SHADOW':'SHADOW_DISABLED',recommendationAuthority:false,analyzedCount:records.length,records:Object.freeze(records)})}
}

module.exports=Object.freeze({ChampionshipEquityShadowEvaluator});
