'use strict';

const FALLBACK_REASONS=Object.freeze({DRAFT_NOW:'Act on the current recommendation before the path changes.',WAIT:'Preserve flexibility while the board develops.',PIVOT:'Use the strongest available alternative path.',PROTECT_TIER:'Preserve access to the current player tier.',EXPLOIT_VALUE:'Use the favorable acquisition window.',BUILD_POSITION:'Address the current roster-construction requirement.',DELAY_POSITION:'Preserve capital by delaying a position already supported.',MONITOR:'Collect more board information before committing.'});

function explain(bestPath,evidence){
  const selected=bestPath.selected,primaryReason=selected.pros[0]||FALLBACK_REASONS[selected.action],supportingReasons=selected.pros.slice(1,4),counterArguments=selected.cons.slice(0,3),unknownInformation=selected.unknown.map(category=>`${category} evidence is unavailable.`),evidenceSummary=evidence.map(item=>Object.freeze({category:item.category,availability:item.availability,confidence:item.confidence,freshness:item.freshness,source:item.source}));
  return Object.freeze({primaryReason,supportingReasons:Object.freeze(supportingReasons),counterArguments:Object.freeze(counterArguments),unknownInformation:Object.freeze(unknownInformation),evidenceSummary:Object.freeze(evidenceSummary)});
}
module.exports=Object.freeze({explain,FALLBACK_REASONS});
