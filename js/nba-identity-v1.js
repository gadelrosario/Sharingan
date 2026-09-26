/* NBA-only identity boundary. No fetching, ranking, storage or NFL fallback. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FantasyHQNBAIdentityV1=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const providers=new Set(['yahoo','nba','sleeper','balldontlie']);
  const clean=value=>value==null?'':String(value).trim();
  function providerKey(provider,id){
    const value=clean(id);
    if(!providers.has(provider)||!/^\d+$/.test(value))throw Error('Unsupported NBA provider identity');
    return `nba:${provider}:${value}`;
  }
  function create({sport,authority,providerIds={},name='',team=null,positions=[]}){
    if(sport!=='nba')throw Error('NBA identity requires explicit nba sport');
    const ids={};
    for(const [provider,id] of Object.entries(providerIds)){providerKey(provider,id);ids[provider]=clean(id);}
    return {sport:'nba',canonicalId:providerKey(authority,ids[authority]),authority,providerIds:ids,name:clean(name),team:clean(team).toUpperCase()||null,positions:[...new Set(positions.map(p=>clean(p).toUpperCase()))]};
  }
  function index(players){
    const canonical=new Map(),aliases=new Map(),errors=[];
    for(const player of players){
      if(player.sport!=='nba'||player.canonicalId!==providerKey(player.authority,player.providerIds?.[player.authority]))throw Error('Invalid NBA canonical identity');
      if(canonical.has(player.canonicalId))errors.push(`Duplicate canonical: ${player.canonicalId}`);
      canonical.set(player.canonicalId,player);
      for(const [provider,id] of Object.entries(player.providerIds)){
        const key=providerKey(provider,id),rows=aliases.get(key)||[];rows.push(player);aliases.set(key,rows);
      }
    }
    for(const [key,rows] of aliases)if(rows.length>1)errors.push(`Duplicate provider: ${key}`);
    return {players:[...players],canonical,aliases,errors};
  }
  function match(source,registry){
    if(source.sport!=='nba')return {status:'UNRESOLVED',reason:'sport-mismatch'};
    if(registry.errors.length)return {status:'AMBIGUOUS',reason:'identity-collision'};
    const ids=Object.entries(source.providerIds||{});
    if(!ids.length)return {status:'UNRESOLVED',reason:'stable-provider-id-required'};
    const candidates=new Set();let missing=false;
    for(const [provider,id] of ids){
      const rows=registry.aliases.get(providerKey(provider,id))||[];
      if(!rows.length)missing=true;
      for(const row of rows)candidates.add(row.canonicalId);
    }
    if(candidates.size>1)return {status:'AMBIGUOUS',reason:'conflicting-provider-ids'};
    // New crosswalks require explicit verification; never attach a new ID by name.
    if(missing||candidates.size!==1)return {status:'UNRESOLVED',reason:'provider-crosswalk-required'};
    return {status:'MATCHED',player:registry.canonical.get([...candidates][0])};
  }
  return {providerKey,create,index,match};
});
