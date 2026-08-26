let players = [],
  mode = 'practice',
  style = 'chaotic',
  slot = 10,
  pick = 1,
  drafted = [],
  history = [],
  decisionSnapshots = [],
  excludedRecommendationIds = new Set(),
  exclusionEvents = [],
  currentYahooRecord = null,
  posFilter = 'ALL',
  aiProfiles = {},
  slotManagers = {},
  selectedCandidateId = null,
  mobileTeamExpanded = false,
  advancedAnalysisExpanded = false,
  dismissedNoteReminderRound = null,
  recentSearchIds = [],
  leagueContext = {
    teams: 10,
    scoring: 'half',
    startQB: 1,
    startRB: 2,
    startWR: 3,
    startTE: 1,
    flex: 2,
    startK: 1,
    startDST: 1,
    bench: 6,
    irSlots: 0,
    passTD: 6,
    risk: 'balanced',
    strategy: 'auto',
  };
let playerBrowserQuery = '';
let playerIdentityIndex = new Map();
let injuryFeedManager = null;
let playerPhotoRegistry = window.PlayerPhotoV1?.emptyRegistry || null;
const managers = [
  {
    name: 'Gerard',
    archetype: 'Championship Value',
    skill: 9.6,
    predictability: 7,
    homerTeam: '',
    homer: 0,
    qbHoard: 2,
    waiver: 10,
  },
  {
    name: 'Marc',
    archetype: 'Calculated Ceiling',
    skill: 8,
    predictability: 8,
    homerTeam: 'NYJ',
    homer: 2,
    qbHoard: 2,
    waiver: 7,
  },
  {
    name: 'Kalani',
    archetype: 'Resource Controller',
    skill: 8,
    predictability: 6,
    homerTeam: 'PIT',
    homer: 5,
    qbHoard: 10,
    waiver: 9,
  },
  {
    name: 'Ray',
    archetype: 'Value Drafter',
    skill: 8.3,
    predictability: 9,
    homerTeam: 'LAC',
    homer: 4,
    qbHoard: 3,
    waiver: 9,
  },
  {
    name: 'Fritz',
    archetype: 'AI Consensus',
    skill: 7.4,
    predictability: 8,
    homerTeam: '',
    homer: 0,
    qbHoard: 3,
    waiver: 6,
  },
  {
    name: 'Michael',
    archetype: 'Instinct / Eagles',
    skill: 7.9,
    predictability: 4,
    homerTeam: 'PHI',
    homer: 10,
    qbHoard: 5,
    waiver: 4,
  },
  {
    name: 'Josh',
    archetype: 'Reactionary Hype',
    skill: 6.8,
    predictability: 5,
    homerTeam: '',
    homer: 0,
    qbHoard: 5,
    waiver: 8,
  },
  {
    name: 'Raoul',
    archetype: 'Balanced Value',
    skill: 7.5,
    predictability: 8,
    homerTeam: 'LAC',
    homer: 6,
    qbHoard: 3,
    waiver: 7,
  },
  {
    name: 'Rob',
    archetype: 'Conviction Drafter',
    skill: 6.5,
    predictability: 9,
    homerTeam: 'DEN',
    homer: 7,
    qbHoard: 3,
    waiver: 6,
  },
  {
    name: 'AJ',
    archetype: 'Balanced Variable',
    skill: 7,
    predictability: 4,
    homerTeam: 'SF',
    homer: 4,
    qbHoard: 4,
    waiver: 7,
  },
];
const blueprint = ['RB', 'WR', 'WR', 'RB', 'TE/QB', 'QB/TE'];
let rosterSlots = [],
  TOTAL_ROUNDS = 17,
  TOTAL_PICKS = 170;
const APP_VERSION = window.FantasyHQAppVersion;
function buildRosterSlots(settings = {}) {
  const q = +(settings.startQB ?? 1),
    rb = +(settings.startRB ?? 2),
    wr = +(settings.startWR ?? 3),
    te = +(settings.startTE ?? 1),
    flex = +(settings.flex ?? 2),
    k = +(settings.startK ?? 1),
    dst = +(settings.startDST ?? 1),
    bench = +(settings.bench ?? 6),
    slots = [];
  for (let i = 1; i <= q; i++) slots.push(i === 1 ? 'QB' : `QB${i}`);
  for (let i = 1; i <= rb; i++) slots.push(`RB${i}`);
  for (let i = 1; i <= wr; i++) slots.push(`WR${i}`);
  for (let i = 1; i <= te; i++) slots.push(i === 1 ? 'TE' : `TE${i}`);
  for (let i = 1; i <= flex; i++) slots.push(`FLEX${i}`);
  for (let i = 1; i <= k; i++) slots.push(i === 1 ? 'K' : `K${i}`);
  for (let i = 1; i <= dst; i++) slots.push(i === 1 ? 'DEF' : `DEF${i}`);
  for (let i = 1; i <= bench; i++) slots.push(`BENCH${i}`);
  return slots;
}
function applyDraftStructure() {
  rosterSlots = buildRosterSlots(leagueContext);
  TOTAL_ROUNDS = rosterSlots.length;
  TOTAL_PICKS = TOTAL_ROUNDS * (leagueContext.teams || 10);
}
rosterSlots = buildRosterSlots(leagueContext);
let renderInProgress = false,
  simulationInProgress = false,
  recommendationPersonalization = true,
  activeMobilePage = 'mobileDraft';
const dirtyViews = { players: true, room: true, wait: true, team: true };
let heavyRenderTimer = null;
// Jōnin Unity Core: one cached evaluation layer powers every visible decision.
let intelligenceEpoch = 0;
let scoreCache = new Map(),
  decisionTraceCache = new Map(),
  evaluationCache = new Map(),
  marketCache = new Map(),
  candidateContextCache = null,
  snapshotCache = null,
  championshipDecisionCache = null;
function invalidateIntelligence() {
  intelligenceEpoch++;
  scoreCache.clear();
  decisionTraceCache.clear();
  evaluationCache.clear();
  marketCache.clear();
  candidateContextCache = null;
  snapshotCache = null;
  championshipDecisionCache = null;
}
function validTier(value) {
  let t = String(value || '')
    .trim()
    .toUpperCase();
  return ['S', 'A', 'B', 'C', 'D', 'E', 'F'].includes(t) ? t : null;
}
function sourceTierSummary(p) {
  return {
    fantasyHQ: tierLabel(p),
    gerard: window.PlayerTierContract ? PlayerTierContract.getDecisionTier(p) : tierLabel(p),
    bdge: validTier(p.bdgeTier),
    flock: validTier(p.flockTier),
    fantasyPros: null,
  };
}
function getPlayerEvaluation(playerOrId) {
  const p =
    typeof playerOrId === 'object' ? playerOrId : players.find(x => x.id === Number(playerOrId));
  if (!p) return null;
  const key = `${intelligenceEpoch}:${p.id}`;
  if (evaluationCache.has(key)) return evaluationCache.get(key);
  const tier = tierLabel(p),
    mamba = mambaScore(p),
    final = finalPickScore(p),
    risk = survivalRisk(p),
    stage = sharinganStage(p);
  const out = Object.freeze({
    player: p,
    playerId: p.id,
    tier,
    sourceTiers: sourceTierSummary(p),
    mamba,
    final,
    risk,
    stage,
    roomBoost: roomBoost(p),
    rosterFit: rosterFitModifier(p),
  });
  evaluationCache.set(key, out);
  return out;
}
function getIntelligenceSnapshot() {
  if (snapshotCache && snapshotCache.epoch === intelligenceEpoch) return snapshotCache;
  const recPlayers = recommendations(),
    recIds = recPlayers.map(p => p.id);
  const markets = {};
  ['RB', 'WR', 'QB', 'TE'].forEach(pos => (markets[pos] = marketPressure(pos)));
  const wait = {};
  ['QB', 'TE', 'DST', 'K'].forEach(pos => (wait[pos] = waitScore(pos)));
  snapshotCache = Object.freeze({
    epoch: intelligenceEpoch,
    pick,
    round: info().r,
    recommendationIds: Object.freeze(recIds),
    markets: Object.freeze(markets),
    wait: Object.freeze(wait),
    createdAt: Date.now(),
  });
  return snapshotCache;
}
function snapshotRecommendations() {
  return getIntelligenceSnapshot()
    .recommendationIds.map(id => players.find(p => p.id === id))
    .filter(Boolean);
}
function el(id) {
  return document.getElementById(id);
}
const DOM = Object.freeze({
  poolStatus: el('poolStatus'),
  draftSlot: el('draftSlot'),
  managerSetup: el('managerSetup'),
  practiceChoice: el('practiceChoice'),
  yahooChoice: el('yahooChoice'),
  liveChoice: el('liveChoice'),
  mockRandomizer: el('mockRandomizer'),
  setupScreen: el('setupScreen'),
  appScreen: el('appScreen'),
  draftReport: el('draftReport'),
  changeBtn: el('changeBtn'),
  tabs: el('tabs'),
  modeBanner: el('modeBanner'),
  recommendation: el('recommendation'),
  alternatives: el('alternatives'),
  desktopBoard: el('desktopBoard'),
  draftBoard: el('draftBoard'),
  roster: el('roster'),
  mRoster: el('mRoster'),
  strategies: el('strategies'),
  mStrategies: el('mStrategies'),
  round: el('round'),
  mRound: el('mRound'),
  pickLabel: el('pickLabel'),
  mPickLabel: el('mPickLabel'),
  until: el('until'),
  mUntil: el('mUntil'),
  myDraftReport: el('myDraftReport'),
  leagueProjection: el('leagueProjection'),
  allTeamReports: el('allTeamReports'),
  yahooExportCard: el('yahooExportCard'),
  archiveCount: el('archiveCount'),
  desktopManagerTable: el('desktopManagerTable'),
  sheetManagerTable: el('sheetManagerTable'),
  managerRosterDetail: el('managerRosterDetail'),
  resumeDraftCard: el('resumeDraftCard'),
  resumeDraftSummary: el('resumeDraftSummary'),
  draftTimeline: el('draftTimeline'),
  draftNotebook: el('draftNotebook'),
  notebookStatus: el('notebookStatus'),
  boardInstruction: el('boardInstructionContent'),
  fightCardMode: el('fightCardMode'),
  recordPickBtn: el('recordPickBtn'),
  recordPickLabel: el('recordPickLabel'),
  roundNoteReminder: el('roundNoteReminder'),
  leagueProfileSelect: el('leagueProfileSelect'),
  activeLeagueLabel: el('activeLeagueLabel'),
  leagueProfileDetails: el('leagueProfileDetails'),
});
const leagueProfileStore=window.LeagueProfilesV1?new LeagueProfilesV1.LeagueProfileStore():null;
let activeLeagueProfile=leagueProfileStore?.initialize()&&leagueProfileStore.active(),
  draftSessionStore=window.DraftSessionV1?new DraftSessionV1.DraftSessionStore(localStorage,leagueProfileStore?.draftKey(activeLeagueProfile?.id)):null,
  completedDraftArchiveStore=window.DraftSessionV1?new DraftSessionV1.CompletedDraftArchiveStore(localStorage,leagueProfileStore?.completedArchiveKey(activeLeagueProfile?.id)):null;
let replacingSavedDraft=false;
let completedDraftRecoveryEntries=[],pendingDraftImport=null;
function safeText(id, value) {
  const node = el(id);
  if (node) node.textContent = value;
}
function safeHTML(id, value) {
  const node = el(id);
  if (node) node.innerHTML = value;
}
function activeProfileSettings(){return activeLeagueProfile?.settings||leagueContext}
function bindProfileDraftStore(){draftSessionStore=window.DraftSessionV1?new DraftSessionV1.DraftSessionStore(localStorage,leagueProfileStore?.draftKey(activeLeagueProfile?.id)):null;completedDraftArchiveStore=window.DraftSessionV1?new DraftSessionV1.CompletedDraftArchiveStore(localStorage,leagueProfileStore?.completedArchiveKey(activeLeagueProfile?.id)):null}
function renderLeagueProfileControls(){
  if(!leagueProfileStore||!activeLeagueProfile)return;
  const profiles=leagueProfileStore.list();
  [DOM.leagueProfileSelect,el('primaryHeaderProfileSelect')].filter(Boolean).forEach(select=>{select.innerHTML='';profiles.forEach(profile=>{const option=document.createElement('option');option.value=profile.id;option.textContent=profile.displayName;select.appendChild(option)});select.value=activeLeagueProfile.id});
  safeText('activeLeagueLabel',`League: ${activeLeagueProfile.displayName}`);
  safeText('leagueProfileDetails',`${activeLeagueProfile.leagueName} • ${activeLeagueProfile.platform} • ${activeLeagueProfile.actualTeams} active teams${activeLeagueProfile.maxTeams!==activeLeagueProfile.actualTeams?` (${activeLeagueProfile.maxTeams} max)`:''} • ${activeLeagueProfile.draftType}`);
  safeText('profileSetupTitle',`${activeLeagueProfile.displayName} Draft Rounds`);safeText('profileSetupLeagueName',activeLeagueProfile.leagueName);
  const facts=el('profileSetupFacts');if(facts){facts.innerHTML='';const settings=activeLeagueProfile.settings,labels=[`${activeLeagueProfile.actualTeams} Teams`,settings.scoring==='full'?'Full PPR':settings.scoring==='standard'?'Standard':'Half-PPR',`${settings.startRB} RB`,`${settings.startWR} WR`,`${settings.flex} FLEX`,`${settings.bench} Bench`,`${settings.irSlots||0} IR`,`${settings.passTD}-Point Pass TD`];labels.forEach(label=>{const span=document.createElement('span');span.textContent=label;facts.appendChild(span)})}
  if(typeof renderYahooSeasonState==='function')renderYahooSeasonState();
}
function applyActiveLeagueProfile(){
  if(!activeLeagueProfile)return;
  applySavedSettings({...activeLeagueProfile.settings,slot:activeLeagueProfile.draftSlot});
  chooseMode(activeLeagueProfile.preferredMode||'practice');
  style=activeLeagueProfile.settings.roomStyle||style;
  if(el('roomStyle'))el('roomStyle').value=style;
  leagueContext={...leagueContext,...activeLeagueProfile.settings};
  slot=activeLeagueProfile.draftSlot;
  applyDraftStructure();renderLeagueProfileControls();renderManagerSetup();updateSetupRoundPreview();
}
function captureProfileSettings(){
  const prior=activeProfileSettings(),scoring=el('scoring')?.value||prior.scoring||'half';
  return {...prior,teams:+(el('teamCount')?.value||prior.teams||10),scoring,receptions:scoring==='full'?1:scoring==='half'?0.5:0,startQB:+(el('startQB')?.value||0),startRB:+(el('startRB')?.value||0),startWR:+(el('startWR')?.value||0),startTE:+(el('startTE')?.value||0),flex:+(el('flexSpots')?.value||0),startK:+(el('startK')?.value||0),startDST:+(el('startDST')?.value||0),bench:+(el('benchSpots')?.value||0),irSlots:+(el('irSpots')?.value||0),passTD:+(el('passTD')?.value||6),risk:el('riskProfile')?.value||'balanced',roomStyle:el('roomStyle')?.value||'chaotic'};
}
function saveActiveLeagueProfileSettings({quiet=false}={}){
  if(!leagueProfileStore||!activeLeagueProfile)return activeLeagueProfile;
  const settings=captureProfileSettings(),draftSlot=Math.max(1,Math.min(settings.teams,+(el('draftSlot')?.value||settings.teams)));
  activeLeagueProfile=leagueProfileStore.update(activeLeagueProfile.id,{actualTeams:settings.teams,settings,draftSlot,preferredMode:mode});
  renderLeagueProfileControls();if(!quiet)alert(`${activeLeagueProfile.displayName} settings saved.`);return activeLeagueProfile;
}
function selectLeagueProfile(profileId){
  if(!leagueProfileStore||profileId===activeLeagueProfile?.id)return;
  if(history.length&&draftSessionStore)persistDraftSession(pick>TOTAL_PICKS?'complete':'active');
  activeLeagueProfile=leagueProfileStore.select(profileId);bindProfileDraftStore();
  history=[];drafted=[];decisionSnapshots=[];excludedRecommendationIds=new Set();exclusionEvents=[];pick=1;selectedCandidateId=null;currentYahooRecord=null;invalidateIntelligence();
  applyActiveLeagueProfile();backToSetup();showSavedDraftPrompt();
}
function selectHeaderLeagueProfile(profileId){selectLeagueProfile(profileId)}
function createLeagueProfile(){
  if(!leagueProfileStore)return;const name=prompt('Profile name');if(!String(name||'').trim())return;
  activeLeagueProfile=leagueProfileStore.create({displayName:String(name).trim(),leagueName:String(name).trim(),preferredMode:mode,settings:captureProfileSettings(),actualTeams:+(el('teamCount')?.value||10),draftSlot:+(el('draftSlot')?.value||10)});bindProfileDraftStore();applyActiveLeagueProfile();showSavedDraftPrompt();
}
function renameLeagueProfile(){
  if(!leagueProfileStore||!activeLeagueProfile)return;const name=prompt('Rename league profile',activeLeagueProfile.displayName);if(!String(name||'').trim())return;activeLeagueProfile=leagueProfileStore.rename(activeLeagueProfile.id,String(name).trim());renderLeagueProfileControls();
}
function reportRuntimeError(context, err) {
  console.error(`[${APP_VERSION.label}] ${context}:`, err);
  const status = el('runtimeStatus');
  if (status) {
    status.classList.remove('hidden');
    status.innerHTML = `<b>Fantasy HQ recovered from an interface error.</b><div class="meta">${context}: ${err.message}. Refresh once if a section does not update.</div>`;
  }
}
window.addEventListener('error', e =>
  reportRuntimeError('Browser runtime', e.error || new Error(e.message))
);
window.addEventListener('unhandledrejection', e =>
  reportRuntimeError(
    'Background task',
    e.reason instanceof Error ? e.reason : new Error(String(e.reason))
  )
);
function updateSetupRoundPreview() {
  const settings = {
    startQB: +(el('startQB')?.value || 1),
    startRB: +(el('startRB')?.value || 2),
    startWR: +(el('startWR')?.value || 3),
    startTE: +(el('startTE')?.value || 1),
    flex: +(el('flexSpots')?.value || 2),
    startK: +(el('startK')?.value || 1),
    startDST: +(el('startDST')?.value || 1),
    bench: +(el('benchSpots')?.value || 6),
  };
  const rounds = buildRosterSlots(settings).length,
    teams = +(el('teamCount')?.value || 10);
  safeText('calculatedRounds', `${rounds} rounds • ${rounds * teams} picks`);
}
async function applyActiveRankingSnapshot() {
  const configResponse=await fetch('data/rankings/ACTIVE_SNAPSHOT.json',{cache:'no-store'});if(!configResponse.ok)throw new Error('Active ranking configuration returned '+configResponse.status);
  const config=await configResponse.json();
  const load=async name=>{if(!/^[a-z0-9_.-]+\.json$/i.test(String(name||'')))throw new Error('Active ranking snapshot path is invalid.');const response=await fetch(`data/rankings/${name}`,{cache:'no-store'});if(!response.ok)throw new Error('Active ranking snapshot returned '+response.status);return response.json()};
  if(config.schemaVersion==='2.0'){
    const fantasylandName=config.sources?.Fantasyland?.activeSnapshot,flockName=config.sources?.Flock?.activeSnapshot;
    const fantasyland=await load(fantasylandName),fantasylandRows=DataHealthV1.validateRankingSnapshot(fantasyland,'Fantasyland');
    let flock=null,flockRows={records:[],matched:[],byId:new Map()},flockError=null;
    try{flock=await load(flockName);flockRows=DataHealthV1.validateRankingSnapshot(flock,'Flock')}catch(error){flockError=error;console.warn('Optional Flock ranking context could not load; Fantasyland remains active:',error)}
    players.forEach(player=>{const primary=fantasylandRows.byId.get(String(player.id));if(primary){player.fantasylandOverallRank=primary.overallRank;player.fantasylandOverallTier=primary.decisionOverallTier;player.fantasylandPositionRank=primary.positionRank;player.fantasylandPositionTier=primary.decisionPositionTier;player.fantasylandSourceOverallTier=primary.overallTier;player.fantasylandSourcePositionTier=primary.positionTier;player.fantasylandSourceTeam=primary.sourceTeam;player.fantasylandSource='Fantasyland';player.fantasylandHostPlatform='Flock Fantasy';player.fantasylandCaptureDate=primary.captureDate;player.fantasylandSourceSnapshotDate=primary.sourceSnapshotDate;player.overall=primary.overallRank;player.overallTier=primary.decisionOverallTier;player.posRank=primary.positionRank;player.posTier=primary.decisionPositionTier}const secondary=flockRows.byId.get(String(player.id));if(secondary){player.flockOverallRank=secondary.overallRank;player.flockOverallTier=secondary.overallTier;player.flockPositionRank=secondary.positionRank;player.flockPositionTier=secondary.positionTier;player.flockSourceTeam=secondary.sourceTeam;player.flockCaptureDate=secondary.captureDate;player.flockSourceSnapshotDate=secondary.sourceSnapshotDate;player.flockRank=secondary.positionRank;player.flockTier=secondary.decisionPositionTier}});
    window.__activeRankingSnapshot={schemaVersion:'2.0',snapshotId:config.snapshotId,captureDate:config.captureDate,sourceSnapshotDate:config.sourceSnapshotDate??null,primaryDecisionSource:'Fantasyland',sources:{Fantasyland:{name:fantasylandName,records:fantasylandRows.records.length,matched:fantasylandRows.matched.length,available:true},Flock:{name:flockName,records:flockRows.records.length,matched:flockRows.matched.length,available:!flockError,error:flockError?.message||null}}};
    return;
  }
  const name=String(config.activeSnapshot||''),snapshot=await load(name),records=Array.isArray(snapshot.records)?snapshot.records:[],byId=new Map(records.map(row=>[String(row.playerId),row]));
  if(snapshot.schemaVersion!=='1.0'||snapshot.immutable!==true||byId.size!==records.length)throw new Error('Active ranking snapshot failed its normalized contract.');
  players.forEach(player=>{const row=byId.get(String(player.id));if(!row||row.importStatus!=='MATCHED')return;player.fantasylandOverallRank=row.overallRank;player.fantasylandOverallTier=row.overallTier;player.fantasylandPositionRank=row.positionRank;player.fantasylandPositionTier=row.positionTier;player.overall=row.overallRank;player.overallTier=row.overallTier;player.posRank=row.positionRank;player.posTier=row.positionTier});
  window.__activeRankingSnapshot={source:snapshot.source,snapshotDate:snapshot.snapshotDate,records:records.length,name};
}
async function loadChampionshipEquityProductionSnapshot(){
  if(!window.ChampionshipEquityProductionV1)return null;
  const response=await fetch('data/championship_equity_2026.json?v=4.3.20',{cache:'no-store'});if(!response.ok)throw new Error('Championship Equity snapshot returned '+response.status);
  const snapshot=await response.json(),report=ChampionshipEquityProductionV1.loadSnapshot(snapshot);window.__championshipEquityProductionSnapshot=report;return report;
}
async function init() {
  try {
    const response = await fetch('data/players.json?v=jonin_3_2', { cache: 'no-store' });
    if (!response.ok) throw new Error('Player database returned ' + response.status);
    players = await response.json();
    try { await applyActiveRankingSnapshot(); } catch (rankingError) { console.warn('Active normalized ranking snapshot could not load; retaining the last bundled player rankings:',rankingError); }
    try { await loadChampionshipEquityProductionSnapshot(); } catch (championshipEquityError) { console.warn('Championship Equity production evidence could not load; continuing with no Championship Equity influence:',championshipEquityError); }
    try {
      const specialistResponse = await fetch('data/specialist_rankings_2026-08-09.json?v=2026-08-09', { cache: 'no-store' });
      if (specialistResponse.ok && window.SpecialistRankingsV1) {
        const specialistSnapshot = await specialistResponse.json();
        window.__specialistRankingReport = SpecialistRankingsV1.apply(players, specialistSnapshot);
      }
    } catch (specialistError) {
      console.warn('Optional specialist ranking snapshot could not load:', specialistError);
    }
    await initializeInjuryFeed();
    buildPlayerSearchIndex();
    if (DOM.poolStatus)
      DOM.poolStatus.innerHTML = `<b>Draft pool ready</b><div class="meta" style="margin-top:4px">${players.length} players loaded, including kickers and defenses.</div>`;
    const btn = el('startDraftBtn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Start Draft';
    }
  } catch (err) {
    console.error('Fantasy HQ player pool failed to load:', err);
    if (DOM.poolStatus)
      DOM.poolStatus.innerHTML = `<b style="color:#ff8c9a">Draft pool could not load</b><div class="meta" style="margin-top:4px">Open the installed/deployed website rather than the HTML file by itself, then refresh. Error: ${err.message}</div>`;
    const btn = el('startDraftBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Player pool unavailable';
    }
  }
  if (DOM.draftSlot) {
    refreshDraftSlotOptions(10,10);
  }
  renderManagerSetup();
  applyActiveLeagueProfile();
  initializeDraftReliability();
}

function applyInjurySnapshot(snapshot, source='bundled') {
  if (!snapshot || !window.InjuryIntelligenceV1) return null;
  window.__injurySnapshot = snapshot;
  playerPhotoRegistry=window.PlayerPhotoV1?.createRegistry(snapshot)||playerPhotoRegistry;
  window.__injurySnapshotReport = {...InjuryIntelligenceV1.applySnapshot(players, snapshot),source,fetchedAt:snapshot.fetchedAt||null,cacheState:snapshot.cacheState||null};
  invalidateIntelligence();
  renderDataHealthStatus();
  return window.__injurySnapshotReport;
}
function renderDataHealthStatus(){
  const node=el('dataHealthReadout');if(!node||!window.DataHealthV1)return;
  const health=DataHealthV1.summary({players,injurySnapshot:window.__injurySnapshot||{},rankingSnapshot:window.__activeRankingSnapshot});
  const updated=health.injuries.fetchedAt?new Date(health.injuries.fetchedAt).toLocaleString():'Unavailable';
  node.dataset.status=health.injuries.status;
  node.textContent=`Rankings: ${health.rankings.source}${health.rankings.snapshotDate?` — ${health.rankings.snapshotDate}`:''}${health.rankings.secondary?` • ${health.rankings.secondary}`:''} • Injuries: Sleeper — ${health.injuries.status} (${updated}) • Player Pool: ${health.playerPool} • Identity Issues: ${health.identityIssues} critical`;
}
async function initializeInjuryFeed() {
  let bundled = null;
  try {
    const response = await fetch('data/injuries_2026.json?v=2026-08-08', { cache: 'no-store' });
    if (response.ok) bundled = await response.json();
  } catch (error) {
    console.warn('Bundled injury snapshot could not load:', error);
  }
  injuryFeedManager = window.SleeperInjuryAdapterV1?.createManager() || null;
  const cached = injuryFeedManager?.loadCached(),baseline=cached||injuryFeedManager?.prime(bundled)||bundled;
  applyInjurySnapshot(baseline || {records:[]}, cached ? 'cache' : bundled ? 'bundled' : 'unavailable');
  if (injuryFeedManager) {
    injuryFeedManager.refreshDaily(players).then(result => {
      if (result.snapshot) {
        applyInjurySnapshot(result.snapshot, result.source);
        if (!DOM.setupScreen?.classList.contains('hidden')) return;
        renderAll();
      }
      if (result.error) console.warn('Daily Sleeper injury refresh preserved existing data:', result.error);
    });
  }
}
async function refreshInjuryDataNow() {
  const button = el('refreshInjuriesBtn');
  if (button) { button.disabled = true; button.textContent = 'Refreshing…'; }
  try {
    if (!injuryFeedManager) throw new Error('Sleeper injury adapter is unavailable.');
    const result = await injuryFeedManager.refreshNow(players);
    if (!result.snapshot) throw result.error || new Error('No valid injury snapshot is available.');
    applyInjurySnapshot(result.snapshot, result.source);
    if (DOM.appScreen && !DOM.appScreen.classList.contains('hidden')) renderAll();
    const count = result.snapshot.records?.filter(record => !['ACTIVE','UNKNOWN'].includes(record.status)).length || 0;
    alert(result.refreshed ? `Injury data refreshed from Sleeper. ${count} non-active player records found.` : `Refresh failed; preserved the last valid ${result.source}.`);
    return result;
  } catch (error) {
    console.warn('Sleeper injury refresh failed without a valid cached snapshot:',error);
    renderDataHealthStatus();
    alert('Injury refresh is unavailable. Existing draft data was preserved.');
    return {snapshot:window.__injurySnapshot||null,source:'unavailable',refreshed:false,error};
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Refresh Injuries Now'; }
  }
}

function refreshDraftSlotOptions(teamCount=10,preferred=slot){
  if(!DOM.draftSlot)return;
  const supported=window.DraftMathV1?.SUPPORTED_SIZES||[9,10,11],teams=supported.includes(Number(teamCount))?Number(teamCount):10,
    selected=Math.max(1,Math.min(teams,Number(preferred)||teams));
  DOM.draftSlot.innerHTML='';
  for(let i=1;i<=teams;i++){
    const option=document.createElement('option');option.value=i;option.textContent='Pick '+i;DOM.draftSlot.appendChild(option);
  }
  DOM.draftSlot.value=selected;
}
function handleLeagueSizeChange(){
  const teams=+(el('teamCount')?.value||10);refreshDraftSlotOptions(teams,DOM.draftSlot?.value);renderManagerSetup();updateSetupRoundPreview();
}

function renderManagerSetup() {
  if (!DOM.managerSetup) return;
  const pref = [
    'Kalani',
    'Marc',
    'Ray',
    'Fritz',
    'Michael',
    'Gerard',
    'Josh',
    'Raoul',
    'Rob',
    'AJ',
  ];
  DOM.managerSetup.innerHTML = '';
  const teamCount=+(el('teamCount')?.value||leagueContext.teams||10);
  for (let i = 1; i <= teamCount; i++) {
    let w = document.createElement('div');
    w.className = 'managerSlot';
    let b = document.createElement('b');
    b.textContent = 'Pick ' + i;
    let s = document.createElement('select');
    s.id = 'mgr' + i;
    managers.forEach(m => {
      let o = document.createElement('option');
      o.value = m.name;
      o.textContent = m.name + ' — ' + m.archetype;
      s.appendChild(o);
    });
    s.value = pref[(i - 1)%pref.length];
    w.append(b, s);
    DOM.managerSetup.appendChild(w);
  }
}
function captureManagers() {
  slotManagers = {};
  for (let i = 1; i <= (leagueContext.teams||10); i++) {
    let e = document.getElementById('mgr' + i);
    slotManagers[i] = e ? e.value : 'Team ' + i;
  }
  let old = Object.keys(slotManagers).find(k => slotManagers[k] === 'Gerard');
  if (old && +old !== slot) {
    let tmp = slotManagers[slot];
    slotManagers[old] = tmp;
  }
  slotManagers[slot] = 'Gerard';
}
function getManager(t) {
  return managers.find(m => m.name === slotManagers[t]) || managers[0];
}
function chooseMode(m) {
  mode = m;
  DOM.practiceChoice?.classList.toggle('selected', m === 'practice');
  DOM.yahooChoice?.classList.toggle('selected', m === 'yahoo');
  DOM.liveChoice?.classList.toggle('selected', m === 'live');
  DOM.mockRandomizer?.classList.toggle('hidden', m !== 'practice');
}
function currentDraftSessionState(status='active'){
  const recommendationIds=players.length&&pick<=TOTAL_PICKS?recommendations().map(player=>player.id):[];
  return {status,leagueProfileId:activeLeagueProfile?.id||null,appVersion:APP_VERSION.label,rankingSnapshot:window.__activeRankingSnapshot?JSON.parse(JSON.stringify(window.__activeRankingSnapshot)):null,injurySnapshot:{provider:window.__injurySnapshot?.provider||null,fetchedAt:window.__injurySnapshot?.fetchedAt||null,cacheState:window.__injurySnapshot?.cacheState||null},archiveRecordId:currentYahooRecord?.id||null,excludedRecommendationIds:[...excludedRecommendationIds],exclusionEvents:exclusionEvents.map(event=>({...event})),mode,style,slot,pick,currentRound:info().r,currentPickOwner:pick<=TOTAL_PICKS?teamForPick(pick):null,drafted:[...drafted],history:history.map(entry=>({...entry})),decisionSnapshots:decisionSnapshots.map(entry=>({...entry})),settings:{...leagueContext,rosterSlots:[...rosterSlots]},leagueConfiguration:{...leagueContext,totalRounds:TOTAL_ROUNDS,totalPicks:TOTAL_PICKS},managers:{...slotManagers},recommendations:recommendationIds,importedRankings:players.map(player=>({id:player.id,overall:player.overall??null,posRank:player.posRank??null,overallTier:player.overallTier??null,posTier:player.posTier??null}))};
}
function persistDraftSession(status='active'){
  if(!draftSessionStore||!history.length&&DOM.appScreen?.classList.contains('hidden'))return null;
  const snapshot=status==='complete'?draftSessionStore.complete(currentDraftSessionState('complete')):draftSessionStore.save(currentDraftSessionState('active'));
  if(status==='complete')archiveCompletedSnapshot(snapshot,{captureExport:true});
  renderDraftTimeline();return snapshot;
}
function archiveCompletedSnapshot(snapshot,{captureExport=false,store=completedDraftArchiveStore}={}){
  if(snapshot?.status!=='complete')return null;if(!store)throw new Error('Completed Draft History is unavailable.');const exportRecord=captureExport?buildDraftJSONExport(snapshot.updatedAt||new Date().toISOString()):null;return store.archive(snapshot,{exportRecord,archivedAt:new Date().toISOString()});
}
function migrateRecoverableCompletedSessions(){
  if(!leagueProfileStore||!window.DraftSessionV1)return 0;const profiles=leagueProfileStore.list(),byId=new Map(profiles.map(profile=>[profile.id,profile])),migrated=[];
  const preserve=(raw,profileHint)=>{if(!raw)return;try{const snapshot=DraftSessionV1.validate(JSON.parse(raw));if(snapshot.status!=='complete')return;const profile=byId.get(snapshot.leagueProfileId)||profileHint||activeLeagueProfile,store=new DraftSessionV1.CompletedDraftArchiveStore(localStorage,leagueProfileStore.completedArchiveKey(profile.id));store.archive(snapshot,{archivedAt:new Date().toISOString()});migrated.push(snapshot.sessionId)}catch(error){console.warn('Completed draft preservation skipped an invalid record:',error.message)}};
  profiles.forEach(profile=>preserve(localStorage.getItem(leagueProfileStore.draftKey(profile.id)),profile));preserve(localStorage.getItem(DraftSessionV1.STORAGE_KEY),byId.get(LeagueProfilesV1.PRIMARY_ID));return new Set(migrated).size;
}
function showSavedDraftPrompt(){
  refreshCompletedDraftCount();const saved=draftSessionStore?.load();if(!saved){DOM.resumeDraftCard?.classList.add('hidden');return}
  DOM.resumeDraftCard?.classList.remove('hidden');if(DOM.resumeDraftSummary)DOM.resumeDraftSummary.textContent=`${activeLeagueProfile?.displayName||'League'} • ${saved.status==='complete'?'Completed ':''}${saved.mode||'Draft'} • Slot ${saved.slot} • ${saved.history.length} picks recorded • saved ${new Date(saved.updatedAt).toLocaleString()}`;
  const resumeButton=el('resumeDraftBtn');if(resumeButton)resumeButton.textContent=saved.status==='complete'?'Open Draft Report':'Resume Draft';
}
function discoverRecoverableCompletedDrafts(){
  if(!window.DraftWorkflowV1||!window.DraftSessionV1||!leagueProfileStore)return [];
  return DraftWorkflowV1.discoverCompletedDrafts({storage:localStorage,profiles:leagueProfileStore.list(),draftKey:LeagueProfilesV1.draftKey,archiveKey:LeagueProfilesV1.archiveKey,completedArchiveKey:LeagueProfilesV1.completedArchiveKey,legacyDraftKey:DraftSessionV1.STORAGE_KEY,validateSession:DraftSessionV1.validate});
}
function completedDraftLabel(entry){return entry.kind==='yahoo-archive'?'Yahoo archive':entry.mode==='live'?'Live Draft':entry.mode==='yahoo'?'Yahoo Live Mock':'Practice Mock'}
function refreshCompletedDraftCount(){
  completedDraftRecoveryEntries=discoverRecoverableCompletedDrafts();const count=el('completedDraftCount');if(count)count.textContent=completedDraftRecoveryEntries.length?`(${completedDraftRecoveryEntries.length})`:'';return completedDraftRecoveryEntries;
}
function recoveryEntry(entryId){return refreshCompletedDraftCount().find(entry=>entry.id===entryId)||null}
function renderCompletedDraftHistory(){
  const content=el('completedDraftHistoryContent'),entries=refreshCompletedDraftCount();if(!content)return;
  content.innerHTML='';
  const notice=document.createElement('div');notice.className='readOnlyNotice';notice.textContent='Read-only recovery: opening, importing, or exporting a completed draft does not replace or modify the current Resume session.';content.appendChild(notice);
  if(!entries.length){const empty=document.createElement('div');empty.className='timelineEmpty';empty.textContent='No recoverable completed session or Yahoo archive exists in the application’s supported storage locations.';content.appendChild(empty);return}
  const list=document.createElement('div');list.className='completedDraftList';
  entries.forEach(entry=>{const article=document.createElement('article');article.className='completedDraftRecord';const info=document.createElement('div'),title=document.createElement('h3'),meta=document.createElement('div');title.textContent=`${entry.profileName} — ${completedDraftLabel(entry)}`;if(entry.imported){const badge=document.createElement('span');badge.className='importedDraftBadge';badge.textContent='Imported Draft';title.appendChild(badge)}meta.className='meta';meta.textContent=`Completed ${entry.completedAt?new Date(entry.completedAt).toLocaleString():'time unavailable'} • ${entry.mode||'mode unavailable'} • ${entry.teamCount??'unknown'} teams • Slot ${entry.draftSlot??'unknown'} • ${entry.pickCount} picks`;info.append(title,meta);const actions=document.createElement('div');actions.className='completedDraftActions';const open=document.createElement('button');open.type='button';open.className='ghost';open.textContent='Open Completed Draft';open.addEventListener('click',()=>openRecoveredCompletedDraft(entry.id));const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='primary';exportButton.textContent='Export JSON';exportButton.addEventListener('click',()=>exportRecoveredCompletedDraft(entry.id));actions.append(open,exportButton);article.append(info,actions);list.appendChild(article)});content.appendChild(list);
}
function chooseDraftJSONFile(){const input=el('draftJsonImportInput');if(input){input.value='';input.click()}}
async function handleDraftJSONFile(file){if(!file)return;const content=el('completedDraftHistoryContent');try{if(file.size>5*1024*1024)throw new Error('Draft JSON exceeds the 5 MB safety limit.');const validation=DraftWorkflowV1.validateDraftImport(await file.text(),{canonicalPlayerIds:players.map(player=>canonicalPlayerId(player.id))});pendingDraftImport={validation,fileName:file.name};renderDraftImportReview()}catch(error){pendingDraftImport=null;if(content){content.innerHTML='';const failure=document.createElement('div');failure.className='seasonStateBanner';failure.textContent=`Import rejected: ${error.message}`;content.append(failure);const back=document.createElement('button');back.type='button';back.className='ghost';back.textContent='Back to Draft History';back.addEventListener('click',renderCompletedDraftHistory);content.append(back)}}}
function renderDraftImportReview(){const content=el('completedDraftHistoryContent');if(!content||!pendingDraftImport||!leagueProfileStore)return;const {validation,fileName}=pendingDraftImport,profiles=leagueProfileStore.list(),mapping=DraftWorkflowV1.resolveImportProfile(validation,profiles);content.innerHTML='';const review=document.createElement('section');review.className='draftImportReview';const heading=document.createElement('h3');heading.textContent='Validate Completed Draft Import';const summary=document.createElement('p');summary.className='meta';summary.textContent=`${fileName} • Schema ${DraftWorkflowV1.EXPORT_SCHEMA_VERSION}`;const facts=document.createElement('div');facts.className='draftImportFacts';[['League',validation.leagueName],['Completed',validation.completedAt?new Date(validation.completedAt).toLocaleString():'Not supplied'],['Draft mode',validation.draftMode],['Teams',validation.teams],['Draft slot',validation.userSlot],['Picks',validation.expectedPicks]].forEach(([label,value])=>{const item=document.createElement('span'),small=document.createElement('small'),strong=document.createElement('b');small.textContent=label;strong.textContent=String(value);item.append(small,strong);facts.appendChild(item)});const mappingRow=document.createElement('div');mappingRow.className='draftImportProfile';const label=document.createElement('label');label.textContent=mapping.requiresSelection?'Select destination Fantasy HQ profile':'Destination Fantasy HQ profile';const select=document.createElement('select');select.id='draftImportProfileSelect';select.setAttribute('aria-label','Destination Fantasy HQ profile');if(mapping.requiresSelection){const prompt=document.createElement('option');prompt.value='';prompt.textContent='Select a profile explicitly';select.appendChild(prompt)}profiles.forEach(profile=>{const option=document.createElement('option');option.value=profile.id;option.textContent=profile.displayName;select.appendChild(option)});if(mapping.profile)select.value=mapping.profile.id;label.appendChild(select);const importButton=document.createElement('button');importButton.type='button';importButton.className='primary';importButton.textContent='Import Completed Draft';importButton.addEventListener('click',()=>restoreImportedDraft(select.value));mappingRow.append(label,importButton);const warning=document.createElement('p');warning.className='readOnlyNotice';warning.textContent='This restores an immutable Draft History record only. It will not overwrite Resume, change league settings, or claim current Yahoo ownership.';review.append(heading,summary,facts,mappingRow,warning);content.appendChild(review)}
function restoreImportedDraft(destinationProfileId){if(!pendingDraftImport||!leagueProfileStore)return;const content=el('completedDraftHistoryContent'),profiles=leagueProfileStore.list();try{const resolved=DraftWorkflowV1.resolveImportProfile(pendingDraftImport.validation,profiles,destinationProfileId||null);if(resolved.requiresSelection)throw new Error('Select the destination Fantasy HQ profile explicitly.');const store=new DraftSessionV1.CompletedDraftArchiveStore(localStorage,leagueProfileStore.completedArchiveKey(resolved.profile.id)),result=DraftWorkflowV1.importCompletedDraft({input:pendingDraftImport.validation.record,profiles,destinationProfileId:resolved.profile.id,canonicalPlayerIds:players.map(player=>canonicalPlayerId(player.id)),archiveStore:store,validateSession:DraftSessionV1.validate,importedAt:new Date().toISOString()}),verified=discoverRecoverableCompletedDrafts().find(entry=>entry.profileId===resolved.profile.id&&entry.snapshot?.sessionId===result.validation.sessionId);if(!verified||verified.snapshot.status!=='complete'||verified.pickCount!==result.validation.expectedPicks)throw new Error('Permanent Draft History verification failed; the import was not reported as successful.');pendingDraftImport=null;renderCompletedDraftHistory();const status=document.createElement('div');status.className='readOnlyNotice';status.textContent=result.idempotent?`This completed draft was already imported; no duplicate was created. Session ${verified.snapshot.sessionId} is owned by ${verified.profileId}.`:`Imported Draft restored permanently. Session ${verified.snapshot.sessionId} is owned by ${verified.profileId}; Season Mode can use it immediately when Yahoo has no successful snapshot.`;content.prepend(status);refreshCompletedDraftCount()}catch(error){if(content){const failure=document.createElement('div');failure.className='seasonStateBanner';failure.textContent=`Import rejected: ${error.message}`;content.prepend(failure)}}}
function openCompletedDraftHistory(){const panel=el('completedDraftHistoryPanel');if(!panel)return;renderCompletedDraftHistory();panel.classList.remove('hidden')}
function closeCompletedDraftHistory(event){if(event&&event.target!==event.currentTarget)return;el('completedDraftHistoryPanel')?.classList.add('hidden')}
function openRecoveredCompletedDraft(entryId){
  const entry=recoveryEntry(entryId),content=el('completedDraftHistoryContent');if(!entry||!content)return;
  let exported;try{exported=DraftWorkflowV1.buildRecoveryExport(entry,{playerIndex:fantasyHQPlayerIndex(),appVersion:APP_VERSION.label,exportedAt:new Date().toISOString()})}catch(error){content.textContent=`This completed draft could not be opened: ${error.message}`;return}
  content.innerHTML='';const back=document.createElement('button');back.type='button';back.className='ghost';back.textContent='← Back to Draft History';back.addEventListener('click',renderCompletedDraftHistory);content.appendChild(back);
  const detail=document.createElement('article');detail.className='completedDraftDetail';const heading=document.createElement('h2');heading.textContent=`${entry.profileName} — ${completedDraftLabel(entry)}`;const notice=document.createElement('div');notice.className='readOnlyNotice';notice.textContent='Viewing stored completion data only. Your active Resume draft remains selected and unchanged.';detail.append(heading,notice);
  const facts=document.createElement('div');facts.className='completedDraftFacts';[['Completed',entry.completedAt?new Date(entry.completedAt).toLocaleString():'Unavailable'],['Draft slot',entry.draftSlot??'Unavailable'],['Picks',exported.draft.picksRecorded],['Status',exported.draft.status]].forEach(([label,value])=>{const fact=document.createElement('span'),small=document.createElement('small'),strong=document.createElement('b');small.textContent=label;strong.textContent=String(value);fact.append(small,strong);facts.appendChild(fact)});detail.appendChild(facts);
  const actions=document.createElement('div');actions.className='completedDraftActions';const download=document.createElement('button');download.type='button';download.className='primary';download.textContent='Export Completed Draft JSON';download.addEventListener('click',()=>exportRecoveredCompletedDraft(entry.id));const close=document.createElement('button');close.type='button';close.className='ghost';close.textContent='Return to Current Draft';close.addEventListener('click',()=>closeCompletedDraftHistory());actions.append(download,close);detail.appendChild(actions);
  const picks=document.createElement('div');picks.className='completedDraftPickList';exported.draftHistory.forEach(pickRow=>{const row=document.createElement('div');row.className='completedDraftPick';const pickNumber=document.createElement('span'),name=document.createElement('span'),team=document.createElement('span');pickNumber.textContent=`#${pickRow.overallPick}`;name.textContent=pickRow.playerName||'Unknown player';team.textContent=`Slot ${pickRow.teamSlot??'?'}`;row.append(pickNumber,name,team);picks.appendChild(row)});detail.appendChild(picks);content.appendChild(detail);
}
function exportRecoveredCompletedDraft(entryId){
  const entry=recoveryEntry(entryId);if(!entry){alert('That completed draft is no longer available.');return false}
  try{const exportedAt=new Date().toISOString(),record=DraftWorkflowV1.buildRecoveryExport(entry,{playerIndex:fantasyHQPlayerIndex(),appVersion:APP_VERSION.label,exportedAt}),name=DraftWorkflowV1.filename({leagueName:entry.profileName,draftMode:record.draft.draftMode,status:'complete',date:exportedAt});downloadBlob(name,JSON.stringify(record,null,2),'application/json');return true}catch(error){alert(`Completed draft export failed: ${error.message}`);return false}
}
function confirmStartNewDraft(){
  const saved=draftSessionStore?.load();if(saved?.status==='active'&&!confirm('Start a new draft? The active saved draft will be replaced.'))return;
  try{if(saved?.status==='complete')archiveCompletedSnapshot(saved);else draftSessionStore?.clear()}catch(error){alert(`The completed draft could not be preserved, so a new draft was not started: ${error.message}`);return}replacingSavedDraft=true;DOM.resumeDraftCard?.classList.add('hidden');startDraft();replacingSavedDraft=false;
}
function applySavedSettings(settings={}){if(settings.teams!==undefined){const teamNode=el('teamCount');if(teamNode)teamNode.value=settings.teams;refreshDraftSlotOptions(settings.teams,settings.slot)}const values={draftSlot:settings.slot,scoring:settings.scoring,startQB:settings.startQB,startRB:settings.startRB,startWR:settings.startWR,startTE:settings.startTE,flexSpots:settings.flex,startK:settings.startK,startDST:settings.startDST,benchSpots:settings.bench,irSpots:settings.irSlots,passTD:settings.passTD,riskProfile:settings.risk};Object.entries(values).forEach(([id,value])=>{const node=el(id);if(node&&value!==undefined)node.value=value})}
function resumeSavedDraft(){
  try{const saved=draftSessionStore?.load();if(!saved)throw new Error('No saved draft is available.');if(saved.leagueProfileId&&activeLeagueProfile?.id&&saved.leagueProfileId!==activeLeagueProfile.id)throw new Error('Saved draft belongs to a different league profile.');mode=saved.mode||'practice';style=saved.style||'chaotic';slot=Number(saved.slot)||10;leagueContext={...leagueContext,...saved.settings};applyDraftStructure();slotManagers={...saved.managers};buildProfiles();history=saved.history.map(entry=>({...entry}));drafted=[...saved.drafted];pick=Number(saved.pick)||history.length+1;if(saved.currentPickOwner!=null&&Number(saved.currentPickOwner)!==teamForPick(pick))throw new Error('Saved draft owner does not match the restored snake order.');decisionSnapshots=[...(saved.decisionSnapshots||[])];excludedRecommendationIds=new Set(DraftWorkflowV1.normalizeExclusions(saved.excludedRecommendationIds,canonicalPlayerId));exclusionEvents=[...(saved.exclusionEvents||[])];selectedCandidateId=null;invalidateIntelligence();applySavedSettings({...saved.settings,slot});chooseMode(mode);DOM.setupScreen?.classList.add('hidden');DOM.appScreen?.classList.remove('hidden');DOM.changeBtn?.classList.remove('hidden');renderLeagueDnaBar();renderDraftTimeline();if(saved.status==='complete'){document.querySelector('.appgrid')?.classList.add('hidden');DOM.draftReport?.classList.remove('hidden');DOM.tabs?.classList.add('hidden');currentYahooRecord=mode==='yahoo'?(yahooArchive().find(record=>record.id===saved.archiveRecordId)||buildYahooRecord()):null;renderDraftReport();DOM.yahooExportCard?.classList.toggle('hidden',mode!=='yahoo');if(mode==='yahoo')updateArchiveCount()}else{DOM.draftReport?.classList.add('hidden');document.querySelector('.appgrid')?.classList.remove('hidden');DOM.tabs?.classList.remove('hidden');renderAll();installDraftNavigationGuard()}requestAnimationFrame(()=>window.scrollTo?.(0,0));}catch(error){alert(`Saved draft could not be resumed: ${error.message}`)}
}
function renderDraftTimeline(){if(!DOM.draftTimeline||!window.DraftSessionV1)return;const groups=DraftSessionV1.timeline(history,fantasyHQPlayerIndex(),leagueContext.teams||10);DOM.draftTimeline.innerHTML=groups.length?groups.map(group=>`<section class="timelineRound"><strong>Round ${group.round}</strong>${group.picks.map(entry=>`<div class="timelinePick"><span>${safeInsightText(entry.label)}</span><span>${safeInsightText(entry.playerName)}</span></div>`).join('')}</section>`).join(''):'<div class="timelineEmpty">Picks will appear here chronologically.</div>'}
function saveDraftNotebook(value){if(!window.DraftSessionV1)return;DraftSessionV1.saveNote(value);if(DOM.notebookStatus){DOM.notebookStatus.textContent='Saved just now';DOM.notebookStatus.dataset.savedAt=new Date().toISOString()}renderRoundNoteReminder()}
function clearDraftNotebook(){if(!DOM.draftNotebook||!confirm('Clear all draft notes?'))return;DOM.draftNotebook.value='';saveDraftNotebook('')}
function toggleNotebookExpanded(){document.getElementById('notesPanel')?.classList.toggle('notesExpanded')}
function openNotebook(){const panel=document.getElementById('notesPanel');if(!panel)return;panel.classList.remove('hidden');panel.focus();}
function closeNotebook(){const panel=document.getElementById('notesPanel');if(!panel)return;panel.classList.add('hidden');panel.classList.remove('notesExpanded');}
function dismissRoundNoteReminder(){dismissedNoteReminderRound=Math.min(info().r,TOTAL_ROUNDS);DOM.roundNoteReminder?.classList.add('hidden')}
function renderRoundNoteReminder(){
  if(!DOM.roundNoteReminder||!DOM.draftNotebook||!window.DraftSessionV1)return;
  const round=Math.min(info().r,TOTAL_ROUNDS),reminder=DraftSessionV1.remindersForRound(DOM.draftNotebook.value,round)[0];
  if(!reminder||dismissedNoteReminderRound===round){DOM.roundNoteReminder.classList.add('hidden');if(!reminder)DOM.roundNoteReminder.innerHTML='';return}
  DOM.roundNoteReminder.innerHTML=`<span><b>Round ${round} reminder</b>${safeInsightText(reminder.text||'Review your draft note for this round.')}</span><button type="button" aria-label="Dismiss round reminder" onclick="dismissRoundNoteReminder()">×</button>`;
  DOM.roundNoteReminder.classList.remove('hidden');
}
function initializeDraftReliability(){migrateRecoverableCompletedSessions();showSavedDraftPrompt();if(DOM.draftNotebook&&window.DraftSessionV1)DOM.draftNotebook.value=DraftSessionV1.loadNote();renderDraftTimeline()}
function activeDraftExists(){return Boolean(draftSessionStore?.hasActive()&&history.length&&pick<=TOTAL_PICKS)}
function installDraftNavigationGuard(){if(window.history?.state?.fantasyHQDraft)return;window.history?.pushState({fantasyHQDraft:true},'',window.location.href)}
window.addEventListener('beforeunload',event=>{if(!activeDraftExists())return;event.preventDefault();event.returnValue=''})
window.addEventListener('popstate',()=>{if(!activeDraftExists())return;if(confirm('Leave this active draft? Your progress is saved locally.'))return;window.history?.pushState({fantasyHQDraft:true},'',window.location.href)})
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('notesPanel')?.classList.contains('hidden'))closeNotebook()})
function startDraft() {
  try {
    if(draftSessionStore?.hasActive()&&!replacingSavedDraft){showSavedDraftPrompt();alert('An active draft is already saved. Resume it or choose Start New Draft.');return false}
    if (!players.length) {
      alert(
        'The player pool has not loaded yet. Refresh the installed website and wait for ‘Draft pool ready.’'
      );
      return;
    }
    saveActiveLeagueProfileSettings({quiet:true});
    mobileTeamExpanded = false;
    const rs = el('runtimeStatus');
    if (rs) {
      rs.classList.add('hidden');
      rs.innerHTML = '';
    }
    slot = +(document.getElementById('draftSlot')?.value || 10);
    style = document.getElementById('roomStyle')?.value || 'chaotic';
    leagueContext = {
      ...activeProfileSettings(),
      scoring: document.getElementById('scoring')?.value || 'half',
      startQB: +(document.getElementById('startQB')?.value || 1),
      startRB: +(document.getElementById('startRB')?.value || 2),
      startWR: +(document.getElementById('startWR')?.value || 3),
      startTE: +(document.getElementById('startTE')?.value || 1),
      flex: +(document.getElementById('flexSpots')?.value || 2),
      startK: +(document.getElementById('startK')?.value || 1),
      startDST: +(document.getElementById('startDST')?.value || 1),
      bench: +(document.getElementById('benchSpots')?.value || 6),
      irSlots: +(document.getElementById('irSpots')?.value || 0),
      passTD: +(document.getElementById('passTD')?.value || 6),
      teams: +(document.getElementById('teamCount')?.value || 10),
      completionPoint: 0.1,
      firstDownPoint: 0.1,
      bigPlayBonuses: true,
      enhancedDST: true,
      customKicker: true,
      risk: document.getElementById('riskProfile')?.value || 'balanced',
      strategy: 'auto',
    };
    applyDraftStructure();
    captureManagers();
    pick = 1;
    drafted = [];
    history = [];
    decisionSnapshots = [];
    excludedRecommendationIds = new Set();
    exclusionEvents = [];
    currentYahooRecord = null;
    selectedCandidateId = null;
    invalidateIntelligence();
    buildProfiles();
    if (typeof rosterRows !== 'function') throw new Error('Roster engine did not initialize');
    DOM.setupScreen?.classList.add('hidden');
    DOM.appScreen?.classList.remove('hidden');
    DOM.draftReport?.classList.add('hidden');
    document.querySelector('.appgrid')?.classList.remove('hidden');
    DOM.changeBtn?.classList.remove('hidden');
    DOM.tabs?.classList.remove('hidden');
    let modeName =
      mode === 'practice'
        ? '🟢 PRACTICE MOCK DRAFT'
        : mode === 'yahoo'
          ? '🟣 YAHOO LIVE MOCK • REAL PEOPLE'
          : '🔵 LIVE DRAFT DAY';
    if (DOM.modeBanner)
      DOM.modeBanner.innerHTML = `<div class="banner ${mode === 'practice' ? 'practiceBanner' : 'liveBanner'}"><span>${modeName}</span><span>${APP_VERSION.label} • Draft Slot ${slot} • ${slotManagers[slot]}</span></div>`;
    renderLeagueDnaBar();
    el('practiceControls')?.classList.toggle('hidden', mode !== 'practice');
    el('liveHelp')?.classList.toggle('hidden', mode === 'practice');
    renderAll();
    installDraftNavigationGuard();
    requestAnimationFrame(() => window.scrollTo?.(0, 0));
    return true;
  } catch (err) {
    console.error('Unable to start draft:', err);
    alert(
      `Fantasy HQ could not start the draft. Please refresh the ${APP_VERSION.label} build. Technical detail: ${err.message}`
    );
  }
}
function backToSetup() {
  DOM.appScreen?.classList.add('hidden');
  DOM.setupScreen?.classList.remove('hidden');
  DOM.changeBtn?.classList.add('hidden');
  DOM.tabs?.classList.add('hidden');
  document.getElementById('headerDraftContext')?.classList.add('hidden');
  showSavedDraftPrompt();
}
function buildProfiles() {
  aiProfiles = {};
  for (let t = 1; t <= (leagueContext.teams||10); t++) {
    if (t !== slot) aiProfiles[t] = getManager(t).archetype;
  }
}
function teamForPick(p) {
  const teams=leagueContext.teams||10;
  if(window.DraftMathV1)return DraftMathV1.teamForPick(p,teams);
  const round=Math.ceil(p/teams),within=((p-1)%teams)+1;
  return round%2?within:teams+1-within;
}
function info() {
  const teams=leagueContext.teams||10;
  if(window.DraftMathV1){const state=DraftMathV1.pickInfo({pick,size:teams,userSlot:slot,totalRounds:TOTAL_ROUNDS});return {r:state.round,ip:state.pickInRound,until:state.picksUntilNext};}
  let next=pick;while(next<=TOTAL_PICKS&&teamForPick(next)!==slot)next+=1;
  return {r:Math.ceil(pick/teams),ip:((pick-1)%teams)+1,until:Math.max(0,Math.min(TOTAL_PICKS,next)-pick)};
}
function canonicalPlayerId(value) {
  const requested = String(value ?? '');
  const player = playerIdentityIndex.get(requested);
  return String(player?.id ?? requested);
}
function isDraftedPlayer(id) {
  const canonicalId = canonicalPlayerId(id);
  return drafted.some(draftedId => canonicalPlayerId(draftedId) === canonicalId);
}
function playerByCanonicalId(id) {
  const canonicalId = canonicalPlayerId(id);
  return playerIdentityIndex.get(canonicalId) || null;
}
function isRecommendationExcluded(id){return excludedRecommendationIds.has(canonicalPlayerId(id))}
function exclusionAuditEvent(action,id){return{action,playerId:canonicalPlayerId(id),timestamp:new Date().toISOString(),overallPick:pick,round:info().r,leagueProfileId:activeLeagueProfile?.id||null}}
function excludeRecommendationPlayer(id,event){
  event?.stopPropagation?.();const player=playerByCanonicalId(id);if(!player||DOM.appScreen?.classList.contains('hidden'))return false;
  const canonicalId=canonicalPlayerId(player.id);if(excludedRecommendationIds.has(canonicalId))return true;
  excludedRecommendationIds.add(canonicalId);exclusionEvents.push(exclusionAuditEvent('excluded',canonicalId));if(String(selectedCandidateId)===canonicalId)selectedCandidateId=null;invalidateIntelligence();renderAll();persistDraftSession(pick>TOTAL_PICKS?'complete':'active');return true;
}
function restoreRecommendationPlayer(id){
  const canonicalId=canonicalPlayerId(id);if(!excludedRecommendationIds.delete(canonicalId))return false;
  exclusionEvents.push(exclusionAuditEvent('restored',canonicalId));invalidateIntelligence();renderAll();persistDraftSession(pick>TOTAL_PICKS?'complete':'active');return true;
}
function toggleExcludedPlayers(){const panel=el('excludedPlayersPanel'),button=el('excludedPlayersButton');if(!panel)return;const opening=panel.classList.contains('hidden');panel.classList.toggle('hidden',!opening);button?.setAttribute('aria-expanded',String(opening));renderExcludedPlayers()}
function renderExcludedPlayers(){
  const button=el('excludedPlayersButton'),panel=el('excludedPlayersPanel'),ids=[...excludedRecommendationIds];if(button)button.textContent=`Excluded (${ids.length})`;if(!panel)return;
  panel.innerHTML=ids.length?ids.map(id=>{const player=playerByCanonicalId(id),draftedState=isDraftedPlayer(id);return `<div><span><b>${safeInsightText(player?.name||`Player ${id}`)}</b><small>${safeInsightText(player?`${positionKey(player)} • ${player.team||'—'}`:'Canonical player')}</small></span><button type="button" class="ghost" onclick="restoreRecommendationPlayer('${safeInsightText(id)}')">Restore${draftedState?' (drafted)':''}</button></div>`}).join(''):'<span class="meta">No players are excluded from recommendations.</span>';
}
function available() {
  return players.filter(p => !isDraftedPlayer(p.id));
}
function myPlayers() {
  return managerRoster(slot);
}
function managerRosterEntries(team) {
  return history
    .filter(h => h.team === team)
    .map(h => ({ id: h.id, player: players.find(p => p.id === h.id) || null, draftOrder: h.pick }));
}
function myRosterEntries() {
  return managerRosterEntries(slot);
}
function rosterViewStateForTeam(team) {
  return RosterViewV1.assignSlots({ slots: rosterSlots, draftedEntries: managerRosterEntries(team) });
}
function rosterViewState() {
  return rosterViewStateForTeam(slot);
}
/*
  Manager-scoped helpers intentionally share the production roster/completion
  engines. They let deterministic all-manager audits change context without
  inventing a second recommendation engine.
*/
function managerRoster(team) {
  return history
    .filter(h => h.team === team)
    .map(h => players.find(p => p.id === h.id))
    .filter(Boolean);
}
function counts() {
  let c = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  myPlayers().forEach(p => {
    const position = positionKey(p);
    if (c[position] !== undefined) c[position]++;
  });
  return c;
}
function configuredStarterTarget(pos) {
  const key = { QB: 'startQB', RB: 'startRB', WR: 'startWR', TE: 'startTE', K: 'startK', DST: 'startDST' }[pos],
    fallback = { QB: 1, RB: 2, WR: 3, TE: 1, K: 1, DST: 1 }[pos] ?? 0;
  return key ? Number(leagueContext[key] ?? fallback) : 0;
}
function userPositionFilled(pos) {
  let c = counts();
  return ['QB', 'TE', 'K', 'DST'].includes(pos) && c[pos] >= configuredStarterTarget(pos);
}

const searchNormalizations = [
  [/\./g, ''],
  [/\bjr\b/gi, ''],
  [/\bii\b/gi, ''],
  [/\biii\b/gi, ''],
  [/\biv\b/gi, ''],
  [/\bvi\b/gi, ''],
  [/\bthe\b/gi, ''],
  [/[^a-z0-9 ]+/gi, ' '],
  [/\s+/g, ' '],
];
function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/\./g, ' ')
    .replace(/\b(jr|ii|iii|iv|vi)\b/gi, '')
    .replace(/[^a-z0-9 ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function buildPlayerSearchIndex() {
  playerIdentityIndex = new Map();
  players.forEach(p => {
    p.__searchKey =
      normalizeSearchText(p.name || '') +
      ' ' +
      normalizeSearchText(p.team || '') +
      ' ' +
      normalizeSearchText(String(p.id)) +
      ' ' +
      (p.identityAliases || []).map(normalizeSearchText).join(' ') +
      ' ' +
      (p.legacyIds || []).map(value => normalizeSearchText(String(value))).join(' ');
    p.__stableId =
      p.id != null ? String(p.id) : normalizeSearchText(p.name) + '|' + normalizeSearchText(p.team);
    playerIdentityIndex.set(String(p.id), p);
    (p.legacyIds || []).forEach(legacyId => playerIdentityIndex.set(String(legacyId), p));
  });
}
function playerMatchesQuery(player, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchKey = [player.name, ...(player.identityAliases || []), player.team, player.pos,
    positionKey(player), player.id, ...(player.legacyIds || [])]
    .map(value => normalizeSearchText(value))
    .filter(Boolean)
    .join(' ');

  return searchKey.includes(normalizedQuery);
}
// Deprecated scoring compatibility wrapper. Display code should request an explicit tier context.
function tierLabel(p) {
  if (window.PlayerTierContract) return PlayerTierContract.getDecisionTier(p);
  let t = String(p?.posTier || p?.overallTier || 'C').toUpperCase();
  return ['S', 'A', 'B', 'C', 'D', 'E', 'F'].includes(t) ? t : 'C';
}
function tierWeight(t) {
  return { S: 5, A: 4, B: 3, C: 2, D: 1, E: 0, F: 0 }[t] ?? 2;
}
function tierBadge(p) {
  let t = PlayerTierContract.getDecisionTier(p);
  return `<span class="tierBadge tier-${t}" aria-label="Decision Tier ${t}">${t} Decision Tier</span>`;
}
function positionTierCounts(pos, team = slot) {
  let out = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  managerRoster(team)
    .filter(p => (p.pos === 'DEF' ? 'DST' : p.pos) === pos)
    .forEach(p => {
      let t = tierLabel(p);
      out[t] = (out[t] || 0) + 1;
    });
  return out;
}
function positionStrength(pos) {
  let tc = positionTierCounts(pos),
    score = tc.S * 5 + tc.A * 4 + tc.B * 2.5 + tc.C;
  let starters = configuredStarterTarget(pos);
  let count = managerPositionCounts(slot)[pos] || 0;
  if (score >= starters * 4) return 'Elite';
  if (score >= starters * 3) return 'Strong';
  if (count >= starters) return 'Adequate';
  if (count > 0) return 'Thin';
  return 'Critical';
}
function rosterFitModifier(p) {
  if (!['RB', 'WR', 'QB', 'TE'].includes(p.pos)) return 0;
  let strength = positionStrength(p.pos),
    t = tierLabel(p),
    m = 0;
  if (strength === 'Critical') m += 5;
  else if (strength === 'Thin') m += 4;
  else if (strength === 'Adequate') m += 2;
  else if (strength === 'Strong') m -= 1;
  else if (strength === 'Elite') m -= 2;
  if ((t === 'S' || t === 'A') && ['RB', 'WR'].includes(p.pos)) m += 1;
  const rosterContextScale = Math.min(1, myPlayers().length / 5);
  return Math.round(m * rosterContextScale * 100) / 100;
}
function roomBoost(p) {
  if (!['RB', 'WR', 'QB', 'TE'].includes(p.pos)) return 0;
  let x = marketPressure(p.pos);
  return x.pressure >= 82
    ? 5
    : x.pressure >= 65
      ? 4
      : x.pressure >= 45
        ? 2
        : x.pressure >= 22
          ? 1
          : 0;
}
function baseFinalScore(p) {
  return Math.max(1, Math.min(110, mambaScore(p) + roomBoost(p) + rosterFitModifier(p)));
}
function reliableOverallRank(p) {
  const rank = Number(p?.overall ?? p?.fantasylandOverallRank ?? p?.fantasyProsOverallRank);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}
function reliableSpecialistRank(p) {
  const sourceRank = window.SpecialistRankingsV1?.positionRank(p), fallback = Number(p?.posRank);
  return sourceRank ?? (Number.isFinite(fallback) && fallback > 0 ? fallback : null);
}
function decisionModifiers(p) {
  if (!window.JoninDecisionIntelligenceV1) return { specialist: { adjustment: 0 }, depth: { adjustment: 0 }, upside: { adjustment: 0 }, injury: window.InjuryIntelligenceV1 ? InjuryIntelligenceV1.decisionAdjustment({record:p?.injury||{},now:new Date().toISOString()}) : {adjustment:0,status:'UNKNOWN',freshness:'UNKNOWN'} };
  const completion = rosterCompletionState(), c = positionalCountsAll(), position = positionKey(p), rank = reliableOverallRank(p), round = info().r;
  const missingSpecialists = Number(c.K < (leagueContext.startK || 1)) + Number(c.DST < (leagueContext.startDST || 1));
  const meaningfulSkillValue = available().some(candidate => ['QB','RB','WR','TE'].includes(positionKey(candidate)) && ((reliableOverallRank(candidate) ?? 999) <= Math.max(180,pick+50) || ['S','A','B'].includes(PlayerTierContract.getOverallTier(candidate))));
  const specialistRank = reliableSpecialistRank(p), samePosition = available().filter(candidate => positionKey(candidate) === position), higherRankedRemaining = specialistRank == null ? 0 : samePosition.filter(candidate => { const candidateRank = reliableSpecialistRank(candidate); return candidateRank != null && candidateRank < specialistRank; }).length;
  const recentSpecialists = history.slice(-Math.max(6,leagueContext.teams||10)).map(entry=>players.find(candidate=>candidate.id===entry.id)).filter(candidate=>candidate&&positionKey(candidate)===position).length;
  const specialist = JoninDecisionIntelligenceV1.specialistEconomics({position,round,totalRounds:TOTAL_ROUNDS,userPicksRemaining:completion.userPicksRemaining,missingSpecialists,completionForced:completion.mode!=='NORMAL'&&completion.requiredPositions.includes(position),meaningfulSkillValue,positionRank:specialistRank,hasReliableRank:specialistRank!=null,higherRankedRemaining,recentSpecialists,positionAvailable:samePosition.length,picksUntil:info().until,unfilledSkillStarters:completion.unfilledRequiredSlots-missingSpecialists});
  const depth = JoninDecisionIntelligenceV1.marginalRosterUtility({position,counts:c,startRB:leagueContext.startRB,startWR:leagueContext.startWR,flex:leagueContext.flex,playerValueGap:valueGap(p)});
  const upside = JoninDecisionIntelligenceV1.stageAwareUpside({round,rookie:p.rookie===true,tier:PlayerTierContract.getOverallTier(p),roleSecurity:p.roleSecurity});
  const starterTarget={QB:leagueContext.startQB||1,RB:leagueContext.startRB||2,WR:leagueContext.startWR||3,TE:leagueContext.startTE||1}[position]||0,foundational=round<=5&&starterTarget>0&&Number(c[position]||0)<starterTarget,portfolio=myPlayers().filter(player=>{const status=InjuryIntelligenceV1?.normalize(player.injury||{}).status;return status&&status!=='ACTIVE'&&status!=='UNKNOWN'}).length,rosterState=rosterViewState(),usedIr=myPlayers().filter(player=>InjuryIntelligenceV1?.IR_ELIGIBLE?.has(InjuryIntelligenceV1.normalize(player.injury||{}).status)).length;
  const injury = window.InjuryIntelligenceV1 ? InjuryIntelligenceV1.decisionAdjustment({record:p.injury||{},now:new Date().toISOString(),round,foundational,valueFall:rank==null?0:Math.max(0,pick-rank),injuredPortfolio:portfolio,irSlots:leagueContext.irSlots??0,usedIrSlots:usedIr,benchSlots:leagueContext.bench||0,benchUsed:(rosterState.bench||[]).length}) : {adjustment:0,status:'UNKNOWN',freshness:'UNKNOWN',reason:'Injury intelligence is unavailable.'};
  return { specialist, depth, upside, injury };
}
function valueGap(p) {
  const context=recommendationCandidateContext(),best=context.mambaLeaders.find(row=>String(row.player.id)!==String(p.id));
  return mambaScore(p) - (best?.score || 0);
}
function valueOverride(p) {
  let fall = Math.max(0, pick - (p.overall || pick)),
    gap = valueGap(p),
    t = tierLabel(p);
  return gap >= 7 || ((t === 'S' || t === 'A') && fall >= 20);
}
function eternalValue(p) {
  let t = tierLabel(p),
    score = mambaScore(p);
  if (window.FlightControlV1?.eternalMangekyoActive)
    return FlightControlV1.eternalMangekyoActive({ tier: t, overall: p.overall, pick, score });
  let fall = Math.max(0, pick - (p.overall || pick));
  return (t === 'S' || t === 'A') && fall >= 40 && score >= 90;
}
function sourcePriorComponents(p) {
  const rank = reliableOverallRank(p), overallTier = PlayerTierContract.getOverallTier(p), positionTier = PlayerTierContract.getPositionTier(p);
  const sourceRankValue = rank == null ? 55 : 112 - Math.min(220, rank - 1) * 0.45;
  const overallTierValue = ({S:2,A:1,B:0,C:-0.5,D:-1,E:-1.5,F:-2}[overallTier] ?? -1);
  const positionalTierValue = ({S:0.75,A:0.4,B:0.15,C:0,D:-0.15,E:-0.25,F:-0.35}[positionTier] ?? 0);
  const mambaContribution = (mambaScore(p) - 85) * 0.12;
  return Object.freeze({rank,sourceRankValue,overallTierValue,positionalTierValue,mambaContribution,total:sourceRankValue+overallTierValue+positionalTierValue+mambaContribution});
}
function earlyContextWeight(round=info().r) {
  return ({1:0.2,2:0.3,3:0.45,4:0.6,5:0.75}[Number(round)] ?? 1);
}
function strategicPlayer(p) {
  return {id:p.id,name:p.name,pos:positionKey(p),sourceRank:reliableOverallRank(p),overallTier:PlayerTierContract.getOverallTier(p),positionRank:p.fantasylandPositionRank??p.posRank??null,positionTier:PlayerTierContract.getPositionTier(p),rookie:recommendationPersonalization&&p.rookie===true,leagueBreaker:recommendationPersonalization&&p.leagueBreaker===true,coreTarget:recommendationPersonalization&&p.coreTarget===true,roleSecurity:p.roleSecurity??null,workhorse:p.workhorse===true};
}
function recommendationCandidateContext(){
  if(candidateContextCache?.epoch===intelligenceEpoch)return candidateContextCache;
  const availablePlayers=available(),eligiblePlayers=availablePlayers.filter(recommendationEligible),positionPools=new Map();
  availablePlayers.forEach(player=>{const position=positionKey(player);if(!positionPools.has(position))positionPools.set(position,[]);positionPools.get(position).push(player)});
  candidateContextCache={epoch:intelligenceEpoch,availablePlayers,eligiblePlayers,strategicCandidates:eligiblePlayers.map(strategicPlayer),strategicRoster:myPlayers().map(strategicPlayer),positionPools,mambaLeaders:eligiblePlayers.map(player=>({player,score:mambaScore(player)})).sort((a,b)=>b.score-a.score||String(a.player.id).localeCompare(String(b.player.id),undefined,{numeric:true}))};
  return candidateContextCache;
}
function picksUntilNextOwnedSelection(team=slot) {
  for(let next=pick+1;next<=TOTAL_PICKS;next++)if(teamForPick(next)===Number(team))return next-pick;
  return 0;
}
function acquisitionContext(p) {
  const position=positionKey(p),currentTier=tierLabel(p),currentTierIndex=DraftStrategyEngineV1?.tierIndex?.(currentTier),positionPool=recommendationCandidateContext().positionPools.get(position)||[],sameTierRemaining=positionPool.filter(candidate=>candidate.id!==p.id&&tierLabel(candidate)===currentTier).length,lowerTier=positionPool.filter(candidate=>{const index=DraftStrategyEngineV1?.tierIndex?.(tierLabel(candidate));return candidate.id!==p.id&&currentTierIndex!=null&&index!=null&&index>currentTierIndex}).sort((a,b)=>(reliableOverallRank(a)??999)-(reliableOverallRank(b)??999))[0],lowerTierIndex=lowerTier?DraftStrategyEngineV1.tierIndex(tierLabel(lowerTier)):null;
  return {picksUntil:picksUntilNextOwnedSelection(),sameTierRemaining,expectedPositionSelections:expectedDraftedBeforeNext(position),nextTierDrop:lowerTierIndex==null||currentTierIndex==null?0:Math.max(0,lowerTierIndex-currentTierIndex),survivalRisk:survivalRisk(p)};
}
function finalDecisionTrace(p) {
  const key = `${intelligenceEpoch}:${p.id}`;
  if (decisionTraceCache.has(key)) return decisionTraceCache.get(key);
  const modifiers=decisionModifiers(p),sourcePrior=sourcePriorComponents(p),round=info().r,contextWeight=earlyContextWeight(round),valueOverrideAdjustment=valueOverride(p)?3:0,eternalAdjustment=eternalValue(p)?4:0;
  const context=Object.freeze({mamba:mambaScore(p),roomBoost:roomBoost(p),rosterFit:rosterFitModifier(p),valueOverride:valueOverrideAdjustment,eternal:eternalAdjustment,specialist:modifiers.specialist.adjustment,depth:modifiers.depth.adjustment,upside:modifiers.upside.adjustment});
  const legacyBeforeInjury=context.mamba+context.roomBoost+context.rosterFit+context.valueOverride+context.eternal+context.specialist+context.depth+context.upside;
  const specialist=['K','DST'].includes(positionKey(p)),blendedBeforeInjury=specialist?legacyBeforeInjury:sourcePrior.total*(1-contextWeight)+legacyBeforeInjury*contextWeight;
  const priceContext=acquisitionContext(p),candidateContext=recommendationCandidateContext(),strategy=window.DraftStrategyEngineV1?DraftStrategyEngineV1.evaluateCandidate({player:strategicPlayer(p),baseScore:blendedBeforeInjury,pick,round,leagueSize:leagueContext.teams||10,picksUntil:info().until,roster:candidateContext.strategicRoster,candidates:candidateContext.strategicCandidates,config:leagueContext,completionForced:rosterCompletionState().mode==='HARD',personalizedFoundation:recommendationPersonalization,tierCliff:marketPressure(positionKey(p)).tierCliff,...priceContext}):null;
  const strategicBeforeInjury=strategy?.score??blendedBeforeInjury,finalDecisionScore=Math.max(1,strategicBeforeInjury+modifiers.injury.adjustment);
  const trace=Object.freeze({sourcePrior,contextWeight,context,legacyBeforeInjury,blendedBeforeInjury,strategy,strategicBeforeInjury,injuryAdjustment:modifiers.injury.adjustment,modifiers,finalDecisionScore});decisionTraceCache.set(key,trace);return trace;
}
function finalDecisionScore(p) {
  return finalDecisionTrace(p).finalDecisionScore;
}
function finalPickScore(p) {
  return Math.round(finalDecisionScore(p));
}
function sharinganIconMarkup(stage = 'three') {
  const key = ['one', 'two', 'three', 'mangekyo', 'eternal'].includes(stage) ? stage : 'three';
  let inner = '';
  if (key === 'mangekyo') {
    inner =
      '<path class="ms-core" d="M12 2.2c1.5 3.5 3.7 5.7 7.4 7.4-3.5 1.4-5.7 3.7-7.4 7.4-1.5-3.7-3.8-6-7.4-7.4C8.2 8 10.5 5.7 12 2.2Z"/><path class="ms-cut" d="M12 4.1 14.2 10 20 12l-5.8 2L12 19.9 9.8 14 4 12l5.8-2L12 4.1Z"/>';
  } else if (key === 'eternal') {
    inner =
      '<path class="ems-outer" d="M12 1.9 15 7.5l6.1.8-4.4 4.3 1 6.1-5.7-2.9-5.7 2.9 1-6.1-4.4-4.3 6.1-.8L12 1.9Z"/><path class="ems-inner" d="M12 4.3c1.1 3 2.9 4.8 5.8 5.8-2.9 1.1-4.7 2.9-5.8 5.8-1.1-2.9-2.9-4.7-5.8-5.8C9.1 9 10.9 7.2 12 4.3Z"/><circle cx="12" cy="12" r="2.1" class="pupil"/>';
  } else {
    const count = key === 'one' ? 1 : key === 'two' ? 2 : 3;
    let tomoe = '';
    for (let i = 0; i < count; i++) {
      const a = i * (360 / count);
      tomoe += `<g transform="rotate(${a} 12 12)"><circle cx="12" cy="5.6" r="1.65" class="tomoeDot"/><path d="M13.2 6.1c2 .8 2.9 2.1 3 3.8-1.1-1.2-2.2-1.7-3.7-1.8Z" class="tomoeTail"/></g>`;
    }
    inner = tomoe + '<circle cx="12" cy="12" r="2.15" class="pupil"/>';
  }
  return `<span class="sharinganIcon sharingan-${key}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="10.5" class="iris"/><circle cx="12" cy="12" r="8.6" class="ring"/>${inner}</svg></span>`;
}
function renderLeagueDnaBar() {
  const node = document.getElementById('leagueDnaBar');
  if (!node) return;
  const scoringLabel =
    leagueContext.scoring === 'full'
      ? 'Full PPR'
      : leagueContext.scoring === 'standard'
        ? 'Standard'
        : 'Half-PPR';
  node.innerHTML = `<div><b>${safeInsightText(activeLeagueProfile?.displayName||'League')} DNA</b><span>${leagueContext.teams || 10} teams • ${scoringLabel} • ${leagueContext.startRB} RB • ${leagueContext.startWR} WR • ${leagueContext.flex} FLEX • ${leagueContext.passTD}-point pass TD • ${TOTAL_ROUNDS} rounds</span></div><div class="leagueDnaSignals"><span>${safeInsightText(activeLeagueProfile?.platform||'Local')}</span><span>${safeInsightText(activeLeagueProfile?.draftType||'Draft')}</span><span>${leagueContext.irSlots||0} IR</span></div>`;
}
function leagueSpecificModifier(p) {
  let m = 0,
    t = tierLabel(p),
    pr = +(p.posRank || 99);
  if (p.pos === 'QB') {
    if (pr <= 4) m += 5;
    else if (pr <= 8) m += 2;
    else if (pr > 12) m -= 2;
    if (p.leagueBreaker) m += 2;
  }
  if (['RB', 'WR'].includes(p.pos)) {
    if (p.leagueBreaker) m += 3;
    if (t === 'S' || t === 'A') m += 2;
    m += 1;
  }
  if (p.pos === 'TE' && (t === 'S' || t === 'A')) m += 2;
  if (p.pos === 'DST') m += 2;
  return m;
}
function sharinganStage(p) {
  if (eternalValue(p))
    return { key: 'eternal', label: 'ETERNAL MANGEKYŌ', meaning: 'Season-Changing Value' };
  if (valueOverride(p)) return { key: 'mangekyo', label: 'MANGEKYŌ', meaning: 'Value Override' };
  let s = finalPickScore(p);
  if (s >= 96) return { key: 'three', label: 'THREE TOMOE', meaning: 'Elite Value' };
  if (s >= 90) return { key: 'two', label: 'TWO TOMOE', meaning: 'Excellent Value' };
  return { key: 'one', label: 'ONE TOMOE', meaning: 'Good Pick' };
}
function recommendationEligible(p) {
  if (isRecommendationExcluded(p.id)) return false;
  if (userPositionFilled(p.pos)) return false;
  return true;
}

function rosterCompletionStateForTeam(team) {
  if (!window.RosterCompletionConstraintV1 || !window.RosterViewV1) return null;
  return RosterCompletionConstraintV1.buildState({
    rosterState: rosterViewStateForTeam(team),
    rosterSlots,
    draftedEntries: managerRosterEntries(team),
    availablePlayers: available(),
    currentPick: pick,
    totalPicks: TOTAL_PICKS,
    userTeam: team,
    teamForPick,
    rosterEngine: RosterViewV1,
  });
}
function rosterCompletionState() {
  return rosterCompletionStateForTeam(slot);
}
function completionConstrainedPool(pool, state = rosterCompletionState()) {
  return RosterCompletionConstraintV1.constrainPool(pool, state);
}
function recommendationSelectionAllowed(player, state = rosterCompletionState()) {
  return RosterCompletionConstraintV1.candidateAllowed(player, state);
}
function selectMarketFloorCandidate(rows = []) {
  if (!rows.length || rows.some(row => row.defensible !== false))
    return Object.freeze({ active: false, playerId: null });
  const eligible = rows.filter(row => !row.blockedAcquisition && !row.chaseDetected && !row.unsupportedSaturation);
  if (!eligible.length) return Object.freeze({ active: false, playerId: null });
  const selected = eligible.slice().sort((a, b) => (a.acquisitionPenalty ?? Infinity) - (b.acquisitionPenalty ?? Infinity) || (a.sourceRank ?? Infinity) - (b.sourceRank ?? Infinity) || (b.upsideOffset ?? 0) - (a.upsideOffset ?? 0) || (b.finalDecisionScore ?? -Infinity) - (a.finalDecisionScore ?? -Infinity) || String(a.playerId).localeCompare(String(b.playerId)))[0];
  const confidence = Math.max(10, Math.min(40, Number(selected.integrityConfidence ?? 55) - 15));
  return Object.freeze({active:true,playerId:selected.playerId,label:'POOR_MARKET_POCKET_FALLBACK',confidence,confidenceLabel:'Low confidence',acquisitionPenalty:selected.acquisitionPenalty??null,sourceRank:selected.sourceRank??null,upsideSignals:Object.freeze([...(selected.upsideSignals||[])]),reason:`Every available skill-position option fails acquisition integrity; ${selected.playerName} is the least-cost non-blocked fallback by acquisition penalty, source rank, and documented upside.`});
}
function recommendationMarketFloor(decision, state = rosterCompletionState()) {
  const rows = (decision?.all || []).filter(item => !['K', 'DST'].includes(positionKey(item.player))).map(item => {
    const strategy = finalDecisionTrace(item.player).strategy, integrity = strategy?.integrity;
    return {playerId:item.playerId,playerName:item.player.name,defensible:integrity?.defensible,blockedAcquisition:integrity?.blockedAcquisition,chaseDetected:integrity?.chaseDetected,unsupportedSaturation:integrity?.unsupportedSaturation,acquisitionPenalty:strategy?.priceOfAcquisition?.penalty,sourceRank:reliableOverallRank(item.player),upsideOffset:strategy?.benchPortfolio?.offset,upsideSignals:strategy?.benchPortfolio?.signals,finalDecisionScore:item.scores.finalDecision,integrityConfidence:integrity?.confidence};
  });
  return selectMarketFloorCandidate(rows);
}
function recommendationIntegrityPriority(item, state = rosterCompletionState(), marketFloorPlayerId = null) {
  const strategy = finalDecisionTrace(item.player).strategy;
  const fillsRequiredSlot = state?.mode !== 'NORMAL' && state?.requiredPositions?.includes(positionKey(item.player));
  if (['K', 'DST'].includes(positionKey(item.player)) && !fillsRequiredSlot) return 2;
  if (String(item.playerId) === String(marketFloorPlayerId)) return 0;
  return strategy?.integrity?.defensible === false && !fillsRequiredSlot ? 1 : 0;
}

// Developer-only visual override (debug panel toggles these). These do NOT change draft logic.
window.__devSharinganStage = null; // e.g. 'one','two','three','mangekyo','eternal','dormant'
window.__devSharinganReason = null;

function setDevSharinganStage(key, reason) {
  window.__devSharinganStage = key || null;
  window.__devSharinganReason = reason || null;
  try {
    renderRecommendation();
  } catch (e) {
    console.error('renderRecommendation error', e);
  }
}

function triggerDevSharinganActivation() {
  // Trigger activation for the developer-chosen visual stage if present,
  // otherwise determine the current visible stage from the DOM and trigger.
  const key = window.__devSharinganStage || null;
  if (key) {
    applySharinganActivation(key);
    return;
  }
  // No override: inspect DOM to find the current sharingan panel class
  const node = el('recommendation');
  if (!node) return;
  const panel = node.querySelector('.sharinganPanel');
  if (panel) {
    // panel has a class like 'one','two','three','mangekyo','eternal','dormant'
    const classes = Array.from(panel.classList);
    const stage = classes.find(c =>
      ['one', 'two', 'three', 'mangekyo', 'eternal', 'dormant'].includes(c)
    );
    applySharinganActivation(stage || null);
    return;
  }
  // Fallback: trigger on recommendation card only
  applySharinganActivation(null);
}

function createSharinganDebugPanel() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('debug') || !params.get('debug').includes('sharingan')) return;
    if (document.getElementById('devSharinganPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'devSharinganPanel';
    panel.className = 'devSharinganPanel';
    panel.innerHTML = `
      <div class="devHeader">Sharingan Debug</div>
      <div class="devButtons">
        <button class="dbgBtn" data-stage="dormant">Dormant</button>
        <button class="dbgBtn" data-stage="one">One Tomoe</button>
        <button class="dbgBtn" data-stage="two">Two Tomoe</button>
        <button class="dbgBtn" data-stage="three">Three Tomoe</button>
        <button class="dbgBtn" data-stage="mangekyo">Mangekyō</button>
        <button class="dbgBtn" data-stage="eternal">Eternal Mangekyō</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button id="dbgTrigger" class="primary">Trigger Activation Animation</button>
        <button id="dbgClear" class="ghost">Clear Override</button>
      </div>
      <div class="devNote">Debug only — visible when <code>?debug=sharingan</code> is present</div>
    `;
    document.body.appendChild(panel);
    panel.querySelectorAll('.dbgBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.stage;
        const reasonMap = {
          one: 'Falling Value Detected',
          two: 'Positional Run Developing',
          three: 'Tier Collapse Detected',
          mangekyo: 'Opponent Snipe Risk',
          eternal: 'Critical Draft Decision',
          dormant: 'Hold Pattern',
        };
        setDevSharinganStage(key, reasonMap[key] || '');
      });
    });
    document
      .getElementById('dbgTrigger')
      .addEventListener('click', () => triggerDevSharinganActivation());
    document.getElementById('dbgClear').addEventListener('click', () => {
      setDevSharinganStage(null, null);
    });
  } catch (e) {
    console.error('createSharinganDebugPanel', e);
  }
}

function buildPlayerAuditPanel() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('debug') || !params.get('debug').includes('players')) return;
    if (document.getElementById('playerAuditPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'playerAuditPanel';
    panel.className = 'devSharinganPanel';
    const required = [
      'Mark Andrews',
      'Jordan Love',
      'Bijan Robinson',
      'Justin Jefferson',
      'Trey McBride',
      'Caleb Williams',
      'Terry McLaurin',
      'Rhamondre Stevenson',
      'Jake Ferguson',
    ];
    const positionCounts = players.reduce((acc, p) => {
      const pos = p.pos || '<missing>';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {});
    const duplicateKeys = players.reduce((acc, p) => {
      const key = String(
        p.id != null
          ? p.id
          : normalizeSearchText(p.name || '') + '|' + normalizeSearchText(p.team || '')
      );
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const duplicateList = Object.entries(duplicateKeys)
      .filter(([k, v]) => v > 1)
      .map(([k, v]) => `${k} (${v})`);
    const requiredStatus = required.map(name => ({
      name,
      found: players.some(p => normalizeSearchText(p.name) === normalizeSearchText(name)),
    }));
    panel.innerHTML = `
      <div class="devHeader">Player Data Audit</div>
      <div class="devNote">Developer mode only — use <code>?debug=players</code>.</div>
      <div style="margin-top:10px"><b>Total players:</b> ${players.length}</div>
      <div style="margin-top:8px"><b>Position counts:</b> ${Object.entries(positionCounts)
        .map(([pos, count]) => `${pos}:${count}`)
        .join(', ')}</div>
      <div style="margin-top:8px"><b>Players missing IDs:</b> ${players.filter(p => p.id == null || p.id === '').length}</div>
      <div style="margin-top:8px"><b>Duplicate stable IDs:</b> ${duplicateList.length ? duplicateList.join(', ') : 'None'}</div>
      <div style="margin-top:8px"><b>Required players:</b><ul>${requiredStatus.map(item => `<li>${item.name}: ${item.found ? '<span style="color:#8cf">FOUND</span>' : '<span style="color:#f88">MISSING</span>'}</li>`).join('')}</ul></div>
      <div style="margin-top:8px"><button class="primary" id="runPlayerAudit">Run audit</button></div>
      <div id="playerAuditResults" style="margin-top:10px;max-height:280px;overflow:auto;background:#0f141d;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.08)"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById('runPlayerAudit').addEventListener('click', () => {
      const lines = [];
      lines.push(`Total players: ${players.length}`);
      lines.push(
        `Duplicate stable IDs: ${duplicateList.length ? duplicateList.join(', ') : 'None'}`
      );
      lines.push('Required players:');
      requiredStatus.forEach(item =>
        lines.push(`  ${item.name}: ${item.found ? 'FOUND' : 'MISSING'}`)
      );
      lines.push('');
      lines.push('Search normalization examples:');
      const examples = [
        'Mark Andrews',
        'mark andrews',
        'Jordan Love',
        'jordan love',
        'D.J. Moore',
        'DJ Moore',
        'Chris Godwin Jr',
        'Chris Godwin',
      ];
      examples.forEach(ex => {
        const match = players.find(p => playerMatchesQuery(p, ex));
        lines.push(`  "${ex}" -> ${match ? `${match.name} (${match.team || '?'})` : 'NO MATCH'}`);
      });
      document.getElementById('playerAuditResults').innerHTML =
        `<pre style="white-space:pre-wrap;word-break:break-word;color:#d1d4e0">${lines.join('\n')}</pre>`;
    });
  } catch (e) {
    console.error('buildPlayerAuditPanel', e);
  }
}

window.addEventListener('load', createSharinganDebugPanel);
window.addEventListener('load', buildPlayerAuditPanel);
function expected() {
  return blueprint[Math.min(info().r - 1, 5)] || 'BPA';
}
function fit(p) {
  let e = expected();
  return e === 'BPA' ? 0 : e === p.pos ? 18 : e.includes(p.pos) ? 15 : -4;
}
function positionalSourceBlend(p) {
  let fp = p.fantasyProsPosRank || p.posRank || 50,
    fl = p.posRank || fp,
    bd = p.bdgeRank || fl,
    fk = p.flockRank || fl;
  // Gerard trusts analyst intelligence more than generic consensus.
  return 100 - (bd * 0.35 + fl * 0.3 + fk * 0.25 + fp * 0.1) * 1.35;
}
function overallSourceBlend(p) {
  const ranks = [p.overall, p.fantasyProsOverallRank]
    .map(Number)
    .filter(rank => Number.isFinite(rank) && rank > 0);
  if (!ranks.length) return null;
  return 100 - (ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length) * 1.35;
}
// Compatibility path for Mamba and same-position evaluation. Cross-position
// Player Value uses crossPositionValueBase() at the championship boundary.
function sourceBlend(p) {
  return positionalSourceBlend(p);
}
function crossPositionValueBase(p) {
  const overallBlend = overallSourceBlend(p),
    positionalBlend = positionalSourceBlend(p),
    mamba = mambaScore(p);
  if (overallBlend === null) return mamba;
  return Math.max(1, Math.min(99, mamba + (overallBlend - positionalBlend) / 5));
}
function formatModifier(p) {
  let m = 0;
  if (
    leagueContext.scoring === 'full' &&
    p.pos === 'RB' &&
    p.opportunityTrend &&
    /receiv|target/i.test(p.opportunityTrend)
  )
    m += 3;
  if (leagueContext.startWR === 3 && p.pos === 'WR') m += 5;
  if (leagueContext.flex === 2 && ['RB', 'WR'].includes(p.pos)) m += 3;
  if (leagueContext.risk === 'aggressive' && (p.leagueBreaker || p.rookie)) m += 5;
  if (leagueContext.risk === 'safe' && p.availabilityRisk === 'high') m -= 10;
  m += leagueSpecificModifier(p);
  return m;
}
function draftPhase() {
  let r = info().r;
  return r <= 5
    ? { name: 'Foundation', text: 'Take value and build dependable starters.' }
    : r <= 9
      ? {
          name: 'Structure',
          text: 'Balance the roster, monitor tiers, and use stacks as tie-breakers.',
        }
      : {
          name: 'Endgame Hunter',
          text: 'Chase upside, paths to larger roles, and premium handcuffs.',
        };
}
function strategyHealth() {
  let c = counts(),
    r = info().r,
    msg = 'Stay flexible — value can override the plan.';
  if (r <= 3 && c.WR >= 1 && c.RB >= 2) msg = 'Anchor WR + Double RB is on track.';
  else if (r <= 4 && c.RB >= 2) msg = 'Strong RB foundation. Add WR value next.';
  else if (r >= 5 && c.WR < 2) msg = 'WR depth is behind. Prefer WR when value is close.';
  else if (r >= 7 && c.QB === 0)
    msg = 'Late-QB plan active; draft only when the tier starts thinning.';
  return msg;
}
function inferredStrategy() {
  if (!window.JoninUXPolish)
    return { name: 'Balanced', confidence: 50, note: 'Draft still developing.' };
  return JoninUXPolish.inferStrategy({
    counts: counts(),
    round: info().r,
    draftedCount: myPlayers().length,
  });
}
function strategyCardMarkup() {
  let s = inferredStrategy();
  return `<div class="strategySummary"><span>Current Strategy</span><strong>${s.name}</strong><div><b>Confidence</b><em>${s.confidence}%</em></div><p>${s.note}</p></div>`;
}
function renderDraftPlan() {
  let d = draftPhase(),
    html = `<div class="strategy"><span><b>${d.name} Mode</b><small style="display:block;color:var(--muted);margin-top:3px">${d.text}</small></span><span class="pill">R${info().r}</span></div>`;
  ['mobileDraftPhase', 'desktopDraftPhase'].forEach(id => {
    let e = document.getElementById(id);
    if (e) e.innerHTML = html;
  });
  ['mobileStrategyHealth', 'desktopStrategyHealth'].forEach(id => {
    let e = document.getElementById(id);
    if (e) e.textContent = strategyHealth();
  });
  ['desktopStrategyCard', 'mobileStrategyCard'].forEach(id => {
    let e = document.getElementById(id);
    if (e) e.innerHTML = strategyCardMarkup();
  });
}
function teamBuildMarkup() {
  if (!window.JoninUXPolish) return '';
  return JoninUXPolish.teamBuild({ counts: positionalCountsAll(), settings: leagueContext })
    .map(
      row =>
        `<div class="teamBuildRow ${row.complete ? 'complete' : 'missing'}"><span>${row.position}</span><b aria-label="${row.filled} of ${row.target} filled">${row.target ? `${'●'.repeat(row.filled)}${'○'.repeat(row.missing)}` : '—'}</b><small>${row.complete ? 'Filled' : `${row.missing} needed`}</small></div>`
    )
    .join('');
}
function renderTeamBuild() {
  ['desktopTeamBuild', 'mobileTeamBuild'].forEach(id => {
    let e = document.getElementById(id);
    if (e) e.innerHTML = teamBuildMarkup();
  });
}
function gerardScore(p) {
  let c = counts(),
    round = info().r,
    overallRank = reliableOverallRank(p) ?? Math.max(250, players.length),
    s =
      150 -
      overallRank * 0.82 +
      sourceBlend(p) +
      (recommendationPersonalization ? p.bdgeBoost || 0 : 0) +
      (recommendationPersonalization ? p.flockBoost || 0 : 0) +
      formatModifier(p) +
      fit(p);
  if (p.pos === 'RB' && c.RB < configuredStarterTarget('RB')) s += 13;
  if (p.pos === 'WR' && c.WR < configuredStarterTarget('WR')) s += 13;
  if (p.pos === 'QB' && c.QB >= configuredStarterTarget('QB')) s -= 120;
  if (p.pos === 'TE' && c.TE >= configuredStarterTarget('TE')) s -= 120;
  if (p.pos === 'QB' && round < 3) s -= 20;
  if (p.pos === 'TE' && round < 2) s -= 10;
  if (p.pos === 'DST') {
    s -= round < 15 ? 95 : round === 15 ? 25 : 0;
    if (c.DST >= 1) s -= 80;
  } else if (p.pos === 'K') {
    s -= round < 16 ? 105 : round === 16 ? 20 : 0;
    if (c.K >= 1) s -= 80;
  }
  if (recommendationPersonalization && p.bdgeAvoid) s -= 10;
  if (recommendationPersonalization && p.priceFade) s -= 7;
  if (recommendationPersonalization && p.coreTarget) s += 5;
  if (recommendationPersonalization && p.leagueBreaker && round >= 7) s += 5;
  if (p.availabilityRisk === 'high') s -= 9;
  if (p.ambiguity === 'high') s -= 3;
  if (['RB', 'WR', 'QB', 'TE'].includes(p.pos)) {
    let mp = marketPressure(p.pos);
    s += mp.pressure * 0.16;
  }
  let bp = blueprintFactors(p);
  s += bp.stack.points + bp.hand.points;
  if (bp.exp?.severity === 'moderate') s -= 2;
  if (bp.exp?.severity === 'heavy') s -= 5;
  if (bp.exp?.severity === 'heavy' && p.offenseQuality === 'weak') s -= 3;
  if (bp.bye) s -= 2;
  return s;
}
function recommendations() {
  const completion = rosterCompletionState();
  let pool = completionConstrainedPool(available().filter(recommendationEligible), completion);
  if (!pool.length)
    pool = completionConstrainedPool(available().filter(p => !isRecommendationExcluded(p.id)&&(!['QB', 'TE'].includes(p.pos) || !userPositionFilled(p.pos))), completion);
  if(!window.JoninDecisionIntelligenceV1)return RosterCompletionConstraintV1.finalizeRecommendations([...pool].sort((a,b)=>finalPickScore(b)-finalPickScore(a)||mambaScore(b)-mambaScore(a)),completion,5);
  const strategicTie=(item)=>finalDecisionTrace(item.player).strategy,decision=championshipDecision(pool),marketFloor=recommendationMarketFloor(decision,completion),ordered=decision.all.slice().sort((a,b)=>recommendationIntegrityPriority(a,completion,marketFloor.playerId)-recommendationIntegrityPriority(b,completion,marketFloor.playerId)||b.scores.finalDecision-a.scores.finalDecision||(strategicTie(b)?.starterEquity?.impact??0)-(strategicTie(a)?.starterEquity?.impact??0)||(strategicTie(b)?.marginalUtility?.adjustment??0)-(strategicTie(a)?.marginalUtility?.adjustment??0)||(strategicTie(b)?.benchPortfolio?.valueFall??0)-(strategicTie(a)?.benchPortfolio?.valueFall??0)||(strategicTie(b)?.benchPortfolio?.offset??0)-(strategicTie(a)?.benchPortfolio?.offset??0)||b.scores.playerValue-a.scores.playerValue||reliableOverallRank(a.player)-reliableOverallRank(b.player)||String(a.player.id).localeCompare(String(b.player.id))).map(item=>item.player),championshipEquityOrder=applyChampionshipEquityBestPickTieBreak(ordered,decision,completion);
  return RosterCompletionConstraintV1.finalizeRecommendations(championshipEquityOrder,completion,5);
}
function championshipEquityEvidence(player){return window.ChampionshipEquityProductionV1?ChampionshipEquityProductionV1.evidenceFor(player):Object.freeze({status:'UNAVAILABLE',score:null,classification:'INSUFFICIENT_DATA',evidenceComplete:false,guardrailEligible:false})}
function championshipEquityDraftContext(completion=rosterCompletionState()){
  const remainingStarterCapacity=Number(completion?.requiredSlotsRemaining??completion?.unfilledRequiredSlots?.length??0),currentRound=info().r,totalRounds=TOTAL_ROUNDS,draftStage=window.ChampionshipEquityProductionV1?ChampionshipEquityProductionV1.draftStage({currentRound,totalRounds,remainingStarterCapacity}):'EARLY';return{profileId:activeLeagueProfile?.id||null,currentRound,totalRounds,remainingStarterCapacity,draftStage,currentAdpAvailable:false};
}
function championshipEquityCandidate(player,decision){
  const evaluation=decision?.all?.find(item=>String(item.playerId)===String(player.id)),trace=finalDecisionTrace(player),strategy=trace.strategy||{},starterImpact=Number(strategy.starterEquity?.impact||0),portfolio=strategy.benchPortfolio||{},acquisition=strategy.priceOfAcquisition||{};return{id:String(player.id),player,position:positionKey(player),rank:reliableOverallRank(player),tier:PlayerTierContract.getOverallTier(player),mamba:mambaScore(player),sourceValue:finalPickScore(player),decisionScore:evaluation?.scores?.finalDecision??null,starterImpact,survival:acquisition.survival||'UNKNOWN',valuableRbDepth:positionKey(player)==='RB'&&(starterImpact>0||['FOUNDATION','STARTER'].includes(strategy.role)||portfolio.documented===true),evidence:championshipEquityEvidence(player)};
}
function applyChampionshipEquityBestPickTieBreak(ordered,decision,completion){
  if(!window.ChampionshipEquityProductionV1)return ordered;
  const rows=ordered.slice(0,5).map(player=>championshipEquityCandidate(player,decision)),result=ChampionshipEquityProductionV1.reorderBestPick({rows,context:championshipEquityDraftContext(completion)}),byId=new Map(ordered.map(player=>[String(player.id),player])),reordered=result.rows.map(row=>byId.get(String(row.id))).filter(Boolean),used=new Set(reordered.map(player=>String(player.id)));window.__championshipEquityBestPickDecision=result.decision;return [...reordered,...ordered.filter(player=>!used.has(String(player.id)))];
}
function setChampionshipEquityProductionEnabled(value){
  if(!window.ChampionshipEquityProductionV1)return false;const enabled=ChampionshipEquityProductionV1.setEnabled(value===true);invalidateIntelligence();window.__championshipEquityBestPickDecision=null;window.__championshipEquityHighestUpsideDecision=null;return enabled;
}
function championshipDecision(pool=available().filter(recommendationEligible)){
  const poolKey=pool.map(player=>player.id).join(',');
  if(championshipDecisionCache?.epoch===intelligenceEpoch&&championshipDecisionCache.poolKey===poolKey)return championshipDecisionCache.value;
  const engine=window.JoninDecisionIntelligenceV1,index=fantasyHQPlayerIndex(),rosterIds=myPlayers().map(player=>player.id),strengthOptions={starterSlots:rosterSlots},before=window.FantasyHQCore?FantasyHQCore.calculateTeamStrength(rosterIds,index,strengthOptions):null,byPosition=new Map();
  pool.forEach(player=>{const position=positionKey(player);if(!byPosition.has(position))byPosition.set(position,[]);byPosition.get(position).push(player)});byPosition.forEach(rows=>rows.sort((a,b)=>mambaScore(b)-mambaScore(a)));
  const inputs=pool.map(player=>{const position=positionKey(player),positionTier=tierLabel(player),overallTier=PlayerTierContract.getOverallTier(player),decisionOverallTier=['K','DST'].includes(position)?'F':overallTier,samePosition=byPosition.get(position)||[],sameTierRemaining=samePosition.filter(candidate=>candidate.id!==player.id&&tierLabel(candidate)===positionTier).length,nextCandidate=samePosition.find(candidate=>candidate.id!==player.id),withoutPlayer=samePosition.filter(candidate=>candidate.id!==player.id),expectedIndex=Math.min(Math.max(0,expectedDraftedBeforeNext(position)),Math.max(0,samePosition.length-1)),replacement=withoutPlayer[expectedIndex]||nextCandidate,replacementOverallTier=replacement?(['K','DST'].includes(positionKey(replacement))?'F':PlayerTierContract.getOverallTier(replacement)):null,environment=engine.environment(replacement||{}),expectedReplacementValue=replacement?engine.playerValue({player:replacement,mamba:mambaScore(replacement),crossPositionBase:crossPositionValueBase(replacement),tier:replacementOverallTier,positionTier:tierLabel(replacement),overall:replacement.overall,environment}):0,after=window.FantasyHQCore?FantasyHQCore.calculateTeamStrength([...rosterIds,player.id],index,strengthOptions):null,trace=finalDecisionTrace(player),modifiers=trace.modifiers;return{player,round:info().r,mamba:mambaScore(player),crossPositionBase:crossPositionValueBase(player),tier:decisionOverallTier,positionTier,overall:player.overall,rosterFitModifier:rosterFitModifier(player),rosterBeforeScore:before,rosterAfterScore:after,marketPressure:marketPressure(position).pressure,survivalRisk:survivalRisk(player),sameTierRemaining,nextTierDrop:nextCandidate?Math.max(0,tierWeight(positionTier)-tierWeight(tierLabel(nextCandidate)))*12:30,expectedReplacementValue,positionDepth:samePosition.length,picksUntil:info().until,finalDecisionScore:trace.finalDecisionScore,decisionModifiers:modifiers}});
  const value=engine.choose(inputs);championshipDecisionCache={epoch:intelligenceEpoch,poolKey,value};return value;
}
function recommendationDebugBreakdown(playerOrId){
  const player=typeof playerOrId==='object'?playerOrId:players.find(candidate=>String(candidate.id)===String(playerOrId));
  if(!player)return null;
  const decision=championshipDecision(),evaluation=decision.all.find(item=>String(item.playerId)===String(player.id));
  const components=scoreComponents(player),ordered=decision.all.slice().sort((a,b)=>b.scores.finalDecision-a.scores.finalDecision||b.scores.playerValue-a.scores.playerValue),trace=finalDecisionTrace(player),marketFloor=recommendationMarketFloor(decision,rosterCompletionState());
  const modifiers=evaluation?.modifiers??decisionModifiers(player),injury=InjuryIntelligenceV1?.normalize(player.injury||{})??null;
  return Object.freeze({player:{id:player.id,name:player.name,position:positionKey(player)},source:{overallRank:player.fantasylandOverallRank??player.overall??null,overallTier:PlayerTierContract.getOverallTier(player),positionRank:reliableSpecialistRank(player)??player.fantasylandPositionRank??player.posRank??null,positionTier:PlayerTierContract.getPositionTier(player),provider:player.fantasylandSpecialistSource??player.fantasylandSource??null,snapshotDate:player.fantasylandSpecialistSnapshotDate??player.fantasylandSnapshotDate??null,rankingScope:player.fantasylandSpecialistRankingScope??'cross-position'},sourcePrior:trace.sourcePrior,strategy:trace.strategy,marketFloor:String(marketFloor.playerId)===String(player.id)?marketFloor:Object.freeze({active:false,playerId:null}),signals:{teamFit:evaluation?.scores.rosterFit??null,scarcity:components.scarcity,runPressure:marketPressure(positionKey(player)),boardAvailabilityRisk:survivalRisk(player),opportunityCost:evaluation?.scores.opportunityCost??null,expectedFutureValue:evaluation?.scores.expectedFutureValue??null,upside:components.ceiling,risk:components.risk,rosterModifier:rosterFitModifier(player),mamba:mambaScore(player)},injury:{status:injury?.status??'UNKNOWN',freshness:modifiers.injury?.freshness??'UNKNOWN',reliability:modifiers.injury?.source??null,expectedAvailability:modifiers.injury?.expectedAvailability??null,footballAvailability:modifiers.injury?.footballAvailability??'UNKNOWN',rosterAvailability:modifiers.injury?.rosterAvailability??null,riskAdjustment:modifiers.injury?.baseRisk??0,availabilityRisk:modifiers.injury?.availabilityRisk??0,irCapacityEffect:modifiers.injury?.irCapacityEffect??0,portfolioEffect:modifiers.injury?.injuryPortfolioEffect??0,finalAdjustment:modifiers.injury?.adjustment??0,reason:modifiers.injury?.reason??''},context:trace.context,contextWeight:trace.contextWeight,completion:rosterCompletionState(),modifiers,finalPickScore:finalPickScore(player),championshipScore:evaluation?.scores.championship??null,finalDecisionScore:evaluation?.scores.finalDecision??trace.finalDecisionScore,finalRecommendationScore:evaluation?.scores.finalDecision??null,finalOrderingRank:ordered.findIndex(item=>item.playerId===player.id)+1,guardrail:decision.guardrail??null,championshipEquity:championshipEquityEvidence(player),championshipEquityBestPickDecision:window.__championshipEquityBestPickDecision??null});
}
function rationale(p) {
  let b = [],
    e = expected();
  if (e === p.pos || e.includes(p.pos)) b.push('fits Gerard Blueprint');
  let fall = Math.max(0, pick - p.overall);
  if (fall >= 8) b.push(`value fall: ${fall} picks`);
  if (p.bdgeLabels?.length) b.push(`BDGE: ${p.bdgeLabels[0]}`);
  let overallTier = window.PlayerTierContract ? PlayerTierContract.getOverallTier(p) : null;
  if (overallTier === 'S' || overallTier === 'A') b.push('top-tier talent');
  if (['RB', 'WR'].includes(p.pos)) b.push('weekly-ceiling core');
  return b.slice(0, 3).join(' • ') || 'best blended value available';
}

function survivalRisk(p) {
  let risk = 0,
    n = pick + 1,
    seen = 0;
  while (seen < (leagueContext.teams||10) && n <= TOTAL_PICKS) {
    let t = teamForPick(n);
    if (t === slot) break;
    let m = getManager(t);
    if (p.team === m.homerTeam) risk += m.homer * 2.5;
    if (p.pos === 'QB') risk += m.qbHoard * 1.7;
    risk += (10 - m.predictability) * 0.7;
    seen++;
    n++;
  }
  return Math.min(95, Math.round(risk));
}
function mambaScore(p) {
  let key = `m:${intelligenceEpoch}:${p.id}`;
  if (scoreCache.has(key)) return scoreCache.get(key);
  let raw = gerardScore(p),
    canonicalTier = tierLabel(p),
    tier = canonicalTier === 'S' ? 1 : canonicalTier === 'A' ? 0.5 : 0,
    overallRank = reliableOverallRank(p),
    fall = overallRank == null ? 0 : Math.max(0, pick - overallRank),
    risk = survivalRisk(p),
    unrankedSpecialistAdjustment = ['K', 'DST'].includes(positionKey(p)) && overallRank == null ? -6 : 0,
    score = Math.round(
      Math.max(1, Math.min(99, (overallRank==null?55:99-Math.log2(overallRank)*3) + Math.max(-3,Math.min(3,(raw-220)/30)) + tier + Math.min(6,fall/8) - risk/100 + unrankedSpecialistAdjustment))
    );
  scoreCache.set(key, score);
  return score;
}
function recommendationState(p) {
  let st = sharinganStage(p);
  if (st.key === 'eternal')
    return { cls: 'state-value', label: '🖤 ETERNAL MANGEKYŌ • SEASON-CHANGING VALUE' };
  if (st.key === 'mangekyo') return { cls: 'state-value', label: '👁 MANGEKYŌ • VALUE OVERRIDE' };
  if (st.key === 'three') return { cls: 'state-confidence', label: '👁 THREE TOMOE • ELITE VALUE' };
  if (st.key === 'two') return { cls: 'state-confidence', label: '👁 TWO TOMOE • EXCELLENT VALUE' };
  return { cls: 'state-normal', label: '👁 ONE TOMOE • GOOD PICK' };
}
function runSignal() {
  let r = history
      .slice(-6)
      .map(h => players.find(p => p.id === h.id)?.pos)
      .filter(Boolean),
    t = { QB: 0, RB: 0, WR: 0, TE: 0 };
  r.forEach(x => t[x]++);
  let top = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 3 ? top[0] + ' run detected' : 'No major positional run';
}
function markHeavyViewsDirty() {
  dirtyViews.players = true;
  dirtyViews.room = true;
  dirtyViews.wait = true;
  dirtyViews.team = true;
}
function boardPlayerClasses(player) {
  return player
    ? `drafted-player ${window.FlightControlV1 ? FlightControlV1.boardPositionClass(player.pos) : 'board-pos-unknown'}`
    : '';
}
function applyBoardPlayerClasses(cell, player) {
  [...cell.classList]
    .filter(name => name.startsWith('board-pos-'))
    .forEach(name => cell.classList.remove(name));
  cell.classList.toggle('drafted-player', Boolean(player));
  if (player)
    boardPlayerClasses(player)
      .split(' ')
      .forEach(name => cell.classList.add(name));
}
function updateBoardIncremental(record) {
  const roots = [DOM.desktopBoard, DOM.draftBoard].filter(Boolean),
    oldPick = record.pick,
    newPick = pick,
    pl = players.find(x => x.id === record.id);
  roots.forEach(root => {
    root.querySelectorAll('.pickCell.current').forEach(cell => cell.classList.remove('current'));
    const used = root.querySelector(`[data-pick="${oldPick}"]`);
    if (used) {
      used.classList.toggle('mine', record.team === slot);
      applyBoardPlayerClasses(used, pl);
      const name = used.querySelector('.name');
      if (name) name.textContent = pl?.name || 'Unknown';
    }
    const next = root.querySelector(`[data-pick="${newPick}"]`);
    if (next && newPick <= TOTAL_PICKS) {
      next.classList.add('current');
      const name = next.querySelector('.name');
      if (name && !history.some(x => x.pick === newPick)) name.textContent = 'ON CLOCK';
    }
  });
}
function scheduleHeavyRefresh(delay = 80) {
  clearTimeout(heavyRenderTimer);
  heavyRenderTimer = setTimeout(() => {
    try {
      if (dirtyViews.room) {
        renderRoomScan();
        dirtyViews.room = false;
      }
      if (dirtyViews.wait) {
        renderWaitMeter();
        dirtyViews.wait = false;
      }
      if (dirtyViews.players && activeMobilePage === 'mobilePlayers') {
        renderPlayers();
        dirtyViews.players = false;
      }
      if (dirtyViews.team && activeMobilePage === 'mobileTeam') {
        renderRoster();
        renderLiveRoster();
        renderExposure();
        dirtyViews.team = false;
      }
    } catch (err) {
      reportRuntimeError('Deferred interface refresh', err);
    }
  }, delay);
}
function renderAfterPick(record, { full = false } = {}) {
  renderMeta();
  updateBoardIncremental(record);
  renderRecommendation();
  renderQuickDraftBoard();
  renderManagerTables();
  renderDraftTimeline();
  markHeavyViewsDirty();
  if (record.team === slot) {
    renderRoster();
    renderLiveRoster();
    renderExposure();
    renderDraftPlan();
    dirtyViews.team = false;
  }
  if (full) {
    renderRoomScan();
    renderWaitMeter();
    renderPlayers();
    dirtyViews.room = dirtyViews.wait = dirtyViews.players = false;
  } else if (!simulationInProgress) scheduleHeavyRefresh();
}
function selectPlayer(id, team, options = {}) {
  try {
    const owner = currentPickOwner(), player = playerByCanonicalId(id);
    if (isDraftedPlayer(id) || pick > TOTAL_PICKS || !player) return false;
    if (Number(team) !== owner) return false;
    id = player.id;
    team = owner;
    if (team === slot) {
      decisionSnapshots.push({
        beforePick: pick,
        selectedPlayerId: id,
        topOptions: recommendations().map((x, i) => ({
          rank: i + 1,
          id: x.id,
          name: x.name,
          pos: x.pos,
          tier: tierLabel(x),
          mamba: mambaScore(x),
          finalPickScore: finalPickScore(x),
        })),
        positionWindows: ['QB', 'RB', 'WR', 'TE'].map(pos => {
          const x = marketPressure(pos);
          return {
            pos,
            window: positionWindow(x),
            pressure: x.pressure,
            starterNeedsBeforeNextPick: x.starterNeed,
            recentDrafted: x.recent,
          };
        }),
        rosterBefore: myPlayers().map(x => ({
          id: x.id,
          name: x.name,
          pos: x.pos,
          tier: tierLabel(x),
        })),
      });
    }
    const record = { pick, id, team };
    drafted.push(id);
    history.push(record);
    pick++;
    selectedCandidateId = null;
    invalidateIntelligence();
    if (pick > TOTAL_PICKS) {
      finishDraft();
      return true;
    }
    renderAfterPick(record, { full: options.full === true });
    if (team === slot) requestAnimationFrame(() => window.scrollTo?.(0, 0));
    return true;
  } catch (err) {
    reportRuntimeError('Recording draft pick', err);
    return false;
  }
}
function aiScore(p, team) {
  let profile = aiProfiles[team] || 'Balanced',
    m = getManager(team),
    s =
      150 -
      p.overall +
      Math.random() * (style === 'chaotic' ? 35 : style === 'conservative' ? 8 : 18),
    owned = history
      .filter(h => h.team === team)
      .map(h => players.find(p => p.id === h.id))
      .filter(Boolean),
    c = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  owned.forEach(x => {
    if (c[x.pos] !== undefined) c[x.pos]++;
  });
  if (profile === 'Hero RB' && p.pos === 'RB' && c.RB < 1) s += 30;
  if (profile === 'Zero RB' && p.pos === 'WR' && c.WR < 4) s += 25;
  if (profile === 'WR Heavy' && p.pos === 'WR') s += 20;
  if (profile === 'Early QB' && p.pos === 'QB' && c.QB < 1 && info().r <= 5) s += 28;
  if (profile === 'Elite TE' && p.pos === 'TE' && c.TE < 1) s += 25;
  if (profile === 'Rookie Chaser' && p.rookie) s += 25;
  if (profile === 'Chaos') s += Math.random() * 45;
  if (p.team === m.homerTeam) s += m.homer * 3;
  if (p.pos === 'QB' && c.QB >= 1) s += m.qbHoard * 2 - 12;
  if (m.archetype.includes('AI')) s += Math.max(0, 25 - p.overall / 8);
  if (m.archetype.includes('Reactionary') && p.rookie) s += 12;
  if (m.archetype.includes('Conviction')) s += Math.random() * 18;
  if (c[p.pos] >= 3 && ['QB', 'TE'].includes(p.pos)) s -= Math.max(10, 45 - m.qbHoard * 3);
  let rd = info().r;
  if (p.pos === 'DST') {
    s -= rd < 15 ? 90 : 0;
    if (c.DST >= 1) s -= 100;
    if (rd >= 16 && c.DST < 1) s += 55;
  }
  if (p.pos === 'K') {
    s -= rd < 16 ? 100 : 0;
    if (c.K >= 1) s -= 100;
    if (rd >= 17 && c.K < 1) s += 65;
  }
  return s;
}
async function simulateToMe() {
  if (mode !== 'practice' || simulationInProgress || teamForPick(pick) === slot) return;
  simulationInProgress = true;
  const btn = el('simulateBtn'),
    original = btn?.textContent || 'Simulate To My Next Pick';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Simulating…';
  }
  try {
    while (teamForPick(pick) !== slot && pick <= TOTAL_PICKS) {
      let team = teamForPick(pick),
        completion = rosterCompletionStateForTeam(team),
        eligible = completion ? completionConstrainedPool(available(), completion) : available(),
        pool = eligible.slice(0, Math.min(28, eligible.length));
      pool.sort((a, b) => aiScore(b, team) - aiScore(a, team));
      if (!pool.length) break;
      selectPlayer(pool[0].id, team);
      await new Promise(requestAnimationFrame);
      await new Promise(r => setTimeout(r, 35));
    }
  } finally {
    simulationInProgress = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
    renderRoomScan();
    renderWaitMeter();
    renderPlayers();
    renderRoster();
    renderLiveRoster();
    renderExposure();
    renderDraftPlan();
    dirtyViews.players = dirtyViews.room = dirtyViews.wait = dirtyViews.team = false;
  }
}
function rosterRows() {
  return rosterViewState().allRows.map(row => [row.slot, row.player]);
}

function positionalCountsAll() {
  let c = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  myPlayers().forEach(p => {
    let key = p.pos === 'DEF' ? 'DST' : p.pos;
    if (c[key] !== undefined) c[key]++;
  });
  return c;
}
function rosterNeeds() {
  let c = positionalCountsAll(),
    needs = [];
  if (c.QB < configuredStarterTarget('QB')) needs.push('QB');
  if (c.RB < configuredStarterTarget('RB')) needs.push('RB');
  if (c.WR < configuredStarterTarget('WR')) needs.push('WR');
  if (c.TE < configuredStarterTarget('TE')) needs.push('TE');
  if (c.K < configuredStarterTarget('K')) needs.push('K');
  if (c.DST < configuredStarterTarget('DST')) needs.push('D/ST');
  return needs;
}
function waitScore(pos) {
  let c = positionalCountsAll(),
    roundNow = info().r,
    avail = available()
      .filter(p => positionKey(p) === pos)
      .sort((a, b) => finalPickScore(b) - finalPickScore(a));
  if (c[pos] >= 1) return 96;
  let before = teamsBeforeMyNextPick().length,
    projectedLoss = Math.min(avail.length, expectedDraftedBeforeNext(pos));
  let eliteNow = avail.filter(p => ['S', 'A'].includes(tierLabel(p))).length;
  let eliteAfter = avail.slice(projectedLoss).filter(p => ['S', 'A'].includes(tierLabel(p))).length;
  let recent = history
    .slice(-8)
    .map(h => players.find(p => p.id === h.id))
    .filter(Boolean)
    .filter(p => positionKey(p) === pos).length;
  let score;
  if (pos === 'QB') {
    score = roundNow <= 3 ? 90 : roundNow <= 5 ? 80 : roundNow <= 7 ? 68 : roundNow <= 9 ? 55 : 42;
    if (roundNow <= 4 && eliteNow > 0 && eliteAfter === 0) score = Math.min(score, 58);
    else if (roundNow <= 5 && eliteNow > 0 && eliteAfter < eliteNow) score -= 8;
  } else if (pos === 'TE') {
    score = roundNow <= 3 ? 91 : roundNow <= 5 ? 78 : roundNow <= 7 ? 64 : roundNow <= 9 ? 52 : 40;
    if (roundNow <= 4 && eliteNow > 0 && eliteAfter === 0) score = Math.min(score, 56);
    else if (roundNow <= 5 && eliteNow > 0 && eliteAfter < eliteNow) score -= 8;
  } else {
    score = 88 - before * 3 - recent * 6;
  }
  return Math.max(10, Math.min(98, Math.round(score)));
}
function renderLiveRoster() {
  let htmlRows = rosterPanelMarkup(),
    c = positionalCountsAll(),
    summary = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
      .map(x => `<div class="rosterCount"><b>${c[x] || 0}</b>${x}</div>`)
      .join(''),
    needs = rosterNeeds(),
    needsText = needs.length
      ? `Remaining needs: ${needs.join(', ')}`
      : 'Starting lineup requirements filled — focus on upside and bench value.';
  let lr = document.getElementById('mobileLiveRoster'),
    rs = document.getElementById('mobileRosterSummary'),
    mn = document.getElementById('mobileNeeds');
  if (lr) lr.innerHTML = htmlRows;
  if (rs) rs.innerHTML = summary;
  if (mn) mn.textContent = needsText;
  const desktopTracker=document.getElementById('desktopLiveTeamTracker');
  if(desktopTracker)desktopTracker.innerHTML=liveTeamTrackerMarkup();
  renderTeamBuild();
}
function liveTeamTrackerMarkup(){
  const state=rosterViewState();
  const rowMarkup=(row,bench=false)=>{const p=row.player,label=bench?'BN':row.slot.startsWith('DEF')?'DST':row.slot;if(!p)return `<tr class="emptyTrackerRow"><td>${safeInsightText(label)}</td><td>Open</td><td>—</td><td>—</td><td>—</td></tr>`;const tier=PlayerTierContract.getDecisionTier(p);return `<tr data-player-id="${safeInsightText(p.id)}"><td>${safeInsightText(label)}</td><td><span class="trackerPlayerIdentity">${playerPhotoMarkup(p,'trackerPlayerPhoto',true)}<span>${safeInsightText(p.name)}</span></span></td><td>${safeInsightText(p.team||'—')}</td><td>${safeInsightText(tier)}</td><td>${safeInsightText(p.bye??'—')}</td></tr>`};
  const starters=state.starters.map(row=>rowMarkup(row)).join(''),bench=[...(state.bench||[]),...(state.overflow||[])].map(row=>rowMarkup(row,true)).join('');
  return `<table class="liveTeamTable"><thead><tr><th>SLOT</th><th>PLAYER</th><th>NFL</th><th>TIER</th><th>BYE</th></tr></thead><tbody><tr class="trackerSection"><th colspan="5">STARTERS</th></tr>${starters}<tr class="trackerSection"><th colspan="5">BENCH</th></tr>${bench||'<tr class="emptyTrackerRow"><td>BN</td><td>Empty</td><td>—</td><td>—</td><td>—</td></tr>'}</tbody></table>`;
}
function renderWaitMeter() {
  let snap = getIntelligenceSnapshot(),
    positions = ['QB', 'TE', 'DST', 'K'],
    roundNow = info().r,
    c = positionalCountsAll();
  let boxes = positions
    .map(pos => {
      if (['QB', 'TE'].includes(pos) && c[pos] >= configuredStarterTarget(pos)) {
        return `<div class="waitBox filledPosition"><div class="pos">${pos}</div><div class="meter"><span style="width:100%"></span></div><div><b>FILLED</b></div><div class="decision">FOCUS ELSEWHERE</div></div>`;
      }
      let locked = (pos === 'DST' && roundNow < 15) || (pos === 'K' && roundNow < 16);
      if (locked) {
        let unlock = pos === 'DST' ? 15 : 16;
        return `<div class="waitBox locked"><div class="pos">${pos === 'DST' ? 'D/ST' : pos}</div><div class="meter"><span style="width:100%"></span></div><div><b>WAIT</b></div><div class="decision">TOO EARLY • R${unlock}+</div></div>`;
      }
      let score = snap.wait[pos],
        cls = score >= 70 ? 'wait' : score >= 48 ? 'now' : 'urgent';
      let label =
        score >= 70
          ? 'SAFE TO WAIT'
          : score >= 48
            ? roundNow <= 4
              ? 'ELITE ONLY'
              : 'MONITOR TIER'
            : 'DRAFT SOON';
      return `<div class="waitBox ${cls}"><div class="pos">${pos === 'DST' ? 'D/ST' : pos}</div><div class="meter"><span style="width:${score}%"></span></div><div><b>${score}%</b></div><div class="decision">${label}</div></div>`;
    })
    .join('');
  ['mobileWaitMeter', 'desktopWaitMeter'].forEach(id => {
    let node = document.getElementById(id);
    if (node) node.innerHTML = boxes;
  });
}
function scoreComponents(p) {
  let value = Math.max(45, Math.min(99, Math.round(102 - (p.overall || 200) / 3)));
  let ceiling = Math.max(
    45,
    Math.min(
      99,
      value + (p.bdgeBoost || 0) * 2 + (p.overallTier === 'S' ? 8 : p.overallTier === 'A' ? 5 : 0)
    )
  );
  let floor = Math.max(40, Math.min(98, value - (p.rookie ? 7 : 0) - (p.bdgeAvoid ? 10 : 0)));
  let fit = mambaScore(p);
  return { value, ceiling, floor, fit };
}
function coverageText(p) {
  const n = Number(p.analystCoverage || 0);
  return n >= 4
    ? '4-source coverage'
    : n === 3
      ? '3-source coverage'
      : n === 2
        ? '2-source coverage'
        : n === 1
          ? '1-source coverage'
          : 'Baseline coverage';
}
function sourceRankLabel(p, source) {
  if (source === 'Fantasyland') {
    if (p.fantasyland === 'N/A' || p.fantasyland === 'Depth pool') return '—';
    const positionTier = PlayerTierContract.getPositionTier(p);
    return p.pos === 'K' || p.pos === 'DST'
      ? `${p.pos === 'DST' ? 'DEF' : 'K'}${reliableSpecialistRank(p) || '—'} • Position-only snapshot`
      : `${p.pos}${p.posRank || '—'} / Position Tier ${positionTier || '—'}`;
  }
  if (source === 'BDGE') {
    return p.bdgeRank ? `${p.pos}${p.bdgeRank}${p.bdgeTier ? ` • ${p.bdgeTier}` : ''}` : '—';
  }
  if (source === 'Flock') {
    return p.flockRank ? `${p.pos}${p.flockRank} • Flock Tier ${p.flockTier || '—'}` : '—';
  }
  if (source === 'FantasyPros') {
    return `${p.pos === 'DST' ? 'D/ST' : p.pos}${p.fantasyProsPosRank || p.posRank || '—'}`;
  }
  return '—';
}
function openScan(id) {
  const modal = document.getElementById('scanModal'),
    content = document.getElementById('scanContent');
  let p = players.find(x => x.id === Number(id));
  if (!p || !modal || !content) return;
  let ev = getPlayerEvaluation(p),
    s = scoreComponents(p),
    risk = ev.risk,
    state = recommendationState(p),
    market = ['QB', 'RB', 'WR', 'TE'].includes(p.pos)
      ? getIntelligenceSnapshot().markets[p.pos]
      : null;
  let windowLabel = market ? positionWindow(market) : 'Late Round';
  let fitLabel = s.fit >= 92 ? 'Elite' : s.fit >= 84 ? 'Strong' : s.fit >= 75 ? 'Good' : 'Neutral';
  let verdict =
    risk >= 70 || valueOverride(p)
      ? {
          label: 'DRAFT NOW',
          cls: 'go',
          text: `${p.name} is strong value and is unlikely to survive to your next selection.`,
        }
      : risk >= 42 || windowLabel === 'Closing'
        ? {
            label: 'GOOD VALUE — CONSIDER NOW',
            cls: 'wait',
            text: `The value is solid, but the position window is beginning to tighten.`,
          }
        : {
            label: 'SAFE TO WAIT',
            cls: 'wait',
            text: `The board still offers alternatives and the current position window remains manageable.`,
          };
  let alternatives = available()
    .filter(x => x.id !== p.id && recommendationEligible(x))
    .sort((a, b) => finalPickScore(b) - finalPickScore(a));
  let alt = alternatives[0];
  let labels = (p.bdgeLabels || []).length ? p.bdgeLabels.join(' • ') : 'No additional BDGE flag';
  let notes = [
    p.rankingRole,
    labels,
    p.opportunityTrend && p.opportunityTrend !== 'Pending' ? p.opportunityTrend : null,
    p.gerardPreference && p.gerardPreference !== 'neutral'
      ? `Gerard preference: ${p.gerardPreference}`
      : null,
  ]
    .filter(Boolean)
    .join('. ');
  let why = [];
  if (valueOverride(p)) why.push('Value Override is active — talent gap outweighs roster balance.');
  const decisionTier = PlayerTierContract.getDecisionTier(p);
  if (decisionTier === 'S' || decisionTier === 'A')
    why.push(`${decisionTier} decision-tier talent is still available.`);
  if (risk >= 60) why.push(`${risk}% steal risk before your next selection.`);
  else why.push(`${100 - risk}% estimated chance to remain available.`);
  if (windowLabel === 'Closing' || windowLabel === 'Thinning')
    why.push(`${p.pos} position window is ${windowLabel.toLowerCase()}.`);
  why.push(
    fitLabel === 'Elite' || fitLabel === 'Strong'
      ? `Strong fit with your current roster and draft blueprint.`
      : `Board value remains the primary reason for this recommendation.`
  );
  content.innerHTML = `
 <div class="scanHeader"><div><div class="scanEye">${sharinganIconMarkup(sharinganStage(p).key)} SHARINGAN SCAN</div><div class="scanName">${p.name}</div><div class="tagrow">${tierBadge(p)}<span class="tag">${p.pos === 'DST' ? 'D/ST' : p.pos}${p.posRank || ''}</span><span class="tag">${p.team}</span><span class="tag">Bye ${p.bye}</span><span class="tag">${coverageText(p)}</span></div></div><button class="ghost" onclick="closeScan()">Close</button></div>
 <div class="scanVerdict"><div class="scanVerdictLabel ${verdict.cls}">${verdict.label}</div><div class="scanVerdictText">${verdict.text}</div></div>
 <div class="scanQuickGrid">
   <div class="scanQuickMetric"><span>Mamba</span><b>${s.fit}</b></div>
   <div class="scanQuickMetric"><span>Chance Gone</span><b>${risk}%</b></div>
   <div class="scanQuickMetric"><span>Roster Fit</span><b>${fitLabel}</b></div>
   <div class="scanQuickMetric"><span>Window</span><b>${windowLabel}</b></div>
 </div>
 <div class="scanWhy"><b>Why this matters</b><ul>${why
   .slice(0, 4)
   .map(x => `<li>${x}</li>`)
   .join('')}</ul></div>
 ${alt ? `<div class="scanAlternative"><div><b>Best alternative: ${alt.name}</b><div class="meta">${alt.pos} • ${alt.team} • Decision Tier ${PlayerTierContract.getDecisionTier(alt)} • ${finalPickScore(alt)}/100</div></div><button class="scanBtn" onclick="openScan(${alt.id})">Compare</button></div>` : ''}
 <button class="primary scanPrimaryAction" onclick="recordCurrentPick(${p.id});closeScan()">Draft ${p.name}</button>
 <details class="scanDetails"><summary>Show Full Sharingan Analysis</summary>
   <div class="scanGrid">
     <div class="scanMetric"><span>Final Pick Score</span><b>${finalPickScore(p)}/100</b></div><div class="scanMetric"><span>Weekly Ceiling</span><b>${s.ceiling}/100</b></div><div class="scanMetric"><span>Floor</span><b>${s.floor}/100</b></div>
     <div class="scanMetric"><span>Board Rank</span><b>#${p.overall || '—'}</b></div><div class="scanMetric"><span>Sharingan State</span><b>${sharinganStage(p).meaning}</b></div><div class="scanMetric"><span>Confidence</span><b>${p.ambiguity === 'high' ? 'Low' : p.ambiguity === 'medium' ? 'Medium' : 'High'}</b></div>
   </div>
   <b>Source breakdown</b>
   <div class="sourceGrid"><div class="sourceBox"><div class="source">FANTASYLAND</div><b>${sourceRankLabel(p, 'Fantasyland')}</b></div><div class="sourceBox"><div class="source">BDGE</div><b>${sourceRankLabel(p, 'BDGE')}</b></div><div class="sourceBox"><div class="source">FLOCK</div><b>${sourceRankLabel(p, 'Flock')}</b></div><div class="sourceBox"><div class="source">FANTASYPROS</div><b>${sourceRankLabel(p, 'FantasyPros')}</b></div></div>
   <div class="scanNotes"><b>Full explanation</b><br>${notes}. ${rationale(p)}.</div>
   <button class="ghost" style="width:100%;margin-top:9px" onclick="selectPlayer(${p.id},${teamForPick(pick)});closeScan()">Record for Current Team</button>
 </details>`;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}
function closeScan(e) {
  const modal = document.getElementById('scanModal');
  if (!modal) return;
  if (e && e.target !== modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function selectCandidate(id) {
  if (isDraftedPlayer(id)) return;
  selectedCandidateId = id;
  recentSearchIds = [id, ...recentSearchIds.filter(candidateId => candidateId !== id)].slice(0, 5);
  renderRecommendation();
  renderRecentSearches();
  requestAnimationFrame(() => document.querySelector('.fightControlPanel')?.scrollIntoView({behavior:'smooth',block:'nearest'}));
}

function renderRecentSearches() {
  const node = document.getElementById('recentSearches');
  if (!node) return;
  const recent = recentSearchIds.map(id => players.find(player => player.id === id)).filter(Boolean);
  node.innerHTML = recent.length
    ? recent.map(player => `<button type="button" onclick="selectCandidate(${player.id})">${safeInsightText(player.name)}</button>`).join('')
    : '<span class="meta">No recent players</span>';
}

function toggleMobileTeam() {
  mobileTeamExpanded = !mobileTeamExpanded;
  let panel = document.getElementById('mobileRosterExpandable');
  let btn = document.getElementById('teamToggleBtn');
  if (panel) panel.classList.toggle('hidden', !mobileTeamExpanded);
  if (btn) {
    btn.textContent = mobileTeamExpanded ? 'Collapse' : 'Expand';
    btn.setAttribute('aria-expanded', String(mobileTeamExpanded));
  }
}

function randomizeManagerOrder() {
  if (mode !== 'practice') {
    alert(
      'Randomization is for Practice Mock Drafts. Yahoo Live Mock and Live Draft keep manual assignments.'
    );
    return;
  }
  let names = managers.map(m => m.name).filter(n => n !== 'Gerard');
  for (let i = names.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  let idx = 0;
  for (let i = 1; i <= +(el('teamCount')?.value||leagueContext.teams||10); i++) {
    let node = document.getElementById('mgr' + i);
    if (!node) continue;
    node.value = i === +(DOM.draftSlot?.value || 10) ? 'Gerard' : names[(idx++)%names.length];
  }
}
function teamExposure() {
  let map = {};
  myPlayers().forEach(p => {
    if (!p.team || p.pos === 'DST') return;
    map[p.team] = (map[p.team] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
function byeExposure() {
  let map = {};
  myPlayers().forEach(p => {
    if (p.bye) map[p.bye] = (map[p.bye] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
function exposureWarningFor(p) {
  if (!p.team || p.pos === 'DST') return null;
  let count = (teamExposure().find(([t]) => t === p.team) || [null, 0])[1],
    after = count + 1,
    severity = after >= 4 ? 'heavy' : after === 3 ? 'moderate' : 'normal',
    quality = p.offenseQuality || 'average',
    text =
      after >= 4
        ? `Heavy ${p.team} exposure (${after} players).`
        : after === 3
          ? `Moderate ${p.team} exposure (${after} players).`
          : '';
  if (text && quality === 'weak') text += ' Weaker offense increases the risk.';
  if (text && quality === 'strong') text += ' Strong offense softens the risk.';
  return text ? { severity, text } : null;
}
function stackBonusFor(p) {
  if (p.pos === 'QB') {
    let mates = myPlayers().filter(x => x.team === p.team && ['WR', 'TE'].includes(x.pos));
    if (mates.length) return { points: 3, label: `Creates QB stack with ${mates[0].name}` };
  }
  if (['WR', 'TE'].includes(p.pos)) {
    let qb = myPlayers().find(x => x.team === p.team && x.pos === 'QB');
    if (qb) return { points: 3, label: `Adds pass catcher to ${qb.name} stack` };
  }
  return { points: 0, label: 'No stack bonus' };
}
function handcuffBonusFor(p) {
  let r = info().r;
  if (r < 11 || p.pos !== 'RB') return { points: 0, label: 'No handcuff bonus' };
  let owned = myPlayers().map(x => x.name),
    protects = (p.handcuffFor || []).find(n => owned.includes(n));
  return protects
    ? { points: 4, label: `Protects ${protects}` }
    : { points: 0, label: 'No handcuff bonus' };
}
function byeWarningFor(p) {
  let existing = (byeExposure().find(([b]) => String(b) === String(p.bye)) || [null, 0])[1];
  return existing >= 3 ? `Would create ${existing + 1} players on Week ${p.bye} bye.` : null;
}
function blueprintFactors(p) {
  let stack = stackBonusFor(p),
    hand = handcuffBonusFor(p),
    exp = exposureWarningFor(p),
    bye = byeWarningFor(p);
  return { stack, hand, exp, bye };
}
function renderExposure() {
  let rows = teamExposure(),
    markup = rows.length
      ? `<div class="exposureList">${rows
          .slice(0, 6)
          .map(([team, count]) => {
            let cls = count >= 4 ? 'heavy' : count === 3 ? 'warn' : '',
              label = count >= 4 ? 'Heavy' : count === 3 ? 'Caution' : 'Normal';
            return `<div class="exposureRow ${cls}"><b>${team}</b><div class="exposureBar"><span style="width:${Math.min(100, count * 25)}%"></span></div><span>${count} • ${label}</span></div>`;
          })
          .join('')}</div>`
      : `<div class="meta">No team concentration yet.</div>`;
  let bye = byeExposure().find(([, c]) => c >= 4);
  if (bye)
    markup += `<div class="exposureNote">Bye warning: ${bye[1]} players are off in Week ${bye[0]}.</div>`;
  ['mobileExposure', 'desktopExposure'].forEach(id => {
    let el = document.getElementById(id);
    if (el) el.innerHTML = markup;
  });
}
function simpleMarketLabel(x) {
  if (x.pressure >= 82) return 'Likely gone';
  if (x.pressure >= 65) return 'Draft soon';
  if (x.pressure >= 45) return 'Monitor';
  return 'Safe to wait';
}
/**
 * Draft Command Center V1 - Get recommendation context and scoring
 * Used for transparent recommendation display
 */
function getCommandCenterContext() {
  const c = counts(),
    r = info();
  const availablePlayers = available();
  let teamsUntilNextPick = r.until;

  return {
    availablePlayers,
    counts: c,
    round: r.r,
    teamsUntilNextPick,
    rosterNeeds: DraftCommandCenterV1
      ? DraftCommandCenterV1.calculatePositionNeeds(c, TOTAL_ROUNDS, r.r, leagueContext)
      : {},
    settings: leagueContext,
  };
}

/**
 * Get detailed recommendation scores using Command Center V1
 */
function getCommandCenterScores(recs) {
  if (!DraftCommandCenterV1 || !recs.length) return [];

  const context = getCommandCenterContext();
  return recs.map(p => ({
    ...p,
    commandCenterScore: DraftCommandCenterV1.scoreRecommendation(p, context),
    commandCenterExplanation: DraftCommandCenterV1.generateExplanation(
      p,
      DraftCommandCenterV1.scoreRecommendation(p, context),
      {
        counts: context.counts,
        round: context.round,
        teamsUntilNextPick: context.teamsUntilNextPick,
      }
    ),
  }));
}

function joninScoreBreakdown(p) {
  const final = finalPickScore(p),
    value = (valueOverride(p) ? 3 : 0) + (eternalValue(p) ? 4 : 0),
    rosterFit = rosterFitModifier(p),
    scarcity = roomBoost(p),
    risk = 0;
  // Projection is the exact residual of the existing score after its exposed modifiers.
  // Survival risk already participates inside Mamba; it is not subtracted twice here.
  const projection = final - value - rosterFit - scarcity - risk;
  return { projection, value, rosterFit, scarcity, risk, final, mamba: mambaScore(p) };
}
function orderedDecisionCandidates(player, recs) {
  return [player, ...recs.filter(candidate => candidate.id !== player.id)];
}
function joninPlayerInsight(player, recs) {
  if (!window.JoninInsightEngineV1 || !player) return null;
  const candidates = orderedDecisionCandidates(player, recs).map(candidate => ({
    player: candidate,
    finalScore: finalPickScore(candidate),
    breakdown: joninScoreBreakdown(candidate),
  }));
  return JoninInsightEngineV1.buildRecommendationInsight({
    player,
    candidates,
    availablePlayers: available(),
    counts: counts(),
    positionStrength: positionStrength(player.pos),
    picksUntil: info().until,
    pick,
    survivalRisk: survivalRisk(player),
    breakdown: candidates[0].breakdown,
  });
}
function joninRecommendationInsight(recs) {
  return recs.length ? joninPlayerInsight(recs[0], recs) : null;
}
function sharinganPlayerForecast(player, recs) {
  if (!window.SharinganVisionV1 || !player) return null;
  const candidates = orderedDecisionCandidates(player, recs).map(candidate => ({
    player: candidate,
    finalScore: finalPickScore(candidate),
    breakdown: joninScoreBreakdown(candidate),
  }));
  return SharinganVisionV1.forecast({
    player,
    candidates,
    breakdown: candidates[0].breakdown,
    availablePlayers: available(),
    recentPicks: history
      .slice(-8)
      .map(entry => players.find(player => player.id === entry.id))
      .filter(Boolean),
    userCounts: managerPositionCounts(slot),
    teamsBeforeNext: teamsBeforeMyNextPick().map(team => ({
      team,
      counts: managerPositionCounts(team),
    })),
    picksUntil: info().until,
    settings: leagueContext,
  });
}
function sharinganVisionForecast(recs) {
  return recs.length ? sharinganPlayerForecast(recs[0], recs) : null;
}
function signedScore(value) {
  return `${value > 0 ? '+' : ''}${value}`;
}
function safeInsightText(value) {
  if (window.JoninInsightEngineV1) return JoninInsightEngineV1.escapeHTML(value);
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}
function joninInsightMarkup(insight, ccScored) {
  if (!insight) return '';
  const b = insight.breakdown,
    w = insight.whyNot,
    o = insight.opportunityWindow,
    c = insight.confidence;
  const whyNot = w.alternative
    ? `<div class="whyNot"><div class="insightHeader"><b>Why Not ${safeInsightText(w.alternative.name || 'unnamed alternative')}?</b><span class="scoreDelta">${safeInsightText(signedScore(w.scoreDifference))} edge</span></div><div>${safeInsightText(w.preferred)}</div><div class="whyNotGrid"><span><b>Stronger</b>${safeInsightText(w.stronger)}</span><span><b>Weaker</b>${safeInsightText(w.weaker)}</span></div></div>`
    : `<div class="whyNot neutralInsight"><b>Why Not?</b><span>${safeInsightText(w.preferred)}</span></div>`;
  return `<div class="joninInsight">
  <div class="insightHeader"><div><div class="insightEyebrow">JŌNIN INSIGHT ENGINE V1</div><b>Why this recommendation</b></div><div class="confidenceBadge"><strong>${safeInsightText(c.score)}</strong><span>Heuristic • ${safeInsightText(c.label)}</span></div></div>
  <div class="insightSections">${[
    ['Value', insight.sections.value],
    ['Team Fit', insight.sections.teamFit],
    ['Scarcity', insight.sections.scarcity],
    ['Risk', insight.sections.risk],
    ['Heuristic confidence', insight.sections.confidence],
  ]
    .map(
      ([label, text]) =>
        `<div class="insightSection"><b>${label}</b><span>${safeInsightText(text)}</span></div>`
    )
    .join('')}</div>
  <div class="opportunity ${o.label === 'Draft now' ? 'urgent' : o.label === 'Risky to wait' ? 'watch' : 'safe'}"><div><span>CAN I WAIT?</span><b>${safeInsightText(o.label)}</b></div><p>${safeInsightText(o.reason)}</p></div>
  <div class="scoreBreakdown"><div class="insightHeader"><b>Existing score breakdown</b><span>Final ${safeInsightText(b.final)}</span></div><div class="scoreRows">${[
    ['Projection', b.projection],
    ['Value', b.value],
    ['Roster Fit', b.rosterFit],
    ['Scarcity', b.scarcity],
    ['Risk', b.risk],
  ]
    .map(
      ([label, value]) =>
        `<div><span>${label}</span><b>${safeInsightText(signedScore(value))}</b></div>`
    )
    .join(
      ''
    )}<div class="scoreFinal"><span>Final Pick</span><b>${safeInsightText(b.final)}</b></div></div><div class="insightMeta">Risk is already embedded in the existing Mamba projection. Command Center V1: ${ccScored ? `${safeInsightText(ccScored.commandCenterScore.total)}/100 • ${safeInsightText(ccScored.commandCenterExplanation)}` : 'neutral'}</div></div>
  ${whyNot}
 </div>`;
}
function sharinganVisionMarkup(vision) {
  if (!vision) return '';
  const cliff = vision.tierCliff,
    forecast = vision.availability,
    why = vision.whyNot;
  const comparison = why.alternative
    ? `<div class="visionWhyNot"><div class="visionLabel">Why Not ${safeInsightText(why.alternative.name || 'unnamed alternative')}?</div><p>${safeInsightText(why.preferred)}</p><div class="visionCompare"><span>${safeInsightText(why.alternativeStrength)}</span><span>${safeInsightText(why.alternativeWeakness)}</span></div></div>`
    : `<div class="visionWhyNot"><div class="visionLabel">Why Not?</div><p>${safeInsightText(why.preferred)}</p></div>`;
  return `<section class="sharinganVisionV1" aria-label="Sharingan Vision">
  <div class="visionV1Header"><div><div class="visionV1Eyebrow">SHARINGAN VISION</div><b>What happens if I don't draft ${safeInsightText(vision.player?.name || 'this player')}?</b></div></div>
  <div class="visionOpportunityBlock"><span>Opportunity Window</span><b class="visionOpportunity ${vision.opportunity.label === 'Draft Now' ? 'urgent' : vision.opportunity.label === 'Risky To Wait' ? 'watch' : 'safe'}">${safeInsightText(vision.opportunity.label)}</b><small>${safeInsightText(vision.opportunity.reason)}</small></div>
  <div class="visionSignalGrid"><div><span>Availability Forecast</span><b>${safeInsightText(forecast.label)}</b><small>${safeInsightText(forecast.reason)}</small></div><div><span>Tier Cliff</span><b>${safeInsightText(cliff.currentTier)} → ${safeInsightText(cliff.nextTier)}</b><small>${safeInsightText(cliff.reason)}</small></div></div>
  <div class="visionWhyNow"><div class="visionLabel">Why Now</div>${vision.whyNow.map(item => `<div><b>${safeInsightText(item.label)}</b><span>${safeInsightText(item.text)}</span></div>`).join('')}</div>
  ${comparison}
 </section>`;
}
function concisePlayerComparison(player, primary, breakdown, primaryBreakdown, vision) {
  const alternative = player.id === primary.id ? vision?.whyNot?.alternative : primary;
  if (!alternative) return 'No comparable alternative is available.';
  const dimensions = [
      ['projection', 'projection'],
      ['value', 'value'],
      ['rosterFit', 'roster fit'],
      ['scarcity', 'tier scarcity'],
    ],
    other = player.id === primary.id ? joninScoreBreakdown(alternative) : breakdown,
    winner = primary,
    winnerBreakdown = primaryBreakdown,
    loserBreakdown = other;
  const advantage = dimensions
    .map(([key, label]) => ({
      label,
      edge: Number(winnerBreakdown?.[key] || 0) - Number(loserBreakdown?.[key] || 0),
    }))
    .sort((a, b) => b.edge - a.edge)[0];
  const margin = Math.abs(finalPickScore(player) - finalPickScore(alternative)),
    tone = margin <= 3 ? 'narrowly ' : '',
    reason =
      advantage?.edge > 0
        ? advantage.label
        : vision?.tierCliff?.nearCliff
          ? 'tier scarcity'
          : 'overall fit';
  return `Why not ${alternative.name}? ${winner.name} ${tone}wins on ${reason}.`;
}
function setAdvancedAnalysisExpanded(open) {
  advancedAnalysisExpanded = Boolean(open);
}

function coachingEventPresentation(eventType) {
  const events = {
    OPPORTUNITY: { icon: '⚡', label: 'OPPORTUNITY' },
    ROOM_OVERREACTION: { icon: '🔥', label: 'ROOM OVERREACTION' },
    TIER_BREAK: { icon: '🚨', label: 'TIER BREAK' },
    POSITIONAL_EDGE: { icon: '◆', label: 'POSITIONAL EDGE' },
  };
  return events[eventType] || null;
}
function playerPhotoFor(player){return playerPhotoRegistry?.resolve(player)||window.PlayerPhotoV1?.fallback(player)||{available:false,url:null}}
function playerPhotoMarkup(player,className='',decorative=false){
  const photo=playerPhotoFor(player),positionFallback=`assets/player-placeholders/${positionKey(player).toLowerCase()}.svg`,src=photo.available?photo.url:positionFallback,stage=photo.available?0:1,alt=decorative?'':photo.available?`Portrait of ${player.name}`:`Player portrait unavailable for ${player.name}`;
  return `<img class="${safeInsightText(className)}" src="${safeInsightText(src)}" loading="lazy" decoding="async" data-position-fallback="${safeInsightText(positionFallback)}" data-generic-fallback="assets/player-placeholders/generic.svg" data-fallback-stage="${stage}" data-player-name="${safeInsightText(player.name)}" alt="${safeInsightText(alt)}" onerror="handlePlayerPortraitError(this)">`;
}
function handlePlayerPortraitError(image) {
  if (!image) return;
  const stage = Number(image.dataset.fallbackStage || 0);
  if (stage === 0) {
    image.dataset.fallbackStage = '1';
    image.src = image.dataset.positionFallback;
    image.alt = `Player portrait unavailable for ${image.dataset.playerName || 'this player'}`;
    return;
  }
  if (stage === 1) {
    image.dataset.fallbackStage = '2';
    image.src = image.dataset.genericFallback;
    return;
  }
  image.hidden = true;
  image.parentElement?.classList.add('portraitUnavailable');
}
function premiumPlayerCardMarkup(card) {
  if (!card || card.empty)
    return `<section class="premiumPlayerCard emptyPlayerCard" aria-label="Recommended player"><p>${safeInsightText(card?.message || 'No player recommendation is currently available.')}</p></section>`;
  const traits = card.traits
      .map(trait => `<span class="playerTrait">${safeInsightText(trait)}</span>`)
      .join(''),
    metrics = [
      card.tier
        ? `<span class="premiumMetric premiumTierBadge"><small>Tier</small><b>${safeInsightText(card.tier)}</b></span>`
        : '',
      card.mambaScore != null
        ? `<span class="premiumMetric premiumMambaBadge"><small>Mamba</small><b>${safeInsightText(card.mambaScore)}</b></span>`
        : '',
    ]
      .filter(Boolean)
      .join(''),
    alt =
      ['exact-local','provider'].includes(card.imageStatus)
        ? `Portrait of ${safeInsightText(card.name)}`
        : `Player portrait unavailable for ${safeInsightText(card.name)}`;
  return `<article class="premiumPlayerCard stage-${safeInsightText(card.sharinganStage)} ${card.comparisonMode ? 'isComparing' : ''}" aria-label="${card.comparisonMode ? 'Comparing' : 'Recommended player'} ${safeInsightText(card.name)}"><div class="playerPortrait"><img src="${safeInsightText(card.imageUrl)}" loading="lazy" decoding="async" data-position-fallback="${safeInsightText(card.positionFallbackUrl)}" data-generic-fallback="${safeInsightText(card.genericFallbackUrl)}" data-fallback-stage="${safeInsightText(card.fallbackStage)}" data-player-name="${safeInsightText(card.name)}" alt="${alt}" onerror="handlePlayerPortraitError(this)"><span class="portraitLight" aria-hidden="true"></span><span class="portraitMonogram" aria-hidden="true">${safeInsightText(card.position)}</span></div><div class="playerCardBody">${card.comparisonMode ? `<div class="playerCardState">COMPARING</div>` : ''}<h2>${safeInsightText(card.name)}</h2><div class="playerIdentity"><span class="positionBadge">${safeInsightText(card.position)}</span><strong>${safeInsightText(card.nflTeam || 'Team unavailable')}</strong>${card.rookie ? `<span class="rookieBadge">ROOKIE</span>` : ''}</div><div class="playerCardMetrics" aria-label="Player metrics">${metrics}</div>${traits ? `<div class="playerTraits" aria-label="Player traits">${traits}</div>` : ''}${card.byeWeek != null ? `<div class="playerCardBye">Bye week <strong>${safeInsightText(card.byeWeek)}</strong></div>` : ''}<div class="playerCardAction"><button class="primary decisionDraftBtn" onclick="recordCurrentPick(${safeInsightText(card.playerId)})">Draft ${safeInsightText(card.name)}</button></div></div></article>`;
}
function comparableQuarterbackDepth() {
  const quarterbacks = available()
    .filter(candidate => positionKey(candidate) === 'QB')
    .sort((a, b) => finalPickScore(b) - finalPickScore(a));
  if (!quarterbacks.length) return 0;
  const leaderScore = finalPickScore(quarterbacks[0]);
  return quarterbacks.filter(candidate => Math.abs(leaderScore - finalPickScore(candidate)) <= 5)
    .length;
}
function draftPsychologyFor(primary, recs) {
  if (!window.DraftPsychologyEngineV1 || !primary) return null;
  const teamCount = leagueContext.teams || 10,
    managerContexts = [];
  for (let team = 1; team <= teamCount; team++) {
    const manager = getManager(team),
      name = team === slot ? 'Gerard' : slotManagers[team] || 'Unknown manager';
    managerContexts.push({
      team,
      name,
      archetype: manager?.archetype || '',
      predictability: manager?.predictability,
      qbHoard: manager?.qbHoard,
      homer: manager?.homer,
      homerTeam: manager?.homerTeam,
      counts: managerPositionCounts(team),
    });
  }
  const primaryInsight = joninPlayerInsight(primary, recs),
    availablePlayers = available().map(candidate => ({
      id: candidate.id,
      name: candidate.name,
      position: positionKey(candidate),
      tier: PlayerTierContract.getDecisionTier(candidate),
      overall: candidate.overall,
      rookie: Boolean(candidate.rookie),
    }));
  return DraftPsychologyEngineV1.analyze({
    currentPick: pick,
    round: info().r,
    userSlot: slot,
    leagueSize: teamCount,
    totalPicks: TOTAL_PICKS,
    recentPicks: history
      .slice(-10)
      .map(entry => players.find(candidate => candidate.id === entry.id))
      .filter(Boolean)
      .map(candidate => ({
        id: candidate.id,
        position: positionKey(candidate),
        tier: PlayerTierContract.getDecisionTier(candidate),
      })),
    availablePlayers,
    recommendation: {
      id: primary.id,
      name: primary.name,
      position: positionKey(primary),
      tier: PlayerTierContract.getDecisionTier(primary),
      overall: primary.overall,
      rookie: Boolean(primary.rookie),
    },
    recommendationConfidence: primaryInsight?.confidence?.score ?? null,
    recommendationMamba: mambaScore(primary),
    managers: managerContexts,
    rostersComplete: managerContexts.every(manager => manager.name !== 'Unknown manager'),
    userCounts: counts(),
    starterSlots: {
      QB: leagueContext.startQB,
      RB: leagueContext.startRB,
      WR: leagueContext.startWR,
      TE: leagueContext.startTE,
    },
  });
}
function draftPsychologyMarkup(psychology) {
  if (!psychology) return '';
  const availability = psychology.projectedNextPickAvailability || {},
    flight = psychology.flightRisk || {},
    support = (psychology.supportingInsights || [])
      .slice(0, 2)
      .map(item => `<li>${safeInsightText(item)}</li>`)
      .join('');
  return `<section class="draftPsychology" aria-label="Room Intelligence" aria-live="off"><div class="psychologyHeader"><span>ROOM INTELLIGENCE</span><strong>${safeInsightText(psychology.timingRecommendation)}</strong></div><p class="psychologyInsight">${safeInsightText(psychology.keyInsight)}</p>${support ? `<ul>${support}</ul>` : ''}<details><summary>Next-turn outlook</summary><div class="psychologyDetails"><span>Availability <b>${safeInsightText(availability.availabilityLabel || 'UNKNOWN')} ${safeInsightText(availability.probabilityBand || '')}</b></span><span>Run <b>${safeInsightText(psychology.recentRun ? `${psychology.recentRun} ${psychology.runStatus}` : 'NONE')}</b></span><span>Flight risk <b>${safeInsightText(flight.severity || 'NONE')}</b></span><span>Data quality <b>${safeInsightText(psychology.dataQuality)}</b></span></div></details></section>`;
}
function playerDecisionModel(player, recs) {
  const breakdown = joninScoreBreakdown(player),
    insight = joninPlayerInsight(player, recs),
    vision = sharinganPlayerForecast(player, recs),
    state = recommendationState(player);
  const hero = window.JoninUXPolish
    ? JoninUXPolish.hero({ player, insight, vision, breakdown })
    : {
        playerId: player.id,
        name: player.name,
        identity: `${player.pos} • ${player.team || 'Team unavailable'}`,
        confidence: 50,
        confidenceLabel: 'Developing',
        primary: { label: 'Best Available', reason: rationale(player) },
      };
  const primary = recs[0],
    comparison = concisePlayerComparison(
      player,
      primary,
      breakdown,
      joninScoreBreakdown(primary),
      vision
    ),
    pivotPlayer = recs.find(candidate => candidate.id !== player.id),
    strategy = inferredStrategy();
  const pivot = pivotPlayer
    ? {
        id: pivotPlayer.id,
        name: pivotPlayer.name,
        identity: `${pivotPlayer.pos} • ${pivotPlayer.team || 'Team unavailable'}`,
        reason: rationale(pivotPlayer),
      }
    : null;
  const rawSummary = window.FlightControlV1
    ? FlightControlV1.decisionSummary({
        hero,
        vision,
        insight,
        comparison,
        pivot,
        context: { round: info().r, strategy: strategy.name },
      })
    : {
        action: 'ACT',
        headline: 'Make the pick',
        mission: 'Build the strongest available roster.',
        bestPath: { label: 'ACT', text: `Draft ${player.name}.` },
        pivot,
        reason: hero.primary.reason,
        primary: hero.primary,
        reasons: [hero.primary.reason],
        wait: {
          action: 'LEAN DRAFT',
          availability: 'Uncertain',
          conclusion: 'Availability is uncertain.',
        },
        comparison,
      };
  const marketFloor=window.JoninDecisionIntelligenceV1?recommendationMarketFloor(championshipDecision(),rosterCompletionState()):{active:false,playerId:null},playerMarketFloor=marketFloor.active&&String(marketFloor.playerId)===String(player.id)?marketFloor:null,integrityConfidence=playerMarketFloor?.confidence??finalDecisionTrace(player).strategy?.integrity?.confidence,summary=integrityConfidence==null?rawSummary:{...rawSummary,reason:playerMarketFloor?.reason??rawSummary.reason,marketFloor:playerMarketFloor,confidence:{...rawSummary.confidence,score:Math.min(Number(rawSummary.confidence?.score??100),integrityConfidence),label:playerMarketFloor?.confidenceLabel??(integrityConfidence>=82?'High confidence':integrityConfidence>=62?'Solid confidence':integrityConfidence>=42?'Close call':'Low confidence')}};
  const stage = sharinganStage(player),
    recent = history
      .slice(-8)
      .map(entry => players.find(candidate => candidate.id === entry.id))
      .filter(Boolean),
    runPositions = ['QB', 'RB', 'WR', 'TE']
      .map(position => ({
        position,
        count: recent.filter(candidate => positionKey(candidate) === position).length,
      }))
      .sort((a, b) => b.count - a.count),
    run = runPositions[0];
  const coaching = window.AdaptiveCoachingEngineV1
    ? AdaptiveCoachingEngineV1.buildCoachingDecision({
        currentPick: pick,
        round: info().r,
        leagueSize: leagueContext.teams || 10,
        rosterSize: rosterSlots.length,
        draftedCount: myPlayers().length,
        counts: counts(),
        starterSlots: {
          QB: leagueContext.startQB,
          RB: leagueContext.startRB,
          WR: leagueContext.startWR,
          TE: leagueContext.startTE,
          K: leagueContext.startK,
          DST: leagueContext.startDST,
        },
        primaryRecommendation: { id: player.id, name: player.name, pos: player.pos },
        pivotRecommendation: pivotPlayer,
        confidence: summary.confidence.score,
        secondaryReason: summary.reason,
        eternal: stage.key === 'eternal',
        tierCliff: vision?.tierCliff,
        roomOverreaction: {
          active: Boolean(run && run.count >= 4),
          position: run?.position,
          count: run?.count,
        },
        positionalEdge: Boolean(
          vision?.tierCliff?.nearCliff && ['QB', 'TE'].includes(positionKey(player))
        ),
        similarAtPosition: comparableQuarterbackDepth(),
        waitSupported: player.pos !== 'QB' && Number(vision?.availability?.score || 0) >= 55,
      })
    : null;
  const playerCard = window.PremiumPlayerCardV1
    ? PremiumPlayerCardV1.buildPlayerCardModel({
        player,
        tier: PlayerTierContract.getDecisionTier(player),
        mambaScore: mambaScore(player),
        availabilityLabel: vision?.availability?.label,
        recommendationRank: recs.findIndex(candidate => candidate.id === player.id) + 1,
        sharinganStage: stage.key,
        coachingPhase: coaching?.phaseLabel,
        coachingHeadline: coaching?.headline,
        tierCliff: vision?.tierCliff,
        comparisonMode: player.id !== primary.id,
        photo: playerPhotoFor(player),
      })
    : null;
  const psychology = draftPsychologyFor(primary, recs);
  const championship=window.JoninDecisionIntelligenceV1?championshipDecision():null;
  const championshipEvaluation=championship?.all.find(item=>item.playerId===player.id)||null;
  return {
    player,
    breakdown,
    insight,
    vision,
    state,
    hero,
    summary,
    coaching,
    playerCard,
    psychology,
    ccScored: getCommandCenterScores([player])[0] || null,
    championship,
    championshipEvaluation,
    championshipEquity: championshipEquityEvidence(player),
  };
}
function commandCenterMarkup(cc) {
  if (!cc) return '';

  const s = cc.commandCenterScore;
  const c = s.components;

  return `
  <section class="commandCenterCard" aria-label="Command Center">
    <div class="commandCenterHeader">
      <span>COMMAND CENTER</span>
      <strong>${safeInsightText(s.total)}/100</strong>
    </div>

    <div class="commandCenterExplanation">
      ${safeInsightText(cc.commandCenterExplanation)}
    </div>

    <div class="commandCenterGrid">
      <div>
        <span>Value</span>
        <b>${safeInsightText(c.value)}</b>
      </div>

      <div>
        <span>Team Fit</span>
        <b>${safeInsightText(c.teamFit)}</b>
      </div>

      <div>
        <span>Scarcity</span>
        <b>${safeInsightText(c.scarcity)}</b>
      </div>

      <div>
        <span>Urgency</span>
        <b>${safeInsightText(c.urgency)}</b>
      </div>
    </div>
  </section>`;
}
function compactStrategyTags(model){
  const p=model.player,vision=model.vision,score=mambaScore(p),tags=[];
  const add=(icon,label)=>{if(label&&!tags.some(item=>item.label===label)&&tags.length<4)tags.push({icon,label})};
  if(['QB','TE'].includes(positionKey(p))&&['S','A'].includes(PlayerTierContract.getDecisionTier(p)))add('⚡','Positional edge');
  if(vision?.tierCliff?.nearCliff)add('🛡️','Protects tier');
  if(vision?.opportunity?.label==='Draft Now'||survivalRisk(p)>=60)add('🔥','High urgency');
  if(score>=92)add('💎','Premium value');
  if(p.leagueBreaker===true)add('🚀','Ceiling builder');
  if(p.rookie===true)add('🌱','Rookie upside');
  if(tags.length<3)add('📈',model.summary?.primary?.label||'Best path');
  if(tags.length<3)add('🛟','Roster-safe value');
  return tags;
}
function confidenceIndicator(score){
  const numeric=Math.max(0,Math.min(100,Number(score)||0)),filled=Math.max(1,Math.min(5,Math.round(numeric/20))),label=numeric>=80?'High':numeric>=65?'Solid':numeric>=48?'Close call':'Toss-up';
  return `<div class="fightConfidence" aria-label="${safeInsightText(label)} confidence, ${safeInsightText(numeric)} out of 100"><span>CONFIDENCE</span><b aria-hidden="true">${'★'.repeat(filled)}${'☆'.repeat(5-filled)}</b><strong>${safeInsightText(label)}</strong></div>`;
}
function injuryBadgeMarkup(player){
  const label=window.InjuryIntelligenceV1?InjuryIntelligenceV1.badge(player?.injury||{}):'';
  return label?`<span class="injuryBadge" title="Injury status; open player details for sources">${safeInsightText(label)}</span>`:'';
}
function decisionCardMarkup(model, { recommended = false } = {}) {
  const p=model.player,card=model.playerCard||{},score=mambaScore(p),tier=PlayerTierContract.getDecisionTier(p),confidence=model.coaching?.confidence??model.summary?.confidence?.score??50,tags=compactStrategyTags(model),label=recommended?'RECOMMENDED PICK':'PLAYER VIEW',portrait=card.imageUrl||`assets/player-placeholders/${positionKey(p).toLowerCase()}.svg`,stage=sharinganStage(p);
  return `<article class="compactFightCard ${recommended?'recommendedDecision':'playerViewDecision'} stage-${safeInsightText(stage.key)}" data-selected-player-id="${safeInsightText(p.id)}" aria-live="polite"><div class="fightPlayerVisual"><img src="${safeInsightText(portrait)}" loading="lazy" decoding="async" data-position-fallback="${safeInsightText(card.positionFallbackUrl||'assets/player-placeholders/generic.svg')}" data-generic-fallback="${safeInsightText(card.genericFallbackUrl||'assets/player-placeholders/generic.svg')}" data-fallback-stage="${safeInsightText(card.fallbackStage??1)}" data-player-name="${safeInsightText(p.name)}" alt="Portrait of ${safeInsightText(p.name)}" onerror="handlePlayerPortraitError(this)"><span aria-hidden="true">${safeInsightText(positionKey(p))}</span></div><div class="fightPlayerContent"><div class="fightPlayerLabel">${label}</div><h2>${safeInsightText(p.name)}</h2><p>${safeInsightText(positionKey(p))} • ${safeInsightText(p.team||'Team unavailable')} ${injuryBadgeMarkup(p)}</p><div class="fightMetrics"><span><small>TIER</small><b>${safeInsightText(tier)}</b></span><span><small>MAMBA SCORE</small><b>♛ ${safeInsightText(score)}</b></span></div><div class="sharinganStage stage-${safeInsightText(stage.key)}">${sharinganIconMarkup(stage.key)}<span>${safeInsightText(stage.label)} • ${safeInsightText(stage.meaning)}</span></div><div class="fightTags">${tags.map(tag=>`<span title="${safeInsightText(tag.label)}"><i aria-hidden="true">${tag.icon}</i>${safeInsightText(tag.label)}</span>`).join('')}</div>${confidenceIndicator(confidence)}${recommended?'':`<button type="button" class="returnRecommendation" onclick="selectCandidate(${snapshotRecommendations()[0]?.id})">Return to top recommendation</button>`}</div></article>`;
}
function recommendationCategoryLabels(models) {
  if(!window.RecommendationArchetypesV1){const fallback=new Map();models.forEach((model,index)=>fallback.set(model.player.id,index===0?'Best Pick':'Alternative'));return fallback}
  const rows=models.map((model,index)=>{const player=model.player,trace=finalDecisionTrace(player),strategy=trace.strategy,acquisition=strategy?.priceOfAcquisition,components=scoreComponents(player),rank=reliableOverallRank(player),candidate=championshipEquityCandidate(player,model.championship);return{id:player.id,order:index,valueFall:rank==null?null:Math.max(0,pick-rank),valueOverride:valueOverride(player),valueScore:components.value,upsideScore:components.ceiling,leagueBreaker:player.leagueBreaker===true,rookie:player.rookie===true,upsideAdjustment:trace.modifiers?.upside?.adjustment??0,upsideSignals:strategy?.benchPortfolio?.signals??[],starterImpact:strategy?.starterEquity?.impact??0,rosterFit:model.championshipEvaluation?.scores?.rosterFit??trace.context?.rosterFit??0,meaningfulTierCliff:acquisition?.meaningfulTierCliff===true,survivalRisk:acquisition?.survivalRisk??0,survival:acquisition?.survival??null,...candidate}}),baseline=RecommendationArchetypesV1.assign(rows),baselineUpsideId=baseline.upsideId,championshipEquityUpside=window.ChampionshipEquityProductionV1?ChampionshipEquityProductionV1.selectHighestUpside({rows,baselinePlayerId:baselineUpsideId,bestPickId:rows[0]?.id,context:championshipEquityDraftContext()}):{playerId:baselineUpsideId,changed:false,reason:'UNAVAILABLE'},assignments=RecommendationArchetypesV1.assign(rows,{preferredUpsideId:championshipEquityUpside.playerId}),labels=new Map();window.__championshipEquityHighestUpsideDecision=championshipEquityUpside;
  models.forEach(model=>labels.set(model.player.id,assignments.labels.get(String(model.player.id))||'Alternative'));
  return labels;
}
function alternativeDecisionMarkup(model, rank, categoryLabel) {
  const p=model.player,card=model.playerCard||{},tier=PlayerTierContract.getDecisionTier(p),score=mambaScore(p),confidence=model.coaching?.confidence??model.summary?.confidence?.score??50,tags=compactStrategyTags(model).slice(0,4),active=selectedCandidateId===p.id||(!selectedCandidateId&&rank===1),portrait=card.imageUrl||`assets/player-placeholders/${positionKey(p).toLowerCase()}.svg`;
  return `<article class="recommendationPlayerCard ${active?'active':''}" data-testid="recommendation-card-${safeInsightText(p.id)}" data-player-id="${safeInsightText(p.id)}"><span class="recommendationCategory">${safeInsightText(categoryLabel)}</span><span class="recommendationRank">${rank}</span><div class="recommendationPortrait"><img src="${safeInsightText(portrait)}" loading="lazy" decoding="async" data-position-fallback="${safeInsightText(card.positionFallbackUrl||'assets/player-placeholders/generic.svg')}" data-generic-fallback="${safeInsightText(card.genericFallbackUrl||'assets/player-placeholders/generic.svg')}" data-fallback-stage="${safeInsightText(card.fallbackStage??1)}" data-player-name="${safeInsightText(p.name)}" alt="" onerror="handlePlayerPortraitError(this)"></div><div class="recommendationCardIdentity"><b>${safeInsightText(p.name)}</b><small>${safeInsightText(positionKey(p))} • ${safeInsightText(p.team||'—')}</small><span>Tier ${safeInsightText(tier)} • ♛ ${safeInsightText(score)}</span></div><div class="recommendationIcons">${tags.map(tag=>`<i title="${safeInsightText(tag.label)}" aria-label="${safeInsightText(tag.label)}">${tag.icon}</i>`).join('')}</div><div class="recommendationStars" aria-label="${safeInsightText(confidence)} confidence">${'★'.repeat(Math.max(1,Math.min(5,Math.round(confidence/20))))}${'☆'.repeat(5-Math.max(1,Math.min(5,Math.round(confidence/20))))}</div><div class="recommendationActions"><button type="button" class="viewRecommendation" aria-pressed="${active}" onclick="viewRecommendationPlayer(${p.id})">View</button><button type="button" class="draftRecommendation" onclick="draftRecommendationPlayer(${p.id})">Draft</button></div></article>`;
}
function appendExclusionControl(container,player){
  if(!container||!player)return;const button=document.createElement('button');button.type='button';button.className='excludeRecommendationButton';button.textContent='×';button.title='Exclude from recommendations';button.setAttribute('aria-label',`Exclude ${player.name} from recommendations`);button.addEventListener('click',event=>excludeRecommendationPlayer(player.id,event));container.appendChild(button);
}
function renderRecommendation() {
  const renderStarted = performance.now();
  let recs = snapshotRecommendations();
  if (!recs.length) {
    if (DOM.recommendation) {
      DOM.recommendation.innerHTML = '<b>Draft complete.</b>';
      DOM.recommendation.dataset.renderMs = (performance.now() - renderStarted).toFixed(3);
    }
    if (DOM.alternatives) DOM.alternatives.innerHTML = '';
    if(DOM.recordPickBtn){DOM.recordPickBtn.disabled=true;DOM.recordPickBtn.dataset.playerId=''}
    if(DOM.recordPickLabel)DOM.recordPickLabel.textContent='Draft complete';

    return;
  }
  const primary = recs[0],
    selected = selectedCandidateId
      ? players.find(
          candidate => candidate.id === selectedCandidateId && !isDraftedPlayer(candidate.id)
        )
      : null,
    displayed = selected || primary;
  const model = playerDecisionModel(displayed, recs);

  if (!DOM.recommendation || !DOM.alternatives) return;
  DOM.recommendation.className = 'rec ' + model.state.cls;
  DOM.recommendation.innerHTML = decisionCardMarkup(model, {
    recommended: displayed.id === primary.id,
  });
  appendExclusionControl(DOM.recommendation.querySelector('.compactFightCard'),displayed);
  const recommendationModels=recs.slice(0,5).map(candidate=>playerDecisionModel(candidate,recs)),categoryLabels=recommendationCategoryLabels(recommendationModels);
  DOM.alternatives.innerHTML = recommendationModels
    .map((candidateModel, index) => alternativeDecisionMarkup(candidateModel,index+1,categoryLabels.get(candidateModel.player.id)))
    .join('');
  DOM.alternatives.querySelectorAll('.recommendationPlayerCard').forEach(card=>appendExclusionControl(card,playerByCanonicalId(card.dataset.playerId)));
  if(DOM.fightCardMode)DOM.fightCardMode.textContent=displayed.id===primary.id?'Recommended Pick':'Player View';
  updateDraftDecisionChrome(model,displayed,primary);
  DOM.recommendation.dataset.renderMs = (performance.now() - renderStarted).toFixed(3);
  renderExcludedPlayers();
}
function boardControlState(score){return score>=72?'HIGH':score>=55?'MEDIUM':'LOW'}
function updateDraftDecisionChrome(model,displayed,primary){
  const cc=Number(model.ccScored?.commandCenterScore?.total),decision=model.coaching||{},tags=compactStrategyTags(model),completion=rosterCompletionState();
  let instruction=decision.reason||model.summary?.primary?.reason||'Follow the strongest value and roster-building path.';
  if(completion.mode!=='NORMAL') instruction=completion.message;
  safeText('headerCommandScore',Number.isFinite(cc)?boardControlState(cc):'MEDIUM');safeText('headerCommandLabel',Number.isFinite(cc)?'Tier Advantage • Pick Flexibility • Roster Balance':'Board developing');
  if(DOM.boardInstruction)DOM.boardInstruction.innerHTML=`<b>BOARD INSTRUCTION</b><span>${safeInsightText(instruction)}</span><span>🎯 Foundation: ${safeInsightText(decision.phaseLabel||'Best roster path')}</span><span>🛡️ Strategy: ${safeInsightText(tags[1]?.label||tags[0]?.label||'Protect value')}</span><span>💎 Focus: ${safeInsightText(tags[0]?.label||'Best available')}</span>`;
  if(DOM.recordPickBtn){DOM.recordPickBtn.disabled=!displayed||isDraftedPlayer(displayed.id);DOM.recordPickBtn.dataset.playerId=displayed?.id??'';DOM.recordPickBtn.setAttribute('aria-label',`Record ${displayed?.name||'selected player'} at pick ${pick}`)}
  if(DOM.recordPickLabel)DOM.recordPickLabel.textContent=`Pick ${pick} • ${displayed?.name||'No player selected'}`;
}
function recordFightCardPlayer(){
  const id=DOM.recordPickBtn?.dataset.playerId,player=playerByCanonicalId(id);
  if(player&&isDraftedPlayer(player.id)){alert('That player is no longer available.');return false}
  if(!player){alert('Select an available player in Fight Card before recording the pick.');return false}
  if(!recommendationSelectionAllowed(player))alert(`Roster-completion warning: ${rosterCompletionState().message} The recorded draft remains the source of truth.`);
  return recordCurrentPick(player.id);
}
function openFightCardDetails(){
  const id=Number(DOM.recordPickBtn?.dataset.playerId);
  if(id)openScan(id);
}
function viewRecommendationPlayer(id){
  selectCandidate(Number(id));
  openScan(Number(id));
}
function draftRecommendationPlayer(id){
  const player=playerByCanonicalId(id);
  if(player&&isDraftedPlayer(player.id)){alert('That player is no longer available.');return false}
  if(!player){alert('That player is no longer available.');return false}
  if(!recommendationSelectionAllowed(player))alert(`Roster-completion warning: ${rosterCompletionState().message} The recorded draft remains the source of truth.`);
  selectCandidate(player.id);
  return recordFightCardPlayer();
}
function renderBoard() {
  let byPick = new Map(history.map(x => [x.pick, x])),
    cols = [];
  const teamCount=leagueContext.teams||10;
  for (let t = 1; t <= teamCount; t++) {
    let cells = [];
    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
      let pnum = (r - 1) * teamCount + (r % 2 ? t : teamCount+1-t),
        h = byPick.get(pnum),
        pl = h ? players.find(x => x.id === h.id) : null;
      cells.push(
        `<div data-pick="${pnum}" class="pickCell ${boardPlayerClasses(pl)} ${pnum === pick ? 'current' : ''} ${h && h.team === slot ? 'mine' : ''}"><span class="pn">${pnum}</span><span class="name">${pl ? pl.name : pnum === pick ? 'ON CLOCK' : '—'}</span></div>`
      );
    }
    cols.push(
      `<div class="teamCol ${t === slot ? 'you' : ''}"><div class="teamHead">${t === slot ? '⭐ YOU' : slotManagers[t] || 'Team ' + t}<small>${t === slot ? 'Gerard Mode' : aiProfiles[t] || 'Manual'}</small></div>${cells.join('')}</div>`
    );
  }
  const markup = cols.join('');
  if (DOM.desktopBoard) DOM.desktopBoard.innerHTML = markup;
  if (DOM.draftBoard) DOM.draftBoard.innerHTML = markup;
}
function teamTierMarkup() {
  let positions = ['QB', 'RB', 'WR', 'TE'],
    lines = positions
      .map(pos => {
        let c = positionTierCounts(pos),
          bits =
            ['S', 'A', 'B', 'C']
              .filter(t => c[t])
              .map(t => `${t}×${c[t]}`)
              .join('  ') || '—';
        return `<div class="tierLine"><b>${pos}</b><span class="tierDots">${bits}</span><span>${positionStrength(pos)}</span></div>`;
      })
      .join('');
  let rb = positionStrength('RB'),
    wr = positionStrength('WR'),
    advice =
      rb === 'Elite' || rb === 'Strong'
        ? 'RB quality is secure. Shift toward WR when values are close. Value Override still wins.'
        : wr === 'Elite' || wr === 'Strong'
          ? 'WR quality is secure. Add RB when values are close. Value Override still wins.'
          : 'Build the best available starting tier. Value remains the priority.';
  return `<div class="teamTierSummary"><b>Team Decision-Tier Quality</b>${lines}<div class="teamAdvice">${advice}</div></div>`;
}
function rosterSlotMarkup(row) {
  const p = row.player,
    label = row.slot.startsWith('DEF') ? row.slot.replace('DEF', 'D/ST') : row.slot;
  if (!p) {
    const missing = row.unresolved
      ? `Unresolved player ID ${safeInsightText(row.playerId)}`
      : 'Empty';
    return `<div class="myTeamSlot emptySlot" role="listitem"><span class="rosterSlotLabel">${safeInsightText(label)}</span><span class="rosterEmpty" aria-label="${safeInsightText(label)} empty">${missing}</span></div>`;
  }
  const decisionTier = PlayerTierContract.getDecisionTier(p),
    position = positionKey(p),
    meta = [p.team || 'Team unavailable', p.bye != null ? `Bye ${p.bye}` : null]
      .filter(Boolean)
      .join(' • ');
  return `<div class="myTeamSlot filledSlot" role="listitem"><span class="rosterSlotLabel">${safeInsightText(label)}</span><span class="rosterPlayer"><b>${safeInsightText(p.name)}</b><small>${safeInsightText(position)} • ${safeInsightText(meta)} • <span aria-label="Decision Tier ${decisionTier}">D:${decisionTier}</span></small></span></div>`;
}
function rosterPanelMarkup() {
  const view = rosterViewState(),
    starters = view.starters.map(rosterSlotMarkup).join(''),
    bench = view.bench.map(rosterSlotMarkup).join(''),
    overflow = view.overflow.map(rosterSlotMarkup).join('');
  return `<div class="myTeamGroup" role="group" aria-label="Starting lineup"><div class="myTeamGroupTitle">STARTERS</div><div role="list">${starters}</div></div><div class="myTeamGroup benchGroup" role="group" aria-label="Bench"><div class="myTeamGroupTitle">BENCH</div><div role="list">${bench}</div></div>${overflow ? `<div class="myTeamGroup overflowGroup" role="group" aria-label="Roster overflow"><div class="myTeamGroupTitle">UNASSIGNED</div><div role="list">${overflow}</div></div>` : ''}`;
}
function renderRoster() {
  let markup = rosterPanelMarkup();
  if (DOM.roster) DOM.roster.innerHTML = markup;
  if (DOM.mRoster) DOM.mRoster.innerHTML = markup;
  let ss = [];
  for (let t = 1; t <= (leagueContext.teams||10); t++)
    ss.push(
      `<div class="strategy"><span>${t === slot ? '⭐ YOU' : slotManagers[t] || 'Team ' + t}</span><span class="pill">${t === slot ? 'Gerard Blueprint' : aiProfiles[t] || 'Manual'}</span></div>`
    );
  const strategyMarkup = ss.join('');
  if (DOM.strategies) DOM.strategies.innerHTML = strategyMarkup;
  if (DOM.mStrategies) DOM.mStrategies.innerHTML = strategyMarkup;
}
function renderMeta() {
  let i = info(),
    pickText = i.r + '.' + String(i.ip).padStart(2, '0'),
    scoringLabel =
      leagueContext.scoring === 'full'
        ? 'Full PPR'
        : leagueContext.scoring === 'standard'
          ? 'Standard'
          : 'Half PPR',
    modeLabel = mode === 'practice' ? 'Practice' : mode === 'yahoo' ? 'Yahoo Mock' : 'Live Draft';
  el('practiceControls')?.classList.toggle('hidden', mode !== 'practice');
  const roundText = `${Math.min(i.r, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`;
  if (DOM.round) DOM.round.textContent = roundText;
  if (DOM.mRound) DOM.mRound.textContent = roundText;
  if (DOM.pickLabel) DOM.pickLabel.textContent = pickText;
  if (DOM.mPickLabel) DOM.mPickLabel.textContent = pickText;
  if (DOM.until) DOM.until.textContent = i.until;
  if (DOM.mUntil) DOM.mUntil.textContent = i.until;
  safeText('headerRound', Math.min(i.r, TOTAL_ROUNDS));
  safeText('headerPick', pickText);
  safeText('headerNextPick', `Pick ${pick+i.until}`);
  safeText('headerUntil', i.until===0?'On the clock':`${i.until} pick${i.until===1?'':'s'}`);
  safeText('headerLeagueFormat', `${leagueContext.teams || 10}-Team • ${scoringLabel}`);
  if(DOM.recordPickLabel&&!DOM.recordPickBtn?.dataset.playerId)DOM.recordPickLabel.textContent=`Pick ${pick}`;
  safeText('headerSlot', slot);
  safeText('headerMode', modeLabel);
  safeText('headerLeague', `${leagueContext.teams || 10} teams • ${scoringLabel}`);
  document.getElementById('headerDraftContext')?.classList.remove('hidden');
  renderRoundNoteReminder();
}

function teamPlayers(team) {
  return history
    .filter(h => h.team === team)
    .map(h => players.find(p => p.id === h.id))
    .filter(Boolean);
}
function gradingInput() {
  const teams = [];
  for (let team = 1; team <= (leagueContext.teams || 10); team++)
    teams.push({ teamId: team, managerName: slotManagers[team] || `Team ${team}`, playerIds: history.filter(entry => entry.team === team).map(entry => entry.id) });
  return { teams, players, picks: history.map(entry => ({ overallPick: entry.pick, teamId: entry.team, playerId: entry.id })), settings: { ...leagueContext } };
}
function evaluateCompletedDraft() {
  if (!window.DraftGradingEngineV1) throw new Error('Unified draft grading engine did not load.');
  return DraftGradingEngineV1.evaluateDraft(gradingInput());
}
function reportList(label, values) {
  return `<section class="gradingFeedback"><b>${safeInsightText(label)}</b><ul>${values.map(value => `<li>${safeInsightText(value)}</li>`).join('')}</ul></section>`;
}
function gradingCategoriesMarkup(team) {
  return Object.entries(team.categories).map(([key, category]) => `<div class="gradingCategory"><div><b>${safeInsightText(DraftGradingEngineV1.CATEGORY_LABELS[key])}</b><span>${safeInsightText(category.grade)} · ${safeInsightText(category.score)}</span></div><p>${safeInsightText(category.explanation)}</p></div>`).join('');
}
function renderDraftReport() {
  const report = evaluateCompletedDraft(), es = [...report.teams], me = es.find(team => String(team.teamId) === String(slot));
  if (DOM.myDraftReport)
    DOM.myDraftReport.innerHTML = `<article class="card unifiedGradeHero"><div class="gradeSummary"><div><div class="meta">YOUR DRAFT GRADE</div><div class="reportGrade">${safeInsightText(me.grade)}</div><b>${safeInsightText(me.overallScore)}/100 · ${safeInsightText(me.draftPercentileLabel)} percentile</b></div><div class="gradeEstimate"><span><small>CHAMPIONSHIP ODDS</small><b>${safeInsightText(me.championshipOdds)}%</b></span><span><small>PROJECTED FINISH</small><b>${safeInsightText(me.projectedFinishRange)}</b></span><span><small>DRAFT-ROOM RANK</small><b>${safeInsightText(me.rank)} of ${safeInsightText(es.length)}</b></span></div></div><p class="estimateDisclaimer">${safeInsightText(me.estimateLabel)}</p><div class="gradingCategoryGrid">${gradingCategoriesMarkup(me)}</div><div class="gradingFeedbackGrid">${reportList('BIGGEST STRENGTHS', me.strengths)}${reportList('BIGGEST WEAKNESSES', me.weaknesses)}${reportList('ACTIONABLE IMPROVEMENTS', me.improvements)}</div><div class="gradeComparison"><b>Why this rank:</b> ${safeInsightText(me.comparison)}</div><details class="gradeDebug"><summary>Score breakdown</summary><pre>${safeInsightText(JSON.stringify({ categoryWeights: report.categoryWeights, categoryScores: Object.fromEntries(Object.entries(me.categories).map(([key, value]) => [key, value.score])), overallScore: me.overallScore, calibration: report.calibration }, null, 2))}</pre></details></article>`;
  if (DOM.leagueProjection)
    DOM.leagueProjection.innerHTML = `<table class="leagueTable"><thead><tr><th>Rank</th><th>Manager</th><th>Grade</th><th>Score</th><th>Championship Odds</th><th>Finish Range</th></tr></thead><tbody>${es.map(team => `<tr class="${String(team.teamId) === String(slot) ? 'youRow' : ''}"><td><span class="rankBadge">${safeInsightText(team.rank)}</span></td><td><b>${safeInsightText(team.managerName)}</b></td><td><span class="gradeBadge">${safeInsightText(team.grade)}</span></td><td>${safeInsightText(team.overallScore)}</td><td>${safeInsightText(team.championshipOdds)}%</td><td>${safeInsightText(team.projectedFinishRange)}</td></tr>`).join('')}</tbody></table><div class="estimateDisclaimer">Draft-day estimates; Championship Odds total ${safeInsightText(report.championshipOddsTotal)}%.</div>`;
  if (DOM.allTeamReports)
    DOM.allTeamReports.innerHTML = es
      .map(team => `<article class="teamReport ${String(team.teamId) === String(slot) ? 'youRow' : ''}"><div class="teamReportHead"><div><b>#${safeInsightText(team.rank)} ${safeInsightText(team.managerName)}</b><div class="meta">${safeInsightText(team.projectedFinishRange)} finish · ${safeInsightText(team.draftPercentileLabel)} percentile</div></div><div><span class="gradeBadge">${safeInsightText(team.grade)}</span> <b>${safeInsightText(team.overallScore)}</b> · ${safeInsightText(team.championshipOdds)}%</div></div><div class="compactCategoryRow">${Object.entries(team.categories).map(([key, value]) => `<span>${safeInsightText(DraftGradingEngineV1.CATEGORY_LABELS[key])} <b>${safeInsightText(value.grade)}</b></span>`).join('')}</div>${reportList('Strengths', team.strengths)}${reportList('Weaknesses', team.weaknesses)}${reportList('Next steps', team.improvements)}<p class="gradeComparison">${safeInsightText(team.comparison)}</p></article>`)
      .join('');
}
function finishDraft() {
  document.querySelector('.appgrid')?.classList.add('hidden');
  DOM.draftReport?.classList.remove('hidden');
  DOM.tabs?.classList.add('hidden');
  renderDraftReport();
  if (mode === 'yahoo') {
    currentYahooRecord = buildYahooRecord();
    saveYahooRecord(currentYahooRecord);
    DOM.yahooExportCard?.classList.remove('hidden');
    updateArchiveCount();
  } else {
    DOM.yahooExportCard?.classList.add('hidden');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  persistDraftSession('complete');
}
function yahooArchive() {
  try {
    return JSON.parse(localStorage.getItem(leagueProfileStore?.archiveKey(activeLeagueProfile?.id)||'fantasyHQYahooMocks') || '[]');
  } catch (e) {
    return [];
  }
}
function buildYahooRecord() {
  const now = new Date();
  return {
    schemaVersion: 'fantasy-hq-yahoo-mock-1',
    appVersion: APP_VERSION.label,
    id: `yahoo-${now.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now.toISOString(),
    source: 'Yahoo public mock draft against real people',
    leagueProfileId: activeLeagueProfile?.id||null,
    rankingSnapshot: window.__activeRankingSnapshot?JSON.parse(JSON.stringify(window.__activeRankingSnapshot)):null,
    injurySnapshot: {provider:window.__injurySnapshot?.provider||null,fetchedAt:window.__injurySnapshot?.fetchedAt||null,cacheState:window.__injurySnapshot?.cacheState||null},
    league: {
      id: activeLeagueProfile?.id||164770,
      name: activeLeagueProfile?.leagueName||'SQUAAA! ROYAL RUMBLE 2025–2026',
      platform: activeLeagueProfile?.platform||'Yahoo',
      teams: leagueContext.teams||10,
      draftSlot: slot,
      scoring: leagueContext.scoring,
      receptions: leagueContext.receptions,
      passingTD: leagueContext.passTD,
      completionPoint: leagueContext.completionPoint,
      startingWR: leagueContext.startWR,
      flex: leagueContext.flex,
      firstDownPoint: leagueContext.firstDownPoint,
      bigPlayBonuses: leagueContext.bigPlayBonuses,
      enhancedDST: leagueContext.enhancedDST,
      customKicker: leagueContext.customKicker,
      riskProfile: leagueContext.risk,
      strategy: leagueContext.strategy,
    },
    managers: slotManagers,
    picks: history.map(h => {
      const p = players.find(x => x.id === h.id) || {};
      return {
        overallPick: h.pick,
        round: Math.ceil(h.pick / (leagueContext.teams||10)),
        pickInRound: ((h.pick - 1) % (leagueContext.teams||10)) + 1,
        teamSlot: h.team,
        isGerard: h.team === slot,
        playerId: h.id,
        playerName: p.name || 'Unknown',
        position: p.pos || '',
        nflTeam: p.team || '',
        tier: tierLabel(p),
        mambaAtExport: mambaScore(p),
      };
    }),
    gerardDecisions: decisionSnapshots,
    gradingReport: evaluateCompletedDraft(),
    finalRoster: myPlayers().map(p => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      nflTeam: p.team,
      tier: tierLabel(p),
    })),
  };
}
function saveYahooRecord(record) {
  let a = yahooArchive();
  a.unshift(record);
  a = a.slice(0, 75);
  localStorage.setItem(leagueProfileStore?.archiveKey(activeLeagueProfile?.id)||'fantasyHQYahooMocks', JSON.stringify(a));
}
function removeYahooRecord(recordId){
  if(!recordId)return;
  const key=leagueProfileStore?.archiveKey(activeLeagueProfile?.id)||'fantasyHQYahooMocks',remaining=yahooArchive().filter(record=>record.id!==recordId);
  localStorage.setItem(key,JSON.stringify(remaining));
}
function downloadBlob(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeDateName() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
function buildDraftJSONExport(exportedAt=new Date().toISOString()){
  const session=draftSessionStore?.load(),teams=leagueContext.teams||10,playerRows=history.map(entry=>{const player=playerByCanonicalId(entry.id);return{overallPick:entry.pick,round:Math.ceil(entry.pick/teams),pickInRound:((entry.pick-1)%teams)+1,teamSlot:entry.team,isUser:entry.team===slot,canonicalPlayerId:canonicalPlayerId(entry.id),playerName:player?.name||'Unknown player',position:player?positionKey(player):'',nflTeam:player?.team||''}}),excludedIds=[...excludedRecommendationIds];
  return DraftWorkflowV1.buildExport({exportedAt,appVersion:APP_VERSION.label,sessionId:session?.sessionId,draftMode:mode==='live'?'live':'mock',sourceMode:mode,startedAt:session?.createdAt,completedAt:session?.status==='complete'?session.updatedAt:null,sessionUpdatedAt:session?.updatedAt,currentPick:pick,currentRound:info().r,expectedTotalPicks:TOTAL_PICKS,league:{profileId:activeLeagueProfile?.id||null,profileName:activeLeagueProfile?.displayName||null,leagueName:activeLeagueProfile?.leagueName||null,teamCount:teams,userDraftSlot:slot,scoringFormat:leagueContext.scoring,passingTouchdownPoints:leagueContext.passTD,managers:{...slotManagers},rosterConfiguration:{slots:[...rosterSlots],startQB:leagueContext.startQB,startRB:leagueContext.startRB,startWR:leagueContext.startWR,startTE:leagueContext.startTE,flex:leagueContext.flex,startK:leagueContext.startK,startDST:leagueContext.startDST,bench:leagueContext.bench,irSlots:leagueContext.irSlots},settings:{...leagueContext}},rankings:window.__activeRankingSnapshot?JSON.parse(JSON.stringify(window.__activeRankingSnapshot)):session?.rankingSnapshot||null,injuries:{provider:window.__injurySnapshot?.provider||session?.injurySnapshot?.provider||null,fetchedAt:window.__injurySnapshot?.fetchedAt||session?.injurySnapshot?.fetchedAt||null,cacheState:window.__injurySnapshot?.cacheState||session?.injurySnapshot?.cacheState||null},history:playerRows,userRoster:myPlayers().map(player=>({canonicalPlayerId:canonicalPlayerId(player.id),playerName:player.name,position:positionKey(player),nflTeam:player.team||''})),excludedPlayerIds:excludedIds,excludedPlayers:excludedIds.map(id=>{const player=playerByCanonicalId(id);return{canonicalPlayerId:id,playerName:player?.name||null}}),exclusionEvents,recommendationHistory:decisionSnapshots});
}
function exportDraftJSON(){
  if(!history.length&&DOM.appScreen?.classList.contains('hidden')){alert('Start or resume a draft before exporting.');return false}
  const exportedAt=new Date().toISOString(),record=buildDraftJSONExport(exportedAt),filename=DraftWorkflowV1.filename({leagueName:activeLeagueProfile?.displayName||activeLeagueProfile?.leagueName,draftMode:record.draft.draftMode,status:record.draft.status,date:exportedAt});downloadBlob(filename,JSON.stringify(record,null,2),'application/json');return true;
}
function exportCurrentYahooJSON() {
  if (!currentYahooRecord) {
    alert('Finish a Yahoo Live Mock first.');
    return;
  }
  downloadBlob(
    `FantasyHQ_YahooMock_${safeDateName()}.json`,
    JSON.stringify(currentYahooRecord, null, 2),
    'application/json'
  );
}
function exportAllYahooJSON() {
  const a = yahooArchive();
  if (!a.length) {
    alert('No saved Yahoo mocks yet.');
    return;
  }
  downloadBlob(
    `FantasyHQ_All_Yahoo_Mocks_${safeDateName()}.json`,
    JSON.stringify(
      {
        schemaVersion: 'fantasy-hq-yahoo-archive-1',
        exportedAt: new Date().toISOString(),
        mockCount: a.length,
        mocks: a,
      },
      null,
      2
    ),
    'application/json'
  );
}
function csvEscape(v) {
  const x = String(v ?? '');
  return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
}
function exportCurrentYahooCSV() {
  if (!currentYahooRecord) {
    alert('Finish a Yahoo Live Mock first.');
    return;
  }
  const headers = [
    'overallPick',
    'round',
    'pickInRound',
    'teamSlot',
    'isGerard',
    'playerName',
    'position',
    'nflTeam',
    'tier',
  ];
  const rows = [
    headers.join(','),
    ...currentYahooRecord.picks.map(p => headers.map(h => csvEscape(p[h])).join(',')),
  ];
  downloadBlob(`FantasyHQ_YahooMock_Picks_${safeDateName()}.csv`, rows.join('\n'), 'text/csv');
}
function updateArchiveCount() {
  const a = yahooArchive();
  if (DOM.archiveCount)
    DOM.archiveCount.textContent = `Saved locally in this browser: ${a.length} Yahoo mock${a.length === 1 ? '' : 's'}. Use “Download All Yahoo Mocks” before clearing browser data or switching devices.`;
}

function startAnotherMock() {
  DOM.draftReport?.classList.add('hidden');
  document.querySelector('.appgrid')?.classList.remove('hidden');
  backToSetup();
}

function managerPositionCounts(team) {
  if (window.SharinganVisionV1?.rosterPositionCounts)
    return SharinganVisionV1.rosterPositionCounts({ history, players, team });
  let c = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  managerRoster(team).forEach(p => {
    let k = p.pos === 'DEF' ? 'DST' : p.pos;
    if (c[k] !== undefined) c[k]++;
  });
  return c;
}
function positionStarterNeed(pos, c) {
  return ['QB', 'RB', 'WR', 'TE'].includes(pos) && (c[pos] || 0) < configuredStarterTarget(pos);
}
function managerPositionStatus(team, pos) {
  let c = managerPositionCounts(team),
    count = c[pos] || 0,
    m = getManager(team);
  let starterNeed = positionStarterNeed(pos, c);
  let depthTarget = pos === 'RB' ? 4 : pos === 'WR' ? 5 : pos === 'QB' ? 1 : pos === 'TE' ? 1 : 1;
  let hoard =
    (pos === 'QB' && count >= 2) ||
    (pos === 'RB' && count >= 5) ||
    (pos === 'WR' && count >= 6) ||
    (pos === 'TE' && count >= 3);
  if (hoard) return { cls: 'hoard', label: count + ' ⚠', need: true };
  if (starterNeed) return { cls: 'pressure', label: count, need: true };
  if (count < depthTarget) return { cls: 'open', label: count, need: true };
  return { cls: 'filled', label: count, need: false };
}
function recentPositionCount(pos, n = 8) {
  return history
    .slice(-n)
    .map(h => players.find(p => p.id === h.id))
    .filter(Boolean)
    .filter(p => (p.pos === 'DEF' ? 'DST' : p.pos) === pos).length;
}
function teamsBeforeMyNextPick() {
  let teams = [],
    n = pick;
  while (n <= 170) {
    let t = teamForPick(n);
    if (t === slot && n !== pick) break;
    if (t !== slot && !teams.includes(t)) teams.push(t);
    n++;
  }
  return teams;
}
function marketPressure(pos) {
  let cacheKey = `${intelligenceEpoch}:${pos}`;
  if (marketCache.has(cacheKey)) return marketCache.get(cacheKey);
  let before = teamsBeforeMyNextPick(),
    starterNeed = 0,
    depthNeed = 0,
    hoardRisk = 0;
  before.forEach(t => {
    let c = managerPositionCounts(t),
      s = managerPositionStatus(t, pos),
      m = getManager(t);
    if (positionStarterNeed(pos, c)) starterNeed++;
    else if (s.need) depthNeed++;
    if (pos === 'QB' && m.qbHoard >= 7) hoardRisk += 1;
  });
  let recent = recentPositionCount(pos, 8);
  let positionPool = available().filter(p => (p.pos === 'DEF' ? 'DST' : p.pos) === pos), avail = positionPool.length;
  const eliteDepth=positionPool.filter(player=>['S','A'].includes(PlayerTierContract.getPositionTier(player))).length,tierCliff=eliteDepth<=2,runContribution=recent>=3&&tierCliff?recent*6:Math.min(3,recent);
  let pressure = starterNeed * 4 + depthNeed * 2 + runContribution + hoardRisk * 5;
  if (avail < 8) pressure += 12;
  if (avail < 4) pressure += 18;
  pressure = Math.max(0, Math.min(100, Math.round(pressure)));
  let level =
    pressure >= 82
      ? 'Critical'
      : pressure >= 65
        ? 'Hot'
        : pressure >= 45
          ? 'Rising'
          : pressure >= 22
            ? 'Calm'
            : 'Cold';
  let result = {
    pos,
    pressure,
    level,
    starterNeed,
    depthNeed,
    recent,
    eliteDepth,
    tierCliff,
    runQualified: recent>=3&&tierCliff,
    runContribution,
    teams: before.length,
    avail,
  };
  marketCache.set(cacheKey, result);
  return result;
}
function marketBoxMarkup(x) {
  const levelClass = String(x.level || 'cold').toLowerCase();
  const windowLabel = positionWindow(x);
  return `<div class="marketBox ${levelClass}"><div class="marketPos">${x.pos}</div><div class="marketLevel">${windowLabel}</div><div class="marketMeta">${x.recent} in last 8 • ${x.starterNeed} need starter</div></div>`;
}
function highestRoomPressure() {
  let positions = ['RB', 'WR', 'QB', 'TE'].filter(pos => !userPositionFilled(pos));
  return (
    positions.map(marketPressure).sort((a, b) => b.pressure - a.pressure)[0] || marketPressure('RB')
  );
}
function roomAlertText() {
  let top = highestRoomPressure();
  if (top.pressure < 65) return '';
  let demand = top.starterNeed
    ? `${top.starterNeed} upcoming teams still need a starter.`
    : `No intervening team has an unfilled starter slot. ${top.depthNeed} may still draft depth.`;
  return `<div class="roomAlert"><b>${top.pos} Position Window: ${positionWindow(top)}</b><div class="meta">${top.recent} drafted in the last 8 picks • ${demand}</div></div>`;
}
function positionWindow(x) {
  if (x.starterNeed === 0) return x.depthNeed > 0 || x.recent >= 2 ? 'Depth Demand' : 'Still Open';
  return x.pressure >= 82
    ? 'Closing Fast'
    : x.pressure >= 65
      ? 'Starting to Thin'
      : x.pressure >= 45
        ? 'Watch Closely'
        : 'Still Open';
}
function roomInsightText() {
  let vals = ['RB', 'WR', 'QB', 'TE']
      .filter(p => !userPositionFilled(p))
      .map(marketPressure)
      .sort((a, b) => b.pressure - a.pressure),
    top = vals[0];
  if (!top) return 'Starting positions filled. Best value wins.';
  if (top.recent >= 4 && top.starterNeed === 0)
    return `${top.pos} run detected, but immediate starter pressure is limited; depth demand may continue.`;
  if (top.pressure >= 82) return `Take ${top.pos} now if value is close.`;
  if (top.pressure >= 65) return `${top.pos} is thinning. Do not wait too long.`;
  return `No urgent run. Best value wins.`;
}
function managerTendency(team) {
  let c = managerPositionCounts(team),
    m = getManager(team);
  if (window.SharinganVisionV1?.rosterConstruction)
    return SharinganVisionV1.rosterConstruction(c, leagueContext).liveRead;
  if (c.QB >= 2) return 'QB hoarding';
  if (c.RB >= 5) return 'RB heavy';
  if (c.WR >= 6) return 'WR heavy';
  if (c.TE >= 3) return 'TE hoarding';
  let filled = ['QB', 'RB', 'WR', 'TE'].filter(pos => c[pos] >= configuredStarterTarget(pos)).length;
  if (filled >= 4) return 'Balanced';
  if (c.RB > c.WR + 1) return 'RB leaning';
  if (c.WR > c.RB + 1) return 'WR leaning';
  return m.archetype;
}
function managerTableMarkup(clickable = true) {
  let rows = [];
  for (let t = 1; t <= (leagueContext.teams||10); t++) {
    let cells = ['QB', 'RB', 'WR', 'TE']
      .map(pos => {
        let s = managerPositionStatus(t, pos);
        return `<td data-position="${pos}" class="needCell ${s.cls}">${s.label}</td>`;
      })
      .join('');
    let name = t === slot ? 'Gerard' : slotManagers[t] || 'Team ' + t;
    rows.push(
      `<tr ${clickable ? `onclick="showManagerRoster(${t})" style="cursor:pointer"` : ''} class="${t === slot ? 'youRow' : ''}"><td><b>${name}</b></td>${cells}<td><span class="tendencyPill">${managerTendency(t)}</span></td></tr>`
    );
  }
  return `<table class="managerTable"><thead><tr><th>Manager</th><th>QB</th><th>RB</th><th>WR</th><th>TE</th><th>Live read</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function renderManagerTables() {
  let desktop = document.getElementById('desktopManagerTable'),
    sheet = document.getElementById('sheetManagerTable');
  if (desktop) desktop.innerHTML = managerTableMarkup(false);
  if (sheet) sheet.innerHTML = managerTableMarkup(true);
}
function showManagerRoster(team) {
  let ps = managerRoster(team),
    name = team === slot ? 'Gerard' : slotManagers[team] || 'Team ' + team,
    c = managerPositionCounts(team);
  if (!DOM.managerRosterDetail) return;
  DOM.managerRosterDetail.innerHTML = `<div class="teamReport" style="margin-top:12px"><div class="teamReportHead"><div><b>${name}</b><div class="meta">${managerTendency(team)} • QB ${c.QB} • RB ${c.RB} • WR ${c.WR} • TE ${c.TE}</div></div><button class="ghost" onclick="hideManagerRoster()">Hide</button></div><div class="managerDetail">${ps.length ? ps.map(p => `<div class="managerPlayer"><b>${p.name}</b><div class="meta">${p.pos === 'DST' ? 'D/ST' : p.pos} • ${p.team}</div></div>`).join('') : `<div class="meta">No players drafted yet.</div>`}</div></div>`;
  DOM.managerRosterDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideManagerRoster() {
  if (DOM.managerRosterDetail) DOM.managerRosterDetail.innerHTML = '';
}
function expectedDraftedBeforeNext(pos) {
  let x = marketPressure(pos),
    picks = teamsBeforeMyNextPick().length;
  if (!picks) return 0;
  let est = Math.round((x.pressure / 100) * Math.max(1, picks * 0.75));
  return Math.max(0, Math.min(picks, est));
}
function availableTierCounts(pos) {
  let c = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  available()
    .filter(p => positionKey(p) === pos)
    .forEach(p => {
      let t = tierLabel(p);
      c[t] = (c[t] || 0) + 1;
    });
  return c;
}
function projectedTierRemaining(pos) {
  let pool = available()
      .filter(p => positionKey(p) === pos)
      .sort((a, b) => finalPickScore(b) - finalPickScore(a)),
    lost = expectedDraftedBeforeNext(pos),
    remain = pool.slice(lost),
    c = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  remain.forEach(p => {
    let t = tierLabel(p);
    c[t] = (c[t] || 0) + 1;
  });
  return c;
}
function tierCountText(c) {
  return (
    ['S', 'A', 'B', 'C']
      .filter(t => (c[t] || 0) > 0)
      .map(t => `${t}: ${c[t]}`)
      .join(' • ') || 'No S–C players'
  );
}
function roomIntelMarkup() {
  return ['RB', 'WR', 'QB', 'TE']
    .filter(pos => !userPositionFilled(pos))
    .map(pos => {
      let x = marketPressure(pos),
        run = x.recent >= 4 ? 'Run is happening' : x.recent >= 2 ? 'Some movement' : 'No run';
      return `<div class="intelItem"><b>${pos} — ${run}</b><span>${x.recent} drafted in the last 8 picks. ${x.starterNeed} teams before your next pick still need a starter.</span></div>`;
    })
    .join('');
}
function peekAheadMarkup() {
  return ['RB', 'WR', 'QB', 'TE']
    .filter(pos => !userPositionFilled(pos))
    .map(pos => {
      let n = expectedDraftedBeforeNext(pos),
        now = availableTierCounts(pos),
        later = projectedTierRemaining(pos);
      return `<div class="peekItem"><b>${pos}: ${n} expected before your next pick</b><span>Available now — ${tierCountText(now)}</span><span>Projected then — ${tierCountText(later)}</span></div>`;
    })
    .join('');
}

function renderRoomScan() {
  let grid = `<div><b>Peek Ahead</b><div class="peekList">${peekAheadMarkup()}</div></div>`,
    table = managerTableMarkup(true);
  ['mobileMarketGrid', 'desktopMarketGrid', 'sheetMarketGrid'].forEach(id => {
    let e = document.getElementById(id);
    if (e) e.innerHTML = grid;
  });
  if (DOM.desktopManagerTable) DOM.desktopManagerTable.innerHTML = managerTableMarkup(false);
  if (DOM.sheetManagerTable) DOM.sheetManagerTable.innerHTML = table;
}

function openRoomScan() {
  renderRoomScan();
  let sheet = document.getElementById('roomScanSheet');
  if (sheet) sheet.classList.remove('hidden');
}
function closeRoomScan(e) {
  let sheet = document.getElementById('roomScanSheet');
  if (!sheet) return;
  if (e && e.target !== sheet) return;
  sheet.classList.add('hidden');
  let detail = document.getElementById('managerRosterDetail');
  if (detail) detail.innerHTML = '';
}

function currentPickOwner() {
  return teamForPick(pick);
}
function currentPickLabel() {
  let i = info(),
    team = currentPickOwner(),
    name = team === slot ? 'YOU' : slotManagers[team] || 'Team ' + team;
  return { team, name, label: `${i.r}.${String(i.ip).padStart(2, '0')}` };
}
function positionKey(p) {
  return RosterCompletionConstraintV1.normalizePosition(p?.pos ?? p?.position);
}
function publicPickScore(p) {
  const owner = currentPickOwner(),
    c = managerPositionCounts(owner),
    rd = info().r,
    adp = p.overall || 999;
  let score = 180 - Math.abs(adp - pick) * 1.25 - adp * 0.08;
  const pos = positionKey(p);
  if (positionStarterNeed(pos, c)) score += 18;
  if (pos === 'RB' && c.RB < 3) score += 5;
  if (pos === 'WR' && c.WR < 4) score += 5;
  if (pos === 'QB' && rd < 4) score -= 18;
  if (pos === 'TE' && rd < 3) score -= 10;
  if (pos === 'DST' && rd < 14) score -= 90;
  if (pos === 'K' && rd < 15) score -= 100;
  return score;
}
function likelyNextPicks() {
  return available()
    .slice()
    .sort(
      (a, b) => publicPickScore(b) - publicPickScore(a) || (a.overall || 999) - (b.overall || 999)
    )
    .slice(0, 16);
}
function quickPickMarkup(p) {
  let decisionTier = PlayerTierContract.getDecisionTier(p);
  return `<button class="quickPick" onclick="recordCurrentPick(${p.id})"><div><div class="qname">${p.name}</div><div class="qmeta">${positionKey(p)} • ${p.team} • <span aria-label="Decision Tier ${decisionTier}">D:${decisionTier}</span> • Rank ${p.overall || '—'}</div></div><span>＋</span></button>`;
}
function clockStripMarkup() {
  let x = currentPickLabel();
  return `<div class="clockStrip"><div><div class="meta">ON THE CLOCK • PICK ${x.label}</div><b>${x.name}</b></div><span class="pill">${x.team === slot ? 'MY PICK' : 'OTHER PICK'}</span></div>`;
}
function recentPicksMarkup() {
  let rows = history.slice(-10).reverse();
  if (!rows.length) return `<div class="meta">No picks recorded yet.</div>`;
  return rows
    .map(h => {
      let p = players.find(x => x.id === h.id),
        nm = h.team === slot ? 'YOU' : slotManagers[h.team] || 'Team ' + h.team;
      const teams=leagueContext.teams||10;return `<div class="recentPick"><span class="meta">${h.pick}</span><div><b>${p?.name || 'Unknown'}</b><div class="meta">${positionKey(p || { pos: '' })} • ${nm}</div></div><span class="meta">${Math.ceil(h.pick / teams)}.${String(((h.pick - 1) % teams) + 1).padStart(2, '0')}</span></div>`;
    })
    .join('');
}
function renderQuickDraftBoard() {
  const q = likelyNextPicks().map(quickPickMarkup).join(''),
    clock = clockStripMarkup(),
    recent = recentPicksMarkup();
  ['mobileQuickPicks', 'desktopQuickPicks'].forEach(id => {
    let e = el(id);
    if (e) e.innerHTML = q;
  });
  ['mobileClockStrip', 'desktopClockStrip', 'mobilePlayersClock'].forEach(id => {
    let e = el(id);
    if (e) e.innerHTML = clock;
  });
  let boardClock = el('desktopBoardClock');
  if (boardClock) {
    let x = currentPickLabel();
    boardClock.textContent = `${x.name} • Pick ${x.label}`;
  }
  ['mobileRecentPicks', 'desktopRecentPicks'].forEach(id => {
    let e = el(id);
    if (e) e.innerHTML = recent;
  });
}
function clearDraftSearch({ refocus = true } = {}) {
  const mobile = el('search'),
    desktop = el('dSearch'),
    active = document.activeElement;
  if (mobile) mobile.value = '';
  if (desktop) desktop.value = '';
  if (refocus) {
    const target =
      active === mobile
        ? mobile
        : active === desktop
          ? desktop
          : window.matchMedia('(min-width: 900px)').matches
            ? desktop
            : mobile;
    requestAnimationFrame(() => {
      if (target && target.offsetParent !== null) {
        target.focus();
        target.select();
      }
    });
  }
}
function recordCurrentPick(id) {
  const recorded = selectPlayer(id, currentPickOwner());
  if (recorded) {
    clearDraftSearch({ refocus: true });
    renderPlayers();
  }
  return recorded;
}
function undoLastPick() {
  if (!history.length) return false;
  const wasComplete=pick>TOTAL_PICKS||!DOM.draftReport?.classList.contains('hidden');
  if(wasComplete&&currentYahooRecord?.id)removeYahooRecord(currentYahooRecord.id);
  const last = history.pop();
  drafted = drafted.filter(id => canonicalPlayerId(id) !== canonicalPlayerId(last.id));
  pick = Math.max(1, last.pick);
  currentYahooRecord=null;
  selectedCandidateId = null;
  invalidateIntelligence();
  if(wasComplete){DOM.draftReport?.classList.add('hidden');document.querySelector('.appgrid')?.classList.remove('hidden');DOM.tabs?.classList.remove('hidden');DOM.yahooExportCard?.classList.add('hidden')}
  renderAll();
  return true;
}
function syncSearch(source) {
  const mobileSearch = el('search');
  const desktopSearch = el('dSearch');
  const browseSearch = el('browseSearch');

  const sourceInput =
    source === 'desktop' ? desktopSearch : source === 'browse' ? browseSearch : mobileSearch;

  const value = sourceInput?.value || '';

  // Always update the one authoritative browser-search value.
  playerBrowserQuery = value;

  // Keep every visible search box synchronized.
  [mobileSearch, desktopSearch, browseSearch].forEach(input => {
    if (input && input !== sourceInput) {
      input.value = value;
    }
  });

  renderPlayers();
}
function handleSearchKey(event) {
  if (!event) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    clearDraftSearch({ refocus: true });
    playerBrowserQuery = '';
    renderPlayers();
    return;
  }
  if (event.key !== 'Enter') return;
  const first = available()
    .filter(player => (posFilter === 'ALL' || positionKey(player) === posFilter) && playerMatchesQuery(player, playerBrowserQuery))
    .sort(posFilter === 'ALL' ? compareOverallBoard : comparePositionBoard)[0];
  if (first) {
    event.preventDefault();
    selectCandidate(first.id);
  }
}
function setPos(pos) {
  posFilter = pos;

  playerBrowserQuery = '';

  const mobileSearch = el('search');
  const desktopSearch = el('dSearch');
  const browseSearch = el('browseSearch');

  if (mobileSearch) mobileSearch.value = '';
  if (desktopSearch) desktopSearch.value = '';
  if (browseSearch) browseSearch.value = '';

  document.querySelectorAll('[data-pos]').forEach(button => {
    button.classList.toggle('filterActive', button.dataset.pos === pos);
  });

  renderPlayers();
}

function bestAvailableRank(player) {
  const ranks = [
    player.overall,
    player.bdgeRank,
    player.flockRank,
    player.sleeperAdp,
    player.yahooAdp,
    player.consensusAdp,
  ]
    .map(rank => Number(rank))
    .filter(rank => Number.isFinite(rank) && rank > 0);

  return ranks.length ? Math.min(...ranks) : 9999;
}
function overallSourceRank(player) {
  const rank=Number(player?.fantasylandOverallRank);
  return Number.isFinite(rank)&&rank>0?rank:null;
}
function deterministicPlayerFallback(a,b) {
  return String(a?.name||'').localeCompare(String(b?.name||''))||String(a?.id??'').localeCompare(String(b?.id??''),undefined,{numeric:true});
}
function compareOverallBoard(a,b) {
  const aRank=overallSourceRank(a),bRank=overallSourceRank(b);
  if(aRank!==null||bRank!==null){if(aRank===null)return 1;if(bRank===null)return-1;if(aRank!==bRank)return aRank-bRank}
  return deterministicPlayerFallback(a,b);
}
function comparePositionBoard(a,b) {
  return bestAvailableRank(a)-bestAvailableRank(b)||deterministicPlayerFallback(a,b);
}

function renderPlayers() {
  const selectedPosition = posFilter || 'ALL';
  const query = playerBrowserQuery || '';

  let pool = available()
    .filter(player => {
      return selectedPosition === 'ALL' || positionKey(player) === selectedPosition;
    })
    .filter(player => playerMatchesQuery(player, query))
    .sort(selectedPosition === 'ALL' ? compareOverallBoard : comparePositionBoard);

  if (selectedPosition === 'ALL' && !query) {
    pool = pool.slice(0, 55);
  } else if (selectedPosition === 'ALL' && query) {
    pool = pool.slice(0, 100);
  }

  const owner = currentPickOwner();
  const ownerLabel = owner === slot ? 'Draft for Me' : 'Record Pick';

  const html =
    pool
      .map(player => {
        const decisionTier = PlayerTierContract.getDecisionTier(player);

        const displayedRank = selectedPosition === 'ALL' ? overallSourceRank(player) : (Number(player.posRank)>0?Number(player.posRank):bestAvailableRank(player));
        const rankLabel = displayedRank == null || displayedRank === 9999 ? '—' : `#${displayedRank}`;

        return `
          <div class="playerRow fast" data-player-id="${player.id}">
            <div class="meta">${rankLabel}</div>

            <button type="button" class="searchResultPlayer" onclick="selectCandidate(${player.id})">
              ${playerPhotoMarkup(player,'searchResultPhoto',true)}
              <span class="searchResultIdentity">
              <b
                class="scanLink"
              >
                ${safeInsightText(player.name)}
              </b>

              <div class="meta">
                ${positionKey(player)}
                • ${safeInsightText(player.team||'—')}
                • Decision Tier ${decisionTier}
                ${injuryBadgeMarkup(player)}
              </div>
              </span>
            </button>

            ${isRecommendationExcluded(player.id)?`<button type="button" class="excludedSearchBadge" onclick="restoreRecommendationPlayer('${safeInsightText(player.id)}')">Excluded · Restore</button>`:''}

            <button
              class="autoPickBtn"
              onclick="recordCurrentPick(${player.id})"
            >
              ${ownerLabel}
            </button>
          </div>
        `;
      })
      .join('') ||
    `
      <div class="meta" style="padding:12px">
        No available players match.
      </div>
    `;

  ['playersList', 'dPlayersList'].forEach(id => {
    const list = el(id);

    if (list) {
      list.innerHTML = html;
    }
  });
}

function renderAll() {
  if (renderInProgress) return;
  renderInProgress = true;
  try {
    renderMeta();
    renderRecommendation();
    renderBoard();
    renderRoster();
    renderLiveRoster();
    renderExposure();
    renderRoomScan();
    renderWaitMeter();
    renderQuickDraftBoard();
    renderPlayers();
    renderDraftPlan();
    renderManagerTables();
    renderDraftTimeline();
    dirtyViews.players = dirtyViews.room = dirtyViews.wait = dirtyViews.team = false;
  } catch (err) {
    reportRuntimeError('Rendering draft room', err);
    throw err;
  } finally {
    renderInProgress = false;
  }
}
function showPage(id) {
  activeMobilePage = id;
  document.querySelectorAll('.mobilePage').forEach(x => x.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  requestAnimationFrame(() => {
    try {
      if (id === 'mobilePlayers' && dirtyViews.players) {
        renderPlayers();
        dirtyViews.players = false;
      } else if (id === 'mobileTeam' && dirtyViews.team) {
        renderRoster();
        renderLiveRoster();
        renderExposure();
        dirtyViews.team = false;
      } else if (id === 'mobileDraft') {
        renderMeta();
        renderRecommendation();
        if (dirtyViews.wait) {
          renderWaitMeter();
          dirtyViews.wait = false;
        }
      }
    } catch (err) {
      reportRuntimeError('Opening mobile tab', err);
    }
  });
}

// Jōnin 2.9 — canonical league-state and sync-ready foundation.
function fantasyHQPlayerIndex() {
  return new Map(
    players.flatMap(p => [
      [Number(p.id), p],
      [String(p.id), p],
    ])
  );
}
function updateSyncFoundationUI() {
  if (!window.FantasyHQCore) return;
  const state = FantasyHQCore.getState(),
    badge = el('syncStatusBadge'),
    text = el('syncStatusText');
  if (badge) {
    badge.textContent = (state.sync?.status || 'local').toUpperCase();
    badge.title = `Schema v${state.schemaVersion}`;
  }
  if (text) {
    const stamp = state.sync?.lastSyncedAt
      ? new Date(state.sync.lastSyncedAt).toLocaleString()
      : 'Not connected';
    text.textContent = `${state.name} • ${state.provider.toUpperCase()} • ${stamp} • ${state.sync?.message || 'Ready'}`;
  }
  if(typeof renderYahooSeasonState==='function')renderYahooSeasonState();
}
function downloadLeagueSnapshot() {
  const blob = new Blob([FantasyHQCore.exportSnapshot()], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'fantasy-hq-league-snapshot.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importLeagueSnapshot(event) {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    FantasyHQCore.importSnapshot(await file.text());
    updateSyncFoundationUI();
    alert('League snapshot imported. Fantasy HQ is now using the updated canonical league state.');
  } catch (err) {
    alert('Snapshot import failed: ' + err.message);
  } finally {
    event.target.value = '';
  }
}
let yahooSyncController=null,yahooDiscoveredLeagues=[],seasonDemoSnapshot=null,seasonEvidenceFixture=null,seasonEvidenceStore=null,seasonPage='home',seasonWeekOverride=null,seasonSelectedPlayer=null;
const seasonDemoEnabled=()=>new URLSearchParams(location.search).get('seasonDemo')==='1';
const seasonEl=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null)node.textContent=String(text);return node};
const seasonButton=(label,onClick,className='')=>{const button=seasonEl('button',className,label);button.type='button';button.addEventListener('click',onClick);return button};
function currentYahooSeasonState(){try{return activeLeagueProfile?getYahooSyncController().read(activeLeagueProfile.id):null}catch(_){return null}}
async function loadSeasonDemo(){if(seasonDemoSnapshot)return seasonDemoSnapshot;const response=await fetch('tests/fixtures/yahoo/season_command_center_demo.json',{cache:'no-store'});if(!response.ok)throw new Error('Season demo fixture is unavailable.');seasonDemoSnapshot=await response.json();return seasonDemoSnapshot}
async function ensureSeasonEvidenceStore(){if(seasonEvidenceStore||!window.FantasyHQSeasonEvidenceV1)return seasonEvidenceStore;if(!seasonDemoEnabled()){seasonEvidenceStore=new FantasyHQSeasonEvidenceV1.SeasonEvidenceStore();return seasonEvidenceStore}const response=await fetch('tests/fixtures/season_evidence_4_4_5.json',{cache:'no-store'});if(!response.ok)throw new Error('Season evidence fixture is unavailable.');seasonEvidenceFixture=await response.json();seasonEvidenceStore=new FantasyHQSeasonEvidenceV1.SeasonEvidenceStore({asOf:seasonEvidenceFixture.asOf});seasonEvidenceStore.importPayload(seasonEvidenceFixture,{players:seasonEvidenceFixture.canonicalPlayers,aliases:seasonEvidenceFixture.aliases});return seasonEvidenceStore}
async function seasonStateForActiveProfile(){await ensureSeasonEvidenceStore();const live=currentYahooSeasonState(),demo=seasonDemoEnabled()?await loadSeasonDemo():null;return SeasonCommandCenterV1.resolveSeasonState({live,demo,entries:discoverRecoverableCompletedDrafts(),profile:activeLeagueProfile,canonicalPlayers:players})}
function seasonSourceDiagnosticText(diagnostic={}){const base=`Season source: ${diagnostic.seasonSource||'EMPTY'}`;if(!diagnostic.archiveDiscovered)return base;return `${base} • Profile: ${diagnostic.activeProfileId||'none'} • Archive discovered: true • Session: ${diagnostic.archiveSessionId||'none'} • Status: ${diagnostic.archiveCompletionStatus||'unknown'} • Picks: ${diagnostic.archivePickCount||0}${diagnostic.bootstrapError?` • Bootstrap error: ${diagnostic.bootstrapError}`:''}`}
function seasonDevelopmentDiagnosticsEnabled(){return ['127.0.0.1','localhost'].includes(location.hostname)}
function seasonScoringLabel(value){const text=String(value||'').toLowerCase();if(text.includes('full'))return'Full PPR';if(text.includes('half'))return'Half PPR';if(text.includes('standard'))return'Standard';return'Format unavailable'}
function seasonSyncLabel(model){if(model.demo)return'DEMO DATA • Sanitized fixture';if(model.draftSnapshot)return'Draft Snapshot • STALE • Non-live';if(model.stale)return`Yahoo • STALE${model.lastSyncMinutes!==null?` • ${model.lastSyncMinutes} min ago`:''}`;if(model.status==='PARTIAL')return`Yahoo • PARTIAL${model.lastSyncMinutes!==null?` • ${model.lastSyncMinutes} min ago`:''}`;if(model.lastSyncMinutes!==null)return`Yahoo • Synced ${model.lastSyncMinutes} min ago`;return'Yahoo • Not synced'}
function seasonFormatRecord(standing){if(!standing)return'Not provided';return`${standing.wins??0}-${standing.losses??0}${standing.ties?`-${standing.ties}`:''}`}
function renderSeasonProfileOptions(){const select=el('seasonProfileSelect');if(!select||!leagueProfileStore)return;select.innerHTML='';leagueProfileStore.list().forEach(profile=>{const option=document.createElement('option');option.value=profile.id;option.textContent=profile.displayName;select.appendChild(option)});select.value=activeLeagueProfile?.id||''}
function renderSeasonNavigation(){const nav=el('seasonNavigation');if(!nav)return;nav.innerHTML='';const labels={home:'⌂ Season Home',team:'♙ My Team',waivers:'♧ Waiver Wire',startsit:'⚡ Start/Sit',matchup:'▦ Matchup',radar:'◉ League Radar',trades:'⇄ Trades',history:'◷ Moves & History',players:'♧ Players',settings:'⚙ Settings'};SeasonCommandCenterV1.PAGES.forEach(page=>{const button=seasonButton(labels[page],()=>showSeasonPage(page));button.classList.toggle('active',seasonPage===page);button.setAttribute('aria-current',seasonPage===page?'page':'false');nav.appendChild(button)})}
function renderSeasonSidebar(model){const box=el('seasonLeagueSnapshot');if(!box)return;box.innerHTML='';box.append(seasonEl('b','',model.demo?'LEAGUE SNAPSHOT • DEMO':model.draftSnapshot?'SOURCE: DRAFT SNAPSHOT':'LEAGUE SNAPSHOT'));const facts=model.draftSnapshot?[['Roster basis','Draft results'],['Live moves','Unknown'],['Teams',model.teamCount||'Not provided'],['Archive','Immutable']]:[['Record',seasonFormatRecord(model.standing)],['PF / PA',model.standing?.pointsFor!=null?`${model.standing.pointsFor} / Not provided`:'Not provided'],['Standing',model.standing?.rank?`#${model.standing.rank}`:'Not provided'],['Projection','Not provided'],['Champ. Odds','Not yet scored'],['Power Ranking','Not yet scored']];facts.forEach(([label,value])=>{const row=seasonEl('div','seasonSnapshotRow');row.append(seasonEl('span','',label),seasonEl('strong','',value));box.appendChild(row)})}
function seasonSectionHeader(title,action){const head=seasonEl('div','seasonSectionHeader');head.appendChild(seasonEl('h2','',title));if(action)head.appendChild(action);return head}
function seasonEmpty(title,body){const node=seasonEl('div','seasonEmpty');node.append(seasonEl('strong','',title),seasonEl('p','',body));return node}
function seasonStatusBadge(text,tone='neutral'){return seasonEl('span',`seasonBadge ${tone}`,text)}
function seasonCanonicalPlayer(player){const canonical=playerByCanonicalId(player?.canonicalPlayerId||player?.identity?.canonicalPlayerId),sameName=canonical&&String(canonical.name||'').trim().toLowerCase()===String(player?.name||'').trim().toLowerCase();return sameName?canonical:player||null}
function seasonPlayerPhoto(player){const canonical=seasonCanonicalPlayer(player),wrap=seasonEl('span','seasonLineupPhoto');if(!canonical){wrap.textContent='—';return wrap}const photo=playerPhotoFor(canonical),fallback=`assets/player-placeholders/${positionKey(canonical).toLowerCase()}.svg`,image=document.createElement('img');image.src=photo.available?photo.url:fallback;image.alt='';image.loading='lazy';image.decoding='async';image.dataset.positionFallback=fallback;image.dataset.genericFallback='assets/player-placeholders/generic.svg';image.dataset.fallbackStage=String(photo.available?0:1);image.dataset.playerName=canonical.name||player.name||'Player';image.addEventListener('error',()=>handlePlayerPortraitError(image));wrap.appendChild(image);return wrap}
function seasonLineupRow(lineupRow,model,{compact=false}={}){const player=lineupRow?.player||null,row=seasonEl(player?'button':'div',`seasonLineupRow${player?'':' empty'}${compact?' compact':''}`);if(player){row.type='button';row.addEventListener('click',()=>openSeasonPlayerDetails(player,model))}row.append(seasonEl('b','seasonLineupSlot',lineupRow?.slot||lineupRow?.slotLabel||'—'),seasonPlayerPhoto(player));const identity=seasonEl('span','seasonLineupIdentity');identity.append(seasonEl('strong','',player?.name||'Open slot'),seasonEl('small','',player?`${player.position||'—'} • ${player.sourceTeam||'NFL team unavailable'}`:'No eligible player assigned'));const schedule=seasonEl('span','seasonLineupSchedule');schedule.append(seasonEl('b','',player?.opponent||player?.nextOpponent||'—'),seasonEl('small','',player?.gameTime||player?.gameStart||'—'));const hasProjection=player?.projection!==null&&player?.projection!==undefined&&String(player.projection).trim()!==''&&Number.isFinite(Number(player.projection)),projection=seasonEl('span','seasonLineupProjection',hasProjection?String(player.projection):'—'),status=seasonEl('span','seasonLineupStatus');if(player?.injuryStatus)status.appendChild(seasonStatusBadge(player.injuryStatus,'orange'));else status.appendChild(seasonEl('span','seasonFutureStatus','—'));const origin=seasonEl('span','seasonRosterOrigin',player?.draftOrigin?`Drafted ${player.draftOrigin}`:'—');row.append(identity,schedule,projection,status,origin);return row}
function seasonLineupSection(card,title,rows,model,{compact=false}={}){card.appendChild(seasonEl('h3','seasonRosterGroup',title));if(rows.length)rows.forEach(row=>card.appendChild(seasonLineupRow(row,model,{compact})));else card.appendChild(seasonEl('p','seasonMuted',`No ${title.toLowerCase()} slots supplied.`))}
function seasonRosterCard(model,{full=false}={}){const card=seasonEl('section','seasonPanel seasonRosterPanel seasonFullRoster');card.append(seasonSectionHeader(full?'MY TEAM — FULL ROSTER':'MY TEAM',full?null:seasonButton('View full roster ›',()=>showSeasonPage('team'),'seasonTextButton')));if(model.userTeamResolution?.status!=='RESOLVED'){card.appendChild(seasonEmpty('User team unresolved','The stored user-team identity does not resolve to exactly one league team. Fantasy HQ will not guess Team 1.'));return card}const identity=seasonEl('div','seasonRosterIdentityBar');identity.append(seasonEl('strong','',`${model.userTeam.name||'My Team'}${model.userTeamResolution.teamSlot?` • Slot ${model.userTeamResolution.teamSlot}`:''}`),seasonStatusBadge(model.draftSnapshot?'DRAFT SNAPSHOT':'YAHOO',model.draftSnapshot?'orange':'green'));card.appendChild(identity);if(model.lineup){card.appendChild(seasonEl('p','seasonTrustNote',model.lineup.authoritative?'Current Yahoo lineup and roster slots.':`${model.lineup.label} • ${model.lineup.notice}`));seasonLineupSection(card,'STARTERS',model.lineup.starters,model);seasonLineupSection(card,'BENCH',model.lineup.bench,model);if(model.lineup.ir.length)seasonLineupSection(card,'IR',model.lineup.ir,model)}return card}
function seasonRosterSummaryCard(model){const card=seasonEl('section','seasonPanel seasonRosterPanel seasonRosterSummary');card.append(seasonSectionHeader('MY TEAM',seasonButton('View Full Roster →',()=>showSeasonPage('team'),'seasonTextButton')));if(model.userTeamResolution?.status!=='RESOLVED'){card.appendChild(seasonEmpty('User team unresolved','No roster is shown because Fantasy HQ will not guess ownership.'));return card}const heading=seasonEl('div','seasonTeamSummaryHead');heading.append(seasonEl('strong','',`${model.userTeam.name||'My Team'} • Slot ${model.userTeamResolution.teamSlot??'—'}`),seasonStatusBadge(model.draftSnapshot?'DRAFT SNAPSHOT':'YAHOO',model.draftSnapshot?'orange':'green'));card.append(heading,seasonEl('p','seasonTrustNote',model.lineup?.authoritative?'Current Yahoo lineup.':'Projected lineup from Draft Snapshot • Current Yahoo lineup unavailable until sync'));const counts={};model.roster.forEach(player=>{counts[player.position]=(counts[player.position]||0)+1});const composition=seasonEl('div','seasonComposition');['QB','RB','WR','TE','K','DST'].forEach(pos=>composition.append(seasonEl('span','',`${pos} ${counts[pos]||0}`)));card.appendChild(composition);if(model.lineup){seasonLineupSection(card,'STARTERS',model.lineup.starters,model,{compact:true});seasonLineupSection(card,'BENCH',model.lineup.bench,model,{compact:true});if(model.lineup.ir.length)seasonLineupSection(card,'IR',model.lineup.ir,model,{compact:true})}return card}
function seasonAvailableRow(player,model){const row=seasonEl('article','seasonAvailableRow');const main=seasonEl('div');main.append(seasonEl('strong','',player.name||'Unknown player'),seasonEl('small','',`${player.position||'—'} • ${player.sourceTeam||'Team unavailable'}`));row.append(main,seasonStatusBadge(player.availability,player.availability==='WAIVER'?'orange':'green'),seasonStatusBadge(player.injuryStatus||'No injury flag',player.injuryStatus?'orange':'neutral'),seasonButton('View',()=>openSeasonPlayerDetails(player,model),'seasonMiniButton'));return row}
function seasonWaiverEvaluation(model){return model.waiverIntelligence||(window.FantasyHQWaiverIntelligence?FantasyHQWaiverIntelligence.evaluate({model,profile:activeLeagueProfile}):null)}
function seasonWaiverPairForPlayer(model,player){const id=player?.identity?.canonicalPlayerId||player?.canonicalPlayerId;return(model.waiverIntelligence?.pairs||[]).find(pair=>pair.canonicalPlayerId===id)||null}
function seasonWaiverSignal(intelligence){if(intelligence?.signals?.chidori)return{label:'CHIDORI ALERT',tone:'red'};if(intelligence?.signals?.sharinganPick)return{label:'SHARINGAN WAIVER PICK',tone:'green'};if(intelligence?.signals?.sharinganWatch)return{label:'SHARINGAN WATCH',tone:'orange'};return{label:'SHARINGAN HOLD',tone:'neutral'}}
function seasonWaiverActionTone(action){return action==='ACT'?'green':action==='WAIT'?'orange':'neutral'}
function seasonWaiverEvidenceLabel(pair){const confidence=Number(pair?.confidence);return !Number.isFinite(confidence)?'Evidence Unknown':confidence>=.85?'Evidence Strong':confidence>=.7?'Evidence Building':'Evidence Limited'}
function seasonWaiverRiskLabel(pair){const risk=pair?.dimensions?.risk;return risk===null||risk===undefined?'Risk Unknown':risk<=35?'Lower Risk':risk<=60?'Moderate Risk':'Higher Risk'}
function seasonWaiverUpsideLabel(pair){const upside=pair?.dimensions?.upside;return upside===null||upside===undefined?'Upside Unknown':upside>=80?'High Upside':upside>=60?'Useful Upside':'Limited Upside'}
function seasonWaiverExplanation(pair){
  if(!pair)return'No available move has enough validated evidence to improve the roster.';
  if(pair.action==='ACT')return pair.rosterNeed==='CRITICAL'||pair.rosterNeed==='HIGH'?`${pair.player.name} addresses a meaningful ${pair.position} need and the complete add/drop move clears the action threshold.`:`${pair.player.name} combines validated role, opportunity, and value with an acceptable drop cost.`;
  if(pair.action==='WAIT')return pair.complete?'The move is interesting, but timing and net roster gain have not cleared the action threshold.':'The signal is promising, but role or opportunity evidence still needs confirmation.';
  if(!pair.drop)return`${pair.player.name} is worth monitoring, but no acceptable drop candidate clears protection.`;
  return'This add/drop pair does not materially improve the current roster.';
}
function seasonWaiverTimingCopy(pair){
  if(!pair)return'Wait for trustworthy current Yahoo roster and availability evidence.';
  if(pair.action==='ACT')return pair.player?.availability==='WAIVER'?'Submit before the current waiver window closes.':'The validated move can be made now.';
  if(!pair.drop)return'Wait until an acceptable drop becomes available.';
  if(!pair.complete)return'Wait for role, opportunity, or availability evidence to strengthen.';
  return pair.action==='WAIT'?'Monitor the next role and waiver-window update.':'No action is justified by the current evidence.';
}
function seasonWaiverFlightSummary(pair){if(!pair)return'No qualifying move currently deserves action.';if(pair.action==='ACT')return`${pair.player?.name||'The target'} is the best current opportunity, and validated roster gain supports acting now.`;if(pair.action==='WAIT')return`${pair.player?.name||'The target'} is the best current opportunity, but the action threshold has not been cleared.`;return'No available add/drop pair meaningfully improves the roster right now.'}
function seasonWaiverRosterImpact(pair){
  const position=pair?.position||pair?.player?.position||'roster',need=pair?.rosterNeed||'UNKNOWN';
  if(!pair)return{before:'Current roster context is unavailable.',move:'No move recommended.',after:'Roster remains unchanged.'};
  if(!pair.drop)return{before:`${position} need: ${need}.`,move:`Add ${pair.player?.name||'candidate'} → no acceptable drop`,after:'Protected roster assets remain unchanged.'};
  return{before:`${position} need: ${need}.`,move:`Add ${pair.player?.name||'candidate'} → Drop ${pair.drop.player?.name||'candidate'}`,after:pair.action==='ACT'?`Improves ${position} depth with a validated net roster gain.`:pair.action==='WAIT'?`Potential ${position} improvement remains under review.`:'Does not materially improve roster construction.'};
}
function seasonWaiverPrimaryPair(intelligence){return intelligence?.signals?.chidori||intelligence?.signals?.sharinganPick||intelligence?.signals?.sharinganWatch||intelligence?.pairs?.[0]||null}
function seasonWaiverRecommendationCards(intelligence){
  const primary=seasonWaiverPrimaryPair(intelligence),cards=[],used=new Set(),add=(identity,pair)=>{if(!pair||used.has(pair.canonicalPlayerId))return;used.add(pair.canonicalPlayerId);cards.push({identity,pair})};
  add(intelligence?.signals?.chidori?'CHIDORI':intelligence?.signals?.sharinganPick?'BEST MOVE':intelligence?.signals?.sharinganWatch?'SHARINGAN WATCH':'BEST CURRENT DECISION',primary);
  const remaining=(intelligence?.pairs||[]).filter(pair=>pair.eligible&&!used.has(pair.canonicalPlayerId));
  const bestFit=remaining.filter(pair=>pair.action!=='HOLD').sort((a,b)=>(b.rosterFit||0)-(a.rosterFit||0))[0];if((bestFit?.rosterFit||0)>=12.5)add('BEST FIT',bestFit);
  const upside=remaining.filter(pair=>pair.action!=='HOLD'&&!used.has(pair.canonicalPlayerId)&&(pair.dimensions?.upside??0)>=70&&pair.confidence>=.7).sort((a,b)=>(b.dimensions.upside||0)-(a.dimensions.upside||0))[0];add('HIGHEST UPSIDE',upside);
  const value=remaining.filter(pair=>pair.action!=='HOLD'&&!used.has(pair.canonicalPlayerId)&&pair.dimensions?.sourceValue!=null&&pair.dimensions?.acquisitionCost!=null&&(pair.dimensions.sourceValue-pair.dimensions.acquisitionCost)>=20).sort((a,b)=>(b.dimensions.sourceValue-b.dimensions.acquisitionCost)-(a.dimensions.sourceValue-a.dimensions.acquisitionCost))[0];add('BEST VALUE',value);
  return cards.slice(0,4);
}
function seasonWaiverDecisionCard(pair,model,{identity='BEST CURRENT DECISION',compact=false}={}){
  const player=pair?.player,impact=seasonWaiverRosterImpact(pair),card=seasonEl('article',`seasonDecisionCard ${compact?'compact':''} action-${String(pair?.action||'HOLD').toLowerCase()}${identity==='CHIDORI'?' chidori':''}`),visual=seasonEl('div','seasonDecisionVisual');
  const photo=seasonPlayerPhoto(player);photo.classList.add('seasonDecisionPhoto');visual.append(photo,seasonStatusBadge(identity,identity==='CHIDORI'?'red':identity.includes('SHARINGAN')?'orange':'blue'));
  const body=seasonEl('div','seasonDecisionBody'),head=seasonEl('div','seasonDecisionHead'),name=seasonEl('div','seasonDecisionPlayer');name.append(seasonEl('h3','',player?.name||'No qualifying player'),seasonEl('p','',player?`${player.position||'—'} • ${player.sourceTeam||'Team unavailable'}`:'Current roster remains unchanged'));head.append(name,seasonStatusBadge(pair?.action||'HOLD',seasonWaiverActionTone(pair?.action)));
  body.append(head,seasonEl('p','seasonDecisionReason',seasonWaiverExplanation(pair)));
  const transaction=seasonEl('div','seasonDecisionTransaction');transaction.append(seasonEl('span','','MOVE'),seasonEl('strong','',impact.move));body.appendChild(transaction);
  const badges=seasonEl('div','seasonDecisionBadges');[`${pair?.rosterNeed||'UNKNOWN'} Need`,seasonWaiverUpsideLabel(pair),seasonWaiverRiskLabel(pair),seasonWaiverEvidenceLabel(pair)].forEach(label=>badges.appendChild(seasonStatusBadge(label,'neutral')));body.appendChild(badges);
  body.appendChild(seasonButton(compact?'View Waiver Intelligence':'View Analysis',()=>compact?showSeasonPage('waivers'):openSeasonPlayerDetails(player,model),'seasonPrimaryButton seasonAnalysisButton'));card.append(visual,body);return card;
}
function seasonWaiverRow(pair,model){const player=pair.player,row=seasonEl('article','seasonWaiverDecisionRow'),identity=seasonEl('div','seasonWaiverIdentity');identity.append(seasonEl('strong','',player?.name||'Unknown player'),seasonEl('small','',`${player?.position||'—'} • ${player?.sourceTeam||'Team unavailable'}`));const decision=seasonEl('div','seasonWaiverDecision');decision.append(seasonStatusBadge(pair.action,seasonWaiverActionTone(pair.action)),seasonStatusBadge(pair.tier||'PASS','blue'));const fit=seasonEl('div','seasonWaiverMeta');fit.append(seasonEl('span','',seasonWaiverExplanation(pair)));row.append(identity,decision,fit,seasonButton('View Analysis',()=>openSeasonPlayerDetails(player,model),'seasonMiniButton'));return row}
function seasonWaiverCard(model,{full=false}={}){const intelligence=seasonWaiverEvaluation(model),card=seasonEl('section','seasonPanel seasonWaiverPanel seasonHomeWaiver');card.append(seasonSectionHeader('WAIVER INTELLIGENCE',full?null:seasonButton('View all ›',()=>showSeasonPage('waivers'),'seasonTextButton')));if(!intelligence||intelligence.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'){card.append(seasonStatusBadge('NO LIVE WAIVER DATA','neutral'),seasonEl('p','seasonTrustNote',intelligence?.reason||'Waiver intelligence awaiting current Yahoo roster and availability data'));return card}const primary=seasonWaiverPrimaryPair(intelligence),summary=seasonEl('article','seasonHomeDecision'),photo=seasonPlayerPhoto(primary?.player);photo.classList.add('seasonHomeDecisionPhoto');const body=seasonEl('div','seasonHomeDecisionBody'),head=seasonEl('div','seasonWaiverSignal');head.append(seasonStatusBadge(seasonWaiverSignal(intelligence).label,seasonWaiverSignal(intelligence).tone),seasonStatusBadge(primary?.action||'HOLD',seasonWaiverActionTone(primary?.action)));body.append(head,seasonEl('h3','',primary?.player?.name||'No qualifying target'),seasonEl('p','seasonHomeDecisionReason',seasonWaiverFlightSummary(primary)),seasonEl('p','seasonHomeDecisionTiming',`Timing: ${seasonWaiverTimingCopy(primary)}`),seasonButton('View Waiver Intelligence',()=>showSeasonPage('waivers'),'seasonPrimaryButton seasonAnalysisButton'));summary.append(photo,body);card.appendChild(summary);return card}
function seasonMatchupSide(row,model,side){const player=row?.player||null,cell=seasonEl('div',`seasonMatchupSide ${side}${player?'':' empty'}`);cell.append(seasonEl('b','seasonMatchupSlot',row?.slot||'—'));if(player)cell.append(seasonPlayerPhoto(player));const identity=seasonEl('span');identity.append(seasonEl('strong','',player?.name||'Unavailable'),seasonEl('small','',player?`${player.position||'—'} • ${player.sourceTeam||'—'}${player.draftOrigin?` • Drafted ${player.draftOrigin}`:''}`:'Yahoo lineup required'));cell.appendChild(identity);return cell}
function seasonMatchupCard(model,{full=false}={}){const card=seasonEl('section','seasonPanel seasonMatchupPanel seasonLineupMatchup');card.append(seasonSectionHeader(`MATCHUP — WEEK ${model.week}`,full?null:seasonButton('View details ›',()=>showSeasonPage('matchup'),'seasonTextButton')));if(model.userTeamResolution?.status!=='RESOLVED'){card.appendChild(seasonEmpty('User team unresolved','A matchup cannot be built until the user team resolves without guessing.'));return card}const versus=seasonEl('div','seasonVersus');versus.append(seasonEl('strong','',`${model.userTeam?.name||'My Team'} • Slot ${model.userTeamResolution.teamSlot??'—'}`),seasonEl('span','','VS'),seasonEl('strong','',model.opponent?.name||'Opponent unavailable'));card.append(versus,seasonEl('p','seasonTrustNote',model.draftSnapshot?'Projected Draft-Snapshot lineup • Non-live • Opponent unavailable until Yahoo sync':'Yahoo lineup assignments are authoritative'));const left=model.lineup?.starters||[],right=model.opponentLineup?.starters||[],rightBySlot=new Map();right.forEach(item=>{const key=SeasonCommandCenterV1.normalizedRosterSlot(item.slot);if(!rightBySlot.has(key))rightBySlot.set(key,[]);rightBySlot.get(key).push(item)});const rows=seasonEl('div','seasonMatchupRows');left.forEach(item=>{const key=SeasonCommandCenterV1.normalizedRosterSlot(item.slot),opponentRow=rightBySlot.get(key)?.shift()||{slot:item.slot,player:null},line=seasonEl('div','seasonMatchupRow');line.append(seasonMatchupSide(item,model,'left'),seasonEl('span','seasonMatchupVs','↔'),seasonMatchupSide(opponentRow,model,'right'));rows.appendChild(line)});card.appendChild(rows);if(full){const bench=seasonEl('div','seasonMatchupBench');bench.append(seasonEl('h3','seasonRosterGroup','BENCH VS BENCH'));const max=Math.max(model.lineup?.bench.length||0,model.opponentLineup?.bench.length||0);for(let index=0;index<max;index++){const line=seasonEl('div','seasonMatchupRow');line.append(seasonMatchupSide(model.lineup?.bench[index]||{slot:'BN',player:null},model,'left'),seasonEl('span','seasonMatchupVs','↔'),seasonMatchupSide(model.opponentLineup?.bench[index]||{slot:'BN',player:null},model,'right'));bench.appendChild(line)}card.appendChild(bench)}return card}
function seasonRadarCard(model,{full=false}={}){const card=seasonEl('section','seasonPanel seasonRadarPanel');card.append(seasonSectionHeader('LEAGUE RADAR',full?null:seasonButton('View all ›',()=>showSeasonPage('radar'),'seasonTextButton')));const observations=[];if(model.objective.transactionCount)observations.push(`${model.objective.transactionCount} recent Yahoo transaction${model.objective.transactionCount===1?'':'s'} available.`);if(model.objective.availableCount)observations.push(`${model.objective.availableCount} players are currently marked free agent or waiver.`);if(model.objective.irCount)observations.push(`${model.objective.irCount} player${model.objective.irCount===1?' is':'s are'} in the user team’s IR slot.`);if(model.status==='PARTIAL')observations.push('Some Yahoo subsystems are stale or unavailable; cached successful data is preserved.');if(!observations.length)observations.push('No objective league-wide alert is available from the current snapshot.');observations.forEach(text=>{const row=seasonEl('div','seasonRadarItem');row.append(seasonEl('span','seasonRadarDot','•'),seasonEl('p','',text));card.appendChild(row)});return card}
function seasonActivityCard(model){const card=seasonEl('section','seasonPanel seasonActivityPanel');card.append(seasonSectionHeader('RECENT LEAGUE ACTIVITY'));if(!model.transactions.length){card.appendChild(seasonEmpty('No transactions','Yahoo did not return recent league activity.'));return card}model.transactions.slice(0,6).forEach(tx=>{const row=seasonEl('div','seasonActivityRow');row.append(seasonStatusBadge(tx.type,tx.type==='ADD'?'green':tx.type==='DROP'?'red':'neutral'),seasonEl('span','',tx.players?.map(player=>player.name).filter(Boolean).join(', ')||'Player unavailable'),seasonEl('time','',tx.timestamp?new Date(tx.timestamp*1000).toLocaleString():'Time unavailable'));card.appendChild(row)});return card}
function seasonFlightHero(model){const fallback=SeasonCommandCenterV1.flightControl(model),intelligence=model.waiverIntelligence,control=intelligence?.timing||fallback,pair=seasonWaiverPrimaryPair(intelligence),impact=seasonWaiverRosterImpact(pair),hero=seasonEl('section',`seasonHero seasonDecisionHero ${model.phase.key} action-${String(control.action||'hold').toLowerCase()}`);const left=seasonEl('div','seasonHeroSignal');left.append(seasonEl('span','seasonRadarGlyph','◉'));const copy=seasonEl('div','seasonHeroCopy');const eyebrow=seasonEl('div','seasonHeroEyebrow');eyebrow.append(seasonEl('b','','FLIGHT CONTROL'),seasonStatusBadge(model.phase.label,'blue'),intelligence?seasonStatusBadge(seasonWaiverSignal(intelligence).label,seasonWaiverSignal(intelligence).tone):seasonStatusBadge('SEASON STATUS','neutral'));copy.append(eyebrow,seasonEl('h1','',`${control.action} — ${control.headline}`));if(pair)copy.append(seasonEl('h2','seasonFlightTarget',`Best current opportunity: ${pair.player?.name||'No qualifying target'}`),seasonEl('p','seasonFlightMove',impact.move));copy.append(seasonEl('p','seasonFlightReason',pair?seasonWaiverFlightSummary(pair):control.reason));const watch=seasonEl('aside','seasonWatch seasonDecisionWindow');watch.append(seasonEl('small','','DECISION WINDOW'),seasonEl('strong','',pair?.action==='ACT'?'ACT NOW':pair?.action==='WAIT'?'MONITOR':'HOLD'),seasonEl('p','',pair?seasonWaiverTimingCopy(pair):control.reason),seasonButton('View waiver intelligence',()=>showSeasonPage('waivers'),'seasonPrimaryButton'));hero.append(left,copy,watch);return hero}
function seasonMoves(model){const card=seasonEl('section','seasonPanel seasonMoves');card.append(seasonSectionHeader('MOVES & RECOMMENDATIONS'));const list=seasonEl('div','seasonMoveGrid');SeasonCommandCenterV1.recommendationCards(model).forEach(item=>{const move=seasonEl('article','seasonMoveCard');move.append(seasonStatusBadge(item.kind,'orange'),seasonEl('h3','',item.title),seasonEl('p','',item.body));list.appendChild(move)});card.appendChild(list);return card}
function seasonDraftLeagueRosters(model){const panel=seasonEl('section','seasonPanel seasonDraftLeagueRosters');panel.append(seasonSectionHeader('DRAFT SNAPSHOT — ALL LEAGUE ROSTERS'),seasonEl('p','seasonTrustNote','Draft-night ownership only • These are not current Yahoo rosters.'));const grid=seasonEl('div','seasonDraftRosterGrid');model.teams.forEach(team=>{const isUser=team.teamKey===model.userTeamResolution?.teamKey,card=seasonEl('article',`seasonDraftTeam${isUser?' userTeam':''}`);const heading=seasonEl('h3','',`Slot ${team.teamSlot??team.draftSlot} • ${team.managerName||team.name||'Manager unavailable'}`);if(isUser)heading.appendChild(seasonEl('span','seasonMyTeamBadge','MY TEAM'));card.append(heading);team.draftRoster.forEach(player=>{const row=seasonEl('div','seasonDraftPlayer');row.append(seasonEl('span','',player.name),seasonEl('small','',`${player.position} • ${player.draftOrigin} • ${player.draftCost?.label||'Cost unavailable'}`));card.appendChild(row)});grid.appendChild(card)});panel.appendChild(grid);return panel}
function seasonTeamFitSummary(model){return window.FantasyHQTeamFitV1?FantasyHQTeamFitV1.summarize({model,profile:activeLeagueProfile}):null}
function seasonTeamFitCandidate(model,candidate){return window.FantasyHQTeamFitV1?FantasyHQTeamFitV1.evaluateCandidate({model,profile:activeLeagueProfile,candidate}):null}
function seasonAnalysisValue(value,fallback='Unknown'){return value===null||value===undefined||String(value).trim()===''?fallback:String(value)}
function seasonAnalysisEnum(value,fallback='Unknown'){return seasonAnalysisValue(value,fallback).replaceAll('_',' ')}
function seasonAnalysisFactGrid(facts,className='seasonAnalysisFacts'){const grid=seasonEl('div',className);facts.forEach(([label,value,tone])=>{const item=seasonEl('div','seasonAnalysisFact');item.append(seasonEl('small','',label),tone?seasonStatusBadge(seasonAnalysisValue(value),tone):seasonEl('strong','',seasonAnalysisValue(value)));grid.appendChild(item)});return grid}
function seasonAnalysisDisclosure(title,facts,className=''){const disclosure=seasonEl('details',`seasonAnalysisDisclosure ${className}`.trim()),summary=seasonEl('summary','',title);disclosure.open=false;disclosure.append(summary,seasonAnalysisFactGrid(facts,'seasonAnalysisEvidenceGrid'));return disclosure}
function seasonAnalysisUnresolved(facts){const missing=facts.filter(([,value])=>value===null||value===undefined||String(value).trim()===''||['UNKNOWN','UNSCORED'].includes(String(value).trim().toUpperCase())).map(([label])=>label);return missing.length?missing.join(' • '):'None in this analysis'}
function seasonAnalysisTakeaways(facts){const section=seasonEl('section','seasonAnalysisGroup seasonKeyTakeaways');section.append(seasonEl('h3','','KEY TAKEAWAYS'),seasonAnalysisFactGrid(facts,'seasonAnalysisTakeawayGrid'));return section}
function seasonTeamFitFacts(fit){return[['Need',seasonAnalysisEnum(fit?.needLevel)],['Starter path',seasonAnalysisEnum(fit?.starterPath)],['Depth impact',seasonAnalysisEnum(fit?.depthImpact)],['Flex utility',seasonAnalysisEnum(fit?.flexUtility)],['Bench utility',seasonAnalysisEnum(fit?.benchUtility)],['Roster fragility',seasonAnalysisEnum(fit?.components?.rosterFragility)],['Injury insurance',seasonAnalysisEnum(fit?.injuryInsurance)],['Replaceability',seasonAnalysisEnum(fit?.replaceability)],['Strengths',fit?.strengths?.join(' • ')||'None validated'],['Concerns',fit?.weaknesses?.join(' • ')||'None validated']]}
function seasonTeamFitAnalysisGroup(fit){const section=seasonEl('section','seasonAnalysisGroup seasonTeamFitAnalysisGroup');section.appendChild(seasonEl('h3','','TEAMFIT — ROSTER CONTEXT'));if(!fit||fit.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'){section.appendChild(seasonEl('p','seasonAnalysisNeutral',fit?.reason||'TeamFit awaiting current Yahoo roster data.'));return section}section.append(seasonEl('p','seasonAnalysisSummary',fit.summary),seasonAnalysisFactGrid(seasonTeamFitFacts(fit),'seasonAnalysisList'));return section}
function seasonRiskAnalysisGroup(facts){const section=seasonEl('section','seasonAnalysisGroup seasonRiskAnalysisGroup');section.append(seasonEl('h3','','RISK & UNCERTAINTY'),seasonAnalysisFactGrid(facts,'seasonAnalysisList'));return section}
function seasonDecisionAnalysisShell({kind,title,heading,summary,takeaways,teamFit,riskFacts,advancedFacts,sourceFacts}){const section=seasonEl('section','seasonWaiverDetail seasonDecisionAnalysis');section.dataset.analysisKind=kind;section.append(seasonSectionHeader(title),seasonEl('p','seasonAnalysisEyebrow',heading),seasonEl('p','seasonAnalysisLead',summary),seasonAnalysisTakeaways(takeaways),seasonTeamFitAnalysisGroup(teamFit),seasonRiskAnalysisGroup(riskFacts),seasonAnalysisDisclosure('SHOW ADVANCED EVIDENCE',advancedFacts,'seasonAdvancedEvidence'),seasonAnalysisDisclosure('SHOW SOURCES & PROVENANCE',sourceFacts,'seasonSourcesProvenance'));return section}
function seasonInsertPrimaryAnalysis(content,section){content.insertBefore(section,content.children[1]||null)}
function seasonTeamFitSummaryCard(model){const summary=seasonTeamFitSummary(model),card=seasonEl('section','seasonPanel seasonTeamFitSummary');card.appendChild(seasonSectionHeader('TEAMFIT'));if(!summary||summary.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'){card.append(seasonStatusBadge('AWAITING YAHOO','neutral'),seasonEl('p','seasonTrustNote',summary?.reason||'TeamFit awaiting current Yahoo roster data.'));return card}const grid=seasonEl('div','seasonTeamFitGrid');[['Strongest area',summary.strongestArea||'Unknown'],['Primary need',summary.primaryNeed?`${summary.primaryNeed} • ${summary.primaryNeedLevel}`:'None'],['Roster fragility',summary.rosterFragility||'Unknown']].forEach(([label,value])=>{const item=seasonEl('div');item.append(seasonEl('small','',label),seasonEl('strong','',value));grid.appendChild(item)});card.appendChild(grid);return card}
function seasonTeamFitOverview(model){const summary=seasonTeamFitSummary(model),panel=seasonEl('section','seasonPanel seasonTeamFitOverview');panel.appendChild(seasonSectionHeader('TEAMFIT — ROSTER CONTEXT'));if(!summary||summary.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'){panel.appendChild(seasonEmpty('TeamFit awaiting current Yahoo roster data',summary?.reason||'Current roster context is unavailable.'));return panel}const grid=seasonEl('div','seasonTeamFitPositionGrid');Object.values(summary.context.byPosition).filter(item=>item.required||item.total).forEach(item=>{const row=seasonEl('div','seasonTeamFitPosition'),qualityLabel=item.unknownQuality?`${item.total}/${item.required} rostered • quality incomplete`:`${item.usable}/${item.required} usable starters`;row.append(seasonEl('strong','',item.position),seasonStatusBadge(item.needLevel,item.needScore>=3?'red':item.needScore===2?'orange':'green'),seasonEl('span','',qualityLabel),seasonEl('span','',`${item.bench} bench • ${item.fragile} fragile`));grid.appendChild(row)});panel.append(grid,seasonEl('p','seasonTrustNote',`Roster fragility: ${summary.rosterFragility} • Profile-specific Yahoo roster context`));return panel}
function appendSeasonTeamFitDetail(player,model){const content=el('scanContent'),fit=seasonTeamFitCandidate(model,player);if(!content||!fit||content.querySelector('.seasonDecisionAnalysis'))return;const riskFacts=[['Main concern',fit.weaknesses?.[0]||'No validated concern'],['Risk flags',fit.riskFlags?.join(' • ')||'None validated'],['Evidence confidence',`${Math.round(fit.confidence||0)}%`],['Unresolved inputs',seasonAnalysisUnresolved([['Need',fit.needLevel],['Starter path',fit.starterPath],['Insurance',fit.injuryInsurance],['Replaceability',fit.replaceability]])]],takeaways=[['TeamFit',seasonAnalysisEnum(fit.status)],['Roster need',seasonAnalysisEnum(fit.needLevel)],['Starter path',seasonAnalysisEnum(fit.starterPath)],['Roster impact',seasonAnalysisEnum(fit.depthImpact)],['Flex utility',seasonAnalysisEnum(fit.flexUtility)],['Confidence',`${Math.round(fit.confidence||0)}%`]],advanced=[...seasonTeamFitFacts(fit),['Component context',fit.components?JSON.stringify(fit.components):'Unknown']],sources=[['Roster source',fit.provenance?.rosterSource],['Role source',fit.provenance?.roleSource],['Relationship source',fit.provenance?.relationshipSource]],section=seasonDecisionAnalysisShell({kind:'teamfit',title:'DECISION ANALYSIS',heading:'WHAT FANTASY HQ SEES',summary:fit.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'?fit.reason:fit.summary,takeaways,teamFit:fit,riskFacts,advancedFacts:advanced,sourceFacts:sources});seasonInsertPrimaryAnalysis(content,section)}
function renderSeasonHome(model,content){content.append(seasonFlightHero(model));const grid=seasonEl('div','seasonDashboardGrid');grid.append(seasonRosterSummaryCard(model),seasonWaiverCard(model),seasonMatchupCard(model),seasonTeamFitSummaryCard(model),seasonRadarCard(model),seasonActivityCard(model));content.append(grid);if(model.draftSnapshot)content.appendChild(seasonDraftLeagueRosters(model))}
function seasonPageIntro(title,body){const intro=seasonEl('header','seasonPageIntro'),copy=seasonPage==='matchup'?'Validated lineup state only. Draft Snapshot projections are labeled non-live; Yahoo remains current roster truth.':body;intro.append(seasonEl('h1','',title),seasonEl('p','',copy));return intro}
function renderSeasonPlayers(model,content){content.append(seasonPageIntro('Available Players','Filter the current normalized Yahoo free-agent and waiver pool. Draft exclusions do not carry into Season Mode.'));const controls=seasonEl('div','seasonPlayerFilters');const search=document.createElement('input');search.type='search';search.placeholder='Search available players';search.setAttribute('aria-label','Search available players');const pos=document.createElement('select');pos.setAttribute('aria-label','Filter position');['ALL','QB','RB','WR','TE','K','DST'].forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value==='ALL'?'All positions':value;pos.appendChild(option)});const availability=document.createElement('select');availability.setAttribute('aria-label','Filter availability');[['ALL','All availability'],['FREE AGENT','Free agents'],['WAIVER','Waivers']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;availability.appendChild(option)});const injured=document.createElement('label');const check=document.createElement('input');check.type='checkbox';injured.append(check,document.createTextNode(' Injured/status only'));controls.append(search,pos,availability,injured);const list=seasonEl('section','seasonPanel');const refresh=()=>{list.innerHTML='';SeasonCommandCenterV1.filterPlayers(model.available,{query:search.value,positionFilter:pos.value,availability:availability.value,injured:check.checked}).forEach(player=>list.appendChild(seasonAvailableRow(player,model)));if(!list.children.length)list.appendChild(seasonEmpty('No matching players','Change filters or refresh Yahoo.'))};[search,pos,availability,check].forEach(node=>node.addEventListener('input',refresh));content.append(controls,list);refresh()}
function renderSeasonWaivers(model,content){
  const intelligence=model.waiverIntelligence;
  content.append(seasonPageIntro('Waiver Intelligence','Fantasy HQ evaluates the player, the drop, roster impact, and whether now is the right time.'));
  if(!intelligence||intelligence.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'){content.append(seasonFlightHero(model),seasonEmpty('Waiver intelligence awaiting current Yahoo data',intelligence?.reason||'Current roster and availability data are required.'));return}
  content.appendChild(seasonFlightHero(model));
  const recommendations=seasonWaiverRecommendationCards(intelligence),primarySection=seasonEl('section','seasonDecisionSection');primarySection.appendChild(seasonSectionHeader('PRIMARY DECISIONS'));
  const cardGrid=seasonEl('div','seasonDecisionGrid');recommendations.forEach(item=>cardGrid.appendChild(seasonWaiverDecisionCard(item.pair,model,{identity:item.identity})));primarySection.appendChild(cardGrid);content.appendChild(primarySection);
  const featuredIds=new Set(recommendations.map(item=>item.pair.canonicalPlayerId)),watchPairs=intelligence.pairs.filter(pair=>pair.action==='WAIT'&&!featuredIds.has(pair.canonicalPlayerId));
  if(watchPairs.length){const watch=seasonEl('section','seasonPanel seasonWaiverWatchlist');watch.appendChild(seasonSectionHeader('WATCHLIST / MONITOR'));watchPairs.forEach(pair=>watch.appendChild(seasonWaiverRow(pair,model)));content.appendChild(watch)}
  const disclosedIds=new Set([...featuredIds,...watchPairs.map(pair=>pair.canonicalPlayerId)]);
  const controls=seasonEl('div','seasonPlayerFilters seasonWaiverFilters'),search=document.createElement('input'),pos=document.createElement('select'),action=document.createElement('select');search.type='search';search.placeholder='Search other waiver candidates';search.setAttribute('aria-label','Search waiver candidates');['ALL','QB','RB','WR','TE','K','DST'].forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value==='ALL'?'All positions':value;pos.appendChild(option)});pos.setAttribute('aria-label','Filter waiver position');['ALL','ACT','WAIT','HOLD'].forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value==='ALL'?'All decisions':value;action.appendChild(option)});action.setAttribute('aria-label','Filter waiver decision');controls.append(search,pos,action);
  const other=seasonEl('section','seasonPanel seasonWaiverPanel seasonOtherCandidates');other.appendChild(seasonSectionHeader('OTHER CANDIDATES'));const rows=seasonEl('div','seasonWaiverRows');other.appendChild(rows);
  const refresh=()=>{rows.innerHTML='';const needle=search.value.trim().toLowerCase(),pairs=intelligence.pairs.filter(pair=>!disclosedIds.has(pair.canonicalPlayerId)&&(!needle||String(pair.player?.name||'').toLowerCase().includes(needle))&&(pos.value==='ALL'||pair.position===pos.value)&&(action.value==='ALL'||pair.action===action.value));pairs.forEach(pair=>rows.appendChild(seasonWaiverRow(pair,model)));if(!pairs.length)rows.appendChild(seasonEmpty('No matching additional candidates','Primary and watch decisions remain above.'))};[search,pos,action].forEach(node=>node.addEventListener('input',refresh));content.append(controls,other);refresh();
}
function seasonStartSitEvaluation(model){return window.StartSitIntelligenceV1?StartSitIntelligenceV1.evaluate({model,profile:activeLeagueProfile}):null}
function seasonStartSitTone(state){return['START','LEAN_START'].includes(state)?'green':['SIT','LEAN_SIT'].includes(state)?'red':['WAIT','TOSS_UP'].includes(state)?'orange':'neutral'}
function seasonStartSitSignal(intelligence){if(intelligence?.signals?.chidori)return{label:'CHIDORI',tone:'red'};if(intelligence?.signals?.sharinganStart)return{label:'SHARINGAN START',tone:'green'};if(intelligence?.signals?.sharinganWatch)return{label:'SHARINGAN WATCH',tone:'orange'};return{label:'SHARINGAN HOLD',tone:'neutral'}}
function seasonStartSitInstruction(decision){if(!decision)return'No legal lineup comparison is available.';if(decision.state==='WAIT')return`Currently prefer ${decision.preferred?.name||decision.starter?.name}, but wait before locking the ${decision.lineupSlot} slot.`;if(decision.state==='TOSS_UP')return`${decision.starter?.name} and ${decision.alternative?.name} remain effectively even for ${decision.lineupSlot}.`;return`Start ${decision.preferred?.name||'the preferred player'} over ${decision.other?.name||'the alternative'} at ${decision.lineupSlot}.`}
function openSeasonStartSitAnalysis(decision,model){const player=decision?.preferred||decision?.starter;if(!player)return;openSeasonPlayerDetails(player,model);const content=el('scanContent');if(!content)return;content.querySelectorAll('.seasonDecisionAnalysis').forEach(node=>node.remove());const preferredScore=decision.preferred===decision.starter?decision.scores.starter:decision.scores.alternative,otherScore=decision.preferred===decision.starter?decision.scores.alternative:decision.scores.starter,evidence=preferredScore?.dimensions||{},fit=seasonTeamFitCandidate(model,player),preferredName=decision.preferred?.name||player.name||'Preferred player',otherName=decision.other?.name||decision.alternative?.name||'the alternative',edge=decision.edge===null?'Unknown':decision.edge.toFixed(1),confidence=`${Math.round(decision.confidence||0)}%`,workloadUncertainty=evidence.workloadUncertainty===null||evidence.workloadUncertainty===undefined?null:Number(evidence.workloadUncertainty),injuryUncertainty=evidence.injuryUncertainty===null||evidence.injuryUncertainty===undefined?null:Number(evidence.injuryUncertainty),uncertainty=['WAIT','TOSS_UP'].includes(decision.state)?decision.timingReason:Number.isFinite(workloadUncertainty)&&workloadUncertainty>0&&(!Number.isFinite(injuryUncertainty)||workloadUncertainty>=injuryUncertainty)?'Workload uncertainty is the largest validated concern.':Number.isFinite(injuryUncertainty)&&injuryUncertainty>0?'Injury uncertainty is the largest validated concern.':workloadUncertainty===null&&injuryUncertainty===null?'Current uncertainty inputs are unresolved.':'No validated uncertainty currently outweighs the preferred player\'s edge.',riskInputs=[['Injury uncertainty',evidence.injuryUncertainty],['Workload uncertainty',evidence.workloadUncertainty],['Volatility',evidence.volatility],['Evidence coverage',`${Math.round((decision.evidenceCoverage||0)*100)}%`],['Evidence freshness',preferredScore?.freshness],['Unresolved inputs',seasonAnalysisUnresolved([['Role',evidence.role],['Opportunity',evidence.opportunity],['Matchup',evidence.matchup],['Projection',evidence.projection]])]],takeaways=[['Preferred starter',preferredName],['Lineup slot',decision.lineupSlot],['Confidence',confidence],['Timing',seasonAnalysisEnum(decision.timingState)],['Main edge',decision.reason],['Main uncertainty',uncertainty]],advanced=[['Decision',seasonAnalysisEnum(decision.state)],['Alternative',otherName],['Meaningful edge',edge],['Role',evidence.role],['Opportunity',evidence.opportunity],['Recent usage',evidence.recentUsage],['Role stability',evidence.roleStability],['Matchup',evidence.matchup],['Floor',evidence.floor],['Ceiling / upside',evidence.upside],['Scoring fit',evidence.scoringFit],['Projection evidence',evidence.projection],['Alternative normalized score',otherScore?.score===null?'Unscored':otherScore.score.toFixed(1)]],sources=[['Role source',preferredScore?.provenance?.roleSource],['Opportunity source',preferredScore?.provenance?.opportunitySource],['Usage source',preferredScore?.provenance?.usageSource],['Matchup source',preferredScore?.provenance?.matchupSource],['Projection source',preferredScore?.provenance?.projectionSource]],detail=seasonDecisionAnalysisShell({kind:'start-sit',title:'DECISION ANALYSIS',heading:`WHY FANTASY HQ PREFERS ${preferredName.toUpperCase()} OVER ${otherName.toUpperCase()}`,summary:decision.reason,takeaways,teamFit:fit,riskFacts:riskInputs,advancedFacts:advanced,sourceFacts:sources});seasonInsertPrimaryAnalysis(content,detail)}
function seasonStartSitFlightHero(model,intelligence){const decision=intelligence?.primary,signal=seasonStartSitSignal(intelligence),hero=seasonEl('section',`seasonHero seasonDecisionHero seasonStartSitHero action-${String(decision?.state||'wait').toLowerCase()}`),left=seasonEl('div','seasonHeroSignal'),copy=seasonEl('div','seasonHeroCopy'),eyebrow=seasonEl('div','seasonHeroEyebrow'),watch=seasonEl('aside','seasonWatch seasonDecisionWindow');left.append(seasonEl('span','seasonRadarGlyph','◉'));eyebrow.append(seasonEl('b','','FLIGHT CONTROL'),seasonStatusBadge(model.phase.label,'blue'),seasonStatusBadge(signal.label,signal.tone));copy.append(eyebrow,seasonEl('h1','',decision?`${decision.state.replaceAll('_',' ')} — ${decision.lineupSlot} DECISION`:'WAIT — LINEUP EVIDENCE NEEDED'),seasonEl('h2','seasonFlightTarget',decision?`Preferred: ${decision.preferred?.name||decision.starter?.name} over ${decision.other?.name||decision.alternative?.name}`:'No authoritative lineup recommendation'),seasonEl('p','seasonFlightReason',decision?decision.reason:intelligence?.reason||'Validated current-season evidence is required.'));watch.append(seasonEl('small','','DECISION WINDOW'),seasonEl('strong','',decision?.state==='WAIT'?'MONITOR':decision?.timingState==='LOCK_WINDOW'?'ACT NOW':'PROVISIONAL'),seasonEl('p','',decision?.timingReason||intelligence?.reason||'Wait for current Yahoo lineup and evidence.'),decision?seasonButton('View Analysis',()=>openSeasonStartSitAnalysis(decision,model),'seasonPrimaryButton'):seasonButton('View current lineup',()=>showSeasonPage('team'),'seasonPrimaryButton'));hero.append(left,copy,watch);return hero}
function seasonStartSitCard(decision,model,{identity='PRIMARY DECISION'}={}){const player=decision.preferred||decision.starter,card=seasonEl('article',`seasonStartSitCard action-${String(decision.state).toLowerCase()}`),visual=seasonEl('div','seasonStartSitVisual'),photo=seasonPlayerPhoto(player),body=seasonEl('div','seasonStartSitBody'),head=seasonEl('div','seasonDecisionHead'),playerIdentity=seasonEl('div','seasonDecisionPlayer'),badges=seasonEl('div','seasonDecisionBadges');photo.classList.add('seasonDecisionPhoto');visual.append(photo,seasonStatusBadge(identity,identity.includes('SHARINGAN')?'orange':'blue'));playerIdentity.append(seasonEl('h3','',player?.name||'Unresolved player'),seasonEl('p','',`${player?.position||'—'} • ${player?.sourceTeam||'Team unavailable'}`));head.append(playerIdentity,seasonStatusBadge(decision.state.replaceAll('_',' '),seasonStartSitTone(decision.state)));badges.append(seasonStatusBadge(decision.lineupSlot,'blue'),seasonStatusBadge(`${Math.round(decision.confidence||0)} confidence`,'neutral'),seasonStatusBadge(decision.timingState.replaceAll('_',' '),'orange'));body.append(head,seasonEl('p','seasonStartSitMove',seasonStartSitInstruction(decision)),seasonEl('p','seasonDecisionReason',decision.reason),badges,seasonButton('View Analysis',()=>openSeasonStartSitAnalysis(decision,model),'seasonPrimaryButton seasonAnalysisButton'));card.append(visual,body);return card}
function seasonStartSitRow(decision,model){const row=seasonEl('article','seasonStartSitRow'),copy=seasonEl('div','seasonWaiverIdentity');copy.append(seasonEl('strong','',`${decision.preferred?.name||decision.starter?.name} over ${decision.other?.name||decision.alternative?.name}`),seasonEl('small','',`${decision.lineupSlot} • ${decision.reason}`));row.append(copy,seasonStatusBadge(decision.state.replaceAll('_',' '),seasonStartSitTone(decision.state)),seasonButton('View Analysis',()=>openSeasonStartSitAnalysis(decision,model),'seasonMiniButton'));return row}
function renderSeasonStartSit(model,content){const intelligence=seasonStartSitEvaluation(model);content.append(seasonPageIntro('Start/Sit Intelligence','Legal lineup-slot comparisons using validated role, opportunity, matchup, injury, scoring, and timing evidence.'),seasonStartSitFlightHero(model,intelligence));if(!intelligence||intelligence.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'){content.appendChild(seasonEmpty('Start/Sit intelligence is waiting for validated current-season data',intelligence?.reason||'Current Yahoo lineup, roster, and player evidence are required.'));return}if(!intelligence.primary){content.append(seasonEmpty('No legal lineup change is recommended','The current lineup has no eligible bench alternative requiring a decision.'),seasonRosterCard(model,{full:true}));return}const primary=seasonEl('section','seasonDecisionSection');primary.appendChild(seasonSectionHeader('PRIMARY LINEUP DECISION'));const grid=seasonEl('div','seasonStartSitGrid'),signal=seasonStartSitSignal(intelligence),identity=signal.label==='SHARINGAN HOLD'?'PRIMARY DECISION':signal.label;grid.appendChild(seasonStartSitCard(intelligence.primary,model,{identity}));primary.appendChild(grid);content.appendChild(primary);if(intelligence.watches.length){const watch=seasonEl('section','seasonPanel seasonStartSitWatches');watch.appendChild(seasonSectionHeader('CLOSE DECISIONS / WATCHES'));intelligence.watches.forEach(decision=>watch.appendChild(seasonStartSitRow(decision,model)));content.appendChild(watch)}content.appendChild(seasonRosterCard(model,{full:true}))}
function renderSeasonShellPage(model,content,page){const shells={trades:['TRADE ANALYZER','Select my players, an opponent, and target players. TeamFit and trade-decision outputs are coming in 4.4.4.'],history:['MOVES & RECOMMENDATION HISTORY','No historical season actions are fabricated. Future recommendations and user decisions will be recorded here.'],settings:['SEASON SETTINGS','Yahoo mapping, sync health, and profile context remain isolated to this Fantasy HQ league profile.']};const [title,body]=shells[page];content.append(seasonPageIntro(title,body));const panel=seasonEl('section','seasonPanel seasonFoundationPanel');panel.append(seasonStatusBadge('FOUNDATION','blue'),seasonEl('h2','','Coming in the next Season sprint'),seasonEl('p','',body));if(page==='settings'){panel.append(seasonEl('p','seasonTrustNote',`Profile: ${model.profileName} • Draft linkage: ${model.draftLinkageStatus} • Sync: ${model.status}`),seasonButton('Sync Yahoo now',()=>syncYahooLeagueNow(),'seasonPrimaryButton'))}content.appendChild(panel)}
async function renderSeasonCommandCenter(){if(!window.SeasonCommandCenterV1||!activeLeagueProfile)return;const resolution=await seasonStateForActiveProfile(),{state,demo,diagnostic}=resolution,baseModel=SeasonCommandCenterV1.buildModel({state,profile:activeLeagueProfile,demo}),model=seasonWeekOverride?{...baseModel,week:seasonWeekOverride,phase:SeasonCommandCenterV1.phaseForWeek(seasonWeekOverride)}:baseModel;renderSeasonProfileOptions();renderSeasonNavigation();renderSeasonSidebar(model);safeText('seasonWeekLabel',model.draftSnapshot?'Preseason':`Week ${model.week}`);const sync=el('seasonSyncPill');if(sync){sync.textContent=seasonSyncLabel(model);sync.className=`seasonSyncPill ${model.demo?'demo':model.stale?'stale':model.status==='PARTIAL'?'partial':'current'}`};const content=el('seasonContent');if(!content)return;content.innerHTML='';if(seasonDevelopmentDiagnosticsEnabled()){const diagnosticText=seasonSourceDiagnosticText(diagnostic);console.info('[Fantasy HQ Season Source]',diagnostic);content.appendChild(seasonEl('div','seasonSourceDiagnostic',diagnosticText))}if(model.demo){const banner=seasonEl('div','seasonDemoBanner','DEMO DATA — sanitized local fixture; never written to Yahoo season storage.');content.appendChild(banner)}if(model.draftSnapshot){content.appendChild(seasonEl('div','seasonStateBanner','Source: Draft Snapshot • STALE • Post-draft transactions unknown. Draft-night ownership only; current Yahoo ownership remains unknown.'))}else if(model.stale||model.syncError){const warning=seasonEl('div','seasonStateBanner',`Cached Yahoo snapshot • ${model.syncError||'Refresh is stale.'}`);content.appendChild(warning)}if(!model.snapshot){content.append(seasonPageIntro('Season Mode','Yahoo has no successful normalized season snapshot and no completed draft archive is available for this profile.'),seasonEmpty('Season data unavailable','Import a completed draft in Draft History or successfully sync Yahoo.'));return}if(seasonPage==='home')renderSeasonHome(model,content);else if(seasonPage==='team'){content.append(seasonPageIntro('My Team',model.draftSnapshot?'Draft-origin roster snapshot. Current Yahoo ownership is not yet known.':'Yahoo is current roster truth. Linked draft origin remains immutable history.'),seasonRosterCard(model,{full:true}),seasonTeamFitOverview(model))}else if(seasonPage==='waivers'||seasonPage==='players')renderSeasonPlayers(model,content);else if(seasonPage==='startsit')renderSeasonStartSit(model,content);else if(seasonPage==='matchup'){content.append(seasonPageIntro(`Week ${model.week} Matchup`,'Only Yahoo-provided matchup state is shown.'),seasonMatchupCard(model,{full:true}))}else if(seasonPage==='radar'){content.append(seasonPageIntro('League Radar','Objective Yahoo roster and transaction observations—never inferred manager motives.'),seasonRadarCard(model,{full:true}),seasonActivityCard(model))}else renderSeasonShellPage(model,content,seasonPage);content.focus({preventScroll:true})}
async function openSeasonMode(){try{if(history.length&&draftSessionStore)persistDraftSession(pick>TOTAL_PICKS?'complete':'active');SeasonCommandCenterV1.saveMode(localStorage,activeLeagueProfile.id,'season');seasonPage='home';seasonWeekOverride=null;el('primaryDraftModeButton')?.classList.remove('active');el('primaryDraftModeButton')?.removeAttribute('aria-current');el('primarySeasonModeButton')?.classList.add('active');el('primarySeasonModeButton')?.setAttribute('aria-current','page');el('setupScreen')?.classList.add('hidden');el('appScreen')?.classList.add('hidden');el('seasonScreen')?.classList.remove('hidden');document.body.classList.add('seasonModeActive');await renderSeasonCommandCenter();window.scrollTo?.(0,0)}catch(error){alert(error.message)}}
function exitSeasonMode(){if(activeLeagueProfile&&window.SeasonCommandCenterV1)SeasonCommandCenterV1.saveMode(localStorage,activeLeagueProfile.id,'draft');document.body.classList.remove('seasonModeActive');el('seasonScreen')?.classList.add('hidden');el('appScreen')?.classList.add('hidden');el('setupScreen')?.classList.remove('hidden');el('primarySeasonModeButton')?.classList.remove('active');el('primarySeasonModeButton')?.removeAttribute('aria-current');el('primaryDraftModeButton')?.classList.add('active');el('primaryDraftModeButton')?.setAttribute('aria-current','page');renderYahooSeasonState();window.scrollTo?.(0,0)}
function returnToDraftMode(){if(!el('seasonScreen')?.classList.contains('hidden'))exitSeasonMode();else{el('primarySeasonModeButton')?.classList.remove('active');el('primarySeasonModeButton')?.removeAttribute('aria-current');el('primaryDraftModeButton')?.classList.add('active');el('primaryDraftModeButton')?.setAttribute('aria-current','page')}}
async function selectSeasonProfile(profileId){selectLeagueProfile(profileId);seasonPage='home';seasonWeekOverride=null;await renderSeasonCommandCenter()}
function showSeasonPage(page){if(!SeasonCommandCenterV1.PAGES.includes(page))return;seasonPage=page;el('seasonSidebar')?.classList.remove('open');el('seasonNavToggle')?.setAttribute('aria-expanded','false');renderSeasonCommandCenter()}
function toggleSeasonNavigation(){const sidebar=el('seasonSidebar'),button=el('seasonNavToggle'),open=!sidebar?.classList.contains('open');sidebar?.classList.toggle('open',open);button?.setAttribute('aria-expanded',String(open))}
function changeSeasonWeek(delta){seasonWeekOverride=Math.max(1,Math.min(18,(seasonWeekOverride||Number(el('seasonWeekLabel')?.textContent.match(/\d+/)?.[0])||1)+Number(delta||0)));renderSeasonCommandCenter()}
function showSeasonComingSoon(name){alert(`${name} is a prepared Season Mode surface. Decision intelligence arrives in a later 4.4.x sprint.`)}
function openSeasonPlayerDetails(player,model){seasonSelectedPlayer=player;const content=el('scanContent');if(!content)return;content.innerHTML='';content.append(seasonSectionHeader(player.name||'Unknown player',seasonButton('Close',()=>closeScan(),'seasonTextButton')));const overview=[['Position',player.position||'Not provided'],['NFL team',player.sourceTeam||'Not provided'],['Availability',player.availability||player.ownership||'Rostered'],['Injury',player.injuryStatus||'No injury flag supplied']],context=[['Yahoo roster slot',player.rosterSlot||'Available player'],['Draft origin',player.draftOrigin?`Drafted ${player.draftOrigin}`:model.linkedDraft?'No linked pick found':'No linked draft archive'],['Rest-of-season value','Not yet scored'],['Championship Equity','Not yet scored'],['Start/Sit reasoning','Open Start/Sit Intelligence']];content.append(seasonAnalysisFactGrid(overview,'seasonPlayerOverview'),seasonAnalysisDisclosure('SHOW PLAYER RECORD & CONTEXT',context,'seasonPlayerContext'));el('scanModal')?.classList.remove('hidden')}
function getYahooSyncController(){
  if(yahooSyncController)return yahooSyncController;
  if(!window.FantasyHQYahooSync||!window.FantasyHQYahooSeason)throw new Error('Yahoo sync modules are unavailable.');
  yahooSyncController=FantasyHQYahooSync.createController({transport:FantasyHQYahooSync.createTransport(),storage:localStorage});
  return yahooSyncController;
}
function yahooArchiveLinkageInputs(){
  if(!window.DraftWorkflowV1||!leagueProfileStore)return[];
  return discoverCompletedDrafts().map(entry=>{const snapshot=entry.snapshot||{};return{sessionId:snapshot.sessionId||entry.archiveId||entry.id,archiveId:entry.archiveId||entry.id,profileId:entry.profileId,completed:true,draftMode:entry.mode,sourceMode:entry.sourceMode,slot:entry.draftSlot,teamCount:snapshot.settings?.teams||snapshot.leagueConfiguration?.teams||entry.record?.league?.teams||null,history:snapshot.history||[],picks:entry.record?.picks||[]};});
}
function renderYahooSeasonState(){
  const badge=el('syncStatusBadge'),text=el('syncStatusText'),overview=el('yahooSeasonOverview'),mapping=el('yahooLeagueMapping'),seasonButton=el('seasonModeBtn');let state=null;
  try{state=activeLeagueProfile?getYahooSyncController().read(activeLeagueProfile.id):null;}catch(_){state=null;}
  if(seasonButton){seasonButton.disabled=false;seasonButton.textContent=seasonDemoEnabled()&&!state?.snapshot?'Open Season Mode • Demo':'Open Season Mode'}
  if(!state){overview?.classList.add('hidden');return;}
  const status=state.sync?.status||'LOCAL';if(badge)badge.textContent=`YAHOO ${status}`;
  if(text){const stamp=state.sync?.lastSuccessfulSyncAt?new Date(state.sync.lastSuccessfulSyncAt).toLocaleString():'Not synced';text.textContent=`${state.mapping?.leagueName||'Yahoo mapping pending'} • ${stamp}${state.sync?.error?` • ${state.sync.error}`:''}`;}
  mapping?.classList.toggle('hidden',Boolean(state.mapping?.explicitlyConfirmed));
  if(!overview)return;const snapshot=state.snapshot;if(!snapshot){overview.classList.add('hidden');return;}overview.innerHTML='';
  const userTeam=snapshot.teams?.find(team=>team.teamKey===snapshot.userTeamKey),userStanding=snapshot.standings?.find(row=>row.teamKey===snapshot.userTeamKey),standingText=userStanding?.rank?`Rank ${userStanding.rank}`:snapshot.standings?.length?'Available':'Not provided',matchupText=snapshot.matchups?.matchups?.length?`Week ${snapshot.matchups.week||snapshot.league?.currentWeek||'current'}`:'Not provided',facts=[['Mode','Season Mode'],['League',snapshot.league?.name||state.mapping?.leagueName||'Yahoo'],['My Team',userTeam?.name||'Unresolved'],['Current Roster',`${userTeam?.roster?.length||0} players`],['Settings',snapshot.settingsReconciliation?.status||'UNKNOWN'],['Standing',standingText],['Matchup',matchupText],['Draft Link',snapshot.draftLinkage?.status||'NOT_LINKED'],['Updated',snapshot.fetchedAt?new Date(snapshot.fetchedAt).toLocaleString():'Unknown']];
  facts.forEach(([label,value])=>{const node=document.createElement('div');node.className='yahooSeasonFact';const strong=document.createElement('b'),small=document.createElement('span');strong.textContent=String(value);small.textContent=label;node.append(strong,small);overview.appendChild(node);});overview.classList.remove('hidden');
}
async function refreshYahooConnectionStatus(){
  try{const status=await getYahooSyncController().status();safeText('syncStatusText',status.connected?'Yahoo connected read-only. Discover leagues or sync the confirmed mapping.':status.ready?'Yahoo bridge ready. Connect to authorize read-only access.':'Yahoo bridge is running but OAuth environment variables are not configured.');const btn=el('yahooConnectBtn');if(btn)btn.textContent=status.connected?'Reconnect Yahoo':'Connect Yahoo';}
  catch(_){safeText('syncStatusText','Yahoo bridge is offline. Cached profile snapshots remain available.');}
  renderYahooSeasonState();
}
function prepareYahooConnection(){
  try{window.location.assign(getYahooSyncController().connectUrl||FantasyHQYahooSync.createTransport().connectUrl);}catch(error){alert(`Yahoo connection could not start: ${error.message}`);}
}
async function discoverYahooLeagues(){
  try{safeText('syncStatusText','Discovering 2026 Yahoo NFL leagues…');const result=await getYahooSyncController().discover(2026);yahooDiscoveredLeagues=result.leagues;const select=el('yahooLeagueSelect');if(select){select.innerHTML='';const first=document.createElement('option');first.value='';first.textContent=yahooDiscoveredLeagues.length?'Choose a discovered league':'No 2026 NFL leagues found';select.appendChild(first);yahooDiscoveredLeagues.forEach(league=>{const option=document.createElement('option');option.value=league.leagueKey;option.textContent=`${league.name} • ${league.teamCount||'?'} teams`;select.appendChild(option);});}el('yahooLeagueMapping')?.classList.remove('hidden');safeText('syncStatusText',`${yahooDiscoveredLeagues.length} Yahoo NFL league${yahooDiscoveredLeagues.length===1?'':'s'} discovered. Confirm the league that belongs to ${activeLeagueProfile?.displayName||'this profile'}.`);}
  catch(error){safeText('syncStatusText',error.message);}
}
function confirmYahooLeagueMapping(){
  try{const key=el('yahooLeagueSelect')?.value,league=yahooDiscoveredLeagues.find(item=>item.leagueKey===key);if(!league)throw new Error('Choose a discovered Yahoo league first.');getYahooSyncController().mapLeague(activeLeagueProfile,league);renderYahooSeasonState();}
  catch(error){alert(error.message);}
}
async function syncYahooLeagueNow(){
  try{safeText('syncStatusText','Syncing the confirmed Yahoo league read-only…');await getYahooSyncController().sync({profile:activeLeagueProfile,canonicalPlayers:players,aliases:{},archives:yahooArchiveLinkageInputs()});renderYahooSeasonState();}
  catch(error){renderYahooSeasonState();alert(`Yahoo sync did not replace the previous snapshot: ${error.message}`);}
}
async function disconnectYahoo(){
  if(!confirm('Remove the local Yahoo authorization? Saved normalized snapshots and mappings will remain.'))return;
  try{await getYahooSyncController().disconnect();await refreshYahooConnectionStatus();}catch(error){alert(error.message);}
}
window.addEventListener('load',()=>refreshYahooConnectionStatus());
function syncDraftIntoLeagueState() {
  if (!window.FantasyHQCore || !players.length) return;
  const teams = Array.from({ length: leagueContext.teams || 10 }, (_, i) => ({
    id: String(i + 1),
    name: slotManagers[i + 1] || `Team ${i + 1}`,
    isUser: i + 1 === slot,
  }));
  const rosters = {};
  teams.forEach(t => (rosters[t.id] = history.filter(h => String(h.team) === t.id).map(h => h.id)));
  FantasyHQCore.updateDraftContext({
    settings: { ...leagueContext, rosterSlots: [...rosterSlots] },
    teams,
    rosters,
    availablePlayerIds: available().map(p => p.id),
    playerMeta: Object.fromEntries(
      players.map(p => [
        p.id,
        { name: p.name, pos: positionKey(p), team: p.team, overall: p.overall },
      ])
    ),
  });
  updateSyncFoundationUI();
}
if (window.FantasyHQCore) {
  FantasyHQCore.subscribe(() => updateSyncFoundationUI());
  window.addEventListener('load', updateSyncFoundationUI);
}
const originalStartDraft = startDraft;
startDraft = function () {
  const saved=draftSessionStore?.load();if(saved?.status==='complete'){try{archiveCompletedSnapshot(saved)}catch(error){alert(`The completed draft could not be preserved, so the active slot was not reused: ${error.message}`);return false}}
  const result = originalStartDraft.apply(this, arguments);
  if(result===true){draftSessionStore?.start(currentDraftSessionState('active'));syncDraftIntoLeagueState();persistDraftSession()}
  return result;
};
const originalSelectPlayer = selectPlayer;
selectPlayer = function (id, team) {
  const result = originalSelectPlayer.apply(this, arguments);
  if(result){syncDraftIntoLeagueState();persistDraftSession(pick>TOTAL_PICKS?'complete':'active')}
  return result;
};
const originalUndoLastPick = undoLastPick;
undoLastPick = function () {
  const result = originalUndoLastPick.apply(this, arguments);
  if(result){syncDraftIntoLeagueState();persistDraftSession()}
  return result;
};

const seasonHomeRenderer441 = renderSeasonHome;
renderSeasonHome = function (model, content) {
  const waiverIntelligence = seasonWaiverEvaluation(model);
  return seasonHomeRenderer441({...model, waiverIntelligence}, content);
};
const seasonPlayerPoolRenderer441 = renderSeasonPlayers;
renderSeasonPlayers = function (model, content) {
  const waiverIntelligence = seasonWaiverEvaluation(model);
  const waiverModel = {...model, waiverIntelligence};
  return seasonPage === 'waivers' ? renderSeasonWaivers(waiverModel, content) : seasonPlayerPoolRenderer441(waiverModel, content);
};
const seasonPlayerDetailsRenderer441 = openSeasonPlayerDetails;
openSeasonPlayerDetails = function (player, model) {
  seasonPlayerDetailsRenderer441(player, model);
  const intelligence = seasonWaiverEvaluation(model), pair = seasonWaiverPairForPlayer({...model, waiverIntelligence:intelligence}, player), content = el('scanContent');
  if (!pair || !content) return;
  const evidence=pair.dimensions||{},competition=pair.competition||{},impact=seasonWaiverRosterImpact(pair),fit=seasonTeamFitCandidate(model,player),confidence=`${Math.round((pair.confidence||0)*100)}%`,teamFitStatus=fit?.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'?'Unavailable':seasonAnalysisEnum(fit?.status),teamFitNeed=fit?.status==='INSUFFICIENT_VALIDATED_SEASON_DATA'?'Unknown':seasonAnalysisEnum(fit?.needLevel),mainConcern=fit?.weaknesses?.[0]||(pair.action==='ACT'?'No validated concern':seasonWaiverTimingCopy(pair)),summary=`${seasonWaiverExplanation(pair)}${fit&&fit.status!=='INSUFFICIENT_VALIDATED_SEASON_DATA'?` ${fit.summary}`:''}`,takeaways=[['Action',pair.action],['TeamFit',teamFitStatus],['Waiver positional demand',seasonAnalysisEnum(pair.rosterNeed)],['TeamFit roster need',teamFitNeed],['Starter path',seasonAnalysisEnum(fit?.starterPath)],['Confidence',confidence]],riskFacts=[['Main concern',mainConcern],['Risk',evidence.risk],['Injury uncertainty',evidence.injuryUncertainty],['Workload uncertainty',evidence.workloadUncertainty],['Evidence coverage',confidence],['Evidence freshness',pair.freshness||pair.provenance?.freshness],['Unresolved inputs',seasonAnalysisUnresolved([['Role signal',evidence.role],['Opportunity evidence',evidence.opportunity],['Risk',evidence.risk],['TeamFit insurance',fit?.injuryInsurance],['Replaceability',fit?.replaceability]])]],advanced=[['Availability',player.availability||player.ownership],['Role signal',evidence.role],['Opportunity evidence',evidence.opportunity],['Upside',evidence.upside],['Acquisition cost signal',evidence.acquisitionCost],['Drop cost signal',pair.drop?.dropCost],['Suggested drop',pair.drop?.player?.name||'No acceptable drop'],['Drop protection',pair.drop?.state||'UNRESOLVED'],['Starter demand',competition.starterNeedCount],['Depth demand',competition.depthDemandCount],['Comparable alternatives',competition.comparableAlternativeCount],['Competition context',competition.reason],['Championship Equity evidence',evidence.championshipEquity],['FAAB',intelligence?.faab?.label||'FAAB: Not yet scored'],['Before',impact.before],['Move',impact.move],['After',impact.after]],sources=[['Role source',pair.provenance?.roleSource],['Opportunity source',pair.provenance?.opportunitySource],['Ranking source',pair.provenance?.rankingSource],['Availability source',pair.provenance?.availabilitySource],['Roster source',fit?.provenance?.rosterSource],['Relationship source',fit?.provenance?.relationshipSource],['Injury source',pair.provenance?.injurySource],['Projection source',pair.provenance?.projectionSource]],detail=seasonDecisionAnalysisShell({kind:'waiver',title:'DECISION ANALYSIS',heading:pair.action==='ACT'?'WHY FANTASY HQ LIKES THIS MOVE':'WHY FANTASY HQ IS CAUTIOUS',summary,takeaways,teamFit:fit,riskFacts,advancedFacts:advanced,sourceFacts:sources});
  if(pair.rosterNeed&&fit?.needLevel&&pair.rosterNeed!==fit.needLevel){const note=seasonEl('p','seasonAnalysisSemanticNote','Waiver positional demand reflects the transaction engine\'s acquisition context. TeamFit roster need reflects broader roster construction and starter/depth utility.');detail.querySelector('.seasonKeyTakeaways')?.appendChild(note)}seasonInsertPrimaryAnalysis(content,detail);
};

const seasonPlayerDetailsRenderer443 = openSeasonPlayerDetails;
openSeasonPlayerDetails = function (player, model) {
  seasonPlayerDetailsRenderer443(player, model);
  appendSeasonTeamFitDetail(player, model);
};

function seasonEvidenceYahooState(model){return{authoritative:Boolean(model?.snapshot&&!model?.demo&&!model?.draftSnapshot),current:Boolean(model?.snapshot&&!model?.demo&&!model?.draftSnapshot&&!model?.stale)}}
function seasonEvidenceStatusSurface(model){const panel=seasonEl('section','seasonPanel seasonEvidencePanel'),store=seasonEvidenceStore,status=store?store.status({yahooState:seasonEvidenceYahooState(model)}):null;panel.appendChild(seasonSectionHeader('SEASON EVIDENCE STATUS'));panel.appendChild(seasonEl('p','seasonTrustNote','NFL/player evidence is profile-independent. Yahoo remains the authority for roster, ownership, availability, and transactions.'));const grid=seasonEl('div','seasonEvidenceGrid'),facts=[['Player identity',status?.identity?.status||'UNAVAILABLE'],['Role evidence',status?.families?.role?.status||'MISSING'],['Opportunity',status?.families?.opportunity?.status||'MISSING'],['Injury',status?.families?.injury?.status||'MISSING'],['Matchup',status?.families?.matchup?.status||'MISSING'],['Projection',status?.families?.projection?.status||'MISSING'],['Source value',status?.families?.sourceValue?.status||'MISSING'],['Yahoo league state',status?.yahooLeagueStateReady?'CONNECTED':'UNAVAILABLE'],['Decision authority',status?.decisionAuthority||'BLOCKED']];facts.forEach(([label,value])=>{const item=seasonEl('div','seasonEvidenceFact');item.append(seasonEl('span','',label),seasonEl('strong','',value));grid.appendChild(item)});panel.appendChild(grid);panel.appendChild(seasonEl('p','seasonEvidenceAuthority','Shadow diagnostics only — recommendation authority is disabled.'));return panel}
function appendSeasonEvidenceDetail(player,model){const content=el('scanContent'),store=seasonEvidenceStore,id=player?.canonicalPlayerId||player?.identity?.canonicalPlayerId||player?.playerId||player?.id;if(!content||!store||!id)return;const context=FantasyHQSeasonEvidenceV1.teamFitEvidenceContext(store,id,{profileId:activeLeagueProfile?.id,leagueState:seasonEvidenceYahooState(model)}),records=store.observations(id),latestInjury=context.latest.injury,section=seasonEl('section','seasonEvidenceDetail');section.appendChild(seasonSectionHeader('SEASON EVIDENCE'));const grid=seasonEl('div','seasonEvidenceGrid'),facts=[['Role',context.roleSignal.status.replace('ROLE_','')],['Opportunity',context.opportunitySignal.status.replace('OPPORTUNITY_','')],['Injury',latestInjury.status==='AVAILABLE'?latestInjury.value.status:latestInjury.status],['Evidence coverage',context.coverage.level],['Freshness',Object.values(context.coverage.freshness).includes('STALE')?'STALE':Object.values(context.coverage.freshness).includes('AGING')?'AGING':records.length?'FRESH':'UNKNOWN'],['Sources',new Set(records.map(record=>record.provenance.source)).size]];facts.forEach(([label,value])=>{const item=seasonEl('div','seasonEvidenceFact');item.append(seasonEl('span','',label),seasonEl('strong','',value));grid.appendChild(item)});section.appendChild(grid);const disclosure=document.createElement('details'),summary=document.createElement('summary'),raw=seasonEl('div','seasonEvidenceRaw');summary.textContent='Show evidence provenance';records.forEach(record=>{const row=seasonEl('p','');row.append(seasonEl('strong','',`${record.provenance.source} • ${record.provenance.sourceType}`),document.createTextNode(` — Week ${record.week??'season'} • observed ${record.observedAt} • ${record.evidenceId}`));raw.appendChild(row)});if(!records.length)raw.appendChild(seasonEl('p','','No normalized evidence is available for this player.'));disclosure.append(summary,raw);section.append(disclosure,seasonEl('p','seasonEvidenceAuthority',`Authority: ${context.authority} • never a probability or transaction claim.`));content.appendChild(section)}
const renderSeasonShellPage444=renderSeasonShellPage;
renderSeasonShellPage=function(model,content,page){renderSeasonShellPage444(model,content,page);if(page==='settings')content.appendChild(seasonEvidenceStatusSurface(model))};
const seasonPlayerDetailsRenderer445=openSeasonPlayerDetails;
openSeasonPlayerDetails=function(player,model){seasonPlayerDetailsRenderer445(player,model);appendSeasonEvidenceDetail(player,model)};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker
      .register('./service-worker.js?v=jonin_4_4_5_season_evidence_foundation')
      .then(reg => reg.update())
      .catch(err => console.warn('Service worker update skipped', err))
  );
}

init();
