import csv, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database" / "fantasyhq.db"
OUT = ROOT / "database" / "player_master_export.csv"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
rows = conn.execute("""
SELECT
 p.id AS player_id, p.canonical_key, p.full_name, p.position, p.nfl_team,
 MAX(CASE WHEN rs.source_key='bdge' THEN er.position_rank END) AS bdge_rank,
 MAX(CASE WHEN rs.source_key='bdge' THEN er.tier END) AS bdge_tier,
 MAX(CASE WHEN rs.source_key='flock' THEN er.position_rank END) AS flock_rank,
 MAX(CASE WHEN rs.source_key='flock' THEN er.tier END) AS flock_tier,
 MAX(CASE WHEN rs2.source_key='sleeper' THEN ma.adp END) AS sleeper_adp,
 MAX(CASE WHEN rs2.source_key='yahoo' THEN ma.adp END) AS yahoo_adp,
 MAX(CASE WHEN rs2.source_key='consensus' THEN ma.adp END) AS consensus_adp,
 hs.hq_grade, hs.expert_agreement
FROM players p
LEFT JOIN expert_rankings er ON er.player_id=p.id AND er.season=2026
LEFT JOIN ranking_sources rs ON rs.id=er.source_id
LEFT JOIN market_adp ma ON ma.player_id=p.id AND ma.season=2026
LEFT JOIN ranking_sources rs2 ON rs2.id=ma.source_id
LEFT JOIN hq_scores hs ON hs.player_id=p.id AND hs.season=2026 AND hs.model_version='v1-expert-only'
GROUP BY p.id
ORDER BY p.position, COALESCE(hs.hq_grade,0) DESC, p.full_name
""").fetchall()

with OUT.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else [])
    writer.writeheader()
    writer.writerows(dict(r) for r in rows)

print(OUT)
