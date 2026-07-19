/**
 * Sharingan Vision V1
 * Deterministic current-state forecast. It never simulates alternate drafts or ranks players.
 */
const SharinganVisionV1 = (() => {
  'use strict';

  const TIERS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
  const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
  const finiteNumber = value => value == null || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) ? null : Number(value);
  const tierOf = player => {
    const raw = player?.overallTier ?? player?.posTier;
    const tier = raw == null ? '' : String(raw).trim().toUpperCase();
    return TIERS.includes(tier) ? tier : null;
  };
  const positionOf = player => player?.pos === 'DEF' ? 'DST' : player?.pos;
  const nameOf = player => String(player?.name ?? '').trim() || 'Recommended player';
  const emptyCounts = () => ({QB:0,RB:0,WR:0,TE:0,K:0,DST:0});
  const starterTargets = {QB:1,RB:2,WR:3,TE:1};
  const depthTargets = {QB:1,RB:4,WR:5,TE:1};

  function rosterPositionCounts({history = [], players = [], team}) {
    const counts = emptyCounts();
    const playerById = new Map(players.map(player => [String(player?.id), player]));
    history.filter(pick => String(pick?.team) === String(team)).forEach(pick => {
      const position = positionOf(playerById.get(String(pick?.id)));
      if (Object.prototype.hasOwnProperty.call(counts, position)) counts[position]++;
    });
    return counts;
  }

  function rosterConstruction(counts = {}) {
    const value = position => finiteNumber(counts?.[position]) ?? 0;
    const unfilled = Object.keys(starterTargets).filter(position => value(position) < starterTargets[position]);
    let liveRead = 'Balanced';
    if (value('QB') >= 2) liveRead = 'QB hoarding';
    else if (value('WR') >= 5 && value('WR') > value('RB')) liveRead = 'WR heavy';
    else if (value('RB') >= 5 && value('RB') > value('WR')) liveRead = 'RB heavy';
    else if (value('TE') >= 3) liveRead = 'TE hoarding';
    else if (value('WR') > value('RB') + 1) liveRead = 'WR leaning';
    else if (value('RB') > value('WR') + 1) liveRead = 'RB leaning';
    return {counts:{...emptyCounts(),...counts},unfilledStarterPositions:unfilled,liveRead};
  }

  function assessUserNeed({position, counts}) {
    if (!SKILL_POSITIONS.has(position) || !counts || typeof counts !== 'object') return {position,status:'Unavailable',starterNeed:false,count:null,unfilledStarterPositions:[],reason:'Personal roster-need guidance is unavailable.'};
    const state = rosterConstruction(counts);
    const count = finiteNumber(counts?.[position]) ?? 0;
    const starterNeed = count < starterTargets[position];
    const status = starterNeed ? 'Starter need' : count < depthTargets[position] ? 'Depth option' : 'Filled';
    const attention = state.unfilledStarterPositions.length ? ` Attention should shift toward unfilled ${state.unfilledStarterPositions.join(', ')} starter positions.` : '';
    const reason = starterNeed ? `${position} remains a personal starter need (${count}/${starterTargets[position]} filled).` : `${position} is not a personal starter need (${count} rostered).${attention}`;
    return {...state,position,status,starterNeed,count,reason};
  }

  function detectTierCliff({player, availablePlayers = []}) {
    const position = positionOf(player);
    const currentTier = tierOf(player);
    if (!SKILL_POSITIONS.has(position) || !currentTier || !Array.isArray(availablePlayers)) {
      return {available:false,currentTier:currentTier || 'Unknown',nextTier:'Unknown',remainingInTier:null,nearCliff:false,reason:'Tier-cliff guidance is unavailable because position or tier data is incomplete.'};
    }
    const positionPool = availablePlayers.filter(item => positionOf(item) === position && item?.id !== player?.id);
    const remainingInTier = positionPool.filter(item => tierOf(item) === currentTier).length;
    const currentIndex = TIERS.indexOf(currentTier);
    const next = positionPool.map(item => tierOf(item)).filter(Boolean).sort((a,b) => TIERS.indexOf(a)-TIERS.indexOf(b)).find(tier => TIERS.indexOf(tier) > currentIndex) || null;
    const nearCliff = remainingInTier <= 1 && Boolean(next);
    const nextTier = next || 'No lower tier visible';
    const reason = nearCliff
      ? `${remainingInTier} other ${currentTier}-tier ${position} option${remainingInTier === 1 ? '' : 's'} ${remainingInTier === 1 ? 'remains' : 'remain'} before the ${nextTier} tier.`
      : `${remainingInTier} other ${currentTier}-tier ${position} option${remainingInTier === 1 ? '' : 's'} ${remainingInTier === 1 ? 'remains' : 'remain'}; the next visible tier is ${nextTier}.`;
    return {available:true,currentTier,nextTier,remainingInTier,nearCliff,reason};
  }

  function detectPositionalRun({position, recentPicks = [], windowSize = 8}) {
    if (!SKILL_POSITIONS.has(position)) return {position,count:0,windowSize,state:'None',active:false,reason:'Run detection is unavailable for this position.'};
    const sample = recentPicks.slice(-windowSize);
    const count = sample.filter(player => positionOf(player) === position).length;
    const state = count >= 4 ? 'Active run' : count >= 2 ? 'Movement' : 'No run';
    const reason = sample.length ? `${count} ${position}${count === 1 ? '' : 's'} selected in the last ${sample.length} picks: ${state.toLowerCase()}.` : `No recent picks are available; no ${position} run is detected.`;
    return {position,count,windowSize:sample.length,state,active:count >= 4,reason};
  }

  function assessTeamNeeds({position, teamsBeforeNext = []}) {
    if (!SKILL_POSITIONS.has(position) || !Array.isArray(teamsBeforeNext)) return {teams:0,starterNeeds:0,depthNeeds:0,reason:'Team-need guidance is unavailable.'};
    const starterTarget = starterTargets[position];
    const depthTarget = depthTargets[position];
    let starterNeeds = 0, depthNeeds = 0;
    teamsBeforeNext.forEach(team => {
      const count = finiteNumber(team?.counts?.[position]) ?? 0;
      if (count < starterTarget) starterNeeds++;
      else if (count < depthTarget) depthNeeds++;
    });
    const reason = starterNeeds ? `${starterNeeds} of ${teamsBeforeNext.length} teams before your next pick still need a starting ${position}; ${depthNeeds} more have room for depth.` : `No intervening team has an unfilled ${position} starter slot; ${depthNeeds} may still draft ${position} depth.`;
    return {teams:teamsBeforeNext.length,starterNeeds,depthNeeds,reason};
  }

  function availabilityForecast({player, availablePlayers = [], picksUntil = 0, tierCliff, run, teamNeeds}) {
    const position = positionOf(player);
    const turns = Math.max(0, finiteNumber(picksUntil) ?? 0);
    const samePosition = availablePlayers.filter(item => positionOf(item) === position && item?.id !== player?.id);
    const rank = finiteNumber(player?.overall);
    const nearbyDepth = rank == null ? null : samePosition.filter(item => {
      const otherRank = finiteNumber(item?.overall);
      return otherRank != null && otherRank > 0 && Math.abs(otherRank-rank) <= Math.max(6,turns);
    }).length;
    let urgency = 0;
    if (tierCliff?.nearCliff) urgency += 3;
    if (run?.active && teamNeeds?.starterNeeds > 0) urgency += 2;
    else if (run?.count >= 2 && (teamNeeds?.starterNeeds > 0 || teamNeeds?.depthNeeds > 0)) urgency += 1;
    if (teamNeeds?.starterNeeds >= 3) urgency += 2; else if (teamNeeds?.starterNeeds > 0) urgency += 1;
    if (turns >= 7) urgency += 1;
    if (nearbyDepth === 0) urgency += 2; else if (nearbyDepth != null && nearbyDepth <= 2) urgency += 1;
    const label = urgency >= 7 ? 'Unlikely Available' : urgency >= 5 ? 'Uncertain' : urgency >= 3 ? 'Likely Available' : 'Very Likely Available';
    const demand = teamNeeds?.starterNeeds > 0 ? `${teamNeeds.starterNeeds} upcoming starter needs` : `${teamNeeds?.depthNeeds ?? 0} possible depth buyers and no upcoming starter needs`;
    const reason = `${tierCliff?.remainingInTier ?? 'Unknown'} same-tier alternatives, ${run?.count ?? 0} recent ${position} picks, ${demand}, and ${turns} picks until your turn.`;
    return {label,urgency,nearbyDepth,reason};
  }

  function opportunityWindow({forecast, tierCliff, run, teamNeeds}) {
    let label;
    if (forecast.label === 'Unlikely Available' || (tierCliff?.nearCliff && (teamNeeds?.starterNeeds >= 3 || (run?.active && teamNeeds?.starterNeeds > 0)))) label = 'Draft Now';
    else if (forecast.label === 'Uncertain' || tierCliff?.nearCliff || run?.count >= 2 || teamNeeds?.starterNeeds >= 2) label = 'Risky To Wait';
    else label = 'Probably Safe To Wait';
    const conflict = run?.active && teamNeeds?.starterNeeds === 0 ? ` A ${run.position} run is active, but no intervening team has an unfilled starter slot. Depth demand may continue; immediate starter pressure is limited.` : '';
    const reason = `${forecast.reason} ${tierCliff?.nearCliff ? 'A tier cliff increases urgency.' : 'No immediate tier cliff is detected.'}${conflict}`;
    return {label,reason};
  }

  function whyNow({player, breakdown = {}, tierCliff, run, teamNeeds, userNeed}) {
    const position = positionOf(player) || 'position';
    return [
      {label:'Value',text:Number(breakdown.value || 0) ? `Existing value modifiers contribute ${Number(breakdown.value)} to the current final-pick score.` : 'The existing value modifier is neutral.'},
      {label:'Scarcity',text:Number(breakdown.scarcity || 0) ? `Existing room scarcity contributes ${Number(breakdown.scarcity)} to the current final-pick score.` : 'The existing room-scarcity modifier is neutral.'},
      {label:'Tier cliff',text:tierCliff?.reason || 'Tier-cliff guidance is unavailable.'},
      {label:'Positional run',text:run?.reason || 'Positional-run guidance is unavailable.'},
      {label:'Roster needs',text:`${userNeed?.reason || 'Personal roster-need guidance is unavailable.'} ${teamNeeds?.reason || `Upcoming ${position} roster needs are unavailable.`}`}
    ];
  }

  function whyNot({recommended, candidates = []}) {
    const primary = candidates.find(item => item.player?.id === recommended?.id) || candidates[0];
    const alternative = candidates.find(item => item.player?.id !== recommended?.id);
    if (!alternative) return {alternative:null,scoreDifference:0,preferred:'No available alternative has enough data for a comparison.',alternativeStrength:'No comparison available.',alternativeWeakness:'No comparison available.'};
    const difference = Number(primary?.finalScore || 0)-Number(alternative.finalScore || 0);
    const dimensions = [['projection','projection'],['value','value'],['rosterFit','roster fit'],['scarcity','scarcity']];
    const stronger = dimensions.filter(([key])=>Number(alternative.breakdown?.[key]||0)>Number(primary?.breakdown?.[key]||0)).map(([,label])=>label);
    const weaker = dimensions.filter(([key])=>Number(alternative.breakdown?.[key]||0)<Number(primary?.breakdown?.[key]||0)).map(([,label])=>label);
    return {
      alternative:alternative.player,
      scoreDifference:difference,
      preferred:difference>0?`${nameOf(recommended)} leads the existing final-pick score by ${difference}.`:`${nameOf(recommended)} wins the existing recommendation tie-breakers.`,
      alternativeStrength:stronger.length?`${nameOf(alternative.player)} is stronger in ${stronger.slice(0,2).join(' and ')}.`:`${nameOf(alternative.player)} has no clear component advantage.`,
      alternativeWeakness:weaker.length?`${nameOf(alternative.player)} trails in ${weaker.slice(0,2).join(' and ')}.`:'The two options are effectively even across the visible components.'
    };
  }

  function forecast(input) {
    const player = input.player;
    const position = positionOf(player);
    const tierCliff = detectTierCliff({player,availablePlayers:input.availablePlayers});
    const run = detectPositionalRun({position,recentPicks:input.recentPicks});
    const teamNeeds = assessTeamNeeds({position,teamsBeforeNext:input.teamsBeforeNext});
    const userNeed = assessUserNeed({position,counts:input.userCounts});
    const availability = availabilityForecast({player,availablePlayers:input.availablePlayers,picksUntil:input.picksUntil,tierCliff,run,teamNeeds});
    return {
      player,tierCliff,run,teamNeeds,userNeed,availability,
      opportunity:opportunityWindow({forecast:availability,tierCliff,run,teamNeeds}),
      whyNow:whyNow({player,breakdown:input.breakdown,tierCliff,run,teamNeeds,userNeed}),
      whyNot:whyNot({recommended:player,candidates:input.candidates})
    };
  }

  return {forecast,detectTierCliff,detectPositionalRun,assessTeamNeeds,assessUserNeed,rosterPositionCounts,rosterConstruction,availabilityForecast,opportunityWindow,whyNow,whyNot};
})();

if (typeof window !== 'undefined') window.SharinganVisionV1 = SharinganVisionV1;
