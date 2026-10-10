/* Read-only NBA metadata normalization; isolated from NFL state. */
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./nba-identity-v1'):root.FantasyHQNBAIdentityV1);if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FantasyHQYahooNBAV1=api;})(typeof window!=='undefined'?window:globalThis,function(identity){
  'use strict';
  const clean=value=>value==null?'':String(value).trim();
  const positions=new Set(['PG','SG','G','SF','PF','F','C','UTIL','BN','IL','IL+']);
  function position(value){const normalized=clean(value).toUpperCase();if(!positions.has(normalized))throw Error('Unsupported NBA position');return normalized;}
  const merge=value=>Array.isArray(value)?Object.assign({},...value.filter(v=>v&&!Array.isArray(v)&&typeof v==='object')):value||{};
  function records(value,key){
    if(!value||typeof value!=='object')return [];
    const found=[];
    for(const [k,v] of Object.entries(value)){if(k===key)found.push(v);else found.push(...records(v,key));}
    return found;
  }
  function assertGame(game){if(game?.code!=='nba'||!/^\d+$/.test(clean(game.game_key)))throw Error('Verified NBA game metadata required');}
  function player(raw,game){
    assertGame(game);
    const row=merge(Array.isArray(raw)?raw[0]:raw),id=clean(row.player_id);
    if(row.player_key!==`${game.game_key}.p.${id}`||row.editorial_player_key!==`nba.p.${id}`)throw Error('Yahoo NBA player namespace mismatch');
    const positions=(row.eligible_positions||[]).map(p=>position(p.position));
    const result=identity.create({sport:'nba',authority:'yahoo',providerIds:{yahoo:id},name:row.name?.full,team:row.editorial_team_abbr,positions});
    return {...result,yahooPlayerId:id,yahooPlayerKey:row.player_key,yahooEditorialPlayerKey:row.editorial_player_key,gameKey:clean(game.game_key),season:clean(game.season),fantasyStatus:typeof row.status==='string'?row.status:null,active:null,identityMetadata:{uniformNumber:clean(row.uniform_number)||null,primaryPosition:clean(row.primary_position)||null,source:'Yahoo'},ownership:'UNKNOWN',rosterSlot:clean(merge(records(raw,'selected_position')[0]).position)||null};
  }
  function gamePlayers(payload){
    const parts=payload?.fantasy_content?.game,game=parts?.[0];assertGame(game);
    const players=records(parts.slice(1),'player').map(raw=>player(raw,game)),registry=identity.index(players);
    if(registry.errors.length)throw Error(registry.errors.join('; '));
    // A page is never asserted to be the complete player universe.
    return {sport:'nba',gameKey:clean(game.game_key),season:clean(game.season),players,coverage:'PAGE_ONLY'};
  }
  function leagueSettings(payload,game){
    assertGame(game);
    const parts=payload?.fantasy_content?.league,league=parts?.[0],key=clean(league?.league_key);
    if(!key.startsWith(`${game.game_key}.l.`))throw Error('NBA league/game mismatch');
    const settings=merge(records(parts.slice(1),'settings')[0]);
    return {sport:'nba',leagueKey:key,gameKey:clean(game.game_key),season:clean(game.season),startDate:clean(league.start_date),endDate:clean(league.end_date),profileKey:`nba:yahoo:${key}`,name:clean(league.name),teamCount:Number(league.num_teams)||null,scoringType:clean(settings.scoring_type||league.scoring_type),draftStatus:clean(league.draft_status),draft:{type:clean(settings.draft_type),time:clean(settings.draft_time)||null,pickSeconds:Number(settings.draft_pick_time)||null,auction:clean(settings.is_auction_draft)==='1',order:null},pointRules:records(settings.stat_modifiers,'stat').map(raw=>{const r=merge(raw);return {id:clean(r.stat_id),weight:r.value==null||clean(r.value)===''?null:Number(r.value),bonuses:r.bonuses||r.bonus||null,unsupportedFields:Object.keys(r).filter(k=>!['stat_id','value','bonuses','bonus'].includes(k))};}),rosterSlots:records(settings.roster_positions,'roster_position').map(raw=>{const r=merge(raw),count=Number(r.count);if(r.count==null||clean(r.count)===''||!Number.isSafeInteger(count)||count<0)throw Error('Invalid NBA roster slot count');return {position:position(r.position),count};}),categories:records(settings.stat_categories,'stat').map(raw=>{const r=merge(raw);return {id:clean(r.stat_id),label:clean(r.display_name),enabled:r.enabled===1||r.enabled==='1',displayOnly:r.is_only_display_stat===1||r.is_only_display_stat==='1'};})};
  }
  function normalizeBundle(bundle){
    assertGame(bundle.game);
    if(bundle.sport!=='nba'||bundle.coverage!=='COMPLETE')throw Error('Complete NBA universe required');
    const settings=leagueSettings(bundle.settings,bundle.game),all=[];
    if(settings.leagueKey!==bundle.selection?.leagueKey||(bundle.userTeam?.team_key&&!bundle.userTeam.team_key.startsWith(settings.leagueKey+'.t.')))throw Error('NBA selected league/team mismatch');
    for(const page of bundle.pages||[]){
      for(const raw of records(page,'player')){
        const p=player(raw,bundle.game),ownership=merge(records(raw,'ownership')[0]),type=clean(ownership.ownership_type).toLowerCase();
        p.ownership=type==='team'?'ROSTERED':type==='freeagents'?'FREE_AGENT':type==='waivers'?'WAIVERS':'UNKNOWN';
        p.ownershipSource='Yahoo';p.ownershipFetchedAt=bundle.fetchedAt;
        all.push(p);
      }
    }
    const registry=identity.index(all);if(registry.errors.length||all.length!==bundle.universeCount)throw Error('NBA universe identity/count conflict');
    const roster=records(bundle.roster,'player').map(raw=>player(raw,bundle.game));
    const rosterIndex=identity.index(roster);if(rosterIndex.errors.length)throw Error('NBA roster identity conflict');
    for(const p of roster){const universe=registry.canonical.get(p.canonicalId);if(!universe||universe.yahooPlayerKey!==p.yahooPlayerKey)throw Error('NBA roster/universe conflict');universe.ownership='ROSTERED';p.ownership='ROSTERED';}
    return {sport:'nba',settings,players:all,roster,userTeam:bundle.userTeam,
      rosterState:bundle.rosterStatus!=='AVAILABLE'?'UNKNOWN':roster.length?'AVAILABLE':settings.draftStatus==='predraft'?'PREDRAFT_NO_ROSTER':'EMPTY',
      fetchedAt:bundle.fetchedAt,coverage:'COMPLETE'};
  }
  return {player,gamePlayers,leagueSettings,normalizeBundle};
});
