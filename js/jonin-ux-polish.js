/**
 * Jonin UX Polish presentation model.
 * Converts existing draft state and insight outputs into reusable view data.
 * It never ranks players or changes draft decisions.
 */
const JoninUXPolish = (() => {
  'use strict';

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const positionName = position => position === 'DST' ? 'D/ST' : position;

  function inferStrategy({counts = {}, round = 1, draftedCount = 0} = {}) {
    const rb = number(counts.RB), wr = number(counts.WR), picks = Math.max(number(draftedCount), rb + wr);
    if (picks < 3) return {name:'Balanced',confidence:Math.min(62,52+picks*5),note:'Draft still developing.'};
    if (rb === 0 && wr >= 2) return {name:'Zero RB',confidence:Math.min(94,68+wr*6),note:'Wide receiver volume is defining the build while running back remains open.'};
    if (rb === 1 && wr >= 2) return {name:'Hero RB',confidence:Math.min(94,70+wr*5),note:'One anchor running back is paired with early wide receiver depth.'};
    if (rb >= 2 && wr === 0 && round <= 5) return {name:'Balanced',confidence:64,note:'The early RB foundation is clear, but the full build is still developing.'};
    const balanceGap = Math.abs(rb-wr);
    return {name:'Balanced',confidence:Math.max(62,Math.min(90,82-balanceGap*6+picks)),note:balanceGap <= 1?'Running back and wide receiver investment remains balanced.':'Draft still developing.'};
  }

  function teamBuild({counts = {}, settings = {}} = {}) {
    const targets = {
      QB:number(settings.startQB ?? 1),RB:number(settings.startRB ?? 2),
      WR:number(settings.startWR ?? 3),TE:number(settings.startTE ?? 1)
    };
    const rows = Object.keys(targets).map(position => {
      const filled = Math.min(number(counts[position]), targets[position]);
      return {position,count:number(counts[position]),target:targets[position],filled,missing:Math.max(0,targets[position]-filled),complete:filled>=targets[position]};
    });
    const flexTarget = number(settings.flex ?? 2);
    const skillTotal = number(counts.RB)+number(counts.WR)+number(counts.TE);
    const requiredSkill = targets.RB+targets.WR+targets.TE;
    const flexFilled = Math.min(flexTarget,Math.max(0,skillTotal-requiredSkill));
    rows.push({position:'FLEX',count:flexFilled,target:flexTarget,filled:flexFilled,missing:Math.max(0,flexTarget-flexFilled),complete:flexFilled>=flexTarget});
    return rows;
  }

  function primaryDriver({player, breakdown = {}, vision} = {}) {
    const need = vision?.userNeed;
    if (vision?.tierCliff?.nearCliff) return {label:'Tier Cliff',reason:vision.tierCliff.reason};
    if (need?.starterNeed) return {label:'Roster Need',reason:need.reason};
    const value = number(breakdown.value), scarcity = number(breakdown.scarcity), fit = number(breakdown.rosterFit);
    if (value > 0 && value >= scarcity && value >= fit) return {label:'Elite Value',reason:`Existing value inputs add ${value} to ${player?.name || 'the recommendation'} at this pick.`};
    if (fit > 0 && fit >= scarcity) return {label:'Roster Fit',reason:`Existing roster-fit inputs add ${fit} for ${positionName(player?.pos) || 'this position'}.`};
    if (scarcity > 0) return {label:'Scarcity',reason:`Existing scarcity inputs add ${scarcity} as the position thins.`};
    return {label:'Best Available',reason:'Jonin’s existing final-pick score ranks this player first.'};
  }

  function hero({player, insight, breakdown, vision} = {}) {
    const confidence = Math.max(0,Math.min(100,number(insight?.confidence?.score)));
    return {
      playerId:player?.id,
      name:String(player?.name || 'Recommended player'),
      identity:`${positionName(player?.pos) || 'Position unavailable'} • ${player?.team || 'Team unavailable'}`,
      confidence,
      confidenceLabel:String(insight?.confidence?.label || 'Developing'),
      primary:primaryDriver({player,breakdown,vision})
    };
  }

  return {inferStrategy,teamBuild,primaryDriver,hero};
})();

if (typeof window !== 'undefined') window.JoninUXPolish = JoninUXPolish;
