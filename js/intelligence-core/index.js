'use strict';

module.exports=Object.freeze({
  canonical:require('./canonical-models'),
  providers:Object.freeze({...require('./data-provider'),...require('./mock-providers')}),
  intelligence:require('./intelligence-store'),
  experts:require('./expert-strategy-registry'),
  expertSignals:require('./expert-signals'),
  evidence:require('./evidence-engine'),
  missionControl:require('./mission-control'),
  championshipEquity:require('./championship-equity'),
  playerIntake:require('./player-intake'),
});
