'use strict';
// Offline, reproducible import of the user transfer package. Never fetch providers.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Y = require('../js/yahoo-season-v1'), S = require('../js/sleeper-projection-adapter-v1');
const { SeasonPlayerRegistry } = require('../js/season-player-registry-v1');
const ROOT = path.resolve(__dirname, '..');
const FILES = ['01_overall_original.txt','02_qb_rank_only.csv','03_rb_rank_only.csv','04_wr_rank_only.csv','05_te_rank_only.csv','06_k_rank_only.csv','07_def_rank_only.csv'];
const DATASETS = ['Overall','QB','RB','WR','TE','K','DST'];
const value = text => text == null || text === '-' || text === '' ? null : /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
const blankStats = () => ({fantasyPoints:null,team:null,played:null,snapPercentage:null,positionalFinish:null,overallFinish:null});
const base = (dataset, file, name, position) => ({
  dataset, sourceFile:file, sourceName:name, position, overallRank:null, positionRank:null,
  tier:null, movement:null, expertRankings:{expertAverage:null,averyHuffman:null,zachSavage:null},
  statistics:blankStats(), auxiliaryStatistics:null, scope:'current_expert_consensus', scoringFormat:'unknown',
  weeklyProjectedPoints:null, restOfSeasonValue:null,
});
function parseOverall(text) {
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean), rows=[];
  const header=['TIER','Expert Average','FPTS','Team','Played','SNAP%','POS Finish','OVR Finish'];
  let i=0, tier=null;
  while(i<lines.length) {
    if(lines[i+1]==='TIER') {
      tier=lines[i++];
      for(const h of header) if(lines[i++]!==h) throw Error(`Unexpected Overall header: ${h}`);
    }
    const rank=Number(lines[i++]);
    if(rank!==rows.length+1) throw Error(`Unexpected Overall rank ${rank}`);
    let movement=null;
    if(/^[+-]\d+$/.test(lines[i]||'')) movement=Number(lines[i++]);
    const name=lines[i++];
    if(!name) throw Error(`Missing name at rank ${rank}`);
    const row=base('Overall',FILES[0],name,null);
    Object.assign(row,{overallRank:rank,tier,movement,completeness:'complete'});
    // Header labels the ordering; no separate numeric expert-average value is supplied.
    row.rankingColumnLabel='Expert Average';
    if(i===lines.length) { row.completeness='truncated'; rows.push(row); break; }
    const match=/^(QB|RB|WR|TE|K|DEF|DST) (\d+)$/.exec(lines[i++]);
    if(!match) throw Error(`Missing position at rank ${rank}`);
    row.position=Y.normalizePosition(match[1]); row.positionRank=Number(match[2]);
    const raw=lines.slice(i,i+6);
    if(raw.length!==6) throw Error(`Incomplete statistics at rank ${rank}`);
    row.rawStatistics=Object.fromEntries(['FPTS','Team','Played','SNAP%','POS Finish','OVR Finish'].map((k,j)=>[k,raw[j]]));
    row.statistics=Object.fromEntries(Object.keys(blankStats()).map((k,j)=>[k,value(raw[j])]));
    i+=6; rows.push(row);
  }
  return rows;
}
function parseCsv(text,dataset,file) {
  const lines=text.trim().split(/\r?\n/);
  if(lines.shift()!=='position_rank,source_name,position,data_completeness') throw Error(`Unexpected CSV header: ${file}`);
  return lines.map((line,index)=>{
    const fields=line.split(',');
    if(fields.length!==4 || Number(fields[0])!==index+1 || Y.normalizePosition(fields[2])!==dataset || fields[3]!=='rank_and_name_only') throw Error(`Invalid row: ${file}:${index+2}`);
    return {...base(dataset,file,fields[1],dataset),positionRank:Number(fields[0]),completeness:'rank_and_name_only'};
  });
}
function resolve(rows,players,injuries=[],aliases={}) {
  const index=Y.buildCanonicalIndex(players,aliases), providers=S.buildIdentityIndex(players,injuries);
  const counts=new Map(), canonical=new Map(players.map(p=>[String(p.canonicalPlayerId||p.playerId||p.id),p]));
  const key=r=>`${r.dataset}|${Y.normalizeName(r.sourceName)}|${r.position}`;
  for(const row of rows) counts.set(key(row),(counts.get(key(row))||0)+1);
  return rows.map(row=>{
    let identity;
    if(counts.get(key(row))>1) identity={status:'AMBIGUOUS',reason:'duplicate-source-name-position'};
    else if(!row.position) identity={status:'UNRESOLVED',reason:'truncated-source-position'};
    else {
      // Defense CSVs omit D/ST. Match the full franchise name, never an invented abbreviation.
      const name=row.position==='DST'?`${row.sourceName} D/ST`:row.sourceName;
      identity=Y.reconcilePlayer({name,position:row.position,sourceTeam:row.statistics.team},index);
    }
    const id=identity.canonicalPlayerId, p=canonical.get(id);
    const external={yahoo:null,sleeper:null};
    if(id) {
      for(const [provider,map] of [['yahoo',providers.byYahoo],['sleeper',providers.bySleeper]]) {
        const ids=[...map].filter(([,v])=>v.canonicalPlayerId===id).map(([k])=>k);
        // Do not select among multiple provider references or contradictory IDs.
        const declared=p?.externalIds?.[provider]||p?.[`${provider}Id`];
        if(ids.length>1 || (declared&&!ids.includes(String(declared)))) {
          identity={status:'AMBIGUOUS',reason:`conflicting-${provider}-identity`}; break;
        }
        external[provider]=ids[0]||null;
      }
    }
    const matched=['MATCHED','ALIAS_MATCH'].includes(identity.status);
    return {...row,identity:{status:identity.status,reason:identity.reason,canonicalPlayerId:matched?id:null,
      canonicalName:matched?identity.canonicalName:null,canonicalTeam:matched?identity.canonicalTeam:null,
      providerIds:matched?external:{yahoo:null,sleeper:null},teamDisagreement:matched?identity.teamDisagreement:false}};
  });
}
function build() {
  const dir=path.join(ROOT,'data/sources/nfl-week6-2026');
  const sources=FILES.map((file,i)=>({file,dataset:DATASETS[i],sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')}));
  const raw=FILES.flatMap((file,i)=>i?parseCsv(fs.readFileSync(path.join(dir,file),'utf8'),DATASETS[i],file):parseOverall(fs.readFileSync(path.join(dir,file),'utf8')));
  const catalog=require('../data/players.json');
  const players=[...catalog,...new SeasonPlayerRegistry({canonicalPlayers:catalog,artifact:require('../data/season_evidence/season_player_registry.json')}).evidencePlayers()];
  const aliases=Object.fromEntries(require('../data/rankings/draftday_identity_aliases_2026-08-23.json').map(a=>[a.sourceName,a.canonicalPlayerId]));
  const records=resolve(raw,players,require('../data/injuries_2026.json').records,aliases);
  const snapshot={schema:'fantasy-hq-nfl-expert-snapshot-1',snapshotId:'user-nfl-2026-week6-v2',sport:'nfl',season:2026,throughWeek:6,asOf:{season:2026,week:6},scopeProvenance:'User clarification 2026-10-20: current expert consensus as of Week 6; not matchup rankings or explicit ROS rankings.',
    source:'User-provided Week 6 ranking transfer package',sourceSnapshotDate:null,scope:'current_expert_consensus',scoringFormat:'unknown',
    independentlyVerified:false,usage:'Supplemental ordinal consensus evidence; existing weekly evidence remains primary; no rank-to-points or ROS authority.',
    sources,records};
  const reference=r=>({dataset:r.dataset,rank:r.overallRank??r.positionRank,name:r.sourceName,reason:r.identity.reason});
  const conflicts=records.filter(r=>r.dataset!=='Overall'&&r.identity.canonicalPlayerId).flatMap(r=>{
    const overall=records.find(o=>o.dataset==='Overall'&&o.identity.canonicalPlayerId===r.identity.canonicalPlayerId);
    return overall&&overall.positionRank!==r.positionRank?[{...reference(r),overallPositionRank:overall.positionRank,positionalDatasetRank:r.positionRank}]:[];
  });
  const audit={snapshotId:snapshot.snapshotId,
    policy:'Unique normalized name + position through existing resolver where source IDs are absent; existing approved aliases only. Duplicate source identities quarantine all rows. Provider IDs come only from existing canonical evidence. Team disagreements preserved, not repaired. Conflicting ranks remain independent. User-confirmed current expert consensus supports ordinal comparisons and equal-evidence waiver tie breaks. Unknown scoring prevents numeric value conversion; no projection or transaction authority.',
    rowsByDataset:Object.fromEntries(DATASETS.map(d=>[d,records.filter(r=>r.dataset===d).length])),
    matched:records.filter(r=>r.identity.canonicalPlayerId).length,
    uniqueCanonicalIds:new Set(records.map(r=>r.identity.canonicalPlayerId).filter(Boolean)).size,
    providerCoverage:{yahoo:records.filter(r=>r.identity.providerIds.yahoo).length,sleeper:records.filter(r=>r.identity.providerIds.sleeper).length},
    ambiguous:records.filter(r=>r.identity.status==='AMBIGUOUS').map(reference),
    unmatched:records.filter(r=>r.identity.status==='UNRESOLVED').map(reference),
    duplicates:records.filter(r=>r.identity.reason==='duplicate-source-name-position').map(reference),
    conflicts,
    missingStatistics:Object.fromEntries(DATASETS.map(d=>[d,Object.fromEntries(Object.keys(blankStats()).map(k=>[k,records.filter(r=>r.dataset===d&&r.statistics[k]===null).length]))])),
    teamDisagreements:records.filter(r=>r.identity.teamDisagreement).map(r=>({...reference(r),sourceTeam:r.statistics.team,canonicalTeam:r.identity.canonicalTeam})),
    incomplete:records.filter(r=>r.completeness==='truncated').map(reference),
    unavailable:['Exact source snapshot date and scoring format are unspecified; user confirmed current expert consensus as of 2026 Week 6, not weekly matchup or explicit ROS rankings.','Six positional files omit all auxiliary statistics, tiers, movement and individual expert columns. TE Avery Huffman, Expert Average and Zach Savage remain independently null. RB rushing/receiving RYDS columns are absent, not inferred.','README reports incomplete final source rows in QB/RB/TE/K/DEF. All provided rank/name rows are retained; absent columns or later rows cannot be reconstructed.']};
  return {snapshot,audit};
}
if(require.main===module) {
  const {snapshot,audit}=build();
  fs.writeFileSync(path.join(ROOT,'data/rankings/nfl-user-week6-2026.json'),JSON.stringify(snapshot,null,2)+'\n');
  fs.writeFileSync(path.join(ROOT,'docs/NFL_WEEK6_IMPORT_AUDIT.json'),JSON.stringify(audit,null,2)+'\n');
  console.log(JSON.stringify({rows:audit.rowsByDataset,matched:audit.matched,unique:audit.uniqueCanonicalIds,ambiguous:audit.ambiguous.length,unmatched:audit.unmatched.length,conflicts:audit.conflicts.length,providerCoverage:audit.providerCoverage},null,2));
}
module.exports={parseOverall,parseCsv,resolve,build};
