'use strict';

const clean=value=>String(value??'').trim();
const integer=value=>{if(value===null||value===undefined||clean(value)==='')return null;const number=Number(value);return Number.isInteger(number)?number:null};
const isoDate=value=>{const token=clean(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(token))return null;const time=Date.parse(`${token}T00:00:00.000Z`);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===token?token:null};
const ageOnSeasonStart=(birthDate,season)=>{
  const date=isoDate(birthDate),year=integer(season);if(!date||year===null)return null;
  const [birthYear,birthMonth,birthDay]=date.split('-').map(Number);let age=year-birthYear;
  if(birthMonth>9||(birthMonth===9&&birthDay>1))age-=1;
  return age>=16&&age<=60?age:null;
};
const yearInLeague=(entryYear,season)=>{const entry=integer(entryYear),year=integer(season);return entry!==null&&year!==null&&entry>=1900&&year>=entry?year-entry+1:null};
const sourceId=row=>clean(row.gsis_id||row.gsisId||row.player_id);
const sourceName=row=>clean(row.display_name||row.player_display_name||row.player_name||row.full_name)||[row.first_name,row.last_name].map(clean).filter(Boolean).join(' ');
const sourceEntryYear=row=>{const year=integer(row.draft_year??row.entry_year??row.rookie_year);return year!==null&&year>=1920&&year<=2100?year:null};
const metadataClassification=(metadata,{asOfSeason}={})=>{
  const season=integer(asOfSeason),entry=integer(metadata?.nflEntryYear);
  if(entry!==null&&season!==null&&entry===season)return'ROOKIE_CONFIRMED';
  if(entry!==null&&season!==null&&entry<season)return'YEAR_2_PLUS';
  if(metadata?.birthDate||entry!==null)return'DEVELOPMENT_METADATA_PARTIAL';
  return'DEVELOPMENT_METADATA_UNKNOWN';
};

function normalizeSnapshot(playerRows,mappingSnapshot,historicalSnapshot,{snapshotDate=new Date().toISOString()}={}){
  if(!Array.isArray(playerRows))throw new TypeError('nflverse player rows must be an array');
  const canonicalByGsis=new Map((mappingSnapshot?.mappings||[]).map(item=>[clean(item.gsisId),item]));
  const seasonsByCanonical=new Map();
  (historicalSnapshot?.players||[]).forEach(record=>{
    const id=String(record.canonicalPlayerId),season=integer(record.season);if(season===null)return;
    if(!seasonsByCanonical.has(id))seasonsByCanonical.set(id,new Set());seasonsByCanonical.get(id).add(season);
  });
  const players=[],records=[],unmatched=[],quarantined=[],seenSource=new Set(),seenCanonical=new Set(),snapshotIso=new Date(snapshotDate).toISOString(),asOfSeason=new Date(snapshotIso).getUTCFullYear();
  playerRows.forEach(row=>{
    const gsisId=sourceId(row);if(!gsisId){quarantined.push({reason:'MISSING_GSIS_ID'});return}
    if(seenSource.has(gsisId)){quarantined.push({gsisId,reason:'DUPLICATE_SOURCE_ID'});return}seenSource.add(gsisId);
    const mapping=canonicalByGsis.get(gsisId);if(!mapping){unmatched.push({gsisId,reason:'NO_EXISTING_CANONICAL_GSIS_MAPPING'});return}
    const canonicalPlayerId=String(mapping.canonicalPlayerId);
    if(seenCanonical.has(canonicalPlayerId)){quarantined.push({gsisId,canonicalPlayerId,reason:'DUPLICATE_CANONICAL_ATTACHMENT'});return}seenCanonical.add(canonicalPlayerId);
    const birthDate=isoDate(row.birth_date??row.birthDate),entryYear=sourceEntryYear(row);
    const sourceIssues=[];
    if(clean(row.birth_date??row.birthDate)&&!birthDate)sourceIssues.push('INVALID_BIRTH_DATE');
    if(clean(row.draft_year??row.entry_year??row.rookie_year)&&entryYear===null)sourceIssues.push('INVALID_ENTRY_YEAR');
    const seasons=[...(seasonsByCanonical.get(canonicalPlayerId)||[])].sort((a,b)=>a-b);
    const metadata={
      recordType:'HISTORICAL_DEVELOPMENT_PLAYER',canonicalPlayerId,providerIds:Object.freeze({gsis:gsisId}),
      sourceDisplayName:sourceName(row)||null,birthDate,nflEntryYear:entryYear,rookieSeason:entryYear,
      position:clean(row.position_group||row.position)||null,source:'nflverse',sourceDataset:'players',snapshotDate:snapshotIso,
      matchMethod:mapping.matchMethod||'existing-gsis-mapping',matchConfidence:mapping.matchConfidence||'UNKNOWN',
      dataConfidence:birthDate&&entryYear?'HIGH':birthDate||entryYear?'PARTIAL':'UNKNOWN',
      historyStatus:seasons.length?'HISTORY_AVAILABLE':entryYear===asOfSeason?'NO_HISTORY_EXPECTED':'HISTORY_MISSING',
      quality:Object.freeze({complete:Boolean(birthDate&&entryYear),issues:Object.freeze(sourceIssues)}),
    };
    metadata.developmentClassification=metadataClassification(metadata,{asOfSeason});
    players.push(Object.freeze(metadata));
    seasons.forEach(season=>records.push(Object.freeze({
      recordType:'HISTORICAL_DEVELOPMENT_SEASON',canonicalPlayerId,providerIds:Object.freeze({gsis:gsisId}),
      birthDate,ageAtSeason:ageOnSeasonStart(birthDate,season),nflEntryYear:entryYear,rookieSeason:entryYear,
      yearInLeague:yearInLeague(entryYear,season),position:clean(row.position_group||row.position)||null,season,
      source:'nflverse',sourceDataset:'players',snapshotDate:snapshotIso,
      confidence:birthDate||entryYear?'HIGH':'UNKNOWN',matchMethod:mapping.matchMethod||'existing-gsis-mapping',
      quality:Object.freeze({complete:Boolean(birthDate&&entryYear),issues:Object.freeze(sourceIssues)}),
    })));
  });
  const summary={staticMetadataPlayers:players.length,birthDatePlayers:players.filter(row=>row.birthDate).length,entryYearPlayers:players.filter(row=>row.nflEntryYear!==null).length,rookieSeasonPlayers:players.filter(row=>row.rookieSeason!==null).length,historicalSeasonRecords:records.length,birthDateRecords:records.filter(row=>row.birthDate).length,entryYearRecords:records.filter(row=>row.nflEntryYear!==null).length,yearInLeagueRecords:records.filter(row=>row.yearInLeague!==null).length};
  return Object.freeze({schemaVersion:2,provider:'nflverse',sourceDataset:'players',snapshotDate:snapshotIso,recommendationAuthority:false,ageReferenceDate:'September 1 of each evidence season',sourcePlayersProcessed:playerRows.length,players:Object.freeze(players),records:Object.freeze(records),matchedPlayers:seenCanonical.size,unmatched:Object.freeze(unmatched),quarantined:Object.freeze(quarantined),unmatchedCount:unmatched.length,ambiguousCount:0,quarantinedCount:quarantined.length,coverage:Object.freeze(summary)});
}

function sampleSlices(snapshot){
  const positions=['QB','RB','WR','TE'],labels=['Year 1','Year 2','Year 3','Year 4+','unknown'];
  const result=Object.fromEntries(positions.map(position=>[position,Object.fromEntries(labels.map(label=>[label,0]))]));
  (snapshot?.records||[]).forEach(row=>{if(!result[row.position])return;const year=row.yearInLeague,label=year===1?'Year 1':year===2?'Year 2':year===3?'Year 3':year>=4?'Year 4+':'unknown';result[row.position][label]++});
  return Object.freeze(result);
}

function attachToEvidence(featureRecord,developmentRecord){
  if(!developmentRecord)return Object.freeze({...featureRecord,development:Object.freeze({ageAtSeason:null,yearInLeague:null,status:'UNAVAILABLE'})});
  if(String(featureRecord.canonicalPlayerId)!==String(developmentRecord.canonicalPlayerId)||Number(featureRecord.evidenceSeason)!==Number(developmentRecord.season))throw new TypeError('development context must match the evidence player and season');
  return Object.freeze({...featureRecord,development:Object.freeze({ageAtSeason:developmentRecord.ageAtSeason??null,yearInLeague:developmentRecord.yearInLeague??null,status:'EVIDENCE_PRESENT'})});
}

module.exports=Object.freeze({isoDate,ageOnSeasonStart,yearInLeague,metadataClassification,normalizeSnapshot,sampleSlices,attachToEvidence});
