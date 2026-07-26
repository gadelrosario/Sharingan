'use strict';
const {createEvidenceRecord}=require('./canonical-models');

const CONFIDENCE=new Set(['LOW','MODERATE','HIGH']);
const RELIABILITY=new Set(['UNVERIFIED','SECONDARY','PRIMARY','AUTHORITATIVE']);

function freshnessFor({observedAt,now,maxAgeMs}) {
  const age=Math.max(0,Date.parse(now)-Date.parse(observedAt));
  if (!Number.isFinite(age)) throw new TypeError('freshness timestamps must be valid');
  if (age<=maxAgeMs) return 'FRESH';
  if (age<=maxAgeMs*2) return 'AGING';
  return 'STALE';
}

class EvidenceEngine {
  constructor({now=()=>new Date().toISOString(),defaultMaxAgeMs=86400000}={}) { this.now=now; this.defaultMaxAgeMs=defaultMaxAgeMs; this.records=new Map(); }
  record(input) {
    const confidence=String(input.confidence||'LOW').toUpperCase(),reliability=String(input.reliability||'UNVERIFIED').toUpperCase();
    if (!CONFIDENCE.has(confidence)) throw new TypeError('unsupported evidence confidence');
    if (!RELIABILITY.has(reliability)) throw new TypeError('unsupported evidence reliability');
    const observedAt=input.timestamp||this.now(),freshness=freshnessFor({observedAt,now:this.now(),maxAgeMs:input.maxAgeMs||this.defaultMaxAgeMs});
    const record=createEvidenceRecord({...input,timestamp:observedAt,freshness,confidence,reliability,metadata:{...input.metadata,maxAgeMs:input.maxAgeMs||this.defaultMaxAgeMs}});
    this.records.set(record.evidenceId,record); return record;
  }
  get(evidenceId) { return this.records.get(evidenceId)||null; }
  forSubject(subjectId) { return [...this.records.values()].filter(record=>record.subjectId===subjectId); }
  assess(evidenceId) {
    const record=this.get(evidenceId); if(!record)return null;
    return Object.freeze({...record,freshness:freshnessFor({observedAt:record.timestamp,now:this.now(),maxAgeMs:record.metadata.maxAgeMs||this.defaultMaxAgeMs})});
  }
}

module.exports=Object.freeze({EvidenceEngine,freshnessFor,CONFIDENCE,RELIABILITY});
