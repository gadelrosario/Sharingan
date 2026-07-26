'use strict';

function providerName(provider){return provider?.name||provider?.getStatus?.().name;}

class MissionControl {
  constructor({clock=()=>new Date().toISOString(),logger=console}={}){this.clock=clock;this.logger=logger;this.providers=new Map();this.health=new Map();this.refreshQueue=[];}
  registerProvider(provider,{nextScheduledSync=null}={}){
    const name=providerName(provider);if(!name)throw new TypeError('registered provider must have a name');
    this.providers.set(name,provider);this.health.set(name,{providerStatus:provider.getStatus().status,lastSync:null,lastSuccessfulSync:null,nextScheduledSync,syncFailures:0,lastError:null});return this.getProviderHealth(name);
  }
  schedule(providerName,scheduledFor=this.clock()){if(!this.providers.has(providerName))throw new Error(`unknown provider: ${providerName}`);const job=Object.freeze({providerName,scheduledFor,queuedAt:this.clock()});this.refreshQueue.push(job);this.refreshQueue.sort((a,b)=>Date.parse(a.scheduledFor)-Date.parse(b.scheduledFor));this.health.get(providerName).nextScheduledSync=scheduledFor;return job;}
  async refresh(providerName,{timestamp=this.clock()}={}){
    const provider=this.providers.get(providerName);if(!provider)throw new Error(`unknown provider: ${providerName}`);
    const state=this.health.get(providerName);state.lastSync=timestamp;
    try{const result=await provider.sync({timestamp});state.providerStatus=provider.getStatus().status;state.lastSuccessfulSync=timestamp;state.lastError=null;this.logger.info?.(`[MissionControl] ${providerName} mock sync succeeded`);return result;}
    catch(error){state.providerStatus=provider.getStatus().status;state.syncFailures+=1;state.lastError=error.message;this.logger.error?.(`[MissionControl] ${providerName} sync failed: ${error.message}`);throw error;}
  }
  async processNext(){const job=this.refreshQueue.shift();if(!job)return null;const next=this.refreshQueue.find(item=>item.providerName===job.providerName);this.health.get(job.providerName).nextScheduledSync=next?.scheduledFor||null;return this.refresh(job.providerName,{timestamp:job.scheduledFor});}
  getProviderHealth(name){const state=this.health.get(name);return state?Object.freeze({...state}):null;}
  getStatus(){return Object.freeze({providers:Object.freeze([...this.health].map(([name,state])=>Object.freeze({name,...state}))),refreshQueue:Object.freeze([...this.refreshQueue])});}
}

module.exports=Object.freeze({MissionControl});
