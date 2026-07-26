'use strict';
const {principle}=require('./signal-fixture');
const common={sourceId:'bdge',transcriptIdentifier:'bdge-transcript-previously-reviewed'};
const p=(sequence,category,strength,confidence,notes,conditions=[],invalidations=[])=>principle({...common,sequence,category,strength,confidence,supportingNotes:[notes],conditions,invalidationConditions:invalidations,sourceReference:`docs/BDGE_RULES.md#bdge-${sequence}`});

const principles=Object.freeze([
  p(1,'PRICE_FADE',72,92,'A fade describes an unacceptable current price, not a permanent player avoid.',['Acquisition cost is above the acceptable value window.'],['Market price falls into an acceptable range.']),
  p(2,'VALUE_WINDOW',84,94,'Acquisition ranges should distinguish poor, fair, good, and excellent prices.',['A current platform price is available.']),
  p(3,'PRICE_DISCIPLINE',90,95,'Recommendation quality must be evaluated together with acquisition cost.',['Player evaluation and current acquisition cost are both known.']),
  p(4,'OPPORTUNITY_COST',88,93,'Opportunity cost carries more weight when premium early-round alternatives are available.',['Pick occurs in a premium early-round window.']),
  p(5,'UPSIDE_PROFILE',76,90,'Premium draft capital should be reserved for outcomes capable of returning premium value.',['Acquisition cost requires premium draft capital.']),
  p(6,'PRICE_DISCIPLINE',68,88,'Visible risk may already be incorporated into the market price.',['The relevant risk is public and the market price reflects it.']),
  p(7,'PRICE_DISCIPLINE',92,96,'Player-quality evaluation and player-price evaluation are separate dimensions.'),
  p(8,'PLATFORM_ADP_DIFFERENCE',74,89,'The same player can occupy a different value window on different draft platforms.',['Comparable platform prices are available.']),
]);

module.exports=Object.freeze({sourceId:'bdge',transcriptIdentifier:common.transcriptIdentifier,principles,examples:Object.freeze([])});
