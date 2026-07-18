from __future__ import annotations
import json
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database" / "fantasyhq.db"

def query(sql, params=()):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()

class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if parsed.path == "/health":
            return self.send_json({"status":"ok","database":str(DB)})

        if parsed.path == "/players":
            position = qs.get("position", [None])[0]
            search = qs.get("search", [None])[0]
            limit = min(int(qs.get("limit", ["100"])[0]), 500)
            sql = """
            SELECT p.*, hs.hq_grade, hs.expert_agreement
            FROM players p
            LEFT JOIN hq_scores hs ON hs.player_id=p.id AND hs.season=2026
            WHERE (? IS NULL OR p.position=?)
              AND (? IS NULL OR p.full_name LIKE '%' || ? || '%')
            ORDER BY COALESCE(hs.hq_grade,0) DESC, p.full_name
            LIMIT ?
            """
            return self.send_json(query(sql, (position,position,search,search,limit)))

        if parsed.path.startswith("/players/"):
            player_id = parsed.path.split("/")[-1]
            player = query("SELECT * FROM players WHERE id=?", (player_id,))
            if not player:
                return self.send_json({"error":"player not found"}, 404)
            rankings = query("""
                SELECT rs.source_key, er.* FROM expert_rankings er
                JOIN ranking_sources rs ON rs.id=er.source_id
                WHERE er.player_id=? ORDER BY rs.source_key
            """, (player_id,))
            adp = query("""
                SELECT rs.source_key, ma.* FROM market_adp ma
                JOIN ranking_sources rs ON rs.id=ma.source_id
                WHERE ma.player_id=? ORDER BY rs.source_key
            """, (player_id,))
            return self.send_json({"player":player[0],"rankings":rankings,"market_adp":adp})

        if parsed.path == "/recommendations":
            limit = min(int(qs.get("limit", ["3"])[0]), 10)
            drafted = set(qs.get("drafted", []))
            rows = query("""
                SELECT p.id,p.full_name,p.position,p.nfl_team,
                       hs.hq_grade,hs.expert_agreement,
                       MAX(CASE WHEN rs.source_key='bdge' THEN er.position_rank END) AS bdge_rank,
                       MAX(CASE WHEN rs.source_key='bdge' THEN er.tier END) AS bdge_tier,
                       MAX(CASE WHEN rs.source_key='flock' THEN er.position_rank END) AS flock_rank,
                       MAX(CASE WHEN rs.source_key='flock' THEN er.tier END) AS flock_tier
                FROM players p
                LEFT JOIN hq_scores hs ON hs.player_id=p.id AND hs.season=2026
                LEFT JOIN expert_rankings er ON er.player_id=p.id AND er.season=2026
                LEFT JOIN ranking_sources rs ON rs.id=er.source_id
                GROUP BY p.id
                ORDER BY COALESCE(hs.hq_grade,0) DESC
            """)
            available = [r for r in rows if str(r["id"]) not in drafted][:limit]
            return self.send_json({"recommendations":available,"calculation_ms_target":"<1000"})

        return self.send_json({
            "name":"Fantasy HQ Backend V1",
            "endpoints":["/health","/players","/players/{id}","/recommendations"]
        })

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    print("Fantasy HQ API: http://127.0.0.1:8765")
    print("Health check:  http://127.0.0.1:8765/health")
    server.serve_forever()
