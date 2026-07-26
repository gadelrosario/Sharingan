'use strict';

const CODIFIED_AT='2026-07-25T00:00:00.000Z';

function principle({sourceId,transcriptIdentifier,sequence,category,scope='GLOBAL',position=null,strength,confidence,conditions=[],invalidationConditions=[],supportingNotes=[],sourceReference,status='ACTIVE'}){
  return Object.freeze({signalId:`fhq_signal_${sourceId}_${String(sequence).padStart(3,'0')}`,sourceId,sourceType:'expert_transcript',category,scope,position,teamId:null,playerId:null,strength,confidence,effectiveDate:CODIFIED_AT,expirationDate:null,conditions:Object.freeze([...conditions]),invalidationConditions:Object.freeze([...invalidationConditions]),supportingNotes:Object.freeze([...supportingNotes]),sourceReference,status,provenance:Object.freeze({originalSource:sourceId,transcriptIdentifier,localReference:sourceReference,dateCodified:CODIFIED_AT,evidenceType:'expert_transcript_summary',claimType:'summarized'})});
}

module.exports=Object.freeze({CODIFIED_AT,principle});
