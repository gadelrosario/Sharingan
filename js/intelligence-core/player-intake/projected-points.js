'use strict';

const numeric=value=>Number.isFinite(Number(value))?Number(value):0;
function score(projection,settings={}){
  const stats=projection?.stats||{},details=settings.scoringDetails||{};
  const receptionPoint=Number.isFinite(Number(settings.receptions))?Number(settings.receptions):settings.scoring==='full'?1:settings.scoring==='half'?0.5:0;
  const passingYardsPerPoint=numeric(details.passingYardsPerPoint)||25,rushingYardsPerPoint=numeric(details.rushingYardsPerPoint)||10,receivingYardsPerPoint=numeric(details.receivingYardsPerPoint)||10;
  return numeric(stats.completions)*numeric(settings.completionPoint)
    +numeric(stats.passingYards)/passingYardsPerPoint
    +numeric(stats.passingTouchdowns)*(numeric(settings.passTD)||4)
    +numeric(stats.interceptions)*(Number.isFinite(Number(details.interceptions))?Number(details.interceptions):-2)
    +numeric(stats.rushingYards)/rushingYardsPerPoint
    +numeric(stats.rushingTouchdowns)*(numeric(details.rushingTD)||6)
    +numeric(stats.receptions)*receptionPoint
    +numeric(stats.receivingYards)/receivingYardsPerPoint
    +numeric(stats.receivingTouchdowns)*(numeric(details.receivingTD)||6);
}
module.exports=Object.freeze({score});
