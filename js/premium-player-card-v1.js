(function(root){
  'use strict';
  const POSITIONS=new Set(['QB','RB','WR','TE','K','DST']);
  const text=value=>String(value??'').trim();
  const positionOf=value=>{const normalized=text(value).toUpperCase().replace(/[.\s_-]/g,'');return ['DST','D/ST','DEF','DEFENSE'].includes(normalized)?'DST':POSITIONS.has(normalized)?normalized:'GENERIC'};
  const safeNumber=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
  const imageKey=player=>safeNumber(player?.id)!==null?String(player.id):'unknown';
  const exactImageUrl=player=>`assets/players/${imageKey(player)}.webp`;
  const positionFallbackUrl=position=>`assets/player-placeholders/${positionOf(position).toLowerCase()}.svg`;
  const genericFallbackUrl=()=>`assets/player-placeholders/generic.svg`;

  function traitsFor({player={},tier,sharinganStage,tierCliff}={}){
    const traits=[],position=positionOf(player.pos??player.position);
    const add=trait=>{if(trait&&!traits.includes(trait)&&traits.length<2)traits.push(trait)};
    if(sharinganStage==='eternal')add('Historic value fall');
    if(player.rookie===true)add('Rookie upside');
    if(tierCliff?.nearCliff===true)add('Scarce position');
    if((position==='TE'||position==='QB')&&(tier==='S'||tier==='A'))add('Positional edge');
    if(player.leagueBreaker===true)add('High-upside profile');
    if(tier==='S'||tier==='A')add('Starter-tier value');
    if(player.coreTarget===true)add('Core target');
    return traits;
  }

  function buildPlayerCardModel(context={}){
    const player=context.player||null;
    if(!player)return {empty:true,message:'No player recommendation is currently available.'};
    const position=positionOf(player.pos??player.position),tier=text(context.tier),mamba=safeNumber(context.mambaScore),bye=safeNumber(player.bye??player.byeWeek);
    const traits=traitsFor({player,tier,sharinganStage:context.sharinganStage,tierCliff:context.tierCliff}),portraitAvailable=context.portraitAvailable===true;
    return {
      empty:false,playerId:player.id??null,name:text(player.name)||'Unknown player',position,
      nflTeam:text(player.team??player.nflTeam),byeWeek:bye,tier:tier||null,mambaScore:mamba,
      rookie:player.rookie===true,imageKey:imageKey(player),exactImageUrl:exactImageUrl(player),
      imageUrl:portraitAvailable?exactImageUrl(player):positionFallbackUrl(position),positionFallbackUrl:positionFallbackUrl(position),
      genericFallbackUrl:genericFallbackUrl(),imageStatus:portraitAvailable?'exact-local':'position-fallback',fallbackStage:portraitAvailable?0:1,
      traits,availabilityLabel:text(context.availabilityLabel)||null,recommendationRank:Number(context.recommendationRank)||1,
      sharinganStage:text(context.sharinganStage)||'normal',coachingPhase:text(context.coachingPhase)||null,
      coachingHeadline:text(context.coachingHeadline)||null,comparisonMode:Boolean(context.comparisonMode)
    };
  }

  root.PremiumPlayerCardV1={buildPlayerCardModel,traitsFor,positionOf,imageKey,exactImageUrl,positionFallbackUrl,genericFallbackUrl};
})(typeof window!=='undefined'?window:globalThis);
