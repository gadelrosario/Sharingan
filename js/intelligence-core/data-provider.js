'use strict';

const PROVIDER_STATES = Object.freeze({IDLE:'IDLE', INITIALIZING:'INITIALIZING', READY:'READY', SYNCING:'SYNCING', DEGRADED:'DEGRADED', ERROR:'ERROR'});

class IDataProvider {
  async initialize() { throw new Error('initialize() must be implemented'); }
  async sync() { throw new Error('sync() must be implemented'); }
  normalize() { throw new Error('normalize() must be implemented'); }
  validate() { throw new Error('validate() must be implemented'); }
  getStatus() { throw new Error('getStatus() must be implemented'); }
  getLastUpdated() { throw new Error('getLastUpdated() must be implemented'); }
  getConfidence() { throw new Error('getConfidence() must be implemented'); }
}

class MockDataProvider extends IDataProvider {
  constructor({name, confidence='LOW', records=[]}={}) {
    super();
    if (!name) throw new TypeError('provider name is required');
    this.name=name; this.confidence=confidence; this.records=records;
    this.status=PROVIDER_STATES.IDLE; this.lastUpdated=null;
  }
  async initialize() { this.status=PROVIDER_STATES.INITIALIZING; this.status=PROVIDER_STATES.READY; return this.getStatus(); }
  normalize(record) { return Object.freeze({provider:this.name, ...record}); }
  validate(records) { return Array.isArray(records)&&records.every(record=>record&&record.provider===this.name); }
  async sync({timestamp='1970-01-01T00:00:00.000Z'}={}) {
    if (this.status===PROVIDER_STATES.IDLE) await this.initialize();
    this.status=PROVIDER_STATES.SYNCING;
    const records=this.records.map(record=>this.normalize(record));
    if (!this.validate(records)) { this.status=PROVIDER_STATES.ERROR; throw new Error(`${this.name} mock validation failed`); }
    this.lastUpdated=timestamp; this.status=PROVIDER_STATES.READY;
    return Object.freeze({provider:this.name, records:Object.freeze(records), mock:true, timestamp});
  }
  getStatus() { return Object.freeze({name:this.name, status:this.status, mock:true}); }
  getLastUpdated() { return this.lastUpdated; }
  getConfidence() { return this.confidence; }
}

module.exports = Object.freeze({IDataProvider, MockDataProvider, PROVIDER_STATES});
