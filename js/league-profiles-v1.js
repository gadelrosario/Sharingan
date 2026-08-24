(function(root){
  'use strict';
  const REGISTRY_KEY='fantasyHQ.leagueProfiles.v1',PRIMARY_ID='primary-league',DOWNEY_ID='straight-outta-downey',SCHEMA_VERSION=1;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const integer=(value,fallback,min=0,max=32)=>{const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:fallback};
  const text=(value,fallback='')=>String(value??'').trim()||fallback;
  const primarySettings=()=>({teams:10,scoring:'half',receptions:0.5,startQB:1,startRB:2,startWR:3,startTE:1,flex:2,startK:1,startDST:1,bench:6,irSlots:0,passTD:6,risk:'balanced',strategy:'auto',completionPoint:0.1,firstDownPoint:0.1,bigPlayBonuses:true,enhancedDST:true,customKicker:true});
  const downeySettings=()=>({teams:10,scoring:'full',receptions:1,startQB:1,startRB:1,startWR:2,startTE:1,flex:2,startK:1,startDST:1,bench:6,irSlots:1,passTD:6,risk:'balanced',strategy:'auto',completionPoint:0.1,firstDownPoint:0.1,bigPlayBonuses:true,enhancedDST:true,customKicker:true,scoringDetails:{passingYardsPerPoint:25,passingBonus500:2,interceptions:-2,pickSixThrown:-1,rushingYardsPerPoint:10,rushingBonus200:2,rushingTD:6,receivingYardsPerPoint:10,receivingBonus200:2,receivingTD:6,returnTD:6,twoPointConversion:2,fumblesLost:-2}});
  function normalizeSettings(value={},fallback=primarySettings()){
    const source=object(value)?value:{},base=object(fallback)?fallback:primarySettings(),scoring=['standard','half','full'].includes(source.scoring)?source.scoring:base.scoring;
    const normalized={...clone(base),...clone(source),teams:integer(source.teams,integer(base.teams,10,2),2),scoring,receptions:Number.isFinite(Number(source.receptions))?Number(source.receptions):(scoring==='full'?1:scoring==='half'?0.5:0),startQB:integer(source.startQB,base.startQB,0),startRB:integer(source.startRB,base.startRB,0),startWR:integer(source.startWR,base.startWR,0),startTE:integer(source.startTE,base.startTE,0),flex:integer(source.flex,base.flex,0),startK:integer(source.startK,base.startK,0),startDST:integer(source.startDST,base.startDST,0),bench:integer(source.bench,base.bench,0),irSlots:integer(source.irSlots,base.irSlots??0,0),passTD:[4,6].includes(Number(source.passTD))?Number(source.passTD):Number(base.passTD||6),risk:['safe','balanced','aggressive'].includes(source.risk)?source.risk:(base.risk||'balanced'),strategy:text(source.strategy,base.strategy||'auto')};delete normalized.rosterSlots;return normalized;
  }
  function profileDefaults(now=new Date().toISOString()){
    return [
      {id:PRIMARY_ID,displayName:'Primary League',leagueName:'SQUAAA! ROYAL RUMBLE 2025–2026',platform:'Yahoo',actualTeams:10,maxTeams:10,draftType:'Fantasy HQ Draft',preferredMode:'practice',draftSlot:10,settings:primarySettings(),createdAt:now,updatedAt:now},
      {id:DOWNEY_ID,displayName:'Straight Outta Downey',leagueName:'Straight Outta Downey',platform:'Yahoo',actualTeams:10,maxTeams:12,draftType:'Offline Draft',preferredMode:'live',draftSlot:10,settings:downeySettings(),createdAt:now,updatedAt:now},
    ];
  }
  function normalizeProfile(value,fallback){
    if(!object(value))throw new Error('League profile is invalid.');
    const base=fallback||profileDefaults()[0],id=text(value.id);if(!/^[a-z0-9][a-z0-9-]{1,63}$/i.test(id))throw new Error('League profile ID is invalid.');
    const settings=normalizeSettings(value.settings,base.settings),actualTeams=integer(value.actualTeams,settings.teams,2),now=new Date().toISOString();settings.teams=actualTeams;
    return {id,displayName:text(value.displayName,base.displayName),leagueName:text(value.leagueName,value.displayName||base.leagueName),platform:text(value.platform,base.platform),actualTeams,maxTeams:integer(value.maxTeams,actualTeams,actualTeams),draftType:text(value.draftType,base.draftType),preferredMode:['practice','live','yahoo'].includes(value.preferredMode)?value.preferredMode:base.preferredMode,draftSlot:integer(value.draftSlot,Math.min(actualTeams,base.draftSlot||actualTeams),1,actualTeams),settings,createdAt:value.createdAt||now,updatedAt:value.updatedAt||now};
  }
  const draftKey=id=>`fantasyHQ.leagueProfile.${id}.draft.v1`;
  const archiveKey=id=>`fantasyHQ.leagueProfile.${id}.yahooMocks.v1`;
  const completedArchiveKey=id=>`fantasyHQ.leagueProfile.${id}.completedDrafts.v1`;
  class LeagueProfileStore{
    constructor(storage=root.localStorage,{draftSession=root.DraftSessionV1,now=()=>new Date().toISOString()}={}){this.storage=storage;this.draftSession=draftSession;this.now=now;this.state=null;}
    _read(){const raw=this.storage?.getItem(REGISTRY_KEY);if(!raw)return null;try{const value=JSON.parse(raw);if(!object(value)||value.schemaVersion!==SCHEMA_VERSION||!Array.isArray(value.profiles)||!value.profiles.length)throw new Error('Invalid profile registry.');const defaults=profileDefaults(this.now()),profiles=value.profiles.map(item=>normalizeProfile(item,defaults.find(base=>base.id===item.id)||defaults[0]));if(new Set(profiles.map(item=>item.id)).size!==profiles.length)throw new Error('Duplicate profile IDs.');const activeProfileId=profiles.some(item=>item.id===value.activeProfileId)?value.activeProfileId:profiles[0].id;return {...value,schemaVersion:SCHEMA_VERSION,profiles,activeProfileId};}catch(error){console.warn?.('League profiles were invalid; restoring safe defaults:',error.message);return null;}}
    _write(){this.storage?.setItem(REGISTRY_KEY,JSON.stringify(this.state));return clone(this.state);}
    _legacyDraft(){const raw=this.storage?.getItem(this.draftSession?.STORAGE_KEY||'fantasyHQ.activeDraft.v1');if(!raw)return null;try{return this.draftSession?.validate?this.draftSession.validate(JSON.parse(raw)):JSON.parse(raw);}catch(error){return null;}}
    _migrateLegacy(profiles){const primary=profiles.find(item=>item.id===PRIMARY_ID),legacy=this._legacyDraft(),target=draftKey(PRIMARY_ID);if(legacy){primary.settings=normalizeSettings(legacy.settings,primary.settings);primary.actualTeams=primary.settings.teams;primary.draftSlot=integer(legacy.slot,primary.draftSlot,1,primary.actualTeams);primary.preferredMode=['practice','live','yahoo'].includes(legacy.mode)?legacy.mode:primary.preferredMode;if(!this.storage?.getItem(target))this.storage?.setItem(target,JSON.stringify(legacy));}const oldArchive=this.storage?.getItem('fantasyHQYahooMocks'),newArchive=archiveKey(PRIMARY_ID);if(oldArchive&&!this.storage?.getItem(newArchive)){try{const parsed=JSON.parse(oldArchive);if(Array.isArray(parsed))this.storage?.setItem(newArchive,JSON.stringify(parsed));}catch(error){/* malformed legacy archive remains untouched */}}}
    initialize(){let state=this._read();if(!state){const profiles=profileDefaults(this.now());this._migrateLegacy(profiles);state={schemaVersion:SCHEMA_VERSION,migrationVersion:1,migratedAt:this.now(),activeProfileId:PRIMARY_ID,profiles};this.state=state;return this._write();}this.state=state;return clone(state);}
    _ensure(){if(!this.state)this.initialize();}
    list(){this._ensure();return clone(this.state.profiles);}
    active(){this._ensure();return clone(this.state.profiles.find(item=>item.id===this.state.activeProfileId)||this.state.profiles[0]);}
    get(id){this._ensure();const profile=this.state.profiles.find(item=>item.id===String(id));return profile?clone(profile):null;}
    select(id){this._ensure();if(!this.state.profiles.some(item=>item.id===String(id)))throw new Error('League profile was not found.');this.state.activeProfileId=String(id);this._write();return this.active();}
    create(input={}){this._ensure();const displayName=text(input.displayName,'New League'),stem=displayName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'league';let id=`league-${stem}`,suffix=2;while(this.state.profiles.some(item=>item.id===id))id=`league-${stem}-${suffix++}`;const base=this.active(),now=this.now(),profile=normalizeProfile({...base,...clone(input),displayName,leagueName:text(input.leagueName,displayName),id,createdAt:now,updatedAt:now},base);this.state.profiles.push(profile);this.state.activeProfileId=id;this._write();return clone(profile);}
    rename(id,name){return this.update(id,{displayName:text(name)});}
    update(id,patch={}){this._ensure();const index=this.state.profiles.findIndex(item=>item.id===String(id));if(index<0)throw new Error('League profile was not found.');const current=this.state.profiles[index],next=normalizeProfile({...current,...clone(patch),id:current.id,settings:patch.settings?normalizeSettings(patch.settings,current.settings):current.settings,updatedAt:this.now()},current);this.state.profiles[index]=next;this._write();return clone(next);}
    draftKey(id=this.active().id){return draftKey(id);}
    archiveKey(id=this.active().id){return archiveKey(id);}
    completedArchiveKey(id=this.active().id){return completedArchiveKey(id);}
  }
  const api=Object.freeze({REGISTRY_KEY,PRIMARY_ID,DOWNEY_ID,SCHEMA_VERSION,primarySettings,downeySettings,profileDefaults,normalizeSettings,normalizeProfile,draftKey,archiveKey,completedArchiveKey,LeagueProfileStore});
  root.LeagueProfilesV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
