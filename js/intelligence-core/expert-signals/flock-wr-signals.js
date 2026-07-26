'use strict';
const {principle}=require('./signal-fixture');
const common={sourceId:'flock',transcriptIdentifier:'flock-wide-receiver-transcript-previously-reviewed'};
const p=(sequence,category,strength,confidence,notes,conditions=[],invalidations=[])=>principle({...common,sequence,category,scope:'POSITION',position:'WR',strength,confidence,supportingNotes:[notes],conditions,invalidationConditions:invalidations,sourceReference:`docs/FLOCK_RULES.md#flock-wr-${sequence}`});

const principles=Object.freeze([
  p(101,'CEILING_SUPPRESSION',88,93,'Bottom-tier projected offenses materially suppress wide-receiver ceiling paths.',['Team offense projects in the bottom tier.']),
  p(102,'OFFENSIVE_ENVIRONMENT',86,94,'Offensive environment affects touchdown access, drive sustainability, yardage ceiling, and weekly consistency.'),
  p(103,'PRICE_DISCIPLINE',78,92,'A poor offensive environment changes acceptable price rather than creating a permanent avoid.',['Acquisition cost is known.']),
  p(104,'VALUE_WINDOW',67,90,'Cheap wide receivers in poor offenses may remain acceptable lottery-ticket selections.',['Acquisition cost is low enough to preserve asymmetric upside.']),
  p(105,'ENVIRONMENT_CONFIDENCE',82,91,'Premium prices in poor offenses require stronger evidence that the environment or player can outperform expectations.',['Acquisition cost is premium.']),
  p(106,'PLATFORM_ADP_DIFFERENCE',81,94,'Platform-specific ADP can make the same wide receiver a good or poor value.',['Platform-specific ADP is available.']),
  p(107,'OFFENSIVE_ENVIRONMENT',79,88,'Sportsbook offensive expectations are strong evidence inputs, not absolute truth.',['A current sportsbook team expectation is available.']),
  p(108,'OFFENSE_IMPROVEMENT_PROBABILITY',73,90,'Environment confidence and offense-improvement probability should moderate the environment penalty.',['Evidence about likely offensive change is available.']),
  p(109,'PRICE_DISCIPLINE',92,96,'Talent, role, environment, and acquisition cost remain separate evaluation dimensions.'),
]);

module.exports=Object.freeze({sourceId:'flock',transcriptIdentifier:common.transcriptIdentifier,position:'WR',principles,examples:Object.freeze([])});
