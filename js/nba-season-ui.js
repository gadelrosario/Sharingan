/* Separate NBA view overlays the existing shell without changing NFL state. */
(function(root){
  'use strict';
  const base='https://localhost:8788';
  let screen=null,content=null,selection=null,leagues=[],model=null;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
  const note=text=>el('p','seasonTrustNote',text);
  async function request(path){const r=await fetch(base+path,{cache:'no-store'});if(!r.ok)throw Error(`NBA bridge unavailable (${r.status})`);return r.json();}
  function render(stats){
    content.replaceChildren();
    const summary=el('section','seasonPanel');summary.append(el('h2','',model.settings.name),note(`${model.settings.teamCount} teams • ${model.settings.scoringType} category format • Yahoo season ${model.settings.season} • ${model.settings.draftStatus} • Synced ${model.fetchedAt}`),note(`Roster: ${model.userTeam?.name||'User team unresolved'} • ${model.rosterState} • ${model.roster.length} players`),note('Roster positions: '+model.settings.rosterSlots.map(s=>`${s.position} × ${s.count}`).join(', ')));
    const mapped=FantasyHQNBASeasonV1.categoryMap(model.settings);summary.append(note('Yahoo scoring categories: '+mapped.map(c=>`${c.label}: ${c.status}`).join(' • ')));content.append(summary);
    let evidence=[];try{const current=FantasyHQNBASeasonV1.currentEvidence(stats,model.settings);evidence=current.evidence;summary.append(note(`${current.status} • NBA ${current.season.nbaSeason} • source ending year ${current.season.endingYear}`));}catch(error){summary.append(note('Statistical evidence rejected: '+error.message));}
    summary.append(note(evidence.length?'Current regular-season statistical evidence; source dates, sample and identity authority retained.':'No accepted current-season observations. Historical or partial records are not displayed.'));
    const players=FantasyHQNBASeasonV1.reconcile(model.players,evidence),counts={};players.forEach(p=>counts[p.ownership]=(counts[p.ownership]||0)+1);
    summary.append(note(`Yahoo universe: ${players.length} • ${Object.entries(counts).map(([k,v])=>`${k}: ${v}`).join(' • ')}. Yahoo alone supplies ownership.`),note(`Identity mappings: ${players.filter(p=>p.mapping==='DIRECT_ID').length} DIRECT_ID; ${players.filter(p=>p.mapping==='UNRESOLVED').length} UNRESOLVED; ${players.filter(p=>p.mapping==='CONFLICT').length} CONFLICT; 0 MULTI_FIELD_CONFIRMED. No automatic name merges.`));
    const controls=el('section','seasonPanel'),search=el('input');search.type='search';search.placeholder='Search NBA players';search.setAttribute('aria-label','Search NBA players');const scope=el('select');scope.setAttribute('aria-label','NBA player scope');for(const name of ['Universe','Roster']){const option=el('option','',name);scope.append(option);}controls.append(search,scope);content.append(controls);
    const list=el('section','seasonPanel');content.append(list);
    function draw(){list.replaceChildren();const rosterIds=new Set(model.roster.map(p=>p.canonicalId)),found=players.filter(p=>(scope.value!=='Roster'||rosterIds.has(p.canonicalId))&&p.name.toLowerCase().includes(search.value.toLowerCase()));
      list.append(note(`${found.length} matching players • showing up to 30, alphabetical • no recommendation ranking`));
      if(!found.length)list.append(note(model.rosterState==='PREDRAFT_NO_ROSTER'?'Predraft: Yahoo provides no roster. No roster has been fabricated.':'No matching players.'));
      found.sort((a,b)=>a.name.localeCompare(b.name)).slice(0,30).forEach(p=>{const card=el('article','seasonPanel');card.append(el('h3','',p.name),note(`${p.team||'Team unknown'} • ${p.positions.join('/')} • ${p.ownership}`),note(`${p.canonicalId} • Yahoo key ${p.yahooPlayerKey} • Editorial ${p.yahooEditorialPlayerKey}`),note(`Statistics: ${p.mapping} • ${p.mappingReason||p.mappingBasis}`));
        for(const stat of p.statistics||[]){card.append(note(`Source ${stat.provenance.source} • season ending ${stat.seasonEndingYear} • source season type ${stat.seasonType} • ${stat.window.from}–${stat.window.through} • ${stat.gamesPlayed} played / ${stat.observations} observations`),note(mapped.map(c=>`${c.label}: ${c.status==='UNSUPPORTED'?'Unsupported':stat.values[c.field||c.label]??'Missing'}`).join(' • ')));}
        if(!p.statistics)card.append(note('No verified Yahoo ↔ ESPN statistical join. Stats remain missing; no projection or recommendation.'));list.append(card);});}
    search.oninput=draw;scope.onchange=draw;draw();
    const attribution=el('footer','seasonAttribution');attribution.append(note('Fantasy data: Yahoo. Statistical source: SportsDataverse / hoopR, CC BY 4.0.'));const link=el('a','','Source and license');link.href='https://github.com/sportsdataverse/hoopR-nba-data/blob/main/LICENSE.md';attribution.append(link);content.append(attribution);
  }
  async function load(refresh=false){if(!selection.value)return;content.replaceChildren(note('Loading Yahoo NBA foundation…'));try{const [raw,stats]=await Promise.all([request('/api/yahoo/nba/snapshot?league_key='+encodeURIComponent(selection.value)+(refresh?'&refresh=1':'')),request('/api/nba/statistics')]);model=FantasyHQYahooNBAV1.normalizeBundle(raw);render(stats);}catch(error){content.replaceChildren(note(error.message+' • No substitute roster or statistics.'));}}
  async function open(){if(screen){screen.classList.remove('hidden');return;}
    screen=el('section','seasonScreen');screen.id='nbaSeasonScreen';screen.setAttribute('aria-label','NBA Season Mode');Object.assign(screen.style,{position:'fixed',inset:'0',zIndex:'1000',overflow:'auto'});
    const header=el('header','seasonHeader'),brand=el('strong','seasonBrand','FANTASY HQ • NBA'),nav=el('nav','seasonTopNavigation'),back=el('button','','Return to NFL / Draft');back.onclick=()=>screen.classList.add('hidden');nav.append(back);header.append(brand,nav);screen.append(header);
    const bar=el('section','seasonOperationalBar');selection=el('select');selection.setAttribute('aria-label','Yahoo NBA league');selection.append(el('option','','Select NBA league'));selection.options[0].value='';selection.onchange=()=>load();const sync=el('button','seasonOperationalSync','Refresh NBA');sync.onclick=()=>load(true);bar.append(selection,sync);screen.append(bar);content=el('main','seasonContent');screen.append(content);document.body.append(screen);
    content.append(note('Loading NBA leagues…'));try{leagues=(await request('/api/yahoo/nba/leagues')).leagues;leagues.forEach(row=>{const option=el('option','',`${row.name} • ${row.teamCount} teams • ${row.game.season}`);option.value=row.leagueKey;selection.append(option);});content.replaceChildren(note('Select your Yahoo NBA league. NFL state remains separate.'));}catch(error){content.replaceChildren(note(error.message));}
  }
  root.FantasyHQNBASeasonUI={open};
})(window);
