'use strict';
const {principle}=require('./signal-fixture');
const common={sourceId:'flock',transcriptIdentifier:'flock-running-back-transcript-previously-reviewed'};
const p=(sequence,category,strength,confidence,notes,conditions=[],invalidations=[])=>principle({...common,sequence,category,scope:'POSITION',position:'RB',strength,confidence,supportingNotes:[notes],conditions,invalidationConditions:invalidations,sourceReference:`docs/FLOCK_RULES.md#flock-rb-${sequence}`});

const principles=Object.freeze([
  p(201,'CEILING_SUPPRESSION',91,94,'Poor offenses suppress running-back ceiling more strongly than volume-supported floor.',['Team offense projects in the bottom tier.']),
  p(202,'FLOOR_SUPPORT',79,92,'Sufficient volume can still support useful RB2 outcomes in a weak offense.',['Projected workload remains stable.']),
  p(203,'CEILING_SUPPRESSION',86,93,'Bottom-tier offenses reduce top-12 and elite running-back outcome paths.',['Team offense projects in the bottom tier.']),
  p(204,'PASS_CATCHING_PROTECTION',85,95,'Receiving usage protects poor-offense running backs better than touchdown-dependent early-down roles.',['Player has a meaningful pass-catching role.']),
  p(205,'OFFENSIVE_ENVIRONMENT',82,93,'Goal-line and touchdown-dependent opportunity should receive an environment penalty.',['Role relies materially on scoring opportunities.']),
  p(206,'CEILING_SUPPRESSION',72,88,'Repeated inability to overcome a poor environment should reduce ceiling confidence.',['Multiple relevant seasons show capped outcomes in comparable conditions.']),
  p(207,'UPSIDE_PROFILE',66,82,'Unknown elite talent may retain a wider ceiling range than an established player with repeatedly capped outcomes.',['Talent uncertainty is genuine and upside evidence exists.']),
  p(208,'OFFENSE_IMPROVEMENT_PROBABILITY',80,93,'Offense-improvement probability should moderate environment risk.',['Current evidence supports a change from the prior environment.']),
  p(209,'ENVIRONMENT_CONFIDENCE',78,92,'Coaching, quarterback, offensive-line, and scoring-expectation changes can reduce confidence in a prior environment label.',['Material team-context changes are documented.']),
  p(210,'PRICE_DISCIPLINE',90,96,'Acquisition cost determines whether running-back environment risk is acceptable.',['Current acquisition cost is known.']),
  p(211,'LEAGUE_FORMAT_ADJUSTMENT',84,94,'League scoring and lineup requirements should alter running-back positional value.',['League scoring and lineup configuration are known.']),
  p(212,'PLATFORM_ADP_DIFFERENCE',81,94,'Platform-specific ADP should alter the running-back value window.',['Platform-specific ADP is available.']),
]);

module.exports=Object.freeze({sourceId:'flock',transcriptIdentifier:common.transcriptIdentifier,position:'RB',principles,examples:Object.freeze([])});
