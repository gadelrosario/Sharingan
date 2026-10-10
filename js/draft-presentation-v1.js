/* Shared NFL draft presentation. Models, ownership and decisions stay in sport adapters. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.DraftPresentationV1=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fightCard({p,card={},score,tier,confidence,tags=[],label,portrait,stage={key:""},recommended=true,position,injury="",stageIcon="",confidenceMarkup="",returnId,safeInsightText=escape,scoreLabel="MAMBA SCORE",scorePrefix="♛ "}){
  return `<article class="compactFightCard ${recommended ? 'recommendedDecision' : 'playerViewDecision'} stage-${safeInsightText(stage.key)}" data-selected-player-id="${safeInsightText(p.id)}" aria-live="polite"><div class="fightPlayerVisual"><img src="${safeInsightText(portrait)}" loading="lazy" decoding="async" data-position-fallback="${safeInsightText(card.positionFallbackUrl || 'assets/player-placeholders/generic.svg')}" data-generic-fallback="${safeInsightText(card.genericFallbackUrl || 'assets/player-placeholders/generic.svg')}" data-fallback-stage="${safeInsightText(card.fallbackStage ?? 1)}" data-player-name="${safeInsightText(p.name)}" alt="Portrait of ${safeInsightText(p.name)}" onerror="handlePlayerPortraitError(this)"><span aria-hidden="true">${safeInsightText(position)}</span></div><div class="fightPlayerContent"><div class="fightPlayerLabel">${label}</div><h2>${safeInsightText(p.name)}</h2><p>${safeInsightText(position)} • ${safeInsightText(p.team || 'Team unavailable')} ${injury}</p><div class="fightMetrics"><span><small>TIER</small><b>${safeInsightText(tier)}</b></span><span><small>${scoreLabel}</small><b>${scorePrefix}${safeInsightText(score)}</b></span></div><div class="sharinganStage stage-${safeInsightText(stage.key)}">${stageIcon}<span>${safeInsightText(stage.label)} • ${safeInsightText(stage.meaning)}</span></div><div class="fightTags">${tags.map(tag => `<span title="${safeInsightText(tag.label)}"><i aria-hidden="true">${tag.icon}</i>${safeInsightText(tag.label)}</span>`).join('')}</div>${confidenceMarkup}${recommended ? '' : `<button type="button" class="returnRecommendation" onclick="selectCandidate(${returnId})">Return to top recommendation</button>`}</div></article>`;
}
function alternative({p,card={},tier,score,confidence=0,tags=[],active=false,portrait,rank,categoryLabel,position,safeInsightText=escape,scorePrefix="♛ ",confidenceText=null}){
  return `<article class="recommendationPlayerCard ${active ? 'active' : ''}" data-testid="recommendation-card-${safeInsightText(p.id)}" data-player-id="${safeInsightText(p.id)}"><span class="recommendationCategory">${safeInsightText(categoryLabel)}</span><span class="recommendationRank">${rank}</span><div class="recommendationPortrait"><img src="${safeInsightText(portrait)}" loading="lazy" decoding="async" data-position-fallback="${safeInsightText(card.positionFallbackUrl || 'assets/player-placeholders/generic.svg')}" data-generic-fallback="${safeInsightText(card.genericFallbackUrl || 'assets/player-placeholders/generic.svg')}" data-fallback-stage="${safeInsightText(card.fallbackStage ?? 1)}" data-player-name="${safeInsightText(p.name)}" alt="" onerror="handlePlayerPortraitError(this)"></div><div class="recommendationCardIdentity"><b>${safeInsightText(p.name)}</b><small>${safeInsightText(position)} • ${safeInsightText(p.team || '—')}</small><span>Tier ${safeInsightText(tier)} • ${scorePrefix}${safeInsightText(score)}</span></div><div class="recommendationIcons">${tags.map(tag => `<i title="${safeInsightText(tag.label)}" aria-label="${safeInsightText(tag.label)}">${tag.icon}</i>`).join('')}</div><div class="recommendationStars" aria-label="${safeInsightText(confidence)} confidence">${confidenceText??('★'.repeat(Math.max(1,Math.min(5,Math.round(confidence/20))))+'☆'.repeat(5-Math.max(1,Math.min(5,Math.round(confidence/20)))))}</div><div class="recommendationActions"><button type="button" class="viewRecommendation" aria-pressed="${active}" onclick="viewRecommendationPlayer(${p.id})">View</button><button type="button" class="draftRecommendation" onclick="draftRecommendationPlayer(${p.id})">Draft</button></div></article>`;
}
function playerRow({player,rankLabel,decisionTier,ownerLabel,position,photo="",injury="",excluded="",safeInsightText=escape}){
        return `
          <div class="playerRow fast" data-player-id="${player.id}">
            <div class="meta">${rankLabel}</div>

            <button type="button" class="searchResultPlayer" onclick="selectCandidate(${player.id})">
              ${photo}
              <span class="searchResultIdentity">
              <b
                class="scanLink"
              >
                ${safeInsightText(player.name)}
              </b>

              <div class="meta">
                ${position}
                • ${safeInsightText(player.team || '—')}
                • Decision Tier ${decisionTier}
                ${injury}
              </div>
              </span>
            </button>

            ${excluded}

            <button
              class="autoPickBtn"
              onclick="recordCurrentPick(${player.id})"
            >
              ${ownerLabel}
            </button>
          </div>
        `;
}
function cloneShell(source){
 const screen=source.cloneNode(true);screen.classList.remove('hidden');
 for(const n of [screen,...screen.querySelectorAll('*')]){
  if(n.id){n.dataset.draftSlot=n.id;n.id='nba-'+n.id;}
  for(const a of [...n.attributes])if(a.name.startsWith('on'))n.removeAttribute(a.name);
 }
 for(const n of screen.querySelectorAll('[aria-labelledby],[aria-controls],[for]'))for(const attr of ['aria-labelledby','aria-controls','for'])if(n.hasAttribute(attr))n.setAttribute(attr,n.getAttribute(attr).split(' ').map(id=>'nba-'+id).join(' '));
 return screen;
}
function trackerTable({starters,bench,teamLabel='NFL',lastLabel='BYE'}){return `<table class="liveTeamTable"><thead><tr><th>SLOT</th><th>PLAYER</th><th>${escape(teamLabel)}</th><th>TIER</th><th>${escape(lastLabel)}</th></tr></thead><tbody><tr class="trackerSection"><th colspan="5">STARTERS</th></tr>${starters}<tr class="trackerSection"><th colspan="5">BENCH</th></tr>${bench || '<tr class="emptyTrackerRow"><td>BN</td><td>Empty</td><td>—</td><td>—</td><td>—</td></tr>'}</tbody></table>`;}
return {escape,fightCard,alternative,playerRow,cloneShell,trackerTable};
});
