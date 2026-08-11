"""Immutable ranking snapshot import, validation, differential, and guarded promotion."""
from __future__ import annotations
import argparse, json, subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RANKINGS=ROOT/'data'/'rankings'
ACTIVE=RANKINGS/'ACTIVE_SNAPSHOT.json'
TIERS=set('SABCDEFGHIJKLMNO')|{'DST'}

def normalize(players, source, snapshot_date):
    records=[]
    for player in players:
        rank=player.get('fantasylandOverallRank')
        records.append({'playerId':str(player['id']),'source':source,'snapshotDate':snapshot_date,'overallRank':rank,'overallTier':player.get('fantasylandOverallTier') or player.get('overallTier'),'position':player.get('pos'),'positionRank':player.get('fantasylandPositionRank'),'positionTier':player.get('fantasylandPositionTier') or player.get('posTier'),'sourceTeam':player.get('fantasylandSourceTeam'),'provenance':{'canonicalKey':player.get('canonicalKey'),'importedFrom':'data/players.json'},'importStatus':'MATCHED'})
    return {'schemaVersion':'1.0','source':source,'snapshotDate':snapshot_date,'createdAt':datetime.now(timezone.utc).isoformat(),'immutable':True,'records':records}

def validate(snapshot):
    errors=[]; ids=set(); ranks=set()
    if snapshot.get('schemaVersion')!='1.0': errors.append('unsupported schemaVersion')
    if not snapshot.get('immutable'): errors.append('snapshot must be immutable')
    for index,row in enumerate(snapshot.get('records') or []):
        pid=str(row.get('playerId') or '')
        if not pid or pid in ids: errors.append(f'row {index}: missing/duplicate stable playerId')
        ids.add(pid); rank=row.get('overallRank')
        if rank is not None:
            if not isinstance(rank,int) or rank<1: errors.append(f'{pid}: invalid overallRank')
            elif rank in ranks: errors.append(f'{pid}: duplicate overallRank {rank}')
            ranks.add(rank)
        tier=row.get('overallTier')
        if tier is not None and str(tier).upper() not in TIERS: errors.append(f'{pid}: invalid overallTier {tier}')
    return errors

def differential(old,new):
    old_rows={str(r['playerId']):r for r in old.get('records',[]) if r.get('playerId')}; new_rows={str(r['playerId']):r for r in new.get('records',[]) if r.get('playerId')}; changed=[]
    for pid in sorted(set(old_rows)&set(new_rows),key=lambda value:int(value) if value.isdigit() else value):
        before,after=old_rows[pid],new_rows[pid]; fields={key:{'old':before.get(key),'new':after.get(key)} for key in ('overallRank','overallTier','positionRank','positionTier') if before.get(key)!=after.get(key)}
        if fields: changed.append({'playerId':pid,'changes':fields})
    def membership(limit, rows): return {pid for pid,row in rows.items() if isinstance(row.get('overallRank'),int) and row['overallRank']<=limit}
    return {'changedPlayers':changed,'rankChanges':sum('overallRank' in row['changes'] for row in changed),'tierChanges':sum('overallTier' in row['changes'] for row in changed),'positionRankChanges':sum('positionRank' in row['changes'] for row in changed),'positionTierChanges':sum('positionTier' in row['changes'] for row in changed),'top25Changes':len(membership(25,old_rows)^membership(25,new_rows)),'top50Changes':len(membership(50,old_rows)^membership(50,new_rows)),'top100Changes':len(membership(100,old_rows)^membership(100,new_rows))}

def run_canaries(snapshot_path, previous_path=None):
    command=['node','tests/data-update-canary-tests.js',str(snapshot_path)]
    if previous_path: command.append(str(previous_path))
    result=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
    try: details=json.loads(result.stdout)
    except json.JSONDecodeError: details=None
    return {'passed':result.returncode==0,'details':details,'output':result.stdout.strip(),'error':result.stderr.strip()}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--players',default=ROOT/'data'/'players.json',type=Path);parser.add_argument('--snapshot-date',required=True);parser.add_argument('--source',default='Fantasyland');parser.add_argument('--candidate',type=Path);parser.add_argument('--promote',action='store_true');args=parser.parse_args()
    RANKINGS.mkdir(parents=True,exist_ok=True); candidate=args.candidate or RANKINGS/f"fantasyland_{args.snapshot_date}.normalized.json"
    if not candidate.exists(): candidate.write_text(json.dumps(normalize(json.loads(args.players.read_text()),args.source,args.snapshot_date),indent=2)+'\n')
    snapshot=json.loads(candidate.read_text());errors=validate(snapshot);active_config=json.loads(ACTIVE.read_text()) if ACTIVE.exists() else None;old_path=RANKINGS/active_config['activeSnapshot'] if active_config else None;old=json.loads(old_path.read_text()) if old_path and old_path.exists() else {'records':[]};diff=differential(old,snapshot);comparison_path=old_path if old_path and old_path.resolve()!=candidate.resolve() else None;canaries=run_canaries(candidate,comparison_path) if not errors else {'passed':False,'details':None,'output':'','error':'validation failed'};promoted=False
    if args.promote and not errors and canaries['passed']:
        ACTIVE.write_text(json.dumps({'schemaVersion':'1.0','activeSnapshot':candidate.name,'promotedAt':datetime.now(timezone.utc).isoformat(),'source':args.source,'snapshotDate':args.snapshot_date},indent=2)+'\n');promoted=True
    report={'snapshot':str(candidate.relative_to(ROOT)),'rows':len(snapshot.get('records',[])),'matched':sum(r.get('importStatus')=='MATCHED' for r in snapshot.get('records',[])),'unmatched':sum(r.get('importStatus')=='UNMATCHED' for r in snapshot.get('records',[])),'ambiguous':sum(r.get('importStatus')=='AMBIGUOUS' for r in snapshot.get('records',[])),'validationErrors':errors,'differential':diff,'recommendationDifferential':canaries.get('details',{}).get('recommendationDiff') if canaries.get('details') else None,'canaries':canaries,'promotionStatus':'PROMOTED' if promoted else 'BLOCKED' if errors or not canaries['passed'] else 'SAFE_NOT_PROMOTED'}
    report_path=ROOT/'outputs'/'player_audit'/f"ranking_update_{args.snapshot_date}.json";report_path.parent.mkdir(parents=True,exist_ok=True);report_path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return 0 if not errors and canaries['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
