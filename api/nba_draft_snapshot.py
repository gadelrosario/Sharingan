"""Import a manually captured public 9cat projection page into a private local cache.
No network calls, private endpoints, executable page code, or actual-stat fallback.
"""
import argparse
import hashlib
import json
import math
import re
from datetime import date, datetime, timezone
from pathlib import Path
from html.parser import HTMLParser

SOURCE_URL = 'https://9cat.app/projections/'
FIELDS = ('pts', 'reb', 'ast', 'stl', 'blk', 'threePm', 'to', 'fgm', 'fga', 'ftm', 'fta')


class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.active = False; self.data = []; self.text = []
    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('id') == 'rk-data': self.active = True
    def handle_endtag(self, tag):
        if tag == 'script': self.active = False
    def handle_data(self, data):
        if self.active: self.data.append(data)
        else: self.text.append(data)


def capture(html, season, captured_at=None):
    if len(html) > 5_000_000: raise ValueError('Page too large')
    parser = Page(); parser.feed(html)
    text = ' '.join(parser.text)
    if f'{season}-{str(season+1)[2:]} NBA fantasy projections' not in text:
        raise ValueError('Wrong or unverified projection season')
    updated = re.search(r'Projections updated\s+(\d{4}-\d{2}-\d{2})', text)
    if not updated: raise ValueError('Missing source date')
    day = date.fromisoformat(updated[1])
    if day > date.today() or day.year != season: raise ValueError('Invalid source date')
    rows = json.loads(''.join(parser.data)); result = []; seen = set()
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000: raise ValueError('Invalid source size')
    def number(value):
        if value is None: return None
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError('Invalid numeric evidence')
        return value
    for r in rows:
        pid = r.get('id', '')
        if not re.fullmatch(r'espn-[1-9][0-9]*', pid) or pid in seen: raise ValueError('Duplicate/invalid source identity')
        seen.add(pid)
        if not r.get('name') or not r.get('team') or not r.get('pos'): raise ValueError('Missing identity metadata')
        if any(p not in {'PG','SG','SF','PF','C'} for p in r['pos']): raise ValueError('Invalid position')
        stats = {key: number(r.get('s', {}).get(key)) for key in FIELDS}
        for made, attempts in [('fgm','fga'),('ftm','fta')]:
            if stats[made] is not None and stats[attempts] is not None and stats[made] > stats[attempts]: raise ValueError('Made exceeds attempts')
        result.append({'providerId':pid,'name':r['name'],'team':r['team'],'positions':r['pos'],
                       'sourceRank':number(r.get('pg',{}).get('rank')),'adp':number(r.get('adp')),
                       'games':number(r.get('gp')),'minutes':number(r.get('mpg')),'stats':stats})
    return {'schemaVersion':1,'sport':'nba','season':str(season),'evidenceClass':'PROJECTED_STATS',
            'source':{'name':'9cat.app Projections','url':SOURCE_URL,'sourceDate':day.isoformat(),
                      'capturedAt':captured_at or datetime.now(timezone.utc).isoformat(),
                      'sha256':hashlib.sha256(html.encode()).hexdigest(),
                      'basis':'PER_GAME','adpSource':'9cat public ADP; market/sample unspecified',
                      'usage':'Private local draft snapshot; not a redistribution license'},'records':result}


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--html',type=Path,required=True); p.add_argument('--season',type=int,required=True)
    p.add_argument('--output',type=Path,required=True); a=p.parse_args()
    data=capture(a.html.read_text(),a.season)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    temporary=a.output.with_suffix('.tmp'); temporary.write_text(json.dumps(data,allow_nan=False)); temporary.replace(a.output)
    print(f"Accepted {len(data['records'])} projected records; source date {data['source']['sourceDate']}")
