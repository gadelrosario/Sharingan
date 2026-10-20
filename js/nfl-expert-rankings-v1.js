(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.NFLExpertRankingsV1=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const SCHEMA='fantasy-hq-nfl-expert-snapshot-1';
  const name=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const position=v=>['DEF','D/ST','DST'].includes(String(v).toUpperCase())?'DST':String(v||'').toUpperCase();
  const rank=v=>Number.isInteger(v)&&v>0?v:null;
  function create(snapshot) {
    if(snapshot?.schema!==SCHEMA||snapshot.sport!=='nfl'||snapshot.season!==2026||!Array.isArray(snapshot.records))throw Error('Unsupported NFL expert snapshot');
    const grouped=new Map();
    for(const row of snapshot.records) {
      const identity=row.identity,id=identity?.canonicalPlayerId;
      if(!id||!['MATCHED','ALIAS_MATCH'].includes(identity.status))continue;
      const rows=grouped.get(String(id))||[];rows.push(row);grouped.set(String(id),rows);
    }
    function lookup(player,model={}) {
      if((model.sport&&model.sport!=='nfl')||(model.snapshot?.league?.gameCode&&model.snapshot.league.gameCode!=='nfl'))return null;
      const season=model.snapshot?.league?.season;
      if(season&&Number(season)!==snapshot.season)return null;
      const status=player?.identity?.status;
      if(status&&!['MATCHED','ALIAS_MATCH'].includes(status))return null;
      const id=String(player?.identity?.canonicalPlayerId||player?.canonicalPlayerId||player?.playerId||player?.id||'');
      const rows=grouped.get(id);
      if(!rows?.length)return null;
      const p=position(player.position||player.pos);
      if(rows.some(r=>r.position!==p || name(r.identity.canonicalName)!==name(player.identity?.canonicalName||player.name)))return null;
      for(const provider of ['yahoo','sleeper']) {
        const supplied=player.externalIds?.[provider]||player[`${provider}PlayerId`];
        if(supplied&&rows.some(r=>r.identity.providerIds?.[provider]&&String(supplied)!==String(r.identity.providerIds[provider])))return null;
      }
      const overallRows=rows.filter(r=>r.dataset==='Overall'),positionalRows=rows.filter(r=>r.dataset===p);
      if(overallRows.length>1||positionalRows.length>1)return null;
      const overall=overallRows[0]||null,positional=positionalRows[0]||null;
      return {overall,positional,source:snapshot.source,snapshotDate:snapshot.sourceSnapshotDate,
        throughWeek:snapshot.throughWeek,season:snapshot.season,scope:snapshot.scope,scoringFormat:snapshot.scoringFormat,
        // Never expose a fabricated score or use source FPTS as live projection evidence.
        recommendationAuthority:false,weeklyProjectedPoints:null,restOfSeasonValue:null};
    }
    function summary(player,model) {
      const info=lookup(player,model);
      if(!info)return null;
      const o=info.overall,p=info.positional,parts=['User expert snapshot'];
      if(rank(o?.overallRank))parts.push(`Overall #${o.overallRank}`);
      if(rank(p?.positionRank))parts.push(`${p.position} #${p.positionRank}`);
      if(rank(o?.positionRank)&&(!p||o.positionRank!==p.positionRank))parts.push(`Overall-list ${o.position} #${o.positionRank}`);
      if(o?.tier)parts.push(`Tier ${o.tier}`);
      if(o?.movement!==null&&o?.movement!==undefined)parts.push(`Movement ${o.movement>0?'+':''}${o.movement}`);
      parts.push(`2026 through Week ${info.throughWeek}; date unknown; scope/scoring unknown`);
      return parts.join(' • ');
    }
    function facts(player,model) {
      const info=lookup(player,model);
      if(!info)return [['Expert rankings','No safely matched entry in the user Week 6 snapshot.']];
      const o=info.overall,p=info.positional,show=v=>v===null||v===undefined?'Unavailable':String(v);
      return [
        ['Overall expert rank',show(o?.overallRank)],['Positional expert rank (position file)',show(p?.positionRank)],
        ['Positional rank (Overall file)',show(o?.positionRank)],['Overall tier',show(o?.tier)],
        ['Rank movement',show(o?.movement)],['Overall ordering label',show(o?.rankingColumnLabel)],
        ['Separate Overall Expert Average value',show(o?.expertRankings?.expertAverage)],
        ['Positional Expert Average column',show(p?.expertRankings?.expertAverage)],
        ...(player.position==='TE'||player.pos==='TE'?[['Avery Huffman',show(p?.expertRankings?.averyHuffman)],['Zach Savage',show(p?.expertRankings?.zachSavage)]]:[]),
        ['Source FPTS (not weekly projection)',show(o?.statistics?.fantasyPoints)],
        ['Source actual positional finish',show(o?.statistics?.positionalFinish)],
        ['Source actual overall finish',show(o?.statistics?.overallFinish)],
        ['Source snap %',show(o?.statistics?.snapPercentage)],['Source games played',show(o?.statistics?.played)],
        ['Source team (not roster authority)',show(o?.statistics?.team)],
        ['Ranking provenance',`${info.source}; 2026 through Week ${info.throughWeek}; snapshot date unknown; not independently verified.`],
        ['Scope / scoring','Unknown / unknown. No weekly or ROS valuation authority; no confirmed half-PPR compatibility.'],
        ['Comparison rule','Overall and positional rankings remain independent. Current Yahoo availability, projections and lineup locks take precedence.'],
      ];
    }
    return Object.freeze({lookup,summary,facts});
  }
  return Object.freeze({SCHEMA,create});
});
