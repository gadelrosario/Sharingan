#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),SOURCE=path.join(ROOT,'outputs/championship_equity/shadow_composite_4_3_18.json'),OUTPUT=path.join(ROOT,'data/championship_equity_2026.json');
function build(source=JSON.parse(fs.readFileSync(SOURCE,'utf8'))){
  const players=source.current2026.evaluations.map(row=>Object.freeze({canonicalPlayerId:String(row.canonicalPlayerId),playerName:row.playerName,position:row.position,status:row.championshipEquityStatus,score:row.shadowScore,classification:row.classification,evidenceComplete:row.dataCompleteness?.complete===true,components:Object.freeze([...(row.components||[])]),provenance:Object.freeze({...row.provenance}),evidenceMeaning:'HISTORICALLY_VALIDATED_MARKET_VALUE_APPRECIATION_SIGNAL_NOT_ABSOLUTE_FANTASY_PRODUCTION'}));
  return Object.freeze({schemaVersion:1,milestone:'Jōnin 4.3.20',label:'Championship Equity Production Evidence Bridge',snapshotDate:'2026-08-19',sourceArtifact:'outputs/championship_equity/shadow_composite_4_3_18.json',sourceModel:'Jōnin 4.3.18 Championship Equity Shadow Composite v1',recommendationAuthority:'LIMITED_GUARDED_BY_FEATURE_FLAG',supportedPositions:Object.freeze(['RB','WR']),unsupportedPositions:Object.freeze({QB:'INSUFFICIENT_VALIDATED_SIGNAL_SET',TE:'INSUFFICIENT_VALIDATED_SIGNAL_SET'}),currentAdpStatus:'CURRENT_2026_ADP_UNAVAILABLE',players:Object.freeze(players)});
}
function main(){const report=build();const temporary=`${OUTPUT}.tmp-${process.pid}`;fs.writeFileSync(temporary,`${JSON.stringify(report,null,2)}\n`);JSON.parse(fs.readFileSync(temporary,'utf8'));fs.renameSync(temporary,OUTPUT);console.log(JSON.stringify({output:OUTPUT,records:report.players.length,supported:report.players.filter(row=>row.evidenceComplete).length,missing:report.players.filter(row=>!row.evidenceComplete).length},null,2));return report}
if(require.main===module)main();
module.exports=Object.freeze({build,main});
