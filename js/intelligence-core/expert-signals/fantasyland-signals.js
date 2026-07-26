'use strict';
const {principle}=require('./signal-fixture');
const common={sourceId:'fantasyland',transcriptIdentifier:'fantasyland-transcript-previously-reviewed'};
const p=(sequence,category,strength,confidence,notes,conditions=[],invalidations=[])=>principle({...common,sequence,category,strength,confidence,supportingNotes:[notes],conditions,invalidationConditions:invalidations,sourceReference:`docs/FANTASYLAND_RULES.md#fantasyland-${sequence}`});

const principles=Object.freeze([
  p(1,'PLANT_FLAG',82,94,'A Plant Flag is positive conviction, not an automatic selection.',['The player remains inside an acceptable value window.']),
  p(2,'CONVICTION_TARGET',70,91,'Positive conviction may break a close decision between otherwise comparable options.',['Candidate evaluations are close.']),
  p(3,'VALUE_WINDOW',64,89,'Conviction may support a controlled reach that remains inside an acceptable value window.',['Reach size remains bounded by the value window.']),
  p(4,'UPSIDE_PROFILE',78,90,'Ceiling and breakout potential gain relevance when roster context can absorb variance.',['Roster construction supports an upside-oriented selection.']),
  p(5,'PRICE_DISCIPLINE',91,95,'Conviction cannot override major tier, acquisition-cost, role, or roster-construction problems.',['No major structural conflict is present.']),
  p(6,'CONVICTION_TARGET',76,96,'Signal strength and evidence confidence are independent attributes.'),
  p(7,'ROLE_STABILITY',80,92,'Positive conviction should weaken or expire when its assumed role is invalidated.',['The role assumption remains supported.'],['Material injury, depth-chart, usage, or team-context change invalidates the assumed role.']),
]);

module.exports=Object.freeze({sourceId:'fantasyland',transcriptIdentifier:common.transcriptIdentifier,principles,examples:Object.freeze([])});
