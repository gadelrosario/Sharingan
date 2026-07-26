'use strict';
const {MockDataProvider}=require('./data-provider');

function providerClass(defaultName) {
  return class extends MockDataProvider {
    constructor(options={}) { super({name:defaultName, confidence:'LOW', records:[], ...options}); }
  };
}

const YahooProvider=providerClass('Yahoo');
const SleeperProvider=providerClass('Sleeper');
const OddsProvider=providerClass('Odds');
const StatsProvider=providerClass('Stats');
const InjuryProvider=providerClass('Injury');
const ExpertRegistryProvider=providerClass('ExpertRegistry');

module.exports=Object.freeze({YahooProvider,SleeperProvider,OddsProvider,StatsProvider,InjuryProvider,ExpertRegistryProvider});
